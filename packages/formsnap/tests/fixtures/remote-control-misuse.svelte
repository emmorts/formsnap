<script lang="ts">
	import { Control } from "$lib/index.js";
	import { Label, RemoteField } from "$lib/remote/index.js";
	import type { RemoteIssue } from "$lib/remote/index.js";

	const handle = {
		value: () => "value",
		touched: () => false,
		dirty: () => false,
		issues: (): RemoteIssue[] | undefined => undefined,
	};
</script>

<!-- Presenting a remote field with the Superforms `Control` must fail descriptively rather than
	emit a second name or an aria-invalid that Kit owns. -->
<RemoteField field={handle}>
	<Control>
		{#snippet children({ props })}
			<Label>Handle</Label>
			<input data-misuse-control {...props} />
		{/snippet}
	</Control>
</RemoteField>
