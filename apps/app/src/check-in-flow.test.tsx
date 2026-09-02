import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_PER_POUND } from "@bro/domain";
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
const { CheckInStore } = jest.requireActual(
	"./check-in/check-in-store",
) as typeof import("./check-in/check-in-store");
const mockedUseSession = (authClient as unknown as { useSession: jest.Mock })
	.useSession;

describe("daily check-in flow", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("persists two offline check-ins atomically across a cold relaunch", async () => {
		mockedUseSession.mockClear();
		(globalThis.fetch as jest.Mock).mockClear();
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"weight",
			0,
			true,
		);
		await new databaseApp.UnitPreferenceRepository(db).set("mass", "st");
		const transaction = jest.spyOn(db, "withTransactionAsync");

		let router = renderRouter("src/app", { initialUrl: "/" });
		let view = await router;
		await act(async () => undefined);
		await view.findByText("Morning");

		// The card tapped in the journal opens that sitting, and each score it
		// asks is put on its own page.
		await fireEvent.press(view.getByLabelText("Start Morning check-in"));
		await fireEvent.press(await view.findByLabelText("Mood 4"));
		await fireEvent.press(await view.findByLabelText("Energy 3"));
		await fireEvent.press(await view.findByLabelText("Motivation 5"));
		expect(await view.findByText("Checked in")).toBeTruthy();
		await fireEvent.press(view.getByText("Done"));

		// The finished sitting reports itself on the card that opened it.
		expect(
			await view.findByText("Mood 4 · Energy 3 · Motivation 5"),
		).toBeTruthy();

		// The evening asks its own scores and is a separate sitting entirely.
		await fireEvent.press(view.getByLabelText("Start Evening check-in"));
		await fireEvent.press(await view.findByLabelText("Mood 3"));
		await fireEvent.press(await view.findByLabelText("Productivity 4"));
		await fireEvent.press(await view.findByLabelText("Libido 2"));
		expect(await view.findByText("Checked in")).toBeTruthy();
		await fireEvent.press(view.getByText("Done"));
		expect(
			await view.findByText("Mood 3 · Productivity 4 · Libido 2"),
		).toBeTruthy();

		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const localDay = (await new CheckInStore(db).loadToday()).localDay;
		expect(
			(await observations.listByDay(localDay)).map((r) => [
				r.metricSlug,
				r.slot,
			]),
		).toEqual([
			["mood", "morning"],
			["energy", "morning"],
			["motivation", "morning"],
			["mood", "evening"],
			["productivity", "evening"],
			["libido", "evening"],
		]);
		// Each sitting is written whole, in one transaction of its own.
		expect(transaction).toHaveBeenCalledTimes(2);

		// Tags describe the day from the journal. Notes use the focused composer.
		await fireEvent.press(view.getByLabelText("Outdoors"));
		await act(async () => undefined);
		expect(transaction).toHaveBeenCalledTimes(3);
		await fireEvent.press(view.getByLabelText("Log"));
		await fireEvent.press(view.getByLabelText("Note"));
		expect(
			await view.findByPlaceholderText("What's on your mind?"),
		).toBeTruthy();
		await fireEvent.changeText(view.getByLabelText("Note"), "Strong finish");
		await fireEvent.press(view.getByText("Save note"));
		await act(async () => undefined);
		expect(await notes.listByDay(localDay)).toMatchObject([
			{ body: "Strong finish" },
		]);

		// Measurements are day-level and logged from the Log screen (covered by
		// the body flow); seeding one here proves the journal reads the day back.
		await observations.create({
			metricSlug: "weight",
			value: 172 * KILOGRAMS_PER_POUND,
			scaleMin: null,
			scaleMax: null,
			observedAt: Date.now(),
			localDay,
			tzOffsetMinutes: new Date().getTimezoneOffset(),
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});

		const firstDay = await observations.listByDay(localDay);
		expect(firstDay.map((row) => row.metricSlug).sort()).toEqual([
			"energy",
			"libido",
			"mood",
			"mood",
			"motivation",
			"outdoors",
			"productivity",
			"weight",
		]);

		// Reopening a finished sitting rewrites it: a slot holds one check-in, so
		// answering the morning again must not leave the day with two of them.
		await fireEvent.press(
			view.getByLabelText(
				"Edit Morning check-in: Mood 4 · Energy 3 · Motivation 5",
			),
		);
		await fireEvent.press(await view.findByLabelText("Mood 5"));
		await fireEvent.press(await view.findByLabelText("Energy 4"));
		await fireEvent.press(await view.findByLabelText("Motivation 4"));
		await fireEvent.press(await view.findByText("Done"));
		expect(
			await view.findByText("Mood 5 · Energy 4 · Motivation 4"),
		).toBeTruthy();

		// Tags belong to the day, so deselecting clears it for the day rather
		// than for one sitting only.
		await fireEvent.press(view.getByLabelText("Outdoors"));
		await act(async () => undefined);
		await fireEvent.press(view.getByLabelText("Training"));
		await act(async () => undefined);

		const secondDay = await observations.listByDay(localDay);
		expect(
			secondDay.filter((row) => row.metricSlug === "outdoors"),
		).toHaveLength(0);
		expect(
			secondDay.filter((row) => row.metricSlug === "training"),
		).toHaveLength(1);
		// One mood per sitting, still — the rewrite added nothing.
		expect(secondDay.filter((row) => row.metricSlug === "mood")).toHaveLength(
			2,
		);
		expect(secondDay.filter((row) => row.metricSlug === "energy")).toHaveLength(
			1,
		);
		expect(secondDay.filter((row) => row.metricSlug === "weight")).toHaveLength(
			1,
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();

		view.unmount();
		await databaseApp.closeDb();
		router = renderRouter("src/app", { initialUrl: "/" });
		view = await router;
		await act(async () => undefined);

		expect(
			await view.findByText("Mood 5 · Energy 4 · Motivation 4"),
		).toBeTruthy();
		expect(
			await view.findByText("Mood 3 · Productivity 4 · Libido 2"),
		).toBeTruthy();
		// Two product opens across the cold relaunch plus one local-store open.
		expect(mockSqlite.openDatabaseAsync).toHaveBeenCalledTimes(3);
		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
