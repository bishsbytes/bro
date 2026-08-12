import type * as DatabaseApp from "@bro/database-app";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();

jest.mock("expo-sqlite", () => ({
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

/**
 * The module memoizes its handle, so a cold relaunch means a fresh module
 * registry reading the same files back off disk.
 */
function relaunch(): typeof DatabaseApp {
	jest.resetModules();
	return jest.requireActual("@bro/database-app");
}

describe("device-local settings", () => {
	beforeEach(() => {
		mockSqlite.reset();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("persists onboarding independently across a cold relaunch", async () => {
		let deviceSettings = relaunch();

		const firstLaunch = await deviceSettings.initDeviceSettings();

		expect(firstLaunch.onboardingComplete).toBe(false);
		expect(firstLaunch.installationId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		// The registry points at the product database, which is a separate file.
		expect(firstLaunch.activeWorkspace).toEqual({
			workspaceId: expect.any(String),
			databaseFileName: "bro.db",
			ownerUserId: null,
		});
		expect(mockSqlite.openDatabaseAsync).toHaveBeenCalledWith("bro-device.db");
		expect(mockSqlite.openDatabaseAsync).not.toHaveBeenCalledWith("bro.db");

		await deviceSettings.setOnboardingComplete(true);
		await deviceSettings.setRemoteSessionMarker(true, "user-a");
		await deviceSettings.closeDeviceSettingsDb();

		deviceSettings = relaunch();
		const relaunched = await deviceSettings.initDeviceSettings();

		expect(relaunched.installationId).toBe(firstLaunch.installationId);
		expect(relaunched.activeWorkspace.workspaceId).toBe(
			firstLaunch.activeWorkspace.workspaceId,
		);
		expect(relaunched.onboardingComplete).toBe(true);
		expect(relaunched.hasStoredRemoteSession).toBe(true);
		expect(relaunched.lastRemoteUserId).toBe("user-a");

		await deviceSettings.closeDeviceSettingsDb();
	});

	it("keeps the installation identity to a single row", async () => {
		const deviceSettings = relaunch();
		await deviceSettings.initDeviceSettings();

		const db = await mockSqlite.openDatabaseAsync.mock.results[0].value;
		await expect(
			db.runAsync(
				"INSERT INTO device_settings (id, installation_id, active_workspace_id) VALUES (?, ?, ?)",
				[2, "second-install", "second-workspace"],
			),
		).rejects.toThrow(/CHECK constraint/i);

		await deviceSettings.closeDeviceSettingsDb();
	});

	it("refuses settings written by a newer app version, and closes the handle", async () => {
		const seed = await mockSqlite.openDatabaseAsync("bro-device.db");
		await seed.execAsync("PRAGMA user_version = 2");
		await seed.closeAsync();

		const deviceSettings = relaunch();

		await expect(deviceSettings.initDeviceSettings()).rejects.toThrow(
			"Device settings were created by a newer version of the app.",
		);
		// A failed open must not leave a half-initialized handle memoized.
		await expect(deviceSettings.getDeviceSettings()).rejects.toThrow(
			"Device settings are not open",
		);
	});
});
