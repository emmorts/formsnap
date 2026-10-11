import { highlightCode } from "$lib/highlight.server";

const sample = `<Field {form} name="email" fieldErrors>
  <Control>
    {#snippet children({ props })}
      <Label>Email</Label>
      <input {...props} bind:value={$formData.email} />
    {/snippet}
  </Control>
  {#snippet description()}
    We'll email you about your account.
  {/snippet}
</Field>`;

export const load = async () => {
	return { sampleHtml: await highlightCode(sample, "svelte") };
};
