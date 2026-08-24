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
		await view.findByLabelText("Mood 4");

		// The energy tap is what commits the check-in — there is no Save button.
		await fireEvent.press(view.getByLabelText("Mood 4"));
		await fireEvent.press(await view.findByLabelText("Energy 3"));

		expect(await view.findByText("1 check-in")).toBeTruthy();
		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const localDay = (await new CheckInStore(db).loadToday()).localDay;
		expect(
			(await observations.listByDay(localDay)).map((r) => r.metricSlug),
		).toEqual(["mood", "energy"]);
		// The pair is one transaction: a check-in never exists half-scored.
		expect(transaction).toHaveBeenCalledTimes(1);

		// Tags and the note describe the day, and each save its own write.
		await fireEvent.press(view.getByLabelText("Outdoors"));
		await act(async () => undefined);
		expect(transaction).toHaveBeenCalledTimes(2);
		await fireEvent.changeText(
			view.getByPlaceholderText("Anything worth remembering?"),
			"Strong finish",
		);
		await fireEvent.press(view.getByText("Save note"));
		await act(async () => undefined);
		expect(await notes.listByDay(localDay)).toMatchObject([
			{ body: "Strong finish" },
		]);

		// Measurements are day-level and logged from the Log screen (covered by
		// the body flow); seeding one here proves Today reads the day back.
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
			"mood",
			"outdoors",
			"weight",
		]);

		await fireEvent.press(view.getByLabelText("Mood 5"));
		await fireEvent.press(await view.findByLabelText("Energy 4"));
		expect(await view.findByText("2 check-ins")).toBeTruthy();

		// Tags belong to the day, so deselecting clears it for the day rather
		// than for the newest check-in only.
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
		expect(secondDay.filter((row) => row.metricSlug === "mood")).toHaveLength(
			2,
		);
		expect(secondDay.filter((row) => row.metricSlug === "energy")).toHaveLength(
			2,
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

		expect(await view.findByText("2 check-ins")).toBeTruthy();
		// Two product opens across the cold relaunch plus one local-store open.
		expect(mockSqlite.openDatabaseAsync).toHaveBeenCalledTimes(3);
		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
