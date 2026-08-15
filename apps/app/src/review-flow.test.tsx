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

	it("saves a whole sitting, survives relaunch, and abandons without writing", async () => {
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
		await fireEvent.press(firstRun.getByText("Save wheel"));

		expect(await firstRun.findByLabelText("Wheel of life chart")).toBeTruthy();
		expect(firstRun.getAllByText("Your wheel").length).toBeGreaterThan(0);
		expect(
			firstRun.getByText(
				"This is your first snapshot. Your next review will show what moved.",
			),
		).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();

		firstRun.unmount();
		await databaseApp.closeDb();

		const secondRun = await renderRouter("src/app", { initialUrl: "/review" });
		await act(async () => undefined);
		expect(await secondRun.findByText("8 life areas")).toBeTruthy();
		expect(secondRun.getAllByLabelText(/^Open review /)).toHaveLength(1);

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
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
