import type * as DatabaseApp from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
const mockSessionState = {
	data: {
		user: { id: "user-a", name: "Ada", email: "ada@example.com" },
		session: { id: "session-user-a" },
	},
	isPending: false,
	error: null,
	refetch: jest.fn(),
};

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-sqlite/kv-store", () => ({
	SQLiteStorage: mockSqlite.SQLiteStorage,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomSeed += 1;
		bytes[length - 1] = mockRandomSeed;
		return bytes;
	}),
}));

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(() => mockSessionState),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
		deleteUser: jest.fn(),
	},
}));

jest.mock("expo-splash-screen", () => ({
	preventAutoHideAsync: jest.fn(async () => true),
	hideAsync: jest.fn(async () => true),
}));

const databaseApp: typeof DatabaseApp = jest.requireActual("@bro/database-app");

describe("reminder schedule continuity", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		databaseApp.closeDeviceSettings();
		mockSqlite.cleanup();
	});

	it("keeps a created reminder listed across a simulated relaunch", async () => {
		databaseApp.readDeviceSettings();
		databaseApp.setOnboardingComplete(true);
		databaseApp.setRemoteSessionMarker(true, "user-a");

		const firstRun = await renderRouter("src/app", {
			initialUrl: "/settings/reminders",
		});
		await act(async () => undefined);

		expect(await firstRun.findByText("No reminders yet")).toBeTruthy();
		await fireEvent.press(firstRun.getByText("Add reminder"));
		expect(firstRun.getByLabelText("Time").props.accessibilityValue).toEqual({
			text: "20:00",
		});
		await fireEvent.press(firstRun.getByText("Save reminder"));
		expect(await firstRun.findByText("Every day")).toBeTruthy();
		expect(firstRun.getByText("20:00")).toBeTruthy();

		// A relaunch goes back through the root layout's own startup path against
		// the same database file; the schedule must come back from disk.
		firstRun.unmount();
		await databaseApp.closeDb();

		const secondRun = await renderRouter("src/app", {
			initialUrl: "/settings/reminders",
		});
		await act(async () => undefined);
		expect(await secondRun.findByText("Every day")).toBeTruthy();
		expect(secondRun.getByText("20:00")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
