import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
	ensureReminderPermission,
	notificationGateway,
} from "./notification-gateway";

const originalPlatform = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
	Object.defineProperty(Platform, "OS", {
		configurable: true,
		value: os,
	});
}

describe("reminder notification gateway", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		setPlatform("android");
		(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.GRANTED,
			canAskAgain: false,
			granted: true,
		});
	});

	afterAll(() => {
		setPlatform(originalPlatform);
	});

	it("reports Android reminders as denied when their channel is disabled", async () => {
		(Notifications.getNotificationChannelAsync as jest.Mock).mockResolvedValue({
			importance: Notifications.AndroidImportance.NONE,
		});

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"denied",
		);
	});

	it("stays granted on Android before the channel has been created", async () => {
		// First launch reconciles before configureChannel has run; a missing
		// channel is not a muted one, and must not silence every reminder.
		(Notifications.getNotificationChannelAsync as jest.Mock).mockResolvedValue(
			null,
		);

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"granted",
		);
	});

	it("does not inspect a channel off Android", async () => {
		setPlatform("ios");

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"granted",
		);
		expect(Notifications.getNotificationChannelAsync).not.toHaveBeenCalled();
	});

	it("does not inspect the Android channel when app permission is denied", async () => {
		(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.DENIED,
			canAskAgain: false,
			granted: false,
		});

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"denied",
		);
		expect(Notifications.getNotificationChannelAsync).not.toHaveBeenCalled();
	});

	it("treats Android's never-asked denial as a permission still to request", async () => {
		// A fresh Android install has no POST_NOTIFICATIONS, so notifications
		// read as disabled and expo-notifications reports denied. Taking that
		// at face value would skip the prompt for good and leave every reminder
		// unscheduled.
		(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.DENIED,
			canAskAgain: true,
			granted: false,
		});

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"undetermined",
		);
	});

	it("asks the OS on a fresh Android install", async () => {
		(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.DENIED,
			canAskAgain: true,
			granted: false,
		});
		(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.GRANTED,
			canAskAgain: false,
			granted: true,
		});

		await expect(ensureReminderPermission()).resolves.toBe("granted");
		expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
	});

	it("stays denied when notifications are switched off for a granted app", async () => {
		// Turning an app's notifications off in system settings leaves the
		// permission itself granted, so asking again would show no dialog and
		// change nothing: only system settings can turn these back on.
		(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
			status: Notifications.PermissionStatus.DENIED,
			canAskAgain: true,
			granted: true,
		});

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"denied",
		);
		await expect(ensureReminderPermission()).resolves.toBe("denied");
		expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
	});
});
