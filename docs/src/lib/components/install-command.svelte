<script lang="ts">
	const managers = [
		{ id: "pnpm", command: "pnpm add @emmorts/formsnap sveltekit-superforms zod" },
		{ id: "npm", command: "npm install @emmorts/formsnap sveltekit-superforms zod" },
		{ id: "yarn", command: "yarn add @emmorts/formsnap sveltekit-superforms zod" },
		{ id: "bun", command: "bun add @emmorts/formsnap sveltekit-superforms zod" },
	] as const;

	let active = $state<(typeof managers)[number]["id"]>("pnpm");
	let copied = $state(false);

	async function copy() {
		const command = managers.find((m) => m.id === active)?.command ?? "";
		try {
			await navigator.clipboard.writeText(command);
		} catch {
			return;
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="border-line bg-surface-raised overflow-hidden rounded-xl border">
	<div class="border-line flex items-center justify-between border-b pr-2" role="presentation">
		<div class="flex" role="tablist" aria-label="Package manager">
			{#each managers as manager (manager.id)}
				<button
					type="button"
					role="tab"
					aria-selected={active === manager.id}
					onclick={() => (active = manager.id)}
					class={[
						"border-b-2 px-3 py-2 font-mono text-xs transition-colors",
						active === manager.id
							? "border-accent text-fg"
							: "text-fg-subtle hover:text-fg-muted border-transparent",
					]}
				>
					{manager.id}
				</button>
			{/each}
		</div>
		<button
			type="button"
			onclick={copy}
			class={[
				"rounded-md border px-2 py-1 text-xs font-medium transition-colors",
				copied
					? "border-mint-400 text-mint-400"
					: "border-line text-fg-muted hover:border-line-strong hover:text-fg",
			]}
		>
			{copied ? "Copied" : "Copy"}
		</button>
	</div>
	<div class="overflow-x-auto px-4 py-3.5">
		<code class="text-fg font-mono text-[0.8125rem] whitespace-nowrap">
			<span class="text-fg-subtle select-none">$ </span>{managers.find((m) => m.id === active)
				?.command}
		</code>
	</div>
</div>
