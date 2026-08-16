import { UnsupportedHealthGateway } from "./gateway";

/** Jest, web, and any unsupported native platform use the inert implementation. */
export function createPlatformHealthGateway() {
	return new UnsupportedHealthGateway();
}
