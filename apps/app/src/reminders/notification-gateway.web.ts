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

/** Expo Notifications does not support this app's local reminder flow on web. */
export const notificationGateway: ReminderNotificationGateway = {
	async configureChannel() {},
	async getPermissionStatus() {
		return "denied";
	},
	async requestPermission() {
		return "denied";
	},
	async listScheduled() {
		return [];
	},
	async schedule() {},
	async cancel() {},
};

export function getInitialNotificationResponseIdentifier(): null {
	return null;
}

export function clearInitialNotificationResponse(): void {}

export function addNotificationResponseListener(): { remove(): void } {
	return { remove() {} };
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
