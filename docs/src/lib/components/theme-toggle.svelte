<script lang="ts">
	import { initTheme, getTheme, toggleTheme } from "$lib/theme.svelte";
	import Icon from "./icon.svelte";
	import { onMount } from "svelte";

	onMount(initTheme);
</script>

<button
	type="button"
	onclick={toggleTheme}
	aria-label={getTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme"}
	aria-pressed={getTheme() === "dark"}
	class="border-line text-fg-muted hover:border-line-strong hover:text-fg inline-flex size-9 items-center justify-center rounded-lg border transition-colors"
>
	<Icon name={getTheme() === "dark" ? "sun" : "moon"} class="size-4" />
</button>
