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

async function createManualHabit(id: string) {
	return await new databaseApp.HabitRepository(db, {
		now: () => 1_000,
		createId: () => id,
	}).create({
		slug: "habit:training",
		customLabel: null,
		kind: "manual",
		metricSlug: null,
		direction: null,
		targetValue: null,
		areaSlug: "wheel:health",
		daysOfWeek: 0b111_1111,
		position: 0,
	});
}

describe("transaction scope", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		jest.resetModules();
		databaseApp = jest.requireActual("./index");
		db = await databaseApp.initDb("transaction.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("lets a self-transacting method join the caller's transaction", async () => {
		const habit = await createManualHabit("habit-1");
		const completions = new databaseApp.HabitCompletionRepository(db, {
			now: () => 2_000,
			createId: () => "completion-1",
		});

		// Without a scope this nests BEGIN inside BEGIN and SQLite refuses.
		await databaseApp.withTransaction(db, async (scope) => {
			await completions.complete(habit.id, "2026-08-17", scope);
		});

		expect(
			await completions.findByHabitDay(habit.id, "2026-08-17"),
		).toMatchObject({ id: "completion-1" });
	});

	it("rolls the joined work back with the transaction that failed", async () => {
		const habit = await createManualHabit("habit-1");
		const completions = new databaseApp.HabitCompletionRepository(db, {
			now: () => 2_000,
			createId: () => "completion-1",
		});

		await expect(
			databaseApp.withTransaction(db, async (scope) => {
				await completions.complete(habit.id, "2026-08-17", scope);
				throw new Error("later write failed");
			}),
		).rejects.toThrow("later write failed");

		expect(await completions.findByHabitDay(habit.id, "2026-08-17")).toBeNull();
	});

	it("still opens its own transaction when called without a scope", async () => {
		const habit = await createManualHabit("habit-1");
		const completions = new databaseApp.HabitCompletionRepository(db, {
			now: () => 2_000,
			createId: () => "completion-1",
		});

		await completions.complete(habit.id, "2026-08-17");

		expect(
			await completions.findByHabitDay(habit.id, "2026-08-17"),
		).not.toBeNull();
	});

	it("returns the callback result to the caller", async () => {
		await expect(
			databaseApp.withTransaction(db, async () => "done"),
		).resolves.toBe("done");
	});

	it("refuses a scope belonging to another connection", async () => {
		const habit = await createManualHabit("habit-1");
		const completions = new databaseApp.HabitCompletionRepository(db, {
			now: () => 2_000,
			createId: () => "completion-1",
		});
		const otherDb = await databaseApp.initLocalDb("transaction-other.db");

		await expect(
			databaseApp.withTransaction(otherDb, async (foreignScope) => {
				await completions.complete(habit.id, "2026-08-17", foreignScope);
			}),
		).rejects.toThrow("different database connection");
	});
});
