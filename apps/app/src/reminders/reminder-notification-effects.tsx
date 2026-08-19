import { REMINDER_NOTIFICATION_PREFIX } from "@bro/logic";
import { router } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";
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

		const appStateSubscription = AppState.addEventListener(
			"change",
			(state) => {
				if (state === "active") {
					void refreshReminderNotifications().catch(
						reportReminderRefreshFailure,
					);
				}
			},
		);
		return () => appStateSubscription.remove();
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
