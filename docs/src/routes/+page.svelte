<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/config";
	import Icon from "$lib/components/icon.svelte";
	import InstallCommand from "$lib/components/install-command.svelte";
	import DemoForm from "$lib/components/demo-form.svelte";

	let { data } = $props();

	const features = [
		{
			title: "Accessible by default",
			body: "Labels associate themselves, descriptions and errors wire up aria-describedby, and error regions announce only while errors exist.",
		},
		{
			title: "Type-safe field paths",
			body: "Field names are checked against your schema's type. Rename a property and the compiler finds every field that referenced it.",
		},
		{
			title: "SSR-safe identity",
			body: "Generated IDs are stable between server rendering and hydration. Nothing backpatches the DOM after first paint.",
		},
		{
			title: "Headless and composable",
			body: "Render props hand you the wiring, never the markup. Bring your own design system, or none at all.",
		},
		{
			title: "Superforms-native",
			body: "Loading, validation, enhance and actions stay exactly as Superforms documents them. Formsnap never wraps the data layer.",
		},
		{
			title: "Svelte 5 runes",
			body: "Built on snippets and runes — child, description and fieldErrors slots compose without prop drilling.",
		},
	];
</script>

<div class="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-8">
	<!-- Hero -->
	<section
		class="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16"
		aria-labelledby="hero-title"
	>
		<div class="min-w-0">
			<p
				class="border-line bg-surface-raised text-fg-muted mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
			>
				<span class="bg-accent size-1.5 rounded-full"></span>
				Maintained fork · Svelte 5 · Superforms 2 &amp; 3
			</p>
			<h1
				id="hero-title"
				class="font-display text-fg text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]"
			>
				Forms that <span class="text-accent">snap</span> into place.
			</h1>
			<p class="text-fg-muted mt-5 max-w-xl text-lg leading-relaxed">
				{site.description} You write the markup; Formsnap connects every label, description and
				error message for you.
			</p>
			<div class="mt-8 max-w-md">
				<InstallCommand />
			</div>
			<div class="mt-8 flex flex-wrap items-center gap-3">
				<a
					href={resolve("/docs/quickstart")}
					class="bg-accent text-accent-contrast inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
				>
					Get started
					<Icon name="arrow-right" class="size-4" />
				</a>
				<a
					href={resolve("/docs")}
					class="border-line text-fg hover:border-line-strong inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
				>
					Read the docs
				</a>
			</div>
		</div>

		<div class="min-w-0 lg:pl-4">
			<p class="text-fg-subtle mb-3 text-xs font-medium uppercase tracking-wider">
				Try it — this form is live
			</p>
			<DemoForm />
			<p class="text-fg-subtle mt-3 text-xs leading-relaxed">
				Built with Field, Control and Label. Submit empty to see validation; inspect the DOM
				to see the aria wiring.
			</p>
		</div>
	</section>

	<!-- Features -->
	<section aria-labelledby="features-title" class="border-line border-t py-16">
		<h2 id="features-title" class="font-display text-fg text-2xl font-semibold tracking-tight">
			Everything a form needs, nothing it doesn't
		</h2>
		<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each features as feature (feature.title)}
				<div class="border-line bg-surface-raised rounded-xl border p-5">
					<h3 class="font-display text-fg text-base font-semibold">{feature.title}</h3>
					<p class="text-fg-muted mt-2 text-sm leading-relaxed">{feature.body}</p>
				</div>
			{/each}
		</div>
	</section>

	<!-- How it reads -->
	<section aria-labelledby="code-title" class="border-line border-t py-16">
		<div class="grid items-center gap-10 lg:grid-cols-2">
			<div class="min-w-0">
				<h2
					id="code-title"
					class="font-display text-fg text-2xl font-semibold tracking-tight"
				>
					The wiring you never write
				</h2>
				<p class="text-fg-muted mt-4 leading-relaxed">
					A <code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>Field</code
					>
					knows its schema path. The
					<code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>Control</code
					>
					snippet receives props with
					<code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>id</code
					>,
					<code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>name</code
					>,
					<code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>aria-invalid</code
					>
					and
					<code
						class="border-line bg-surface-raised text-fg rounded border px-1.5 py-0.5 font-mono text-[0.8125em]"
						>aria-describedby</code
					>
					already set — spread them onto any element you like.
				</p>
				<a
					href={resolve("/docs/components/field")}
					class="text-accent hover:text-accent-strong mt-5 inline-flex items-center gap-1.5 text-sm font-medium"
				>
					Explore the components
					<Icon name="arrow-right" class="size-3.5" />
				</a>
			</div>
			<div class="code-block min-w-0">
				<div class="code-header"><span>settings-form.svelte</span></div>
				<!-- Shiki output for a string literal defined in +page.server.ts, never user input. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html data.sampleHtml}
			</div>
		</div>
	</section>
</div>
