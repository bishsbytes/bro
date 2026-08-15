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
		);
		expect(first.previousAssessment).toBeNull();
		expect(first.assessment.focusItemSlugs).toEqual([]);
		expect(first.scores).toHaveLength(8);
		expect(first.scores.every((score) => score.focused === false)).toBe(true);
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
});
