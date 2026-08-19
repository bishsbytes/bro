import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { router as expoRouter } from "expo-router";
import {
	act,
	fireEvent,
	renderRouter,
	waitFor,
} from "expo-router/testing-library";
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
	installationId: "install-1",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
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

describe("drink logging flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("logs, trends, goals, edits, and hard-deletes a catalogue drink offline", async () => {
		mockedUseSession.mockClear();
		(globalThis.fetch as jest.Mock).mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		await new databaseApp.UnitPreferenceRepository(db).set(
			"alcohol",
			"uk_unit",
		);

		const router = renderRouter("src/app", {
			initialUrl: "/settings/drinks",
		});
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("Trends and goals")).toBeTruthy();
		await fireEvent(view.getByLabelText("Track Alcohol"), "valueChange", true);
		expect(await view.findByLabelText("Stop tracking Alcohol")).toBeTruthy();

		await act(async () => expoRouter.replace("/drinks"));
		expect(await view.findByText("Nothing logged")).toBeTruthy();
		await fireEvent.press(view.getByText("Choose a drink"));
		await fireEvent.press(view.getByText("Lager, 4.5%"));
		await fireEvent.press(view.getByText("Save drink"));
		expect(await view.findByText(/^1 × pint ·/)).toBeTruthy();
		expect(view.getAllByText("2.6 units").length).toBeGreaterThan(0);
		const [entry] = await new databaseApp.ConsumptionEntryRepository(db).listAll();
		if (!entry) throw new Error("Expected a stored drink entry.");
		expect(entry).toMatchObject({
			label: "Lager, 4.5%",
			servingLabel: "pint",
			quantity: 1,
		});
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual([]);

		await fireEvent.press(view.getByText("Set goal for Alcohol"));
		await fireEvent.changeText(view.getByLabelText("Target (uk_unit)"), "2");
		await fireEvent.press(view.getByText("Save goal"));
		expect(await view.findByText(/Target 2.0 units/)).toBeTruthy();
		expect((await new databaseApp.GoalRepository(db).listAll())[0]).toMatchObject({
			metricSlug: "alcohol_intake",
			direction: "decrease",
		});

		await act(async () => expoRouter.replace("/trends"));
		expect(await view.findByText("Latest 2.6 units")).toBeTruthy();
		await fireEvent.press(view.getByText("Open Drinks"));
		expect(await view.findByText(/^1 × pint ·/)).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Edit Lager, 4.5%"));
		await fireEvent.changeText(view.getByLabelText("Quantity"), "2");
		await fireEvent.press(view.getByText("Save changes"));
		expect(await view.findByText("5.1 units")).toBeTruthy();
		expect(
			(await new databaseApp.ConsumptionEntryRepository(db).findById(entry.id))
				?.quantity,
		).toBe(2);

		await fireEvent.press(view.getByText("Delete drink"));
		await waitFor(() =>
			expect(view.getByText("No drinks on this day")).toBeTruthy(),
		);
		expect(await new databaseApp.ConsumptionEntryRepository(db).listAll()).toEqual([]);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual([]);

		await act(async () => expoRouter.replace("/drinks"));
		await fireEvent.press(await view.findByText("Choose a drink"));
		await fireEvent.press(view.getByText("Water"));
		await fireEvent.press(view.getByText("Last night"));
		await fireEvent.press(view.getByText("Save drink"));
		expect(await view.findByDisplayValue("Water")).toBeTruthy();
		const [lastNight] =
			await new databaseApp.ConsumptionEntryRepository(db).listAll();
		if (!lastNight) throw new Error("Expected the last-night drink.");
		expect(router.getPathname()).toBe(`/drinks/${lastNight.localDay}`);

		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(mockedUseSession).not.toHaveBeenCalled();
	});
});
