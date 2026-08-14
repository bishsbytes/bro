import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

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

const { CheckInStore, localDayOf } = jest.requireActual(
	"./check-in/check-in-store",
) as typeof import("./check-in/check-in-store");

const CAPTURED_AT = new Date("2026-08-14T10:00:00");
const LOCAL_DAY = localDayOf(CAPTURED_AT);

async function openDatabase() {
	jest.resetModules();
	databaseApp = jest.requireActual("@bro/database-app");
	db = await databaseApp.initDb("check-in-store.db");
	await databaseApp.runMigrations(db);
}

function scoredObservation(
	metricSlug: string,
	value: number,
	scaleMin: number,
	scaleMax: number,
): DatabaseApp.CreateObservation {
	return {
		metricSlug,
		value,
		scaleMin,
		scaleMax,
		observedAt: CAPTURED_AT.getTime(),
		localDay: LOCAL_DAY,
		tzOffsetMinutes: CAPTURED_AT.getTimezoneOffset(),
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
	};
}

describe("check-in store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		await openDatabase();
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("preserves a row's scale snapshot when an entry is edited", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const mood = await observations.create(
			scoredObservation("mood", 7, 0, 10),
		);
		const energy = await observations.create(
			scoredObservation("energy", 2, 0, 10),
		);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.save(
			{ mood: 4, energy: 3, selectedFactorSlugs: [], note: "" },
			{ id: mood.id, observedAt: mood.observedAt, mood, energy },
		);

		expect(await observations.findById(mood.id)).toMatchObject({
			value: 4,
			scaleMin: 0,
			scaleMax: 10,
		});
		expect(await observations.findById(energy.id)).toMatchObject({
			value: 3,
			scaleMin: 0,
			scaleMax: 10,
		});
	});

	it("deletes the day's note when the prefilled field is saved empty", async () => {
		const notes = new databaseApp.DayNoteRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		const draft = { mood: 4, energy: 3, selectedFactorSlugs: [] };

		const saved = await store.save({ ...draft, note: "Keep me" });
		expect(saved.note).toBe("Keep me");

		const cleared = await store.save({ ...draft, note: "   " }, null);
		expect(cleared.note).toBe("");
		expect(await notes.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("clears only the note the form showed, retaining manufactured duplicates", async () => {
		const notes = new databaseApp.DayNoteRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		const draft = { mood: 4, energy: 3, selectedFactorSlugs: [] };

		await store.save({ ...draft, note: "Shown in the form" });
		const duplicate = await notes.create(LOCAL_DAY, "Replicated duplicate");

		await store.save({ ...draft, note: "" });

		expect(await notes.listByDay(LOCAL_DAY)).toMatchObject([
			{ id: duplicate.id, body: "Replicated duplicate" },
		]);
	});
});
