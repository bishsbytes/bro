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
	themeMode: "system",
	accentColor: "neutral",
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
	afterEach(() => {
		delete process.env.EXPO_PUBLIC_API_URL;
	});

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
		await fireEvent.press(view.getByLabelText("Log food"));
		await waitFor(() => expect(router.getPathname()).toBe("/food/log"));
		await fireEvent.press(await view.findByText("Custom log"));
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
		await waitFor(() => expect(router.getPathname()).toBe("/food"));
		expect(await view.findByText("52.0 g")).toBeTruthy();
		expect(
			(await new databaseApp.ConsumptionEntryRepository(db).listAll())[0],
		).toMatchObject({
			kind: "food",
			proteinG: 52,
		});

		await fireEvent.press(view.getByText("Daily goals"));
		await waitFor(() => expect(router.getPathname()).toBe("/food/goals"));
		await fireEvent.press(await view.findByText("Set goal for Protein"));
		await fireEvent.changeText(view.getByLabelText("Target (g)"), "60");
		await fireEvent.press(view.getByText("Save goal"));
		expect(
			(await new databaseApp.GoalRepository(db).listAll())[0],
		).toMatchObject({
			metricSlug: "protein_intake",
			direction: "increase",
			targetValue: 0.06,
		});

		await act(async () => expoRouter.replace("/insights"));
		expect(await view.findByText("Latest 52.0 g")).toBeTruthy();
		await act(async () => expoRouter.replace("/food"));
		await fireEvent.press(await view.findByLabelText("Edit Chicken thighs"));
		await fireEvent.changeText(view.getByLabelText("Quantity"), "1");
		await fireEvent.press(view.getByText("Save changes"));
		expect(await view.findByText("26.0 g")).toBeTruthy();

		await act(async () => expoRouter.replace("/food/custom"));
		await fireEvent.press(await view.findByText("Create"));
		expect(view.getByText("Nutrition per serving")).toBeTruthy();
		expect(view.getByLabelText("Energy (kcal)")).toBeTruthy();
		expect(view.getByLabelText("Protein (g)")).toBeTruthy();
		expect(view.getByLabelText("Carbs (g)")).toBeTruthy();
		expect(view.getByLabelText("Fat (g)")).toBeTruthy();
		await fireEvent.changeText(view.getByLabelText("Name"), "Empty food");
		expect(
			view.getByText("Enter at least one of energy, protein, carbs, or fat."),
		).toBeTruthy();
		expect(
			view.getByLabelText("Save custom food").props.accessibilityState,
		).toMatchObject({ disabled: true });
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
		expect(await view.findByText("1 recipe component")).toBeTruthy();

		await act(async () => expoRouter.replace("/food/log"));
		await fireEvent.press(await view.findByLabelText("Log Chicken bowl"));
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
		await act(async () => expoRouter.replace("/food/log"));
		await fireEvent.press(await view.findByLabelText("Log Chicken bowl again"));
		expect(await view.findByText("Chicken bowl added")).toBeTruthy();
		const repeatedFood = (
			await new databaseApp.ConsumptionEntryRepository(db).listAll()
		).find(({ id }) => !entries.some((entry) => entry.id === id));
		if (!repeatedFood) throw new Error("Expected the repeated food entry.");
		await fireEvent.press(view.getByText("View log"));
		expect(router.getPathname()).toBe(`/food/${repeatedFood.localDay}`);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
		expect(mockedUseSession).not.toHaveBeenCalled();
	});

	it("searches anonymously, shows attribution, logs a snapshot, and falls back to cache", async () => {
		process.env.EXPO_PUBLIC_API_URL = "https://api.example.test";
		(globalThis.fetch as jest.Mock).mockReset();
		(globalThis.fetch as jest.Mock).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					results: [
						{
							ref: "off:12345678",
							label: "Provider chicken thighs",
							brand: "Example",
							source: "Open Food Facts",
							licence: "ODbL-1.0",
							servings: [
								{
									id: "100g",
									label: "100 g",
									energyKcal: 210,
									proteinG: 26,
									carbsG: 0,
									fatG: null,
								},
							],
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);

		const router = renderRouter("src/app", { initialUrl: "/food/log" });
		const view = await router;
		expect(await view.findByText("Recent foods")).toBeTruthy();
		expect(view.getByLabelText("Log Chicken thighs again")).toBeTruthy();
		expect(view.getByText("Custom log")).toBeTruthy();
		const searchBar = view.getByLabelText("Food search");
		await fireEvent.changeText(searchBar, "chicken");
		expect(view.getByLabelText("Clear search")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Clear search"));
		expect(view.getByLabelText("Food search").props.value).toBe("");
		await fireEvent.changeText(
			view.getByLabelText("Food search"),
			"chicken thighs",
		);
		expect(await view.findByText("Open Food Facts · ODbL-1.0")).toBeTruthy();
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			"https://api.example.test/api/food/search?q=chicken+thighs",
			expect.objectContaining({
				method: "GET",
				credentials: "omit",
				headers: { Accept: "application/json" },
			}),
		);
		await fireEvent.press(
			view.getByLabelText("Choose Provider chicken thighs"),
		);
		expect(view.getByText("Log Provider chicken thighs")).toBeTruthy();
		await fireEvent.changeText(view.getByLabelText("Number of servings"), "2");
		await fireEvent.press(view.getByText("Save searched food"));
		expect(
			(
				await new databaseApp.ConsumptionEntryRepository(
					databaseApp.getDb(),
				).listAll()
			).find(({ consumableRef }) => consumableRef === "off:12345678"),
		).toMatchObject({
			label: "Example · Provider chicken thighs",
			energyKcal: 420,
			proteinG: 52,
			carbsG: 0,
			fatG: null,
		});

		await act(async () => expoRouter.replace("/food/log"));
		const retrySearchBar = view.getByLabelText("Food search");
		(globalThis.fetch as jest.Mock).mockRejectedValueOnce(
			new TypeError("Network request failed"),
		);
		await fireEvent.changeText(retrySearchBar, "chicken thighs");
		expect(
			await view.findByText(
				"Search needs a connection. Your recents, custom foods, and saved results are still available.",
			),
		).toBeTruthy();
		await fireEvent.press(
			view.getByText(
				"Food data from Open Food Facts under ODbL 1.0 · Licence details",
			),
		);
		await waitFor(() =>
			expect(router.getPathname()).toBe("/settings/licences"),
		);
		expect(
			await view.findByText("Source: Open Food Facts · Licence: ODbL-1.0"),
		).toBeTruthy();
	});
});
