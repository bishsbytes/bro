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
	installationId: "install-food",
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

describe("food logging flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("logs, trends, goals, corrects, and composes a recipe with no request", async () => {
		mockedUseSession.mockClear();
		(globalThis.fetch as jest.Mock).mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);

		const router = renderRouter("src/app", { initialUrl: "/settings/food" });
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("Trends and goals")).toBeTruthy();
		await fireEvent(view.getByLabelText("Track Protein"), "valueChange", true);
		expect(await view.findByLabelText("Stop tracking Protein")).toBeTruthy();

		await fireEvent.press(view.getByText("Open food log"));
		await waitFor(() => expect(router.getPathname()).toBe("/food"));
		expect(await view.findByText("Nothing logged")).toBeTruthy();
		await fireEvent.press(view.getByText("Something else"));
		await fireEvent.changeText(
			view.getByLabelText("Food name"),
			"Chicken thighs",
		);
		await fireEvent.changeText(
			view.getByLabelText("Energy per serving (kcal)"),
			"210",
		);
		await fireEvent.changeText(
			view.getByLabelText("Protein per serving (g)"),
			"26",
		);
		await fireEvent.changeText(view.getByLabelText("Number of servings"), "2");
		await fireEvent.press(view.getByText("Save food"));
		expect(await view.findByText("52.0 g")).toBeTruthy();
		expect(
			(await new databaseApp.ConsumptionEntryRepository(db).listAll())[0],
		).toMatchObject({
			kind: "food",
			proteinG: 52,
		});

		await fireEvent.press(view.getByText("Set goal for Protein"));
		await fireEvent.changeText(view.getByLabelText("Target (g)"), "60");
		await fireEvent.press(view.getByText("Save goal"));
		expect(
			(await new databaseApp.GoalRepository(db).listAll())[0],
		).toMatchObject({
			metricSlug: "protein_intake",
			direction: "increase",
			targetValue: 0.06,
		});

		await act(async () => expoRouter.replace("/trends"));
		expect(await view.findByText("Latest 52.0 g")).toBeTruthy();
		await fireEvent.press(view.getByText("Open Food"));
		await fireEvent.press(await view.findByLabelText("Edit Chicken thighs"));
		await fireEvent.changeText(view.getByLabelText("Quantity"), "1");
		await fireEvent.press(view.getByText("Save changes"));
		expect(await view.findByText("26.0 g")).toBeTruthy();

		await act(async () => expoRouter.replace("/food"));
		await fireEvent.press(await view.findByText("Create"));
		await fireEvent.press(view.getByText("Recipe"));
		await fireEvent.changeText(view.getByLabelText("Name"), "Chicken bowl");
		await fireEvent.changeText(
			view.getByLabelText("Component name"),
			"Chicken and rice",
		);
		await fireEvent.changeText(view.getByLabelText("Component kcal"), "600");
		await fireEvent.changeText(view.getByLabelText("Protein (g)"), "52");
		await fireEvent.press(view.getByText("Add component"));
		await fireEvent.press(view.getByText("Save custom food"));
		expect(await view.findByText("1 recipe components")).toBeTruthy();

		await fireEvent.press(view.getByText("Choose custom food"));
		const chickenBowlMatches = view.getAllByText("Chicken bowl");
		const chickenBowlButton = chickenBowlMatches.at(-1);
		if (!chickenBowlButton) throw new Error("Expected the recipe log button.");
		await fireEvent.press(chickenBowlButton);
		await fireEvent.press(view.getByText("Save food"));
		const entries = await new databaseApp.ConsumptionEntryRepository(
			db,
		).listAll();
		expect(entries).toHaveLength(2);
		expect(entries.find(({ label }) => label === "Chicken bowl")).toMatchObject(
			{
				energyKcal: 600,
				proteinG: 52,
			},
		);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(mockedUseSession).not.toHaveBeenCalled();
	});
});
