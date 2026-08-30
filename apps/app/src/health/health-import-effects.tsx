import { useEffect } from "react";
import { AppState } from "react-native";
import { deferBackgroundWork } from "../lib/defer-background-work";
import { healthImportEngine } from "./import-service";

export function HealthImportEffects() {
	useEffect(() => {
		// Android brings the app and its tab bar back together, and importing is
		// upkeep nothing on screen waits for. Running it straight off the
		// foreground event would put its work ahead of the user's first tap.
		const start = () =>
			deferBackgroundWork(() => {
				void healthImportEngine.refresh().catch(() => undefined);
			});

		let pending = start();
		const subscription = AppState.addEventListener("change", (state) => {
			pending.cancel();
			if (state === "active") {
				pending = start();
			}
		});
		return () => {
			pending.cancel();
			subscription.remove();
		};
	}, []);

	return null;
}
