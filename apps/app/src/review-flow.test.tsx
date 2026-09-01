import type * as DatabaseApp from "@bro/database-app";
import { LIFE_AREA_CATALOGUE } from "@bro/domain/life-area-catalogue";
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

		await fireEvent.press(firstRun.getByRole("button", { name: "Take stock" }));
		await waitFor(() => expect(expoRouter.canGoBack()).toBe(true));
		// One area at a time, the way the check-in asks for one score at a time.
		for (const area of LIFE_AREA_CATALOGUE.filter(
			(candidate) => candidate.defaultEnabled,
		)) {
			expect(await firstRun.findByText(area.label)).toBeTruthy();
			// The areas are scored on one adjustable rail, so a score is a press
			// at a point along it rather than a button of its own.
			const width = 1000;
			await fireEvent(
				firstRun.getByTestId("discrete-scale-points", {
					includeHiddenElements: true,
				}),
				"layout",
				{ nativeEvent: { layout: { x: 0, y: 0, width, height: 64 } } },
			);
			await fireEvent.press(firstRun.getByLabelText(`${area.label} score`), {
				nativeEvent: { locationX: undefined, offsetX: 5.5 * (width / 10) },
			});
		}
		// Answering the last area lands on the focus step with no button to press.
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

		// A focused area also suggests its catalogue habits, prefilled for adding.
		await fireEvent.press(
			await firstRun.findByText("Add habit “Choose the week's priority”"),
		);
		expect(
			await firstRun.findByDisplayValue("Choose the week's priority"),
		).toBeTruthy();
		await fireEvent.press(firstRun.getByText("Save habit"));
		expect(
			await firstRun.findByText("Tap to complete · Work & career"),
		).toBeTruthy();
		const habits = new databaseApp.HabitRepository(databaseApp.getDb());
		const [habit] = await habits.listActive();
		if (!habit) throw new Error("Expected a saved starter habit.");
		await habits.update(habit.id, {
			customLabel: habit.customLabel,
			targetValue: habit.targetValue,
			areaSlug: habit.areaSlug,
			daysOfWeek: 0b111_1111,
			position: habit.position,
		});
		await act(async () => expoRouter.back());

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

		await fireEvent.press(
			secondRun.getByRole("button", { name: "Take stock" }),
		);
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
		await fireEvent.press(await secondRun.findByText("Mark done"));
		await fireEvent.press(secondRun.getByText("Life"));
		expect(await secondRun.findByText("Your wheel")).toBeTruthy();
		expect(secondRun.getByLabelText("Wheel of life chart")).toBeTruthy();
		expect(secondRun.getByText("1 today · 1 complete")).toBeTruthy();
		expect(secondRun.queryByText("Time to take stock")).toBeNull();

		await act(async () => expoRouter.replace("/insights"));
		await fireEvent.press(await secondRun.findByLabelText("Open history"));
		await waitFor(() => expect(expoRouter.canGoBack()).toBe(true));
		expect(await secondRun.findByLabelText("Open Today")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
