import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import {
	act,
	fireEvent,
	renderRouter,
	waitFor,
} from "expo-router/testing-library";
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
const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

const DELETE_COPY =
	"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.";

describe("delete local data", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		databaseApp.closeDeviceSettings();
		mockSqlite.cleanup();
	});

	it("clears every product table but preserves migrations, settings, and session", async () => {
		databaseApp.readDeviceSettings();
		databaseApp.setOnboardingComplete(true);
		databaseApp.setRemoteSessionMarker(true, "user-a");
		const settingsBefore = databaseApp.readDeviceSettings();

		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const trackedMetrics = new databaseApp.TrackedMetricsRepository(db);
		await observations.create({
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: Date.parse("2026-08-14T10:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: -60,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		await notes.create("2026-08-14", "Delete me");
		await trackedMetrics.configure("alcohol", 6, false);
		const markerBefore = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __app_migrations",
		);
		const transaction = jest.spyOn(db, "withTransactionAsync");

		const router = renderRouter("src/app", { initialUrl: "/settings" });
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("Settings")).toBeTruthy();
		expect(view.queryByText(DELETE_COPY)).toBeNull();

		await fireEvent.press(view.getByText("Delete local data"));
		expect(view.getByText(DELETE_COPY)).toBeTruthy();
		expect(await observations.listAll()).toHaveLength(1);
		expect(await notes.listAll()).toHaveLength(1);
		expect(await trackedMetrics.listAll()).toHaveLength(1);

		await fireEvent.press(view.getByText("Cancel"));
		expect(view.queryByText(DELETE_COPY)).toBeNull();
		expect(await observations.listAll()).toHaveLength(1);

		await fireEvent.press(view.getByText("Delete local data"));
		await fireEvent.press(view.getByText("Permanently delete local data"));
		expect(await view.findByText("Local data deleted")).toBeTruthy();

		expect(await observations.listAll()).toEqual([]);
		expect(await notes.listAll()).toEqual([]);
		expect(await trackedMetrics.listAll()).toEqual([]);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(
			await db.getFirstAsync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM __app_migrations",
			),
		).toEqual(markerBefore);
		expect(databaseApp.readDeviceSettings()).toEqual(settingsBefore);
		expect(mockedAuthClient.signOut).not.toHaveBeenCalled();
		expect(mockedAuthClient.deleteUser).not.toHaveBeenCalled();

		await fireEvent.press(view.getByText("Back to today"));
		await waitFor(() => expect(router.getPathname()).toBe("/"));
		expect(await view.findByText("How are you?")).toBeTruthy();
		expect(view.queryByText("Logged today")).toBeNull();

		await fireEvent.press(view.getByText("Account"));
		expect(await view.findByText("ada@example.com")).toBeTruthy();
		expect(mockedAuthClient.useSession).toHaveBeenCalled();
		expect(databaseApp.readDeviceSettings()).toEqual(settingsBefore);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
