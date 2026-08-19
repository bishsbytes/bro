import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
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
	installationId: "install-history",
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

describe("history and day view", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("renders unknown slugs and duplicate notes, then hard-edits and deletes", async () => {
		mockedUseSession.mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const localDay = "2026-08-14";
		const base = {
			observedAt: Date.parse(`${localDay}T10:00:00.000Z`),
			localDay,
			tzOffsetMinutes: -60,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		};
		await observations.create({
			...base,
			metricSlug: "mood",
			value: 2,
			scaleMin: 1,
			scaleMax: 5,
		});
		await observations.create({
			...base,
			metricSlug: "energy",
			value: 3,
			scaleMin: 1,
			scaleMax: 5,
		});
		const unknown = await observations.create({
			...base,
			metricSlug: "future_metric",
			value: 42,
			scaleMin: null,
			scaleMax: null,
			source: "future-sync",
		});
		const factor = await observations.create({
			...base,
			metricSlug: "stress",
			value: 1,
			scaleMin: null,
			scaleMax: null,
		});
		await notes.create(localDay, "First synced note");
		await notes.create(localDay, "Second synced note");
		await notes.create("2026-08-10", "Older note");

		const router = renderRouter("src/app", {
			initialUrl: "/history",
		});
		const view = await router;
		await act(async () => undefined);
		await view.findByLabelText(`Open ${localDay}`);
		expect(
			view
				.getAllByLabelText(/^Open /)
				.map((entry) => entry.props.accessibilityLabel),
		).toEqual([`Open ${localDay}`, "Open 2026-08-10"]);
		await fireEvent.press(view.getByLabelText(`Open ${localDay}`));

		expect(await view.findByText("future_metric: 42")).toBeTruthy();
		expect(view.getByText("Source: future-sync")).toBeTruthy();
		expect(view.getByDisplayValue("First synced note")).toBeTruthy();
		expect(view.getByDisplayValue("Second synced note")).toBeTruthy();

		await fireEvent.press(view.getByLabelText("Mood 5"));
		await fireEvent.press(view.getByLabelText("Energy 4"));
		await fireEvent.press(view.getByText("Save changes"));
		await act(async () => undefined);
		let rows = await observations.listByDay(localDay);
		expect(rows.find((row) => row.metricSlug === "mood")?.value).toBe(5);
		expect(rows.find((row) => row.metricSlug === "energy")?.value).toBe(4);

		await fireEvent.press(view.getByText("Delete", { exact: true }));
		await waitFor(() =>
			expect(view.queryByText("future_metric: 42")).toBeNull(),
		);
		expect(await observations.findById(unknown.id)).toBeNull();
		await fireEvent.press(view.getByText("Remove"));
		await waitFor(() => expect(view.queryByText("Stress")).toBeNull());
		expect(await observations.findById(factor.id)).toBeNull();

		await fireEvent.changeText(
			view.getByDisplayValue("First synced note"),
			"Edited first note",
		);
		await fireEvent.press(view.getAllByText("Save note")[0]);
		await act(async () => undefined);
		expect(await notes.listByDay(localDay)).toMatchObject([
			{ body: "Edited first note" },
			{ body: "Second synced note" },
		]);
		await fireEvent.press(view.getAllByText("Delete note")[0]);
		await waitFor(() =>
			expect(view.queryByDisplayValue("Edited first note")).toBeNull(),
		);
		expect(await notes.listByDay(localDay)).toHaveLength(1);
		await fireEvent.press(view.getByText("Delete check-in"));
		await waitFor(() => expect(view.queryByText("Delete check-in")).toBeNull());
		rows = await observations.listByDay(localDay);
		expect(rows.filter((row) => row.metricSlug === "mood")).toHaveLength(0);
		expect(rows.filter((row) => row.metricSlug === "energy")).toHaveLength(0);

		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("renders free trends with both periods and a plain empty state", async () => {
		const trendsRouter = renderRouter("src/app", { initialUrl: "/trends" });
		const trendsView = await trendsRouter;
		await act(async () => undefined);
		expect(await trendsView.findByText("Mood")).toBeTruthy();
		expect(trendsView.getByText("Energy")).toBeTruthy();
		expect(trendsView.getByText("7 days")).toBeTruthy();
		expect(trendsView.getByText("30 days")).toBeTruthy();
		expect(trendsView.getAllByText(/Log 7 more days/)).toHaveLength(2);
	});
});
