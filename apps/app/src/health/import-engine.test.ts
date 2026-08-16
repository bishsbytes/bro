import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	HealthChangeTokenExpiredError,
	type HealthGateway,
	type HealthGatewayBatch,
} from "./gateway";
import type { PlatformHealthSample } from "./mapping";
import type { HealthMetricSlug } from "./policy";
import { createNodeSqliteMock } from "../test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomByte = 0;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomByte += 1;
		for (let index = 0; index < Math.min(length, 4); index += 1) {
			bytes[length - index - 1] = (mockRandomByte >>> (index * 8)) & 0xff;
		}
		return bytes;
	}),
}));

const databaseApp: typeof DatabaseApp = jest.requireActual("@bro/database-app");
const { HealthImportEngine }: typeof import("./import-engine") =
	jest.requireActual("./import-engine");
const { TrendsStore }: typeof import("../trends/trends-store") =
	jest.requireActual("../trends/trends-store");
const NOW = Date.parse("2026-08-16T12:00:00.000Z");
const DAY_MS = 86_400_000;

function steps(id: string, value: number, at: string): PlatformHealthSample {
	const startedAt = Date.parse(at);
	return {
		metricSlug: "steps",
		value,
		unit: "count",
		startedAt,
		endedAt: startedAt + 60_000,
		source: "health_connect",
		sourceRecordId: id,
	};
}

class FakeGateway implements HealthGateway {
	readonly platform = "health_connect" as const;
	readonly fetchChanges = jest.fn<
		Promise<HealthGatewayBatch>,
		[HealthMetricSlug, string | null, { from: number; through: number }]
	>();

	async availability() {
		return { available: true, platform: this.platform } as const;
	}

	async authorize(metricSlugs: readonly HealthMetricSlug[]) {
		return [...metricSlugs];
	}

	async grantedMetrics() {
		return ["steps"] as HealthMetricSlug[];
	}

	async openSettings() {}
}

describe("health import engine", () => {
	let productDb: SQLiteDatabase;
	let importDb: SQLiteDatabase;

	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomByte = 0;
		productDb = await mockSqlite.openDatabaseAsync("engine-product.db");
		importDb = await mockSqlite.openDatabaseAsync("engine-import.db");
		await Promise.all([
			databaseApp.runMigrations(productDb),
			databaseApp.runLocalMigrations(importDb),
		]);
	});

	afterEach(async () => {
		await Promise.all([productDb.closeAsync(), importDb.closeAsync()]);
	});

	afterAll(() => mockSqlite.cleanup());

	function engine(gateway: HealthGateway, selectedProductDb = productDb) {
		return new HealthImportEngine({
			gateway,
			getProductDb: () => selectedProductDb,
			getImportDb: () => importDb,
			now: () => NOW,
			timeZone: () => "UTC",
		});
	}

	it("backfills durable days, advances the token, and prunes old raw samples", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: [
				steps("old", 1_000, "2026-05-01T09:00:00.000Z"),
				steps("recent", 2_000, "2026-08-15T09:00:00.000Z"),
			],
			deletions: [],
			nextToken: "token-1",
		});

		await expect(engine(gateway).connect(["steps"])).resolves.toEqual({
			platform: "health_connect",
			importedMetrics: ["steps"],
			importedSamples: 2,
		});
		const daily = await new databaseApp.DailyMetricRepository(
			productDb,
		).listByMetric("steps");
		expect(daily.map(({ localDay, value }) => ({ localDay, value }))).toEqual([
			{ localDay: "2026-05-01", value: 1_000 },
			{ localDay: "2026-08-15", value: 2_000 },
		]);
		expect(
			await new databaseApp.RawSampleRepository(importDb).listByMetricSource(
				"steps",
				"health_connect",
			),
		).toHaveLength(1);
		expect(
			await new databaseApp.HealthConnectionRepository(importDb).find(
				"health_connect",
				"steps",
			),
		).toMatchObject({ changeToken: "token-1", lastImportedAt: NOW });
		expect(gateway.fetchChanges.mock.calls[0]?.[2].through).toBe(NOW);
	});

	it("backfills 365 durable days and exposes the imported series in Trends", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: Array.from({ length: 365 }, (_, index) =>
				steps(
					`day-${index}`,
					index + 1,
					new Date(NOW - index * DAY_MS - 3 * 60 * 60 * 1_000).toISOString(),
				),
			),
			deletions: [],
			nextToken: "token-365",
		});

		await engine(gateway).connect(["steps"]);

		const daily = await new databaseApp.DailyMetricRepository(
			productDb,
		).listByMetric("steps");
		expect(daily).toHaveLength(365);
		expect(new Set(daily.map((row) => row.id))).toHaveProperty("size", 365);
		const stepsTrend = (
			await new TrendsStore(productDb, () => new Date(NOW), () => "en-GB").load(
				30,
			)
		).metrics.find(({ metric }) => metric.slug === "steps");
		expect(stepsTrend?.series.points.filter((point) => point.value !== null)).toHaveLength(
			30,
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("recreates a lost disposable import store and converges to identical rollups", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: [
				steps("day-one", 4_000, "2026-08-14T09:00:00.000Z"),
				steps("day-two", 5_000, "2026-08-15T09:00:00.000Z"),
			],
			deletions: [],
			nextToken: "fresh-token",
		});

		await engine(gateway).connect(["steps"]);
		const daily = new databaseApp.DailyMetricRepository(productDb);
		const beforeLoss = await daily.listByMetric("steps");

		await importDb.closeAsync();
		importDb = await mockSqlite.openDatabaseAsync("engine-import-recreated.db");
		await databaseApp.runLocalMigrations(importDb);
		await engine(gateway).connect(["steps"]);

		expect(await daily.listByMetric("steps")).toEqual(beforeLoss);
		expect(
			await new databaseApp.RawSampleRepository(importDb).listByMetricSource(
				"steps",
				"health_connect",
			),
		).toHaveLength(2);
		expect(gateway.fetchChanges).toHaveBeenLastCalledWith(
			"steps",
			null,
			expect.any(Object),
		);
	});

	it("applies an incremental deletion and removes an empty daily rollup", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges
			.mockResolvedValueOnce({
				mode: "snapshot",
				additions: [steps("record-1", 500, "2026-08-15T09:00:00.000Z")],
				deletions: [],
				nextToken: "token-1",
			})
			.mockResolvedValueOnce({
				mode: "changes",
				additions: [],
				deletions: [{ source: "health_connect", sourceRecordId: "record-1" }],
				nextToken: "token-2",
			});
		const subject = engine(gateway);
		await subject.connect(["steps"]);
		await subject.refresh();

		expect(
			await new databaseApp.DailyMetricRepository(productDb).listByMetric(
				"steps",
			),
		).toEqual([]);
		expect(
			await new databaseApp.HealthConnectionRepository(importDb).find(
				"health_connect",
				"steps",
			),
		).toMatchObject({ changeToken: "token-2" });
	});

	it("leaves raw data and the token unchanged when the rollup commit fails", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: [steps("record-1", 500, "2026-08-15T09:00:00.000Z")],
			deletions: [],
			nextToken: "token-failed",
		});
		await new databaseApp.HealthConnectionRepository(importDb).connect(
			"health_connect",
			"steps",
		);
		const failingProductDb = {
			...productDb,
			withTransactionAsync: async () => {
				throw new Error("rollup failed");
			},
		} as unknown as SQLiteDatabase;

		await expect(engine(gateway, failingProductDb).refresh()).rejects.toThrow(
			"rollup failed",
		);
		expect(
			await new databaseApp.RawSampleRepository(importDb).listByMetricSource(
				"steps",
				"health_connect",
			),
		).toEqual([]);
		expect(
			await new databaseApp.HealthConnectionRepository(importDb).find(
				"health_connect",
				"steps",
			),
		).toMatchObject({ changeToken: null, lastImportedAt: null });
	});

	it("replaces the snapshot after an expired token", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges
			.mockResolvedValueOnce({
				mode: "snapshot",
				additions: [steps("before", 500, "2026-08-14T09:00:00.000Z")],
				deletions: [],
				nextToken: "expired",
			})
			.mockRejectedValueOnce(new HealthChangeTokenExpiredError("steps"))
			.mockResolvedValueOnce({
				mode: "snapshot",
				additions: [steps("after", 900, "2026-08-15T09:00:00.000Z")],
				deletions: [],
				nextToken: "fresh",
			});
		const subject = engine(gateway);
		await subject.connect(["steps"]);
		await subject.refresh();

		const daily = await new databaseApp.DailyMetricRepository(
			productDb,
		).listByMetric("steps");
		expect(daily.map(({ localDay, value }) => ({ localDay, value }))).toEqual([
			{ localDay: "2026-08-15", value: 900 },
		]);
	});

	it("queues a connect behind an in-flight refresh instead of swallowing it", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: [steps("first", 1_000, "2026-08-15T09:00:00.000Z")],
			deletions: [],
			nextToken: "token-1",
		});
		let releaseAvailability = () => {};
		const gate = new Promise<void>((resolve) => {
			releaseAvailability = resolve;
		});
		gateway.availability = async () => {
			await gate;
			return { available: true, platform: "health_connect" } as const;
		};

		const subject = engine(gateway);
		const refreshing = subject.refresh();
		const connecting = subject.connect(["steps"]);
		releaseAvailability();

		await expect(refreshing).resolves.toEqual({
			platform: "health_connect",
			importedMetrics: [],
			importedSamples: 0,
		});
		await expect(connecting).resolves.toEqual({
			platform: "health_connect",
			importedMetrics: ["steps"],
			importedSamples: 1,
		});
		expect(
			await new databaseApp.HealthConnectionRepository(importDb).find(
				"health_connect",
				"steps",
			),
		).toMatchObject({ changeToken: "token-1" });
	});

	it("replaces the snapshot when a change touches a day the retention window pruned", async () => {
		const gateway = new FakeGateway();
		gateway.fetchChanges
			.mockResolvedValueOnce({
				mode: "snapshot",
				additions: [steps("recent", 2_000, "2026-08-15T09:00:00.000Z")],
				deletions: [],
				nextToken: "token-1",
			})
			.mockResolvedValueOnce({
				mode: "changes",
				additions: [steps("stale-edit", 700, "2026-02-01T09:00:00.000Z")],
				deletions: [],
				nextToken: "token-2",
			})
			.mockResolvedValueOnce({
				mode: "snapshot",
				additions: [
					steps("stale-edit", 700, "2026-02-01T09:00:00.000Z"),
					steps("stale-peer", 5_300, "2026-02-01T10:00:00.000Z"),
					steps("recent", 2_000, "2026-08-15T09:00:00.000Z"),
				],
				deletions: [],
				nextToken: "token-3",
			});
		const subject = engine(gateway);
		await subject.connect(["steps"]);
		await subject.refresh();

		// Rolling up the pruned day from the lone changed sample would have
		// recorded 700; the replacement snapshot restores the full 6,000.
		const daily = await new databaseApp.DailyMetricRepository(
			productDb,
		).listByMetric("steps");
		expect(daily.map(({ localDay, value }) => ({ localDay, value }))).toEqual([
			{ localDay: "2026-02-01", value: 6_000 },
			{ localDay: "2026-08-15", value: 2_000 },
		]);
		expect(gateway.fetchChanges).toHaveBeenCalledTimes(3);
		expect(gateway.fetchChanges.mock.calls[2]?.[1]).toBeNull();
	});

	it("preserves durable history older than a reconnected snapshot window", async () => {
		await new databaseApp.DailyMetricRepository(productDb).upsert({
			metricSlug: "steps",
			localDay: "2024-01-01",
			value: 4_000,
			source: "health_connect",
		});
		const gateway = new FakeGateway();
		gateway.fetchChanges.mockResolvedValue({
			mode: "snapshot",
			additions: [steps("recent", 2_000, "2026-08-15T09:00:00.000Z")],
			deletions: [],
			nextToken: "token-1",
		});

		await engine(gateway).connect(["steps"]);

		const daily = await new databaseApp.DailyMetricRepository(
			productDb,
		).listByMetric("steps");
		expect(daily.map(({ localDay, value }) => ({ localDay, value }))).toEqual([
			{ localDay: "2024-01-01", value: 4_000 },
			{ localDay: "2026-08-15", value: 2_000 },
		]);
	});
});
