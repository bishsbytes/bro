import { REMINDER_NOTIFICATION_PREFIX } from "@bro/logic";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
import {
	type DeferredWork,
	deferBackgroundWork,
} from "../lib/defer-background-work";
import {
	addNotificationResponseListener,
	clearInitialNotificationResponse,
	getInitialNotificationResponseIdentifier,
	notificationGateway,
} from "./notification-gateway";
import {
	refreshReminderNotifications,
	reportReminderRefreshFailure,
} from "./reminder-materialiser";

export function ReminderNotificationEffects({
	onboardingComplete,
}: {
	onboardingComplete: boolean;
}) {
	useEffect(() => {
		void notificationGateway
			.configureChannel()
			.then(() => refreshReminderNotifications())
			.catch(reportReminderRefreshFailure);

		// Rescheduling reads the whole pending notification queue back across the
		// bridge. Nothing on screen shows it, and it only has to be right by the
		// time the app next goes away, so it gives the resume a head start.
		let pending: DeferredWork = { cancel: () => {} };
		const appStateSubscription = AppState.addEventListener(
			"change",
			(state) => {
				pending.cancel();
				if (state === "active") {
					pending = deferBackgroundWork(() => {
						void refreshReminderNotifications().catch(
							reportReminderRefreshFailure,
						);
					});
				}
			},
		);
		return () => {
			pending.cancel();
			appStateSubscription.remove();
		};
	}, []);

	useEffect(() => {
		function openToday(identifier: string) {
			if (
				onboardingComplete &&
				identifier.startsWith(REMINDER_NOTIFICATION_PREFIX)
			) {
				router.replace("/");
				clearInitialNotificationResponse();
			}
		}

		const initialIdentifier = getInitialNotificationResponseIdentifier();
		if (initialIdentifier) {
			openToday(initialIdentifier);
		}
		const responseSubscription = addNotificationResponseListener(openToday);
		return () => responseSubscription.remove();
	}, [onboardingComplete]);

	return null;
}
