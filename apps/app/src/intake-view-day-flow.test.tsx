import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import * as domain from "@bro/domain";
import { router as expoRouter } from "expo-router";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomSeed += 1;
		bytes[length - 1] = mockRandomSeed;
		return bytes;
	}),
}));

const settings: DatabaseApp.DeviceSettingsSnapshot = {
	installationId: "install-intake-view-day",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	themeMode: "dark",
	accentHue: 212,
	accentChroma: 0.12,
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
const { setImmediate: realSetImmediate } =
	jest.requireActual<typeof import("node:timers")>("node:timers");

async function settle(found: () => unknown): Promise<void> {
	for (let turn = 0; turn < 200; turn += 1) {
		if (found()) return;
		await act(async () => {
			await jest.advanceTimersByTimeAsync(50);
			await new Promise((resolve) => realSetImmediate(resolve));
		});
	}
	throw new Error("The screen did not settle.");
}

describe("intake view-day flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("returns a completed log to the tab on the day and view it belongs to", async () => {
		(authClient as unknown as { useSession: jest.Mock }).useSession.mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const yesterday = domain.previousLocalDay(domain.localDayOf(new Date()));

		const router = renderRouter("src/app", { initialUrl: "/intake" });
		const view = await router;
		await settle(() => view.queryByText("Summary"));

		await act(async () => expoRouter.push("/intake/log"));
		await settle(() => view.queryByText("Browse"));
		await fireEvent.press(view.getByLabelText("Log Lager, 4.5%"));
		await fireEvent.press(await view.findByText("Earlier"));
		await fireEvent.press(await view.findByText("Yesterday"));
		await fireEvent.press(view.getByText("Log it"));
		expect(await view.findByText("Lager, 4.5% added")).toBeTruthy();

		await fireEvent.press(view.getByText("View day"));
		await settle(() => router.getPathname() === "/intake" || undefined);
		expect(router.getPathname()).toBe("/intake");
		expect(view.queryByText("Browse")).toBeNull();
		expect(router.getSearchParams()).toMatchObject({
			day: yesterday,
			view: "logged",
		});
		expect(await view.findByText("Yesterday")).toBeTruthy();
		expect(view.getByText("Lager, 4.5%")).toBeTruthy();
		expect(view.getByLabelText("Log")).toBeTruthy();
	});
});
