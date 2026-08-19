import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationGateway } from "./notification-gateway";

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
		});

		await expect(notificationGateway.getPermissionStatus()).resolves.toBe(
			"denied",
		);
		expect(Notifications.getNotificationChannelAsync).not.toHaveBeenCalled();
	});
});
