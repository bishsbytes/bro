import { useEffect } from "react";
import { AppState } from "react-native";
import { healthImportEngine } from "./import-service";

export function HealthImportEffects() {
	useEffect(() => {
		void healthImportEngine.refresh().catch(() => undefined);
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				void healthImportEngine.refresh().catch(() => undefined);
			}
		});
		return () => subscription.remove();
	}, []);

	return null;
}
