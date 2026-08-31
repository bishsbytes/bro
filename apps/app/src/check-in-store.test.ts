import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_PER_POUND, localDayOf } from "@bro/domain";
import {
	hasCompletedCheckIn,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { buildTrendSeries } from "@bro/logic";
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

const { CheckInStore } = jest.requireActual(
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
		const mood = await observations.create({
			...scoredObservation("mood", 7, 0, 10),
			slot: "morning",
		});
		const energy = await observations.create({
			...scoredObservation("energy", 2, 0, 10),
			slot: "morning",
		});
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.saveCheckIn(
			"morning",
			{ mood: 4, optional: { energy: 3 } },
			{
				id: mood.id,
				observedAt: mood.observedAt,
				slot: "morning",
				mood,
				optionalScores: [energy],
			},
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

	it("rejects editing an entry through a different sitting", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const mood = await observations.create(scoredObservation("mood", 3, 1, 5));
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await expect(
			store.saveCheckIn(
				"morning",
				{ mood: 4 },
				{
					id: mood.id,
					observedAt: mood.observedAt,
					slot: null,
					mood,
					optionalScores: [],
				},
			),
		).rejects.toThrow("does not belong to the morning slot");
		expect(await observations.findById(mood.id)).toMatchObject({ value: 3 });
	});

	it("rewrites the slot's sitting instead of adding a second one", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.saveCheckIn("morning", { mood: 4, optional: { energy: 3 } });
		// No entry is handed in: the store finds what already fills the slot.
		const saved = await store.saveCheckIn("morning", {
			mood: 2,
			optional: { energy: 1 },
		});

		expect(saved.sittings.morning).toMatchObject({
			mood: { value: 2 },
			optionalScores: [{ metricSlug: "energy", value: 1 }],
		});
		expect(
			(await observations.listByDay(LOCAL_DAY)).map((row) => [
				row.metricSlug,
				row.value,
			]),
		).toEqual([
			["mood", 2],
			["energy", 1],
		]);

		// The other sitting is untouched by any of it.
		await store.saveCheckIn("evening", { mood: 5 });
		const both = await store.loadToday();
		expect(both.sittings.morning?.mood.value).toBe(2);
		expect(both.sittings.evening?.mood.value).toBe(5);
	});

	it("shows one sitting per slot when sync leaves two, and hides neither", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		// Two devices each wrote the morning offline; both rows have to survive.
		const older = await observations.create({
			...scoredObservation("mood", 3, 1, 5),
			slot: "morning",
		});
		const newer = await observations.create({
			...scoredObservation("mood", 5, 1, 5),
			observedAt: CAPTURED_AT.getTime() + 1,
			slot: "morning",
		});

		const today = await store.loadToday();
		// The most recently written wins the card.
		expect(today.sittings.morning?.id).toBe(newer.id);
		expect(today.sittings.morning?.mood.value).toBe(5);
		expect(today.slotlessEntries).toEqual([]);
		// Neither row was deleted, and the day still counts as checked in.
		expect(
			(await observations.listByDay(LOCAL_DAY)).map((row) => row.id).sort(),
		).toEqual([older.id, newer.id].sort());
	});

	it("keeps a check-in written before slots out of both sittings", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		const legacy = await observations.create(
			scoredObservation("mood", 3, 1, 5),
		);

		const today = await store.loadToday();
		expect(today.sittings).toEqual({ morning: null, evening: null });
		expect(today.slotlessEntries.map((entry) => entry.id)).toEqual([legacy.id]);

		// Answering the morning adds a sitting rather than adopting the old row.
		const saved = await store.saveCheckIn("morning", { mood: 4 });
		expect(saved.sittings.morning?.id).not.toBe(legacy.id);
		expect(saved.slotlessEntries.map((entry) => entry.id)).toEqual([legacy.id]);
	});

	it("loads the distinct days with a mood observation in an inclusive range", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		await observations.create({
			...scoredObservation("mood", 3, 1, 5),
			localDay: "2026-08-13",
		});
		await observations.create({
			...scoredObservation("mood", 4, 1, 5),
			localDay: "2026-08-14",
		});
		await observations.create({
			...scoredObservation("mood", 5, 1, 5),
			observedAt: CAPTURED_AT.getTime() + 1,
			localDay: "2026-08-14",
		});
		await observations.create({
			...scoredObservation("energy", 4, 1, 5),
			localDay: "2026-08-15",
		});
		await observations.create({
			...scoredObservation("mood", 3, 1, 5),
			localDay: "2026-08-16",
		});
		await observations.create({
			...scoredObservation("mood", 2, 1, 5),
			localDay: "2026-08-17",
		});

		expect(await store.loadCheckInDays("2026-08-14", "2026-08-16")).toEqual(
			new Set(["2026-08-14", "2026-08-16"]),
		);
	});

	it("deletes the day's note when the prefilled field is saved empty", async () => {
		const notes = new databaseApp.DayNoteRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const saved = await store.saveDayNote("Keep me");
		expect(saved.note).toBe("Keep me");

		const cleared = await store.saveDayNote("   ");
		expect(cleared.note).toBe("");
		expect(await notes.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("writes a check-in as exactly one mood and energy pair", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const transaction = jest.spyOn(db, "withTransactionAsync");
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const saved = await store.saveCheckIn("morning", {
			mood: 4,
			optional: { energy: 3 },
		});

		expect(transaction).toHaveBeenCalledTimes(1);
		expect(await observations.listByDay(LOCAL_DAY)).toMatchObject([
			{ metricSlug: "mood", value: 4, scaleMin: 1, scaleMax: 5 },
			{ metricSlug: "energy", value: 3, scaleMin: 1, scaleMax: 5 },
		]);
		expect(saved.sittings.morning).toMatchObject({
			slot: "morning",
			mood: { value: 4 },
			optionalScores: [{ metricSlug: "energy", value: 3 }],
		});
		expect(saved.sittings.evening).toBeNull();
		expect(saved.selectedTagSlugs).toEqual([]);
		expect(saved.note).toBe("");
		transaction.mockRestore();
	});

	it("writes Mood alone even while optional scores are enabled", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const available = (await store.loadToday()).availableOptionalScores;
		expect(available.morning.map((metric) => metric.slug)).toEqual([
			"energy",
			"motivation",
		]);
		expect(available.evening.map((metric) => metric.slug)).toEqual([
			"productivity",
			"libido",
		]);
		const saved = await store.saveCheckIn("morning", { mood: 4 });

		expect(await observations.listByDay(LOCAL_DAY)).toMatchObject([
			{ metricSlug: "mood", value: 4, scaleMin: 1, scaleMax: 5 },
		]);
		expect(saved.sittings.morning).toMatchObject({
			mood: { value: 4 },
			optionalScores: [],
		});
		expect(hasCompletedCheckIn(await observations.listByDay(LOCAL_DAY))).toBe(
			true,
		);
	});

	it("writes enabled optional scores and retains them when disabled", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.configure("motivation", 2, true);
		await tracked.configure("productivity", 3, true);
		await tracked.configure("libido", 4, true);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const available = (await store.loadToday()).availableOptionalScores;
		expect(available.morning.map((metric) => metric.slug)).toEqual([
			"energy",
			"motivation",
		]);
		expect(available.evening.map((metric) => metric.slug)).toEqual([
			"productivity",
			"libido",
		]);
		// The slot decides what a sitting asks, not what may be recorded in it:
		// a score handed to the store is written whatever slot it lands in.
		const saved = await store.saveCheckIn("morning", {
			mood: 4,
			optional: {
				energy: 3,
				motivation: 5,
				productivity: 4,
				libido: 2,
			},
		});

		expect(
			(await observations.listByDay(LOCAL_DAY)).map((row) => [
				row.metricSlug,
				row.value,
			]),
		).toEqual([
			["mood", 4],
			["energy", 3],
			["motivation", 5],
			["productivity", 4],
			["libido", 2],
		]);
		expect(saved.sittings.morning?.optionalScores).toMatchObject([
			{ metricSlug: "energy", value: 3 },
			{ metricSlug: "motivation", value: 5 },
			{ metricSlug: "productivity", value: 4 },
			{ metricSlug: "libido", value: 2 },
		]);
		const entry = saved.sittings.morning;
		if (!entry) throw new Error("Expected the saved check-in.");
		await store.saveCheckIn(
			"morning",
			{
				mood: 3,
				optional: {
					energy: 2,
					motivation: 4,
					productivity: 3,
					libido: 1,
				},
			},
			entry,
		);
		expect(await observations.listByDay(LOCAL_DAY)).toMatchObject([
			{ metricSlug: "mood", value: 3 },
			{ metricSlug: "energy", value: 2 },
			{ metricSlug: "motivation", value: 4 },
			{ metricSlug: "productivity", value: 3 },
			{ metricSlug: "libido", value: 1 },
		]);

		await tracked.configure("libido", 4, false);
		const reloaded = await store.loadToday();
		expect(
			reloaded.availableOptionalScores.evening.map((metric) => metric.slug),
		).toEqual(["productivity"]);
		expect(reloaded.sittings.morning?.optionalScores).toHaveLength(4);
	});

	it("rejects a score outside the scale without writing anything", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await expect(
			store.saveCheckIn("morning", { mood: 0, optional: { energy: 3 } }),
		).rejects.toThrow("Mood must be a whole number from 1 to 5.");
		await expect(
			store.saveCheckIn("morning", { mood: 4, optional: { energy: 6 } }),
		).rejects.toThrow("Energy must be a whole number from 1 to 5.");
		await expect(
			store.saveCheckIn("morning", {
				mood: 4,
				optional: { energy: 3, libido: 0 },
			}),
		).rejects.toThrow("Libido must be a whole number from 1 to 5.");
		expect(await observations.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("writes tag rows with exactly the presence value and null bounds", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.saveDayTags(["outdoors", "training"]);

		const tagRows = await observations.listByDay(LOCAL_DAY);
		expect(tagRows).toHaveLength(2);
		for (const row of tagRows) {
			expect(row).toMatchObject({ value: 1, scaleMin: null, scaleMax: null });
		}
	});

	it("reconciles the day's tags to the set it is given", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.saveDayTags(["outdoors", "training"]);
		// A repeated slug must not multiply the day's rows.
		const kept = await store.saveDayTags(["training", "training"]);

		expect(kept.selectedTagSlugs).toEqual(["training"]);
		expect(await observations.listByDay(LOCAL_DAY)).toMatchObject([
			{ metricSlug: "training" },
		]);

		const cleared = await store.saveDayTags([]);
		expect(cleared.selectedTagSlugs).toEqual([]);
		expect(await observations.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("drops a tag an active habit already records from the panel", async () => {
		const habits = new databaseApp.HabitRepository(db);
		const trained = await habits.create({
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
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const today = await store.loadToday();
		expect(today.availableTags.some(({ slug }) => slug === "training")).toBe(
			false,
		);
		// Its uncovered neighbours are untouched.
		expect(today.availableTags.some(({ slug }) => slug === "outdoors")).toBe(
			true,
		);
		// The panel has no authority over a covered tag, so it cannot be saved
		// through the check-in either.
		await expect(store.saveDayTags(["training"])).rejects.toThrow(
			"Tag is not active today: training",
		);

		// Removing the habit hands the tag back.
		await habits.remove(trained.id);
		const afterRemoval = await store.loadToday();
		expect(
			afterRemoval.availableTags.some(({ slug }) => slug === "training"),
		).toBe(true);
	});

	it("leaves a habit-owned tag row untouched when reconciling", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const habits = new databaseApp.HabitRepository(db);
		const trained = await habits.create({
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
		await observations.create({
			metricSlug: "training",
			value: 1,
			scaleMin: null,
			scaleMax: null,
			observedAt: CAPTURED_AT.getTime(),
			localDay: LOCAL_DAY,
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: trained.id,
			assessmentId: null,
		});
		const store = new CheckInStore(db, () => CAPTURED_AT);

		// Clearing every tag the panel owns must not reach the habit's row.
		const cleared = await store.saveDayTags([]);
		expect(cleared.selectedTagSlugs).toEqual([]);
		expect(await observations.listByDay(LOCAL_DAY)).toMatchObject([
			{ metricSlug: "training", sourceRecordId: trained.id },
		]);
	});

	it("refuses a tag the day is not tracking", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		await new databaseApp.TrackedMetricsRepository(db).configure(
			"training",
			0,
			false,
		);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await expect(store.saveDayTags(["training"])).rejects.toThrow(
			"Tag is not active today: training",
		);
		expect(await observations.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("keeps measurements default-off and resolves enabled units from preference", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		const store = new CheckInStore(
			db,
			() => CAPTURED_AT,
			() => "en-US",
		);

		expect((await store.loadToday()).availableMeasurements).toEqual([]);
		await tracked.configure("weight", 0, true);
		expect((await store.loadToday()).availableMeasurements).toMatchObject([
			{
				metricSlug: "weight",
				label: "Weight",
				dimension: "mass",
				displayUnit: "lb",
			},
		]);

		await preferences.set("mass", "st");
		expect((await store.loadToday()).availableMeasurements).toMatchObject([
			{ metricSlug: "weight", displayUnit: "st" },
		]);
	});

	it("ignores imported-only metrics even if an overlay is manufactured", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		await tracked.configure("steps", 99, true);

		expect((await store.loadToday()).availableMeasurements).toEqual([]);
	});

	it("exposes the day's last measurement value in the current unit", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		const observations = new databaseApp.ObservationRepository(db);
		await tracked.configure("weight", 0, true);
		await preferences.set("mass", "st");
		const store = new CheckInStore(
			db,
			() => CAPTURED_AT,
			() => "en-GB",
		);
		const firstValue = 172 * KILOGRAMS_PER_POUND;
		const secondValue = 171 * KILOGRAMS_PER_POUND;

		// Measurements are logged from the Log screen; the check-in only reads
		// back whatever the day holds.
		await observations.create({
			...scoredObservation("weight", firstValue, 0, 0),
			scaleMin: null,
			scaleMax: null,
		});
		expect((await store.loadToday()).loggedMeasurements).toMatchObject([
			{
				metricSlug: "weight",
				formattedValue: "12 st 4 lb",
				observation: { value: firstValue, source: "user" },
			},
		]);

		await observations.create({
			...scoredObservation("weight", secondValue, 0, 0),
			scaleMin: null,
			scaleMax: null,
			observedAt: CAPTURED_AT.getTime() + 60_000,
		});
		const weightRows = (await observations.listByDay(LOCAL_DAY)).filter(
			(row) => row.metricSlug === "weight",
		);
		expect(weightRows).toHaveLength(2);

		const resolved = resolveMetric("weight");
		if (resolved.kind !== "known")
			throw new Error("Weight must be registered.");
		const trend = buildTrendSeries(weightRows, resolved.metric, LOCAL_DAY, 7);
		expect(trend.points.at(-1)?.value).toBe(secondValue);

		await preferences.set("mass", "kg");
		const kilograms = await store.loadToday();
		expect(kilograms.loggedMeasurements).toMatchObject([
			{
				formattedValue: "77.6 kg",
				observation: { value: secondValue },
			},
		]);
	});

	it("ignores assessment and measurement overlays as tags", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.configure("wheel:career", 0, true);
		await tracked.configure("weight", 0, true);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const today = await store.loadToday();
		expect(
			today.availableTags.some(({ slug }) => slug.startsWith("wheel:")),
		).toBe(false);
		expect(today.availableTags.some(({ slug }) => slug === "weight")).toBe(
			false,
		);
		await expect(store.saveDayTags(["wheel:career"])).rejects.toThrow(
			"Unknown tag slug: wheel:career",
		);
		await expect(store.saveDayTags(["weight"])).rejects.toThrow(
			"Unknown tag slug: weight",
		);
	});

	it("clears only the note the form showed, retaining manufactured duplicates", async () => {
		const notes = new databaseApp.DayNoteRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.saveDayNote("Shown in the form");
		const duplicate = await notes.create(LOCAL_DAY, "Replicated duplicate");

		await store.saveDayNote("");

		expect(await notes.listByDay(LOCAL_DAY)).toMatchObject([
			{ id: duplicate.id, body: "Replicated duplicate" },
		]);
	});

	it("refreshes reminders only once the check-in is committed and visible", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		let visibleToRefresh: DatabaseApp.Observation[] = [];
		const refresh = jest.fn(async () => {
			visibleToRefresh = await observations.listByDay(LOCAL_DAY);
		});
		const store = new CheckInStore(db, () => CAPTURED_AT, undefined, refresh);

		await store.saveCheckIn("morning", { mood: 4, optional: { energy: 3 } });

		expect(refresh).toHaveBeenCalledTimes(1);
		// The refresh is what cancels today's nudge, so it has to run after the
		// transaction commits and see the pair that proves the check-in happened.
		expect(hasCompletedCheckIn(visibleToRefresh)).toBe(true);

		// Neither tags nor the note change whether the day counts as checked
		// in, so neither has a reminder schedule to reconcile.
		await store.saveDayTags(["training"]);
		await store.saveDayNote("Strong finish");
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("keeps a check-in saved when the reminder refresh fails", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const store = new CheckInStore(
			db,
			() => CAPTURED_AT,
			undefined,
			() => Promise.reject(new Error("no notification permission")),
		);

		const saved = await store.saveCheckIn("morning", {
			mood: 4,
			optional: { energy: 3 },
		});

		expect(saved.sittings.morning).not.toBeNull();
		expect(await observations.listByDay(LOCAL_DAY)).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
