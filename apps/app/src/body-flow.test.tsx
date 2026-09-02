import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_PER_POUND } from "@bro/domain";
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

describe("body metrics flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("tracks, logs, charts, edits, and goals a measurement offline", async () => {
		mockedUseSession.mockClear();
		(globalThis.fetch as jest.Mock).mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		await new databaseApp.UnitPreferenceRepository(db).set("mass", "st");

		const router = renderRouter("src/app", { initialUrl: "/body" });
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("No measurements tracked")).toBeTruthy();

		await fireEvent.press(view.getAllByLabelText("Manage body data")[0]);
		await fireEvent.press(await view.findByLabelText("Track Weight"));
		await fireEvent.press(
			view.getByTestId("modal-sheet-backdrop", { includeHiddenElements: true }),
		);
		expect(
			await view.findByLabelText("Weight. Nothing logged yet"),
		).toBeTruthy();

		await fireEvent.press(view.getByLabelText("Log body"));
		await fireEvent.press(view.getByLabelText("Weight"));
		await fireEvent.changeText(view.getByLabelText("Weight (stones)"), "12");
		await fireEvent.changeText(view.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(view.getByLabelText("Save reading"));
		expect(await view.findByLabelText("Weight. First reading.")).toBeTruthy();

		await act(async () => expoRouter.replace("/insights"));
		expect(await view.findByText("Latest 12 st 4 lb")).toBeTruthy();
		expect(view.getByLabelText("weight trend chart")).toBeTruthy();
		await act(async () => expoRouter.replace("/body"));
		await fireEvent.press(await view.findByLabelText("Weight. First reading."));
		expect(await view.findByLabelText(/^Weight, 12 st 4 lb\./)).toBeTruthy();
		expect(view.getByTestId("gauge-marker")).toBeTruthy();

		await fireEvent.changeText(view.getByLabelText("Target (stones)"), "12");
		await fireEvent.changeText(view.getByLabelText("Target (pounds)"), "0");
		await fireEvent.press(view.getByLabelText("Target date (optional)"));
		await fireEvent(
			view.getByTestId("date-picker"),
			"valueChange",
			{ nativeEvent: { timestamp: Date.parse("2026-12-25T12:00:00Z") } },
			new Date(2026, 11, 25, 12),
		);
		await fireEvent.press(view.getByText("Done"));
		await fireEvent.press(view.getByText("Save goal"));
		expect(await view.findByText("Target 12 st 0 lb")).toBeTruthy();
		expect(
			view.getByText("Started at 12 st 4 lb · Latest 12 st 4 lb"),
		).toBeTruthy();

		const goals = await new databaseApp.GoalRepository(db).listAll();
		expect(goals[0]).toMatchObject({
			metricSlug: "weight",
			direction: "decrease",
			targetValue: 168 * KILOGRAMS_PER_POUND,
		});

		await act(async () => expoRouter.replace("/body"));
		await fireEvent.press(await view.findByLabelText("Log body"));
		await fireEvent.press(view.getByLabelText("Weight"));
		await fireEvent.changeText(view.getByLabelText("Weight (stones)"), "12");
		await fireEvent.changeText(view.getByLabelText("Weight (pounds)"), "3");
		await fireEvent.press(view.getByLabelText("Save reading"));
		expect(await view.findByLabelText("Weight. First reading.")).toBeTruthy();

		await act(async () => expoRouter.replace("/body/weight"));
		expect(await view.findByText("12 st 3 lb")).toBeTruthy();
		const observation = (
			await new databaseApp.ObservationRepository(db).listAll()
		)
			.filter((row) => row.metricSlug === "weight")
			.at(-1);
		if (!observation) throw new Error("Expected a saved weight observation.");
		await fireEvent.changeText(
			view.getByLabelText(`Edit Weight ${observation.id} (pounds)`),
			"2",
		);
		await fireEvent.press(
			view.getByLabelText(`Save measurement ${observation.id}`),
		);
		await waitFor(() => expect(view.getByText("12 st 2 lb")).toBeTruthy());
		expect(
			(await new databaseApp.ObservationRepository(db).findById(observation.id))
				?.value,
		).toBe(170 * KILOGRAMS_PER_POUND);

		await fireEvent.press(view.getByText("Mark goal achieved"));
		expect(await view.findByText(/Achieved: target 12 st 0 lb/)).toBeTruthy();

		const canonicalObservation = (
			await new databaseApp.ObservationRepository(db).findById(observation.id)
		)?.value;
		const canonicalGoal = (
			await new databaseApp.GoalRepository(db).listAll()
		)[0]?.targetValue;
		await act(async () => expoRouter.replace("/settings/units"));
		expect(await view.findByText("Example: 12 st 4 lb")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Choose the unit for Weight"));
		await fireEvent.press(view.getByLabelText("Use Kilograms for Weight"));
		expect(await view.findByText("Example: 78.0 kg")).toBeTruthy();
		expect(
			await new databaseApp.UnitPreferenceRepository(
				db,
			).resolveLatestPerDimension(),
		).toMatchObject([{ dimension: "mass", unit: "kg" }]);
		expect(
			(await new databaseApp.ObservationRepository(db).findById(observation.id))
				?.value,
		).toBe(canonicalObservation);
		expect(
			(await new databaseApp.GoalRepository(db).listAll())[0]?.targetValue,
		).toBe(canonicalGoal);

		await act(async () => expoRouter.replace("/body"));
		expect(await view.findByLabelText("Weight. First reading.")).toBeTruthy();
		await act(async () => expoRouter.replace("/body/weight"));
		expect(await view.findByText(/Achieved: target 76.2 kg/)).toBeTruthy();
		await act(async () => expoRouter.replace("/insights"));
		expect(await view.findByText("Latest 77.1 kg")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(mockedUseSession).not.toHaveBeenCalled();
	});
});
