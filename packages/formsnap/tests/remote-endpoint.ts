/**
 * The enhanced remote-form transport posts to the app's remote endpoint, not to the page URL, which
 * is why a recipe test cannot wait for a response on its own route.
 *
 * Shared by the remote recipe tests so every one of them matches the same request.
 */
export function isRemoteEndpointRequest(response: {
	url(): string;
	request(): { method(): string };
}) {
	return response.request().method() === "POST" && /\/_app\/remote\//.test(response.url());
}
