import type { DailyMetric, UpsertDailyMetric } from "@bro/mobile-model";
import type { SQLiteDatabase } from "expo-sqlite";
import { createDailyMetricId } from "../uuid-v5";
import { BaseRepository, type RepositoryOptions } from "./base-repository";

export type { DailyMetric, UpsertDailyMetric } from "@bro/mobile-model";

type DailyMetricRow = {
	id: string;
	metric_slug: string;
	local_day: string;
	value: number;
	source: string;
	computed_at: number;
	created_at: number;
	updated_at: number;
};

/**
 * Ids here are derived from the natural key rather than the clock, so a metric
 * recomputed for the same day and source overwrites its own row instead of
 * accumulating duplicates.
 */
type DailyMetricRepositoryOptions = RepositoryOptions & {
	createNaturalId?: (
		metricSlug: string,
		localDay: string,
		source: string,
	) => string;
};

const SELECT_COLUMNS =
	"id, metric_slug, local_day, value, source, computed_at, created_at, updated_at";
const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDailyMetric(row: DailyMetricRow): DailyMetric {
	return {
		id: row.id,
		metricSlug: row.metric_slug,
		localDay: row.local_day,
		value: row.value,
		source: row.source,
		computedAt: row.computed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function assertInput(input: UpsertDailyMetric): void {
	required(input.metricSlug, "Daily metric slug");
	required(input.source, "Daily metric source");
	if (!LOCAL_DAY_PATTERN.test(input.localDay)) {
		throw new TypeError("Daily metric local day must use YYYY-MM-DD.");
	}
	if (!Number.isFinite(input.value)) {
		throw new TypeError("Daily metric value must be finite.");
	}
	if (input.computedAt !== undefined && !Number.isInteger(input.computedAt)) {
		throw new TypeError(
			"Daily metric computed time must be epoch milliseconds.",
		);
	}
}

export class DailyMetricRepository extends BaseRepository {
	private readonly createNaturalId: NonNullable<
		DailyMetricRepositoryOptions["createNaturalId"]
	>;

	constructor(db: SQLiteDatabase, options: DailyMetricRepositoryOptions = {}) {
		super(db, options);
		this.createNaturalId = options.createNaturalId ?? createDailyMetricId;
	}

	async upsert(input: UpsertDailyMetric): Promise<DailyMetric> {
		assertInput(input);
		const metricSlug = input.metricSlug.trim();
		const source = input.source.trim();
		const now = this.now();
		const computedAt = input.computedAt ?? now;
		const id = this.createNaturalId(metricSlug, input.localDay, source);

		await this.run(
			`INSERT INTO daily_metrics (
				id, metric_slug, local_day, value, source,
				computed_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (metric_slug, local_day, source) DO UPDATE SET
				id = excluded.id,
				value = excluded.value,
				computed_at = excluded.computed_at,
				updated_at = excluded.updated_at`,
			[
				id,
				metricSlug,
				input.localDay,
				input.value,
				source,
				computedAt,
				now,
				now,
			],
		);

		const row = await this.first<DailyMetricRow>(
			`SELECT ${SELECT_COLUMNS} FROM daily_metrics WHERE id = ?`,
			[id],
		);
		if (!row) {
			throw new Error("Daily metric upsert did not persist a row.");
		}
		return toDailyMetric(row);
	}

	async listByMetric(metricSlug: string): Promise<DailyMetric[]> {
		const rows = await this.all<DailyMetricRow>(
			`SELECT ${SELECT_COLUMNS} FROM daily_metrics
			 WHERE metric_slug = ?
			 ORDER BY local_day ASC, source ASC, id ASC`,
			[required(metricSlug, "Daily metric slug")],
		);
		return rows.map(toDailyMetric);
	}

	async listAll(): Promise<DailyMetric[]> {
		const rows = await this.all<DailyMetricRow>(
			`SELECT ${SELECT_COLUMNS} FROM daily_metrics
			 ORDER BY local_day ASC, metric_slug ASC, source ASC, id ASC`,
		);
		return rows.map(toDailyMetric);
	}

	async listByDay(localDay: string): Promise<DailyMetric[]> {
		if (!LOCAL_DAY_PATTERN.test(localDay)) {
			throw new TypeError("Daily metric local day must use YYYY-MM-DD.");
		}
		const rows = await this.all<DailyMetricRow>(
			`SELECT ${SELECT_COLUMNS} FROM daily_metrics
			 WHERE local_day = ?
			 ORDER BY metric_slug ASC, source ASC, id ASC`,
			[localDay],
		);
		return rows.map(toDailyMetric);
	}

	async deleteNaturalKey(
		metricSlug: string,
		localDay: string,
		source: string,
	): Promise<boolean> {
		if (!LOCAL_DAY_PATTERN.test(localDay)) {
			throw new TypeError("Daily metric local day must use YYYY-MM-DD.");
		}
		const result = await this.run(
			`DELETE FROM daily_metrics
			 WHERE metric_slug = ? AND local_day = ? AND source = ?`,
			[
				required(metricSlug, "Daily metric slug"),
				localDay,
				required(source, "Daily metric source"),
			],
		);
		return result.changes > 0;
	}

	async deleteByMetricSourceFromDay(
		metricSlug: string,
		source: string,
		fromLocalDay: string,
	): Promise<number> {
		if (!LOCAL_DAY_PATTERN.test(fromLocalDay)) {
			throw new TypeError("Daily metric local day must use YYYY-MM-DD.");
		}
		const result = await this.run(
			`DELETE FROM daily_metrics
			 WHERE metric_slug = ? AND source = ? AND local_day >= ?`,
			[
				required(metricSlug, "Daily metric slug"),
				required(source, "Daily metric source"),
				fromLocalDay,
			],
		);
		return result.changes;
	}
}
