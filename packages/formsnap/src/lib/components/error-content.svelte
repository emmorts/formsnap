<script lang="ts">
	let { errors, errorProps }: { errors: string[]; errorProps: Record<string, unknown> } =
		$props();
</script>

{#each errors as error, i (i)}
	<div {...errorProps}>{error}</div>
{/each}
