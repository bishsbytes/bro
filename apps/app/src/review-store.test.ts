import type * as DatabaseApp from "@bro/database-app";
import { KILOGRAMS_ETHANOL_PER_UK_UNIT } from "@bro/domain";
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

const { ReviewStore } = jest.requireActual(
	"./review/review-store",
) as typeof import("./review/review-store");
const { HistoryStore } = jest.requireActual(
	"./history/history-store",
) as typeof import("./history/history-store");

describe("review store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("review-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("writes nothing when a sitting is begun and abandoned", async () => {
		const store = new ReviewStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
		);

		const draft = await store.beginSitting();
		expect(draft.items).toHaveLength(8);
		expect(await store.listSittings()).toEqual([]);
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
		expect(await store.loadLatestWheel()).toBeNull();
	});

	it("loads the latest completed wheel and skips incomplete sittings", async () => {
		let now = new Date("2026-06-01T12:00:00.000Z");
		const store = new ReviewStore(db, () => now);
		expect(await store.loadLatestWheel()).toBeNull();

		const firstDraft = await store.beginSitting();
		now = new Date("2026-06-01T12:05:00.000Z");
		const first = await store.completeSitting(
			firstDraft,
			Object.fromEntries(firstDraft.items.map((item) => [item.slug, 5])),
		);
		expect((await store.loadLatestWheel())?.assessment.id).toBe(
			first.assessment.id,
		);

		now = new Date("2026-07-01T12:00:00.000Z");
		const secondDraft = await store.beginSitting();
		now = new Date("2026-07-01T12:05:00.000Z");
		const second = await store.completeSitting(
			secondDraft,
			Object.fromEntries(secondDraft.items.map((item) => [item.slug, 7])),
		);

		await new databaseApp.AssessmentRepository(db).createWithObservations({
			templateSlug: "wheel-of-life",
			templateVersion: 1,
			startedAt: Date.parse("2026-08-01T12:00:00.000Z"),
			completedAt: null,
			items: secondDraft.items,
			focusItemSlugs: [],
			observations: secondDraft.items.map((item) => ({
				metricSlug: item.slug,
				value: 9,
				scaleMin: 1,
				scaleMax: 10,
				observedAt: Date.parse("2026-08-01T12:00:00.000Z"),
				localDay: "2026-08-01",
				tzOffsetMinutes: 0,
				source: "user",
				sourceRecordId: null,
			})),
		});

		const latest = await store.loadLatestWheel();
		expect(latest?.assessment.id).toBe(second.assessment.id);
		expect(latest?.previousAssessment?.id).toBe(first.assessment.id);
	});

	it("uses persisted life-area order, enabled state, and labels in a new sitting", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.configure("wheel:career", 1, false);
		await tracked.configure("wheel:money", 0, true);
		await tracked.relabel("wheel:money", "Financial security", { position: 0 });

		const store = new ReviewStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
		);
		const draft = await store.beginSitting();

		expect(draft.items).toHaveLength(7);
		expect(draft.items[0]).toEqual({
			slug: "wheel:money",
			label: "Financial security",
			position: 0,
		});
		expect(draft.items.some(({ slug }) => slug === "wheel:career")).toBe(false);
	});

	it("keeps snapshots immutable and compares a second sitting by slug", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.relabel("wheel:career", "Business", { position: 0 });
		let now = new Date("2026-08-14T12:00:00.000Z");
		const store = new ReviewStore(db, () => now);

		const firstDraft = await store.beginSitting();
		expect(firstDraft.items[0]).toMatchObject({
			slug: "wheel:career",
			label: "Business",
			position: 0,
		});
		now = new Date("2026-08-14T12:05:00.000Z");
		const first = await store.completeSitting(
			firstDraft,
			Object.fromEntries(
				firstDraft.items.map((item) => [
					item.slug,
					item.slug === "wheel:career" ? 6 : 5,
				]),
			),
			["wheel:career"],
		);
		expect(first.previousAssessment).toBeNull();
		expect(first.assessment.focusItemSlugs).toEqual(["wheel:career"]);
		expect(first.scores).toHaveLength(8);
		expect(
			first.scores.find(({ slug }) => slug === "wheel:career")?.focused,
		).toBe(true);
		expect(await new HistoryStore(db).loadHistory()).toEqual([
			{
				localDay: "2026-08-14",
				moodValues: [],
				energyValues: [],
				factorLabels: [],
				noteBodies: [],
				assessmentCount: 1,
			},
		]);

		await tracked.relabel("wheel:career", "Founder life", { position: 0 });
		now = new Date("2026-09-14T12:00:00.000Z");
		const secondDraft = await store.beginSitting();
		expect(secondDraft.items[0]?.label).toBe("Founder life");
		now = new Date("2026-09-14T12:05:00.000Z");
		const second = await store.completeSitting(
			secondDraft,
			Object.fromEntries(
				secondDraft.items.map((item) => [
					item.slug,
					item.slug === "wheel:career" ? 8 : 5,
				]),
			),
		);

		expect(second.previousAssessment?.id).toBe(first.assessment.id);
		expect(
			second.comparisons.find(({ slug }) => slug === "wheel:career"),
		).toEqual({
			slug: "wheel:career",
			label: "Founder life",
			previousLabel: "Business",
			currentValue: 8,
			previousValue: 6,
			delta: 2,
		});

		const historical = await store.loadResult(first.assessment.id);
		expect(historical?.scores[0]?.label).toBe("Business");
		expect(await store.listSittings()).toHaveLength(2);
		const rows = await new databaseApp.ObservationRepository(
			db,
		).listByAssessmentId(second.assessment.id);
		expect(rows).toHaveLength(8);
		expect(
			rows.every(
				(row) =>
					row.assessmentId === second.assessment.id &&
					row.scaleMin === 1 &&
					row.scaleMax === 10,
			),
		).toBe(true);
	});

	it("rejects an incomplete score set before opening a transaction", async () => {
		const store = new ReviewStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
		);
		const draft = await store.beginSitting();

		await expect(store.completeSitting(draft, {})).rejects.toThrow(
			"Rate every displayed life area before saving.",
		);
		expect(await store.listSittings()).toEqual([]);
	});

	it("rejects invalid focus selections before opening a transaction", async () => {
		const store = new ReviewStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
		);
		const draft = await store.beginSitting();
		const scores = Object.fromEntries(
			draft.items.map((item) => [item.slug, 5]),
		);

		await expect(
			store.completeSitting(
				draft,
				scores,
				draft.items.slice(0, 4).map((item) => item.slug),
			),
		).rejects.toThrow("Choose no more than three unique focus areas");
		await expect(
			store.completeSitting(draft, scores, ["wheel:future"]),
		).rejects.toThrow("Choose no more than three unique focus areas");
		expect(await store.listSittings()).toEqual([]);
	});

	it("creates focus goals and derives progress from later wheel observations", async () => {
		let now = new Date("2026-08-14T12:00:00.000Z");
		const store = new ReviewStore(db, () => now);
		const firstDraft = await store.beginSitting();
		now = new Date("2026-08-14T12:05:00.000Z");
		const first = await store.completeSitting(
			firstDraft,
			Object.fromEntries(
				firstDraft.items.map((item) => [
					item.slug,
					item.slug === "wheel:career" ? 5 : 6,
				]),
			),
			["wheel:career"],
		);

		now = new Date("2026-08-14T12:10:00.000Z");
		const goal = await store.createGoal(
			first.assessment.id,
			"wheel:career",
			8,
			"2026-12-01",
		);
		expect(goal).toMatchObject({
			metricSlug: "wheel:career",
			direction: "increase",
			targetValue: 8,
			targetDate: "2026-12-01",
		});
		expect((await store.loadOverview()).goals[0]).toMatchObject({
			label: "Work & career",
			status: "active",
			startValue: 5,
			currentValue: 5,
			progressPercent: 0,
		});

		now = new Date("2026-09-14T12:00:00.000Z");
		const secondDraft = await store.beginSitting();
		now = new Date("2026-09-14T12:05:00.000Z");
		const second = await store.completeSitting(
			secondDraft,
			Object.fromEntries(
				secondDraft.items.map((item) => [
					item.slug,
					item.slug === "wheel:career" ? 7 : 6,
				]),
			),
			["wheel:career"],
		);
		expect((await store.loadOverview()).goals[0]).toMatchObject({
			startValue: 5,
			currentValue: 7,
			progressPercent: 67,
		});

		await store.achieveGoal(goal.id);
		expect((await store.loadOverview()).goals[0]?.status).toBe("achieved");

		now = new Date("2026-09-14T12:10:00.000Z");
		const decreasing = await store.createGoal(
			second.assessment.id,
			"wheel:career",
			4,
			null,
		);
		expect(decreasing.direction).toBe("decrease");
		await store.abandonGoal(decreasing.id);
		expect((await store.loadOverview()).goals[0]).toMatchObject({
			goal: { id: decreasing.id },
			status: "abandoned",
		});
	});

	it("presents body and consumption goals on the overview in their own units", async () => {
		const now = new Date("2026-08-14T12:00:00.000Z");
		const store = new ReviewStore(
			db,
			() => now,
			() => "en-GB",
		);
		await new databaseApp.UnitPreferenceRepository(db).set("mass", "kg");
		await new databaseApp.UnitPreferenceRepository(db).set(
			"alcohol",
			"uk_unit",
		);

		const observations = new databaseApp.ObservationRepository(db);
		const observationBase = {
			scaleMin: null,
			scaleMax: null,
			tzOffsetMinutes: 0,
			source: "user" as const,
			sourceRecordId: null,
			assessmentId: null,
		};
		await observations.create({
			...observationBase,
			metricSlug: "weight",
			value: 85,
			observedAt: Date.parse("2026-08-01T09:00:00.000Z"),
			localDay: "2026-08-01",
		});
		const goals = new databaseApp.GoalRepository(db);
		const weightGoal = await goals.create({
			metricSlug: "weight",
			direction: "decrease",
			targetValue: 80,
			targetDate: null,
			startedAt: Date.parse("2026-08-02T09:00:00.000Z"),
		});
		await observations.create({
			...observationBase,
			metricSlug: "weight",
			value: 82,
			observedAt: Date.parse("2026-08-10T09:00:00.000Z"),
			localDay: "2026-08-10",
		});

		const alcoholGoal = await goals.create({
			metricSlug: "alcohol_intake",
			direction: "decrease",
			targetValue: 2 * KILOGRAMS_ETHANOL_PER_UK_UNIT,
			targetDate: null,
			startedAt: Date.parse("2026-08-02T09:00:00.000Z"),
		});
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
			occurredAt: Date.parse("2026-08-12T18:00:00.000Z"),
			localDay: "2026-08-12",
			tzOffsetMinutes: 0,
		});

		const overview = await store.loadOverview();
		const weight = overview.goals.find(
			(progress) => progress.goal.id === weightGoal.id,
		);
		// The regression this guards: every goal used to render as "X/10".
		expect(weight).toMatchObject({
			label: "Weight",
			startValue: 85,
			currentValue: 82,
			progressPercent: 60,
			targetReached: false,
		});
		expect(weight?.targetFormatted).toMatch(/kg$/);
		expect(weight?.currentFormatted).toMatch(/kg$/);

		const alcohol = overview.goals.find(
			(progress) => progress.goal.id === alcoholGoal.id,
		);
		// Consumption goals live in consumption_entries, not observations; the
		// overview used to show them with no current value at all.
		expect(alcohol?.label).toBe("Alcohol");
		expect(alcohol?.currentValue).toBeCloseTo(0.020_181_999 / 7, 12);
		expect(alcohol?.currentFormatted).toMatch(/units$/);
		expect(alcohol?.targetReached).toBe(true);
	});

	it("only creates goals from a saved focus area", async () => {
		const store = new ReviewStore(
			db,
			() => new Date("2026-08-14T12:00:00.000Z"),
		);
		const draft = await store.beginSitting();
		const result = await store.completeSitting(
			draft,
			Object.fromEntries(draft.items.map((item) => [item.slug, 5])),
			["wheel:career"],
		);

		await expect(
			store.createGoal(result.assessment.id, "wheel:money", 7, null),
		).rejects.toThrow("saved focus area");
		await expect(
			store.createGoal(result.assessment.id, "wheel:career", 5, null),
		).rejects.toThrow("different from your current score");
	});
});
