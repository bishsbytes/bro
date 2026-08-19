import { UnsupportedHealthGateway } from "./gateway";
import { HealthImportEngine } from "./import-engine";
import { createPlatformHealthGateway } from "./platform-gateway";

export const healthImportEngine = new HealthImportEngine({
	gateway:
		process.env.NODE_ENV === "test"
			? new UnsupportedHealthGateway()
			: createPlatformHealthGateway(),
});
