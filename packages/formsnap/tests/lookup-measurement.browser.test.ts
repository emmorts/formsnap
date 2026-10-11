import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import { superValidate, type SuperValidated } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { z } from "zod/v3";
import LookupMeasurement from "./fixtures/lookup-measurement.svelte";

// Temporary before/after evidence only. Keep this exact workload on both revisions;
// no timing assertions, implementation assertions, or benchmark dependencies.
const LOG_PREFIX = "FORMSNAP_LOOKUP_MEASUREMENT ";
const WARMUP_MOUNTS = 2;
const MEASURED_MOUNTS = 9;
const UPDATES_PER_MOUNT = 30;
interface MountedMeasurement {
	updateField(step: number): void;
}

interface RenderedMetadata {
	errors: string[];
	constraints: Record<string, unknown>;
	tainted: string | null;
}

let mounted: MountedMeasurement | undefined;

async function cleanup() {
	if (mounted) await unmount(mounted);
	mounted = undefined;
	document.body.innerHTML = "";
}

afterEach(cleanup);

function median(samples: number[]) {
	const ordered = [...samples].sort((a, b) => a - b);
	const middle = Math.floor(ordered.length / 2);
	return ordered.length % 2 === 0
		? (ordered[middle - 1]! + ordered[middle]!) / 2
		: ordered[middle]!;
}

function received(name: string): RenderedMetadata {
	const output = document.querySelector(`output[data-field="${name}"]`);
	expect(output, `rendered metadata for ${name}`).not.toBeNull();
	return {
		errors: JSON.parse(output!.getAttribute("data-errors")!) as string[],
		constraints: JSON.parse(output!.getAttribute("data-constraints")!) as Record<
			string,
			unknown
		>,
		tainted: output!.getAttribute("data-tainted"),
	};
}

function checkInitial(names: string[]) {
	expect(document.querySelectorAll("output[data-field]")).toHaveLength(names.length);
	return names.map((name) => {
		const metadata = received(name);
		expect(metadata.errors.length).toBeGreaterThan(0);
		expect(metadata.constraints).toMatchObject({
			minlength: 2,
			maxlength: 100,
			required: true,
		});
		expect(metadata.tainted).toBe("true");
		return metadata;
	});
}

function checkUpdate(names: string[], initial: RenderedMetadata[], step: number) {
	expect(received(names[0]!)).toEqual({
		errors: [`updated-${names[0]}-${step}`],
		constraints: { ...initial[0]!.constraints, minlength: 2 + (step % 2) },
		tainted: String(step % 2 === 0),
	});
	expect(received(names[1]!)).toEqual(initial[1]);
}

function checkSiblings(names: string[], initial: RenderedMetadata[]) {
	for (let index = 1; index < names.length; index++) {
		expect(received(names[index]!)).toEqual(initial[index]);
	}
}

function mountFixture(validated: SuperValidated<Record<string, string>>, names: string[]) {
	mounted = mount(LookupMeasurement, { target: document.body, props: { validated, names } });
	flushSync();
}

function updateFixture(step: number) {
	mounted!.updateField(step);
	flushSync();
}

async function sample(
	validated: SuperValidated<Record<string, string>>,
	names: string[],
	timed: boolean
) {
	const mountStart = timed ? performance.now() : 0;
	mountFixture(validated, names);
	const mountMs = timed ? performance.now() - mountStart : 0;
	const initial = checkInitial(names);
	const updateMs: number[] = [];
	for (let step = 1; step <= UPDATES_PER_MOUNT; step++) {
		const updateStart = timed ? performance.now() : 0;
		updateFixture(step);
		if (timed) updateMs.push(performance.now() - updateStart);
		// Assertions and DOM reads stay outside every timed interval.
		checkUpdate(names, initial, step);
	}
	checkSiblings(names, initial);
	await cleanup();
	return { mountMs, updateMs };
}

function instrument(validated: SuperValidated<Record<string, string>>, names: string[]) {
	const emptyCounters = {
		cloneCalls: 0,
		objectInputs: 0,
		arrayInputs: 0,
		otherInputs: 0,
		aggregateRootKeys: 0,
		aggregateJsonCharacters: 0,
		maxJsonCharacters: 0,
		wholeFormShapedInputs: 0,
		wholeFormJsonCharacters: 0,
		unserializableInputs: 0,
	};
	const counts = { mount: { ...emptyCounters }, updates: { ...emptyCounters } };
	let active = counts.mount;
	const original = globalThis.structuredClone;
	globalThis.structuredClone = function <T>(value: T, options?: StructuredSerializeOptions): T {
		active.cloneCalls++;
		const objectInput = value !== null && typeof value === "object";
		if (Array.isArray(value)) active.arrayInputs++;
		else if (objectInput) active.objectInputs++;
		else active.otherInputs++;
		if (objectInput) active.aggregateRootKeys += Object.keys(value).length;
		const wholeForm = objectInput && names.every((name) => Object.hasOwn(value, name));
		if (wholeForm) active.wholeFormShapedInputs++;
		try {
			// Serialized character counts are payload-shape evidence, not heap bytes.
			const characters = JSON.stringify(value)?.length ?? 0;
			active.aggregateJsonCharacters += characters;
			active.maxJsonCharacters = Math.max(active.maxJsonCharacters, characters);
			if (wholeForm) active.wholeFormJsonCharacters += characters;
		} catch {
			active.unserializableInputs++;
		}
		return original(value, options);
	};
	try {
		mountFixture(validated, names);
		const initial = checkInitial(names);
		active = counts.updates;
		for (let step = 1; step <= UPDATES_PER_MOUNT; step++) {
			updateFixture(step);
			checkUpdate(names, initial, step);
		}
		checkSiblings(names, initial);
	} finally {
		globalThis.structuredClone = original;
	}
	return counts;
}

describe("temporary real-store field metadata measurement", () => {
	for (const fieldCount of [10, 200]) {
		it(`reports ${fieldCount}-field mount and ordinary metadata-update measurements`, async () => {
			const names = Array.from({ length: fieldCount }, (_, index) => `field_${index}`);
			const schema = z.object(
				Object.fromEntries(names.map((name) => [name, z.string().min(2).max(100)]))
			);
			const invalidData = Object.fromEntries(names.map((name) => [name, ""]));
			// Validation/schema preparation is excluded; every mount gets independent real data.
			const prepare = () => superValidate(invalidData, zod(schema));
			for (let index = 0; index < WARMUP_MOUNTS; index++) {
				await sample(await prepare(), names, false);
			}

			const mountSamples: number[] = [];
			const allUpdateSamples: number[] = [];
			const updateMediansPerMount: number[] = [];
			for (let index = 0; index < MEASURED_MOUNTS; index++) {
				const result = await sample(await prepare(), names, true);
				mountSamples.push(result.mountMs);
				allUpdateSamples.push(...result.updateMs);
				updateMediansPerMount.push(median(result.updateMs));
			}

			// Separate untimed pass: payload inspection must not affect the timings above.
			const cloneCounts = instrument(await prepare(), names);
			await cleanup();
			console.log(
				LOG_PREFIX +
					JSON.stringify({
						protocol: 1,
						scenario: `flat-fields-${fieldCount}`,
						workload: {
							fieldCount,
							metadataPerField: ["errors", "constraints", "tainted"],
							changedField: names[0],
							storesUpdatedPerStep: 3,
							errorsUpdateForce: true,
							warmupMounts: WARMUP_MOUNTS,
							measuredMounts: MEASURED_MOUNTS,
							updatesPerMount: UPDATES_PER_MOUNT,
							measuredUpdates: allUpdateSamples.length,
							instrumentedMounts: 1,
							instrumentedUpdates: UPDATES_PER_MOUNT,
						},
						timing: {
							unit: "milliseconds",
							mountMedian: median(mountSamples),
							updateMedian: median(allUpdateSamples),
							mountSamples,
							updateMediansPerMount,
						},
						structuredClone: cloneCounts,
						caveats: [
							"Mount includes superForm creation, initial taint population, Field creation and flushSync.",
							"Updates mutate one field in three real metadata stores then flushSync; no validation, input events or layout measurement.",
							"Errors use the public force option so same-object updates do not invoke Superforms' clear-and-reconcile behavior.",
							"DOM metadata serialization/rendering is included; assertions, validation preparation and unmount are excluded.",
							"Clone counts cover all synchronous platform structuredClone calls, including Superforms, not only Formsnap.",
							"Whole-form shape means an object owning every field key; JSON character counts are not allocation bytes.",
							"Wall times depend on browser, CI load, timer precision and garbage collection; compare identical workloads and environments.",
						],
					})
			);
		}, 60_000);
	}
});
