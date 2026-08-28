import { UnsupportedHealthGateway } from "./gateway";

/** Web uses the inert implementation because native health APIs are unavailable. */
export function createPlatformHealthGateway() {
	return new UnsupportedHealthGateway();
}
