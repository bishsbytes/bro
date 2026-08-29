import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { i18n } from "../i18n";

export const REMINDERS_CHANNEL_ID = "reminders";

export type NotificationPermissionStatus =
	| "granted"
	| "denied"
	| "undetermined";

export type ScheduledNotification = { identifier: string };

export type ReminderNotificationGateway = {
	configureChannel(): Promise<void>;
	getPermissionStatus(): Promise<NotificationPermissionStatus>;
	requestPermission(): Promise<NotificationPermissionStatus>;
	listScheduled(): Promise<ScheduledNotification[]>;
	schedule(identifier: string, fireAt: Date): Promise<void>;
	cancel(identifier: string): Promise<void>;
};

function normalisePermission(
	status: Notifications.PermissionStatus,
): NotificationPermissionStatus {
	if (status === Notifications.PermissionStatus.GRANTED) {
		return "granted";
	}
	if (status === Notifications.PermissionStatus.DENIED) {
		return "denied";
	}
	return "undetermined";
}

export const notificationGateway: ReminderNotificationGateway = {
	async configureChannel() {
		Notifications.setNotificationHandler({
			handleNotification: async () => ({
				shouldShowBanner: true,
				shouldShowList: true,
				shouldPlaySound: true,
				shouldSetBadge: false,
			}),
		});
		await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
			name: i18n.t("notifications:channelName"),
			importance: Notifications.AndroidImportance.DEFAULT,
		});
	},

	async getPermissionStatus() {
		const permission = normalisePermission(
			(await Notifications.getPermissionsAsync()).status,
		);
		if (permission !== "granted" || Platform.OS !== "android") {
			return permission;
		}

		const channel =
			await Notifications.getNotificationChannelAsync(REMINDERS_CHANNEL_ID);
		return channel?.importance === Notifications.AndroidImportance.NONE
			? "denied"
			: "granted";
	},

	async requestPermission() {
		return normalisePermission(
			(await Notifications.requestPermissionsAsync()).status,
		);
	},

	async listScheduled() {
		return (await Notifications.getAllScheduledNotificationsAsync()).map(
			(request) => ({ identifier: request.identifier }),
		);
	},

	async schedule(identifier, fireAt) {
		// Copy is fixed at schedule time, not delivery time, and the materialiser
		// reconciles by identifier alone: a notification already queued is left
		// as it is. Adding a language picker therefore needs every reminder
		// cancelled and rescheduled on the switch, or the old wording keeps
		// firing until its identifier drops out of the plan.
		await Notifications.scheduleNotificationAsync({
			identifier,
			content: {
				// The app's own name, so it reads the same in every language.
				title: "bro",
				body: i18n.t("notifications:reminder.body"),
				data: { destination: "today" },
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: fireAt,
				channelId: REMINDERS_CHANNEL_ID,
			},
		});
	},

	async cancel(identifier) {
		await Notifications.cancelScheduledNotificationAsync(identifier);
	},
};

function reminderIdentifierOf(
	response: Notifications.NotificationResponse | null,
): string | null {
	return response?.notification.request.identifier ?? null;
}

export function getInitialNotificationResponseIdentifier(): string | null {
	return reminderIdentifierOf(Notifications.getLastNotificationResponse());
}

export function clearInitialNotificationResponse(): void {
	Notifications.clearLastNotificationResponse();
}

export function addNotificationResponseListener(
	listener: (identifier: string) => void,
): { remove(): void } {
	return Notifications.addNotificationResponseReceivedListener((response) => {
		const identifier = reminderIdentifierOf(response);
		if (identifier) {
			listener(identifier);
		}
	});
}

export async function ensureReminderPermission(
	gateway: ReminderNotificationGateway = notificationGateway,
): Promise<NotificationPermissionStatus> {
	await gateway.configureChannel();
	const current = await gateway.getPermissionStatus();
	return current === "undetermined"
		? await gateway.requestPermission()
		: current;
}
