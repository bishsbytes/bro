import { router } from "expo-router";

/**
 * Leaves sign-in or sign-up and goes wherever the flow was entered from.
 *
 * Entered from the running app, `/settings` is already on the stack, so the
 * flow is dismissed back onto it. Replacing instead would push a second
 * `/settings` entry on top of the first. Onboarding has no Settings screen
 * below it and completes into the app.
 */
export function leaveSettingsFlow(
	returnTo: string | undefined,
	onboardingComplete: boolean,
) {
	if (!onboardingComplete || returnTo !== "settings") {
		router.replace("/");
		return;
	}

	if (router.canDismiss()) {
		router.dismissTo("/settings");
		return;
	}

	// Reached directly, by deep link rather than from Settings.
	router.replace("/settings");
}
