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
	installationId: "install-intake",
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
const { setImmediate: realSetImmediate } =
	jest.requireActual<typeof import("node:timers")>("node:timers");

/**
 * Waits for a pushed screen to show its data. The router keeps Jest on fake
 * timers, which the navigator's transition needs advancing, while the screen's
 * first read settles on the real event loop; each turn drives both inside act
 * so the resulting state lands in a render.
 */
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
const mockedUseSession = (authClient as unknown as { useSession: jest.Mock })
	.useSession;

describe("intake flow", () => {
	afterEach(() => {
		delete process.env.EXPO_PUBLIC_API_URL;
	});

	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("switches a stream on, logs a drink, a smoke, and a free entry from one screen, corrects, and sets a goal offline", async () => {
		mockedUseSession.mockClear();
		(globalThis.fetch as jest.Mock).mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const events = new databaseApp.IntakeEventRepository(db);

		const router = renderRouter("src/app", { initialUrl: "/settings/intake" });
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("Streams")).toBeTruthy();
		// A fresh install: food and drink only, nothing tracked.
		await fireEvent(
			view.getByLabelText("Turn on Smoking & vaping"),
			"valueChange",
			true,
		);
		expect(
			await view.findByLabelText("Turn off Smoking & vaping"),
		).toBeTruthy();
		await fireEvent(
			view.getByLabelText("Track Energy intake"),
			"valueChange",
			true,
		);
		expect(
			await view.findByLabelText("Stop tracking Energy intake"),
		).toBeTruthy();
		expect(
			await new databaseApp.IntakeStreamRepository(db).listEnabledKinds(),
		).toEqual(["food", "drink", "nicotine"]);

		// One log screen for every kind: a catalogue drink first.
		await act(async () => expoRouter.push("/intake/log"));
		await waitFor(() => expect(router.getPathname()).toBe("/intake/log"));
		expect(await view.findByText("Browse")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Log Lager, 4.5%"));
		expect(await view.findByText("Log Lager, 4.5%")).toBeTruthy();
		await fireEvent.press(view.getByText("Log it"));
		expect(await view.findByText("Lager, 4.5% added")).toBeTruthy();
		const [lager] = await events.listAll();
		expect(lager).toMatchObject({
			kind: "drink",
			sourceRef: "system:drink:lager-4_5",
			portionLabel: "pint",
			quantity: 1,
		});
		expect(lager?.constituents.ethanol).toBeCloseTo(0.020_182, 6);

		// The stream is on, so its chip and its catalogue appear; the screen
		// stayed for the next item.
		await fireEvent.press(view.getByLabelText("Show Smoke or vape"));
		await fireEvent.press(await view.findByLabelText("Log Cigarette"));
		await fireEvent.press(await view.findByText("Log it"));
		expect(await view.findByText("Cigarette added")).toBeTruthy();
		expect(
			(await events.listRecent(["nicotine"]))[0]?.constituents.nicotine,
		).toBeCloseTo(1.2e-6, 12);

		// The lager just logged is a recent chip: one tap logs it again at the
		// remembered portion, with no sheet.
		await fireEvent.press(view.getByLabelText("Show Smoke or vape"));
		await fireEvent.press(await view.findByLabelText("Log Lager, 4.5% again"));
		expect(await view.findByText("Lager, 4.5% added")).toBeTruthy();
		expect(await events.listAll()).toHaveLength(3);

		// Something else: a complete event with no library row behind it.
		await fireEvent.press(view.getByLabelText("Something else"));
		await fireEvent.changeText(view.getByLabelText("What was it?"), "Oat bar");
		await fireEvent.changeText(view.getByLabelText("Energy (kcal)"), "210");
		await fireEvent.press(view.getByText("Log it"));
		expect(await view.findByText("Oat bar added")).toBeTruthy();
		expect(await events.listAll()).toHaveLength(4);

		// The tab: one stream, one energy total against nothing but itself, the
		// two pints as one row, everything else in order.
		await act(async () => expoRouter.replace("/intake"));
		expect(await view.findByLabelText("Energy intake, 699 kcal.")).toBeTruthy();
		expect(view.queryByText(/remaining|left today|budget/i)).toBeNull();
		// The shared FAB is the way in; the card carries no log button.
		expect(view.getByLabelText("Log")).toBeTruthy();
		expect(view.queryByText("Log something")).toBeNull();
		await fireEvent.press(view.getByLabelText("Logged"));
		expect(await view.findByText("2 × pint")).toBeTruthy();
		expect(view.getAllByText("Lager, 4.5%")).toHaveLength(1);
		expect(view.getByText("Cigarette")).toBeTruthy();
		expect(view.getByText("Oat bar")).toBeTruthy();

		// A goal, parsed in the unit being read. The router's test renderer runs
		// on fake timers while the goals screen's first read settles on the real
		// event loop, so the pushed screen is settled by hand.
		await act(async () => expoRouter.push("/intake/goals"));
		await settle(() => view.queryByText("Set goal for Energy intake"));
		await fireEvent.press(await view.findByText("Set goal for Energy intake"));
		await fireEvent.changeText(view.getByLabelText("Target (kcal)"), "600");
		await fireEvent.press(view.getByText("Save goal"));
		await waitFor(async () =>
			expect(
				(await new databaseApp.GoalRepository(db).listAll())[0],
			).toMatchObject({
				metricSlug: "energy_intake",
				direction: "decrease",
				targetValue: 600,
			}),
		);
		await act(async () => expoRouter.back());
		await act(async () => {
			await jest.advanceTimersByTimeAsync(300);
		});
		await waitFor(() => expect(router.getPathname()).toBe("/intake"));

		// Correct the record in place: quantity is the only lever, and totals
		// re-derive.
		await fireEvent.press(view.getByLabelText(/^Oat bar,/));
		await fireEvent.changeText(await view.findByLabelText("Quantity"), "2");
		await fireEvent.press(view.getByText("Save changes"));
		await waitFor(async () => {
			const oatBar = (await events.listAll()).find(
				({ name }) => name === "Oat bar",
			);
			expect(oatBar).toMatchObject({
				quantity: 2,
				constituents: { energy: 420 },
			});
		});

		await fireEvent.press(view.getByLabelText("Summary"));
		expect(await view.findByLabelText("Energy intake, 909 kcal.")).toBeTruthy();
		expect(router.getPathname()).toBe("/intake");

		// Switching the stream off hides its chip and its catalogue; the logged
		// smoke stays stored.
		await new databaseApp.IntakeStreamRepository(db).setEnabled(
			"nicotine",
			false,
		);
		await act(async () => expoRouter.replace("/intake/log"));
		expect(await view.findByText("Browse")).toBeTruthy();
		expect(view.queryByLabelText("Show Smoke or vape")).toBeNull();
		expect(view.queryByLabelText("Log Cigarette")).toBeNull();
		expect(await events.listRecent(["nicotine"])).toHaveLength(1);

		// Nothing here wrote an observation or made a request.
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
