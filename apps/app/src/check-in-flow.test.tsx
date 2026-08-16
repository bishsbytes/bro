import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";
import { KILOGRAMS_PER_POUND } from "./units";

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
		await view.findByText("How are you?");

		await fireEvent.press(view.getByLabelText("Mood 4"));
		await fireEvent.press(view.getByLabelText("Energy 3"));
		await fireEvent.press(view.getByLabelText("Alcohol"));
		await fireEvent.changeText(view.getByLabelText("Weight (st)"), "12 st 4");
		await fireEvent.changeText(
			view.getByPlaceholderText("Anything worth remembering?"),
			"Strong finish",
		);
		await fireEvent.press(view.getByText("Save check-in"));

		expect(await view.findByText("1 check-in")).toBeTruthy();
		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const firstDay = await observations.listByDay(
			(await new CheckInStore(db).loadToday()).localDay,
		);
		expect(firstDay.map((row) => row.metricSlug).sort()).toEqual([
			"alcohol",
			"energy",
			"mood",
			"weight",
		]);
		expect(firstDay.find((row) => row.metricSlug === "weight")).toMatchObject({
			value: 172 * KILOGRAMS_PER_POUND,
			scaleMin: null,
			scaleMax: null,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		expect(await notes.listByDay(firstDay[0].localDay)).toMatchObject([
			{ body: "Strong finish" },
		]);
		expect(transaction).toHaveBeenCalledTimes(1);

		await fireEvent.press(view.getByText("Add another check-in"));
		await fireEvent.press(view.getByLabelText("Mood 5"));
		await fireEvent.press(view.getByLabelText("Energy 4"));
		await fireEvent.press(view.getByLabelText("Alcohol"));
		await fireEvent.press(view.getByLabelText("Training"));
		await fireEvent.changeText(view.getByLabelText("Weight (st)"), "12 st 3");
		await fireEvent.press(view.getByText("Save check-in"));

		expect(await view.findByText("2 check-ins")).toBeTruthy();
		const secondDay = await observations.listByDay(firstDay[0].localDay);
		expect(secondDay.filter((row) => row.metricSlug === "mood")).toHaveLength(
			2,
		);
		expect(secondDay.filter((row) => row.metricSlug === "energy")).toHaveLength(
			2,
		);
		expect(
			secondDay.filter((row) => row.metricSlug === "alcohol"),
		).toHaveLength(0);
		expect(
			secondDay.filter((row) => row.metricSlug === "training"),
		).toHaveLength(1);
		expect(secondDay.filter((row) => row.metricSlug === "weight")).toHaveLength(
			2,
		);
		expect(
			secondDay.filter((row) => row.metricSlug === "weight").at(-1),
		).toMatchObject({ value: 171 * KILOGRAMS_PER_POUND });
		expect(transaction).toHaveBeenCalledTimes(2);
		expect(globalThis.fetch).not.toHaveBeenCalled();

		view.unmount();
		await databaseApp.closeDb();
		router = renderRouter("src/app", { initialUrl: "/" });
		view = await router;
		await act(async () => undefined);

		expect(await view.findByText("2 check-ins")).toBeTruthy();
		expect(
			await view.findByText("Measurements: Weight 12 st 3 lb"),
		).toBeTruthy();
		expect(mockSqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
