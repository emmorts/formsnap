// Components available to markdown pages. Import what a page needs:
//
//   <script>
//     import { Callout } from "$lib/markdown";
//   </script>
//
// mdsvex renders block-level HTML as raw nodes, so layout-module exports are not rewritten
// to layout imports — pages must import the components they use explicitly.
export { default as Callout } from "$lib/components/callout.svelte";
