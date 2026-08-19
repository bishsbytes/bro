import type { SQLiteDatabase } from "expo-sqlite";
import type * as DatabaseApp from "./index";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

describe("habit and challenge repositories", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		jest.resetModules();
		databaseApp = jest.requireActual("./index");
		db = await databaseApp.initDb("habit-challenge-repositories.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("snapshots, edits, orders, and soft-removes habits", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.HabitRepository(db, {
			now: () => now,
			createId: () => `habit-${++nextId}`,
		});
		const steps = await repository.create({
			slug: "habit:steps-10k",
			customLabel: null,
			kind: "metric",
			metricSlug: "steps",
			direction: "at_least",
			targetValue: 10_000,
			areaSlug: "wheel:health",
			daysOfWeek: 0b111_1111,
			position: 1,
		});
		expect(steps.areaSlug).toBe("wheel:health");
		expect((await repository.findById(steps.id))?.areaSlug).toBe(
			"wheel:health",
		);
		await expect(
			repository.create({
				slug: "habit:mislabelled",
				customLabel: null,
				kind: "manual",
				metricSlug: null,
				direction: null,
				targetValue: null,
				areaSlug: "growth",
				daysOfWeek: 0b111_1111,
				position: 9,
			}),
		).rejects.toThrow("wheel: namespace");
		const reading = await repository.create({
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

		expect((await repository.listActive()).map(({ id }) => id)).toEqual([
			reading.id,
			steps.id,
		]);
		now = 2_000;
		await expect(
			repository.update(steps.id, {
				customLabel: "  Daily movement  ",
				targetValue: 8_000,
				areaSlug: "wheel:health",
				daysOfWeek: 0b001_1111,
				position: 0,
			}),
		).resolves.toMatchObject({
			slug: "habit:steps-10k",
			metricSlug: "steps",
			direction: "at_least",
			targetValue: 8_000,
			areaSlug: "wheel:health",
			customLabel: "Daily movement",
			createdAt: 1_000,
			updatedAt: 2_000,
		});

		now = 3_000;
		await expect(repository.remove(reading.id)).resolves.toMatchObject({
			removedAt: 3_000,
		});
		expect(await repository.listActive()).toHaveLength(1);
		expect(await repository.listAll()).toHaveLength(2);
	});

	it("stores only idempotent manual completions and supports undo", async () => {
		let nextHabitId = 0;
		const habits = new databaseApp.HabitRepository(db, {
			createId: () => `habit-${++nextHabitId}`,
		});
		const manual = await habits.create({
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
		const metric = await habits.create({
			slug: "habit:sleep-7h",
			customLabel: null,
			kind: "metric",
			metricSlug: "sleep_duration",
			direction: "at_least",
			targetValue: 25_200,
			areaSlug: null,
			daysOfWeek: 0b111_1111,
			position: 1,
		});
		let now = 10_000;
		let nextCompletionId = 0;
		const completions = new databaseApp.HabitCompletionRepository(db, {
			now: () => now,
			createId: () => `completion-${++nextCompletionId}`,
		});

		const first = await completions.complete(manual.id, "2026-08-16");
		now = 20_000;
		expect(await completions.complete(manual.id, "2026-08-16")).toEqual(first);
		expect(await completions.listByDay("2026-08-16")).toEqual([first]);
		await expect(completions.complete(metric.id, "2026-08-16")).rejects.toThrow(
			"derived",
		);
		expect(await completions.listByHabit(metric.id)).toEqual([]);
		await expect(completions.uncomplete(manual.id, "2026-08-16")).resolves.toBe(
			true,
		);
		await expect(completions.uncomplete(manual.id, "2026-08-16")).resolves.toBe(
			false,
		);
	});

	it("enforces one active run per challenge and permits a run after abandon", async () => {
		let now = 1_000;
		let nextId = 0;
		const enrolments = new databaseApp.ChallengeEnrolmentRepository(db, {
			now: () => now,
			createId: () => `enrolment-${++nextId}`,
		});
		const input = {
			challengeSlug: "challenge:health-intro",
			title: "Health reset",
			durationDays: 3,
			areaSlug: "wheel:health",
			startedOn: "2026-08-16",
		};
		const first = await enrolments.enrol(input);
		await expect(enrolments.enrol(input)).rejects.toThrow("active enrolment");

		now = 2_000;
		await expect(enrolments.abandon(first.id)).resolves.toMatchObject({
			abandonedAt: 2_000,
			completedAt: null,
		});
		now = 3_000;
		const second = await enrolments.enrol({
			...input,
			title: "Retuned catalogue title",
			startedOn: "2026-08-17",
		});
		expect(second.id).not.toBe(first.id);
		expect((await enrolments.listAll()).map(({ title }) => title)).toEqual([
			"Retuned catalogue title",
			"Health reset",
		]);
	});

	it("advances challenge days sequentially and closes on the final step", async () => {
		let now = 1_000;
		const enrolments = new databaseApp.ChallengeEnrolmentRepository(db, {
			now: () => now,
			createId: () => "enrolment-1",
		});
		const enrolment = await enrolments.enrol({
			challengeSlug: "challenge:health-intro",
			title: "Health reset",
			durationDays: 3,
			areaSlug: "wheel:health",
			startedOn: "2026-08-16",
		});
		let nextId = 0;
		const progress = new databaseApp.ChallengeProgressRepository(db, {
			now: () => now,
			createId: () => `progress-${++nextId}`,
		});

		await expect(
			progress.completeDay(enrolment.id, 2, "2026-08-16"),
		).rejects.toThrow("Next challenge day is 1");
		const dayOne = await progress.completeDay(enrolment.id, 1, "2026-08-16");
		now = 2_000;
		expect(await progress.completeDay(enrolment.id, 1, "2026-08-17")).toEqual(
			dayOne,
		);
		await progress.completeDay(enrolment.id, 2, "2026-08-19");
		now = 3_000;
		await progress.completeDay(enrolment.id, 3, "2026-08-23");

		expect(
			(await progress.listByEnrolment(enrolment.id)).map(
				({ dayIndex, localDay }) => [dayIndex, localDay],
			),
		).toEqual([
			[1, "2026-08-16"],
			[2, "2026-08-19"],
			[3, "2026-08-23"],
		]);
		expect(await enrolments.findById(enrolment.id)).toMatchObject({
			completedAt: 3_000,
			abandonedAt: null,
		});
		expect(await enrolments.listActive()).toEqual([]);
		await expect(
			progress.completeDay(enrolment.id, 4, "2026-08-24"),
		).rejects.toThrow("closed");
	});
});
