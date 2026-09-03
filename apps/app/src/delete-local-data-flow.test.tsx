import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import * as Notifications from "expo-notifications";
import {
	act,
	fireEvent,
	renderRouter,
	waitFor,
} from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
const mockSessionState = {
	data: {
		user: { id: "user-a", name: "Ada", email: "ada@example.com" },
		session: { id: "session-user-a" },
	},
	isPending: false,
	error: null,
	refetch: jest.fn(),
};

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
		useSession: jest.fn(() => mockSessionState),
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
const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

const DELETE_COPY =
	"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.";

describe("delete local data", () => {
	afterAll(async () => {
		await Promise.all([databaseApp.closeDb(), databaseApp.closeLocalDb()]);
		databaseApp.closeDeviceSettings();
		mockSqlite.cleanup();
	});

	it("clears every product table but preserves migrations, settings, and session", async () => {
		databaseApp.readDeviceSettings();
		databaseApp.setOnboardingComplete(true);
		databaseApp.setRemoteSessionMarker(true, "user-a");
		const settingsBefore = databaseApp.readDeviceSettings();

		const db = await databaseApp.initDb();
		const localDb = await databaseApp.initLocalDb();
		await Promise.all([
			databaseApp.runMigrations(db),
			databaseApp.runLocalMigrations(localDb),
		]);
		const observations = new databaseApp.ObservationRepository(db);
		const notes = new databaseApp.DayNoteRepository(db);
		const trackedMetrics = new databaseApp.TrackedMetricsRepository(db);
		const reminders = new databaseApp.ReminderRepository(db);
		const assessments = new databaseApp.AssessmentRepository(db);
		const goals = new databaseApp.GoalRepository(db);
		const unitPreferences = new databaseApp.UnitPreferenceRepository(db);
		const dailyMetrics = new databaseApp.DailyMetricRepository(db);
		const habits = new databaseApp.HabitRepository(db);
		const habitCompletions = new databaseApp.HabitCompletionRepository(db);
		const challengeEnrolments = new databaseApp.ChallengeEnrolmentRepository(
			db,
		);
		const challengeProgress = new databaseApp.ChallengeProgressRepository(db);
		const intakeEvents = new databaseApp.IntakeEventRepository(db);
		const consumables = new databaseApp.ConsumableRepository(db);
		const intakeStreams = new databaseApp.IntakeStreamRepository(db);
		await observations.create({
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			slot: "morning",
			observedAt: Date.parse("2026-08-14T10:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: -60,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		await notes.create("2026-08-14", "Delete me");
		await trackedMetrics.configure("alcohol", 6, false);
		await reminders.create({
			minuteOfDay: 1_200,
			daysOfWeek: 0b111_1111,
			slot: "evening",
		});
		await assessments.createWithObservations({
			templateSlug: "wheel-of-life",
			templateVersion: 1,
			startedAt: Date.parse("2026-08-14T11:00:00.000Z"),
			completedAt: Date.parse("2026-08-14T11:05:00.000Z"),
			items: [{ slug: "wheel:career", label: "Work & career", position: 0 }],
			focusItemSlugs: ["wheel:career"],
			observations: [
				{
					metricSlug: "wheel:career",
					value: 6,
					scaleMin: 1,
					scaleMax: 10,
					observedAt: Date.parse("2026-08-14T11:05:00.000Z"),
					localDay: "2026-08-14",
					tzOffsetMinutes: -60,
					source: "user",
					sourceRecordId: null,
				},
			],
		});
		await goals.create({
			metricSlug: "wheel:career",
			direction: "increase",
			targetValue: 8,
			targetDate: null,
			startedAt: Date.parse("2026-08-14T11:05:00.000Z"),
		});
		await unitPreferences.set("mass", "st");
		await dailyMetrics.upsert({
			metricSlug: "weight",
			localDay: "2026-08-14",
			value: 80,
			source: "health_connect",
		});
		const habit = await habits.create({
			slug: "habit:reading",
			customLabel: null,
			kind: "manual",
			metricSlug: null,
			direction: null,
			targetValue: null,
			areaSlug: null,
			daysOfWeek: 0b111_1111,
			position: 0,
		});
		await habitCompletions.complete(habit.id, "2026-08-14");
		const enrolment = await challengeEnrolments.enrol({
			challengeSlug: "challenge:health-intro",
			title: "Health reset",
			durationDays: 3,
			areaSlug: "wheel:health",
			startedOn: "2026-08-14",
		});
		await challengeProgress.completeDay(enrolment.id, 1, "2026-08-14");
		await intakeEvents.create({
			kind: "drink",
			consumableId: null,
			sourceRef: "system:drink:lager-4_5",
			name: "Lager",
			brand: null,
			portionLabel: "pint",
			quantity: 1,
			massKg: null,
			volumeL: 0.568_261_25,
			constituents: {
				fluid: 0.568_261_25,
				ethanol: 0.020_181_999,
				energy: 227,
			},
			context: null,
			notes: null,
			occurredAt: Date.parse("2026-08-14T21:00:00.000Z"),
			localDay: "2026-08-14",
			tzOffsetMinutes: -60,
		});
		const recipe = await consumables.create({
			kind: "food",
			name: "Traybake",
			brand: null,
			barcode: null,
			basis: { type: "portion", portionId: "plate" },
			constituents: {},
			portions: [],
			defaultPortionId: null,
			recipe: { yield: { quantity: 1, unit: "portion" } },
			source: { type: "user" },
		});
		await consumables.addIngredient(recipe.id, {
			position: 0,
			consumableId: null,
			sourceRef: null,
			name: "Chicken",
			portionLabel: null,
			quantity: 2,
			massKg: null,
			volumeL: null,
			constituents: {
				energy: 500,
				protein: 0.04,
				carbohydrate: 0.05,
				fat: 0.02,
			},
		});
		await intakeStreams.setEnabled("nicotine", true);
		const healthConnections = new databaseApp.HealthConnectionRepository(
			localDb,
		);
		const rawSamples = new databaseApp.RawSampleRepository(localDb);
		const foodCache = new databaseApp.FoodCacheRepository(localDb);
		await healthConnections.connect("health_connect", "weight");
		await rawSamples.upsert({
			metricSlug: "weight",
			value: 80,
			startedAt: Date.parse("2026-08-14T07:00:00.000Z"),
			endedAt: Date.parse("2026-08-14T07:00:00.000Z"),
			localDay: "2026-08-14",
			source: "health_connect",
			sourceRecordId: "scale-1",
		});
		await foodCache.upsert({
			ref: "off:delete-me",
			query: "traybake",
			payload: { ref: "off:delete-me", name: "Traybake" },
		});
		(
			Notifications.getAllScheduledNotificationsAsync as jest.Mock
		).mockResolvedValue([
			{ identifier: "checkin-reminder:reminder-1:2026-08-14" },
			{ identifier: "another-domain:one" },
		]);
		const markerBefore = await db.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __drizzle_migrations",
		);
		const localMarkerBefore = await localDb.getFirstAsync<{ count: number }>(
			"SELECT COUNT(*) AS count FROM __drizzle_migrations",
		);
		const transaction = jest.spyOn(db, "withTransactionAsync");
		const localTransaction = jest.spyOn(localDb, "withTransactionAsync");

		const router = renderRouter("src/app", {
			initialUrl: "/settings/data/delete",
		});
		const view = await router;
		await act(async () => undefined);
		expect(await view.findByText("Data on this device")).toBeTruthy();
		expect(view.queryByText(DELETE_COPY)).toBeNull();

		await fireEvent.press(view.getByText("Delete local data"));
		expect(view.getByText(DELETE_COPY)).toBeTruthy();
		expect(await observations.listAll()).toHaveLength(2);
		expect(await notes.listAll()).toHaveLength(1);
		expect(await trackedMetrics.listAll()).toHaveLength(1);
		expect(await intakeEvents.listAll()).toHaveLength(1);
		expect(await consumables.listAll()).toHaveLength(1);
		expect(await consumables.listIngredients(recipe.id)).toHaveLength(1);
		expect(await intakeStreams.listAll()).toHaveLength(1);
		expect(await foodCache.listRecent()).toHaveLength(1);

		await fireEvent.press(view.getByText("Cancel"));
		expect(view.queryByText(DELETE_COPY)).toBeNull();
		expect(await observations.listAll()).toHaveLength(2);

		await fireEvent.press(view.getByText("Delete local data"));
		await fireEvent.press(view.getByText("Permanently delete local data"));
		expect(await view.findByText("Local data deleted")).toBeTruthy();

		expect(await observations.listAll()).toEqual([]);
		expect(await notes.listAll()).toEqual([]);
		expect(await trackedMetrics.listAll()).toEqual([]);
		expect(await reminders.listAll()).toEqual([]);
		expect(await assessments.listAll()).toEqual([]);
		expect(await goals.listAll()).toEqual([]);
		expect(await unitPreferences.list()).toEqual([]);
		expect(await dailyMetrics.listByMetric("weight")).toEqual([]);
		expect(await habits.listAll()).toEqual([]);
		expect(await habitCompletions.listByDay("2026-08-14")).toEqual([]);
		expect(await challengeEnrolments.listAll()).toEqual([]);
		expect(await challengeProgress.listByDay("2026-08-14")).toEqual([]);
		expect(await intakeEvents.listAll()).toEqual([]);
		expect(await consumables.listAll()).toEqual([]);
		expect(await consumables.listIngredients(recipe.id)).toEqual([]);
		expect(await intakeStreams.listAll()).toEqual([]);
		expect(await healthConnections.list()).toEqual([]);
		expect(await rawSamples.listByMetricDay("weight", "2026-08-14")).toEqual(
			[],
		);
		expect(await foodCache.listRecent()).toEqual([]);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(localTransaction).toHaveBeenCalledTimes(1);
		const cancelMock =
			Notifications.cancelScheduledNotificationAsync as jest.Mock;
		expect(cancelMock).toHaveBeenCalledTimes(1);
		expect(cancelMock).toHaveBeenCalledWith(
			"checkin-reminder:reminder-1:2026-08-14",
		);
		// Cancel-all is the one side effect the transaction cannot carry; it must
		// run after the commit so a failed delete never half-silences.
		expect(cancelMock.mock.invocationCallOrder[0]).toBeGreaterThan(
			transaction.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
		);
		expect(
			await db.getFirstAsync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM __drizzle_migrations",
			),
		).toEqual(markerBefore);
		expect(
			await localDb.getFirstAsync<{ count: number }>(
				"SELECT COUNT(*) AS count FROM __drizzle_migrations",
			),
		).toEqual(localMarkerBefore);
		expect(databaseApp.readDeviceSettings()).toEqual(settingsBefore);
		expect(mockedAuthClient.signOut).not.toHaveBeenCalled();
		expect(mockedAuthClient.deleteUser).not.toHaveBeenCalled();

		await fireEvent.press(view.getByText("Back to today"));
		await waitFor(() => expect(router.getPathname()).toBe("/"));
		expect(await view.findByText("Morning")).toBeTruthy();
		expect(view.queryByText("Logged today")).toBeNull();

		await fireEvent.press(view.getByLabelText("Settings"));
		expect(await view.findByText("ada@example.com")).toBeTruthy();
		expect(mockedAuthClient.useSession).toHaveBeenCalled();
		expect(databaseApp.readDeviceSettings()).toEqual(settingsBefore);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
