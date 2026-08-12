import { router } from "expo-router";

/**
 * Leaves sign-in or sign-up and goes wherever the flow was entered from.
 *
 * Entered from the running app, `/account` is already on the stack, so the flow
 * is dismissed back onto it. Replacing instead would push a second `/account`
 * entry on top of the first, and Back from Account would land on Account again.
 * Onboarding has no Account below it and completes into the app.
 */
export function leaveAccountFlow(
	returnTo: string | undefined,
	onboardingComplete: boolean,
) {
	if (!onboardingComplete || returnTo !== "account") {
		router.replace("/");
		return;
	}

	if (router.canDismiss()) {
		router.dismissTo("/account");
		return;
	}

	// Reached directly, by deep link rather than from Account.
	router.replace("/account");
}
