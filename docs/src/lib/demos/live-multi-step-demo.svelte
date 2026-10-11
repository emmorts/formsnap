<script lang="ts">
	import { resolve } from "$app/paths";
	import MultiStepForm from "$multiStepRecipe/multi-step-form.svelte";
	import {
		demoBoxClass,
		errorClass,
		fieldClass,
		hintClass,
		inputClass,
		labelClass,
		secondaryButtonClass,
		submitClass,
	} from "./input-classes";
</script>

<div class={demoBoxClass}>
	<MultiStepForm
		clientOnly
		restartHref={resolve("/docs/recipes/multi-step")}
		styles={{
			form: "flex flex-col gap-4 [&_section:not([hidden])]:flex [&_section:not([hidden])]:flex-col [&_section]:gap-4 [&_h2]:text-base [&_h2]:font-semibold [&_summary]:cursor-pointer [&_dl]:text-sm [&_dd]:mb-2 [&_dt]:font-medium [&_button]:mr-2",
			field: fieldClass,
			input: inputClass,
			label: labelClass,
			hint: hintClass,
			error: errorClass,
			button: submitClass,
			secondary: secondaryButtonClass,
		}}
	/>
</div>
