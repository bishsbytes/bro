import { UnsupportedHealthGateway } from "./gateway";
import { createPlatformHealthGateway } from "./platform-gateway.web";

describe("web health platform gateway", () => {
	it("creates the unsupported gateway without resolving back to itself", () => {
		expect(createPlatformHealthGateway()).toBeInstanceOf(
			UnsupportedHealthGateway,
		);
	});
});
