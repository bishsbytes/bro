import type * as DatabaseApp from "@bro/database-app";
import { resolveChallenge } from "@bro/domain/challenge-catalogue";
import { resolveHabit } from "@bro/domain/habit-catalogue";
import type { SQLiteDatabase } from "expo-sqlite";
import type { HabitsStore } from "./habits/habits-store";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;
let now: Date;
let store: HabitsStore;

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

function habit(slug: string) {
	const template = resolveHabit(slug);
	if (!template) throw new Error(`Missing habit template: ${slug}`);
	return template;
}

describe("habits store", () => {
	beforeEach(async () => {
		(globalThis.fetch as jest.Mock).mockClear();
		mockSqlite.reset();
		jest.resetModules();
		databaseApp = jest.requireActual("@bro/database-app");
		const { HabitsStore: HabitsStoreImpl } = jest.requireActual(
			"./habits/habits-store",
		) as typeof import("./habits/habits-store");
		db = await databaseApp.initDb("habits-store.db");
		await databaseApp.runMigrations(db);
		now = new Date("2026-08-17T12:00:00.000Z");
		store = new HabitsStoreImpl(
			db,
			() => now,
			() => "UTC",
			() => "en-GB",
		);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("combines manual taps and resolved metric truth on Today", async () => {
		await store.addTemplate(habit("habit:reading"), {
			label: "Read",
			daysOfWeek: 0b111_1111,
			targetValue: null,
			areaSlug: null,
		});
		await store.addTemplate(habit("habit:steps-10k"), {
			label: "Walk 10,000 steps",
			daysOfWeek: 0b111_1111,
			targetValue: 10_000,
			areaSlug: null,
		});
		await new databaseApp.DailyMetricRepository(db).upsert({
			metricSlug: "steps",
			localDay: "2026-08-17",
			value: 10_012,
			source: "health_connect",
		});

		let today = await store.loadToday();
		expect(today.habits).toEqual([
			expect.objectContaining({ label: "Read", completed: false, streak: 0 }),
			expect.objectContaining({
				label: "Walk 10,000 steps",
				completed: true,
				streak: 1,
				progressLabel: "10,012 / 10,000 steps",
			}),
		]);

		await store.toggleManual(today.habits[0].habit.id, today.localDay);
		today = await store.loadToday();
		expect(today.habits[0]).toMatchObject({ completed: true, streak: 1 });
		now = new Date("2026-08-18T12:00:00.000Z");
		today = await store.loadToday();
		expect(today.habits.map(({ streak }) => streak)).toEqual([1, 1]);
	});

	it("self-completes an alcohol-free day from the drink log", async () => {
		const alcoholFree = await store.addTemplate(habit("habit:alcohol-free"), {
			label: "Have an alcohol-free day",
			daysOfWeek: 0b111_1111,
			targetValue: 0,
			areaSlug: null,
		});
		expect(alcoholFree).toMatchObject({
			kind: "metric",
			metricSlug: "alcohol_intake",
			direction: "at_most",
			targetValue: 0,
		});

		// Nothing logged: the scheduled day reads as zero intake and completes.
		let today = await store.loadToday();
		expect(today.habits[0]).toMatchObject({
			completed: true,
			streak: 1,
			progressLabel: null,
		});

		// Silence over unlogged days extends the streak.
		now = new Date("2026-08-19T12:00:00.000Z");
		today = await store.loadToday();
		expect(today.habits[0]).toMatchObject({ completed: true, streak: 3 });

		// A logged drink with ethanol breaks the day and shows what was logged.
		await new databaseApp.ConsumptionEntryRepository(db).create({
			kind: "drink",
			catalogueRef: "drink:lager",
			label: "Lager",
			servingLabel: "pint",
			quantity: 1,
			volumeL: 0.568_261_25,
			ethanolKg: 0.020_181_999,
			caffeineKg: 0,
			energyKcal: 227,
			occurredAt: now.getTime(),
			localDay: "2026-08-19",
			tzOffsetMinutes: 0,
		});
		today = await store.loadToday();
		// Today's slip is not a recorded miss yet, so the streak still counts
		// the completed days through yesterday.
		expect(today.habits[0]).toMatchObject({ completed: false, streak: 2 });
		expect(today.habits[0].progressLabel).toMatch(/logged$/);

		const detail = await store.loadHabitDetail(alcoholFree.id);
		expect(detail?.days.slice(-3).map(({ state }) => state)).toEqual([
			"done",
			"done",
			"missed",
		]);
	});

	it("heals a metric streak after a late resolved-day import without logging completion", async () => {
		now = new Date("2026-08-14T12:00:00.000Z");
		const steps = await store.addTemplate(habit("habit:steps-10k"), {
			label: "Daily steps",
			daysOfWeek: 0b111_1111,
			targetValue: 10_000,
			areaSlug: null,
		});
		const metrics = new databaseApp.DailyMetricRepository(db);
		await metrics.upsert({
			metricSlug: "steps",
			localDay: "2026-08-14",
			value: 10_500,
			source: "health_connect",
		});
		await metrics.upsert({
			metricSlug: "steps",
			localDay: "2026-08-15",
			value: 9_000,
			source: "health_connect",
		});
		now = new Date("2026-08-16T12:00:00.000Z");

		expect((await store.loadToday()).habits[0]).toMatchObject({
			completed: false,
			streak: 0,
		});
		await metrics.upsert({
			metricSlug: "steps",
			localDay: "2026-08-15",
			value: 10_012,
			source: "health_connect",
		});

		expect((await store.loadToday()).habits[0]).toMatchObject({
			completed: false,
			streak: 2,
		});
		expect(
			await new databaseApp.HabitCompletionRepository(db).listByHabit(steps.id),
		).toEqual([]);
	});

	it("creates, edits, reorders, and soft-removes custom habits", async () => {
		const reading = await store.addTemplate(habit("habit:reading"), {
			label: "Books",
			daysOfWeek: 0b111_1111,
			targetValue: null,
			areaSlug: null,
		});
		// Template habits snapshot the authored area regardless of the draft.
		expect(reading.areaSlug).toBe("wheel:growth");
		const custom = await store.addCustom({
			label: "Practise piano",
			daysOfWeek: 0b001_0101,
			targetValue: null,
			areaSlug: "wheel:fun",
		});
		expect(custom.slug).toMatch(/^habit:custom:/);
		expect(custom.areaSlug).toBe("wheel:fun");
		await store.moveHabit(custom.id, -1);
		let settings = await store.loadSettings();
		expect(settings.active.map(({ label }) => label)).toEqual([
			"Practise piano",
			"Books",
		]);
		expect(settings.active.map(({ areaLabel }) => areaLabel)).toEqual([
			"Fun & recreation",
			"Learning & growth",
		]);
		expect(settings.areas.map(({ slug }) => slug)).toContain("wheel:growth");

		// A template habit keeps its snapshot even if the draft claims otherwise;
		// only custom habits are user-classifiable.
		const updatedReading = await store.updateHabit(reading, {
			label: "Read fiction",
			daysOfWeek: 0b100_0000,
			targetValue: null,
			areaSlug: null,
		});
		expect(updatedReading.areaSlug).toBe("wheel:growth");
		const reclassified = await store.updateHabit(custom, {
			label: "Practise piano",
			daysOfWeek: 0b001_0101,
			targetValue: null,
			areaSlug: "wheel:growth",
		});
		expect(reclassified.areaSlug).toBe("wheel:growth");
		await store.removeHabit(custom.id);
		settings = await store.loadSettings();
		expect(settings.active).toHaveLength(1);
		expect(settings.active[0]).toMatchObject({ label: "Read fiction" });
	});

	it("ends a removed habit's adherence record on its removal day", async () => {
		now = new Date("2026-08-14T12:00:00.000Z");
		const reading = await store.addTemplate(habit("habit:reading"), {
			label: "Read",
			daysOfWeek: 0b111_1111,
			targetValue: null,
			areaSlug: null,
		});
		await store.toggleManual(reading.id, "2026-08-14");
		now = new Date("2026-08-15T12:00:00.000Z");
		await store.removeHabit(reading.id);
		now = new Date("2026-08-17T12:00:00.000Z");

		const detail = await store.loadHabitDetail(reading.id);
		expect(detail?.days.slice(-4).map((day) => day.state)).toEqual([
			"done",
			"missed",
			"unscheduled",
			"unscheduled",
		]);
	});

	it("enrols, pauses by completion, finishes, and retains history", async () => {
		const enrolment = await store.startChallenge("challenge:health-basics");
		expect(await store.startChallenge("challenge:health-basics")).toEqual(
			enrolment,
		);
		let detail = await store.loadChallenge(enrolment.id);
		expect(detail).toMatchObject({ nextDayIndex: 1, isFinished: false });

		detail = await store.completeChallengeDay(enrolment.id, 1);
		expect(detail.nextDayIndex).toBe(2);
		now = new Date("2026-08-20T12:00:00.000Z");
		detail = await store.completeChallengeDay(enrolment.id, 2);
		expect(detail.nextDayIndex).toBe(3);
		now = new Date("2026-08-24T12:00:00.000Z");
		detail = await store.completeChallengeDay(enrolment.id, 3);
		expect(detail).toMatchObject({ nextDayIndex: null, isFinished: true });
		expect((await store.loadToday()).challenges).toEqual([]);

		const { HistoryStore } = jest.requireActual(
			"./history/history-store",
		) as typeof import("./history/history-store");
		const history = await new HistoryStore(db).loadDay("2026-08-20");
		expect(history.challengeSteps).toEqual([
			expect.objectContaining({
				title: resolveChallenge("challenge:health-basics")?.title,
				dayIndex: 2,
				dayTitle: "Make rest easier",
			}),
		]);
		const rerun = await store.startChallenge("challenge:health-basics");
		expect(rerun.id).not.toBe(enrolment.id);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("renders a retired challenge from its enrolment snapshot", async () => {
		const enrolment = await new databaseApp.ChallengeEnrolmentRepository(
			db,
		).enrol({
			challengeSlug: "challenge:retired",
			title: "A challenge remembered",
			durationDays: 4,
			areaSlug: "wheel:growth",
			startedOn: "2026-08-17",
		});

		await expect(store.loadChallenge(enrolment.id)).resolves.toMatchObject({
			title: "A challenge remembered",
			durationDays: 4,
			nextDayIndex: 1,
			currentDay: null,
			contentAvailable: false,
		});
	});
});
