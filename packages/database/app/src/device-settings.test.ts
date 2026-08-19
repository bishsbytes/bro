import type * as DatabaseApp from "./index";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-sqlite/kv-store", () => ({
	SQLiteStorage: mockSqlite.SQLiteStorage,
}));

/**
 * The module memoizes its store, so a cold relaunch means a fresh module
 * registry reading the same file back off disk.
 */
function relaunch(): typeof DatabaseApp {
	jest.resetModules();
	return jest.requireActual("./index");
}

describe("device-local settings", () => {
	beforeEach(() => {
		mockSqlite.reset();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("creates an installation identity once and keeps it across a cold relaunch", () => {
		let deviceSettings = relaunch();

		const firstLaunch = deviceSettings.readDeviceSettings();

		expect(firstLaunch.installationId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(firstLaunch).toMatchObject({
			onboardingComplete: false,
			appLockEnabled: false,
			appLockTimeoutSeconds: null,
			hasStoredRemoteSession: false,
			lastRemoteUserId: null,
		});
		// Reading twice in one session must not mint a second identity.
		expect(deviceSettings.readDeviceSettings().installationId).toBe(
			firstLaunch.installationId,
		);

		deviceSettings.setOnboardingComplete(true);
		deviceSettings.closeDeviceSettings();

		deviceSettings = relaunch();
		const relaunched = deviceSettings.readDeviceSettings();

		expect(relaunched.installationId).toBe(firstLaunch.installationId);
		expect(relaunched.onboardingComplete).toBe(true);
	});

	it("never places device-local state in the product database", () => {
		const deviceSettings = relaunch();

		deviceSettings.readDeviceSettings();

		const opened = mockSqlite.openDatabaseSync.mock.calls.map(
			([name]) => name as string,
		);
		// Only the throwaway in-memory handle used to mint the identity.
		expect(opened).toEqual([":memory:"]);
		expect(deviceSettings.DEVICE_SETTINGS_DATABASE_NAME).toBe("bro-device.db");
		expect(deviceSettings.DEVICE_SETTINGS_DATABASE_NAME).not.toBe(
			deviceSettings.DATABASE_NAME,
		);
	});

	it("round-trips every setting through storage, not through memory", () => {
		let deviceSettings = relaunch();
		deviceSettings.readDeviceSettings();

		deviceSettings.setOnboardingComplete(true);
		deviceSettings.setAppLock(true, 120);
		deviceSettings.setRemoteSessionMarker(true, "user-a");
		deviceSettings.closeDeviceSettings();

		deviceSettings = relaunch();
		expect(deviceSettings.readDeviceSettings()).toMatchObject({
			onboardingComplete: true,
			appLockEnabled: true,
			appLockTimeoutSeconds: 120,
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		// Clearing must remove the value, not store the string "null".
		deviceSettings.setRemoteSessionMarker(false, null);
		deviceSettings.setAppLock(false, null);
		deviceSettings.closeDeviceSettings();

		deviceSettings = relaunch();
		expect(deviceSettings.readDeviceSettings()).toMatchObject({
			appLockEnabled: false,
			appLockTimeoutSeconds: null,
			hasStoredRemoteSession: false,
			lastRemoteUserId: null,
		});
	});

	it("refuses settings written by a newer app version", () => {
		const seed = new mockSqlite.SQLiteStorage("bro-device.db");
		seed.setItemSync("schemaVersion", "2");
		seed.setItemSync("installationId", "from-the-future");
		seed.closeSync();

		const deviceSettings = relaunch();

		expect(() => deviceSettings.readDeviceSettings()).toThrow(
			"Device settings were created by a newer version of the app.",
		);
	});
});
