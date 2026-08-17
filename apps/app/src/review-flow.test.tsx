import type * as DatabaseApp from "@bro/database-app";
import { router as expoRouter } from "expo-router";
import {
	act,
	fireEvent,
	renderRouter,
	waitFor,
} from "expo-router/testing-library";
import { LIFE_AREA_CATALOGUE } from "./content/life-area-catalogue";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;

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
		useSession: jest.fn(),
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

describe("wheel-of-life review flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		databaseApp.closeDeviceSettings();
		mockSqlite.cleanup();
	});

	it("closes the review, focus, goal, and starter-content loop offline", async () => {
		databaseApp.readDeviceSettings();
		databaseApp.setOnboardingComplete(true);

		const firstRun = await renderRouter("src/app", { initialUrl: "/review" });
		await act(async () => undefined);
		expect(await firstRun.findByText("No reviews yet")).toBeTruthy();

		await fireEvent.press(firstRun.getByText("Take stock"));
		await waitFor(() => expect(expoRouter.canGoBack()).toBe(true));
		for (const area of LIFE_AREA_CATALOGUE.filter(
			(candidate) => candidate.defaultEnabled,
		)) {
			await fireEvent.press(firstRun.getByLabelText(`${area.label} 6`));
		}
		await fireEvent.press(firstRun.getByText("Choose focus areas"));
		expect(await firstRun.findByText("Choose your focus")).toBeTruthy();
		await fireEvent.press(firstRun.getByLabelText("Focus on Work & career"));
		await fireEvent.press(firstRun.getByText("Save review"));

		expect(await firstRun.findByLabelText("Wheel of life chart")).toBeTruthy();
		expect(firstRun.getAllByText("Your wheel").length).toBeGreaterThan(0);
		expect(
			firstRun.getByText(
				"This is your first snapshot. Your next review will show what moved.",
			),
		).toBeTruthy();
		expect(firstRun.getByText("Focus")).toBeTruthy();

		await fireEvent.press(firstRun.getByText("Read “A clearer working week”"));
		expect(await firstRun.findByText("DAY 1")).toBeTruthy();
		expect(firstRun.getByText("Name what matters")).toBeTruthy();
		await fireEvent.press(firstRun.getByText("Back to my wheel"));

		await fireEvent.press(
			await firstRun.findByText("Set a goal for Work & career"),
		);
		expect(
			await firstRun.findByText("Your current wheel score is 6/10."),
		).toBeTruthy();
		await fireEvent.changeText(firstRun.getByLabelText("Target score"), "8");
		await fireEvent.changeText(
			firstRun.getByLabelText("Target date (optional)"),
			"2026-12-01",
		);
		await fireEvent.press(firstRun.getByText("Save goal"));
		expect(
			await firstRun.findByText("Started at 6/10 · Latest 6/10 · Target 8/10"),
		).toBeTruthy();
		expect(firstRun.getByText("Target date 2026-12-01")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();

		firstRun.unmount();
		await databaseApp.closeDb();

		const secondRun = await renderRouter("src/app", { initialUrl: "/review" });
		await act(async () => undefined);
		expect(await secondRun.findByText("8 life areas")).toBeTruthy();
		expect(secondRun.getAllByLabelText(/^Open review /)).toHaveLength(1);
		expect(
			secondRun.getByText("Started at 6/10 · Latest 6/10 · Target 8/10"),
		).toBeTruthy();
		await fireEvent.press(secondRun.getByText("Mark Work & career achieved"));
		expect(await secondRun.findByText("Achieved")).toBeTruthy();

		await fireEvent.press(secondRun.getByText("Take stock"));
		expect(
			await secondRun.findByText("Nothing is saved until you finish."),
		).toBeTruthy();
		await act(async () => expoRouter.back());
		await waitFor(() =>
			expect(secondRun.getAllByLabelText(/^Open review /)).toHaveLength(1),
		);
		const assessments = new databaseApp.AssessmentRepository(
			databaseApp.getDb(),
		);
		expect(await assessments.listAll()).toHaveLength(1);

		await act(async () => expoRouter.replace("/"));
		await fireEvent.press(secondRun.getByText("Life"));
		expect(await secondRun.findByText("YOUR BIGGER PICTURE")).toBeTruthy();
		await fireEvent.press(secondRun.getByText("Take stock"));
		expect(
			await secondRun.findByText("Nothing is saved until you finish."),
		).toBeTruthy();
		await act(async () => expoRouter.back());

		await act(async () => expoRouter.replace("/trends"));
		await fireEvent.press(await secondRun.findByText("Open wheel reviews"));
		expect(await secondRun.findByText("Review history")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
