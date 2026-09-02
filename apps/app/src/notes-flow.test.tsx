import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { localDayOf } from "@bro/domain";
import {
	act,
	fireEvent,
	renderRouter,
	waitFor,
} from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));

const settings: DatabaseApp.DeviceSettingsSnapshot = {
	installationId: "install-notes",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	themeMode: "system",
	accentHue: 235,
	accentChroma: 0.055,
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

jest.mock("@bro/database-app", () => {
	const actual = jest.requireActual("@bro/database-app");
	return {
		...actual,
		readDeviceSettings: () => settings,
		setOnboardingComplete: jest.fn(),
		setRemoteSessionMarker: jest.fn(),
		closeDeviceSettings: jest.fn(),
	};
});

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(() => ({
			data: null,
			isPending: false,
			error: null,
			refetch: jest.fn(),
		})),
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
const mockedUseSession = (authClient as unknown as { useSession: jest.Mock })
	.useSession;

describe("notes flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("lists stored notes and adds another from the notes stack", async () => {
		mockedUseSession.mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const notes = new databaseApp.DayNoteRepository(db);
		await notes.create("2026-08-10", "A note already here");

		const route = renderRouter("src/app", { initialUrl: "/notes" });
		const view = await route;
		await act(async () => undefined);

		expect(await view.findByText("A note already here")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Add note"));
		await waitFor(() => expect(route.getPathname()).toBe("/notes/new"));
		expect(view.getByPlaceholderText("What's on your mind?")).toBeTruthy();

		await fireEvent.changeText(view.getByLabelText("Note"), "A newer note");
		await fireEvent.press(view.getByText("Save note"));

		await waitFor(() => expect(route.getPathname()).toBe("/notes"));
		expect(await view.findByText("A newer note")).toBeTruthy();
		expect(await notes.listByDay(localDayOf(new Date()))).toMatchObject([
			{ body: "A newer note" },
		]);
		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
