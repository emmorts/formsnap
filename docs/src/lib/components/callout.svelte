<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon from "./icon.svelte";

	type CalloutType = "note" | "tip" | "warning";

	const labels = { note: "Note", tip: "Tip", warning: "Warning" } as const;
	const iconNames = { note: "info", tip: "tip", warning: "warning" } as const;

	let { type = "note", children }: { type?: CalloutType; children?: Snippet } = $props();
</script>

<aside class="callout callout--{type}">
	<div class="callout-label">
		<Icon name={iconNames[type]} class="size-4" />
		<span>{labels[type]}</span>
	</div>
	<div class="callout-body">
		{@render children?.()}
	</div>
</aside>

<style>
	.callout {
		margin: 1.25rem 0;
		border-radius: 0.625rem;
		border: 1px solid var(--color-line);
		border-left-width: 3px;
		padding: 0.875rem 1rem;
		background-color: var(--color-surface-raised);
	}

	.callout--note {
		border-left-color: var(--color-accent);
	}
	.callout--tip {
		border-left-color: var(--color-mint-400);
	}
	.callout--warning {
		border-left-color: var(--color-amber-400);
	}

	.callout-label {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.callout--note .callout-label {
		color: var(--color-accent);
	}
	.callout--tip .callout-label {
		color: var(--color-mint-400);
	}
	.callout--warning .callout-label {
		color: var(--color-amber-400);
	}

	.callout-body {
		margin-top: 0.375rem;
		font-size: 0.875rem;
		line-height: 1.65;
	}

	.callout-body :global(p) {
		margin: 0;
	}

	.callout-body :global(p + p) {
		margin-top: 0.5rem;
	}
</style>
