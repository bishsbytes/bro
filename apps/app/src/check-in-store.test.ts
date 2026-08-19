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
		const mood = await observations.create(scoredObservation("mood", 7, 0, 10));
		const energy = await observations.create(
			scoredObservation("energy", 2, 0, 10),
		);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.save(
			{
				mood: 4,
				energy: 3,
				selectedFactorSlugs: [],
				measurements: [],
				note: "",
			},
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
		const draft = {
			mood: 4,
			energy: 3,
			selectedFactorSlugs: [],
			measurements: [],
		};

		const saved = await store.save({ ...draft, note: "Keep me" });
		expect(saved.note).toBe("Keep me");

		const cleared = await store.save({ ...draft, note: "   " }, null);
		expect(cleared.note).toBe("");
		expect(await notes.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("writes factor rows with exactly the presence value and null bounds", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await store.save({
			mood: 4,
			energy: 3,
			selectedFactorSlugs: ["outdoors", "training"],
			measurements: [],
			note: "",
		});

		const factorRows = (await observations.listByDay(LOCAL_DAY)).filter(
			(row) => row.metricSlug !== "mood" && row.metricSlug !== "energy",
		);
		expect(factorRows).toHaveLength(2);
		for (const row of factorRows) {
			expect(row).toMatchObject({ value: 1, scaleMin: null, scaleMax: null });
		}
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
		await expect(
			store.save({
				mood: 4,
				energy: 3,
				selectedFactorSlugs: [],
				measurements: [{ metricSlug: "steps", value: 10_000 }],
				note: "",
			}),
		).rejects.toThrow("Unknown measurement slug: steps");
	});

	it("writes canonical measurements and exposes the day's last value", async () => {
		let capturedAt = CAPTURED_AT;
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		const preferences = new databaseApp.UnitPreferenceRepository(db);
		const observations = new databaseApp.ObservationRepository(db);
		await tracked.configure("weight", 0, true);
		await preferences.set("mass", "st");
		const store = new CheckInStore(
			db,
			() => capturedAt,
			() => "en-GB",
		);
		const firstValue = 172 * KILOGRAMS_PER_POUND;

		const first = await store.save({
			mood: 4,
			energy: 3,
			selectedFactorSlugs: [],
			measurements: [{ metricSlug: "weight", value: firstValue }],
			note: "",
		});
		expect(first.loggedMeasurements).toMatchObject([
			{
				metricSlug: "weight",
				formattedValue: "12 st 4 lb",
				observation: {
					value: firstValue,
					scaleMin: null,
					scaleMax: null,
					source: "user",
					sourceRecordId: null,
					assessmentId: null,
				},
			},
		]);

		capturedAt = new Date(CAPTURED_AT.getTime() + 60_000);
		const secondValue = 171 * KILOGRAMS_PER_POUND;
		await store.save({
			mood: 5,
			energy: 4,
			selectedFactorSlugs: [],
			measurements: [{ metricSlug: "weight", value: secondValue }],
			note: "",
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
		expect(weightRows[0]?.value).toBe(firstValue);
		expect(weightRows[1]?.value).toBe(secondValue);
	});

	it("rolls back the check-in when a measurement is not active", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		await expect(
			store.save({
				mood: 4,
				energy: 3,
				selectedFactorSlugs: [],
				measurements: [{ metricSlug: "weight", value: 78 }],
				note: "",
			}),
		).rejects.toThrow("Measurement is not active");
		expect(await observations.listByDay(LOCAL_DAY)).toEqual([]);
	});

	it("ignores assessment and measurement overlays as factors", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.configure("wheel:career", 0, true);
		await tracked.configure("weight", 0, true);
		const store = new CheckInStore(db, () => CAPTURED_AT);

		const today = await store.loadToday();
		expect(
			today.availableFactors.some(({ slug }) => slug.startsWith("wheel:")),
		).toBe(false);
		expect(today.availableFactors.some(({ slug }) => slug === "weight")).toBe(
			false,
		);
		await expect(
			store.save({
				mood: 4,
				energy: 3,
				selectedFactorSlugs: ["wheel:career"],
				measurements: [],
				note: "",
			}),
		).rejects.toThrow("Unknown factor slug: wheel:career");
		await expect(
			store.save({
				mood: 4,
				energy: 3,
				selectedFactorSlugs: ["weight"],
				measurements: [],
				note: "",
			}),
		).rejects.toThrow("Unknown factor slug: weight");
	});

	it("clears only the note the form showed, retaining manufactured duplicates", async () => {
		const notes = new databaseApp.DayNoteRepository(db);
		const store = new CheckInStore(db, () => CAPTURED_AT);
		const draft = {
			mood: 4,
			energy: 3,
			selectedFactorSlugs: [],
			measurements: [],
		};

		await store.save({ ...draft, note: "Shown in the form" });
		const duplicate = await notes.create(LOCAL_DAY, "Replicated duplicate");

		await store.save({ ...draft, note: "" });

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

		await store.save({
			mood: 4,
			energy: 3,
			selectedFactorSlugs: [],
			measurements: [],
			note: "",
		});

		expect(refresh).toHaveBeenCalledTimes(1);
		// The refresh is what cancels today's nudge, so it has to run after the
		// transaction commits and see the pair that proves the check-in happened.
		expect(hasCompletedCheckIn(visibleToRefresh)).toBe(true);
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

		const saved = await store.save({
			mood: 4,
			energy: 3,
			selectedFactorSlugs: [],
			measurements: [],
			note: "",
		});

		expect(saved.entries).toHaveLength(1);
		expect(await observations.listByDay(LOCAL_DAY)).toHaveLength(2);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
