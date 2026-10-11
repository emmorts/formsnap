<script lang="ts">
	import { resolve } from "$app/paths";
	import { site } from "$lib/config";
</script>

<footer class="border-line mt-auto border-t">
	<div
		class="text-fg-muted mx-auto flex max-w-[90rem] flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
	>
		<p>
			<span class="font-display text-fg font-semibold"
				>form<span class="text-accent">snap</span></span
			>
			— maintained fork of
			<a
				href="https://github.com/svecosystem/formsnap"
				target="_blank"
				rel="noreferrer"
				class="decoration-line-strong hover:text-fg underline underline-offset-2"
			>
				svecosystem/formsnap</a
			>. MIT licensed.
		</p>
		<nav aria-label="Footer" class="flex gap-5">
			<a href={resolve("/docs")} class="hover:text-fg">Docs</a>
			<a href={resolve("/changelog")} class="hover:text-fg">Changelog</a>
			<!-- Absolute external URL: resolve() applies to app routes, not to this. -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a href={site.repoUrl} target="_blank" rel="noreferrer" class="hover:text-fg">GitHub</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</nav>
	</div>
</footer>
