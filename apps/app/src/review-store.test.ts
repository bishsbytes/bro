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
	});

	it("uses persisted life-area order, enabled state, and labels in a new sitting", async () => {
		const tracked = new databaseApp.TrackedMetricsRepository(db);
		await tracked.configure("wheel:career", 1, false);
		await tracked.configure("wheel:money", 0, true);
		await tracked.relabel("wheel:money", "Financial security", 0, true);

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
		await tracked.relabel("wheel:career", "Business", 0, true);
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
		expect(await new HistoryStore(db).loadHistory()).toEqual([]);

		await tracked.relabel("wheel:career", "Founder life", 0, true);
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
