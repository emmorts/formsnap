import { inject } from "vitest";

declare module "vitest" {
	interface ProvidedContext {
		fixtureUrl: string;
	}
}

export function fixtureUrl() {
	return inject("fixtureUrl");
}
