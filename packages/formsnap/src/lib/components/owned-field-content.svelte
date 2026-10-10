<script lang="ts">
	import type { OwnedFieldContentProps } from "./types.js";
	import {
		getDescriptionProps,
		getErrorProps,
		getFieldErrorsProps,
	} from "$lib/internal/utils/attributes.js";
	import ErrorContent from "./error-content.svelte";

	let {
		description,
		fieldErrors,
		descriptionId,
		fieldErrorsId,
		fieldErrorsLive,
		errors,
	}: OwnedFieldContentProps & {
		descriptionId: string;
		fieldErrorsId: string;
		errors: string[];
	} = $props();

	const errorProps = $derived(getErrorProps(errors));
</script>

{#if description}
	<div {...getDescriptionProps(descriptionId, errors)}>
		{@render description()}
	</div>
{/if}
{#if fieldErrors}
	<div {...getFieldErrorsProps(fieldErrorsId, errors, fieldErrorsLive)}>
		{#if fieldErrors === true}
			<ErrorContent {errors} {errorProps} />
		{:else}
			{@render fieldErrors({ errors, errorProps })}
		{/if}
	</div>
{/if}
