import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type RawSample = {
	id: string;
	metricSlug: string;
	value: number;
	startedAt: number;
	endedAt: number;
	localDay: string;
	source: string;
	sourceRecordId: string;
	importedAt: number;
};

export type UpsertRawSample = Omit<RawSample, "id" | "importedAt"> & {
	importedAt?: number;
};

type RawSampleRow = {
	id: string;
	metric_slug: string;
	value: number;
	started_at: number;
	ended_at: number;
	local_day: string;
	source: string;
	source_record_id: string;
	imported_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS =
	"id, metric_slug, value, started_at, ended_at, local_day, source, source_record_id, imported_at";
const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toRawSample(row: RawSampleRow): RawSample {
	return {
		id: row.id,
		metricSlug: row.metric_slug,
		value: row.value,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		localDay: row.local_day,
		source: row.source,
		sourceRecordId: row.source_record_id,
		importedAt: row.imported_at,
	};
}

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function validate(input: UpsertRawSample): void {
	if (!Number.isFinite(input.value)) {
		throw new TypeError("Raw sample value must be finite.");
	}
	if (!Number.isInteger(input.startedAt) || !Number.isInteger(input.endedAt)) {
		throw new TypeError("Raw sample times must be epoch milliseconds.");
	}
	if (input.endedAt < input.startedAt) {
		throw new RangeError("Raw sample cannot end before it starts.");
	}
	if (!LOCAL_DAY_PATTERN.test(input.localDay)) {
		throw new TypeError("Raw sample local day must use YYYY-MM-DD.");
	}
	required(input.metricSlug, "Raw sample metric slug");
	required(input.source, "Raw sample source");
	required(input.sourceRecordId, "Raw sample source record id");
}

export class RawSampleRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async upsert(input: UpsertRawSample): Promise<RawSample> {
		validate(input);
		const importedAt = input.importedAt ?? this.now();
		const source = input.source.trim();
		const sourceRecordId = input.sourceRecordId.trim();
		const id = this.createId(importedAt);

		await this.run(
			`INSERT INTO raw_samples (
				id, metric_slug, value, started_at, ended_at, local_day,
				source, source_record_id, imported_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (source, source_record_id) DO UPDATE SET
				metric_slug = excluded.metric_slug,
				value = excluded.value,
				started_at = excluded.started_at,
				ended_at = excluded.ended_at,
				local_day = excluded.local_day,
				imported_at = excluded.imported_at`,
			[
				id,
				input.metricSlug.trim(),
				input.value,
				input.startedAt,
				input.endedAt,
				input.localDay,
				source,
				sourceRecordId,
				importedAt,
			],
		);

		const row = await this.first<RawSampleRow>(
			`SELECT ${SELECT_COLUMNS} FROM raw_samples
			 WHERE source = ? AND source_record_id = ?`,
			[source, sourceRecordId],
		);
		if (!row) {
			throw new Error("Raw sample upsert did not persist a row.");
		}
		return toRawSample(row);
	}

	async listByMetricDay(
		metricSlug: string,
		localDay: string,
	): Promise<RawSample[]> {
		if (!LOCAL_DAY_PATTERN.test(localDay)) {
			throw new TypeError("Raw sample local day must use YYYY-MM-DD.");
		}
		const rows = await this.all<RawSampleRow>(
			`SELECT ${SELECT_COLUMNS} FROM raw_samples
			 WHERE metric_slug = ? AND local_day = ?
			 ORDER BY ended_at ASC, started_at ASC, source ASC, source_record_id ASC`,
			[required(metricSlug, "Raw sample metric slug"), localDay],
		);
		return rows.map(toRawSample);
	}

	async deleteBySourceRecord(
		source: string,
		sourceRecordId: string,
	): Promise<RawSample | null> {
		const normalizedSource = required(source, "Raw sample source");
		const normalizedRecordId = required(
			sourceRecordId,
			"Raw sample source record id",
		);
		return await this.transaction(async () => {
			const row = await this.first<RawSampleRow>(
				`SELECT ${SELECT_COLUMNS} FROM raw_samples
				 WHERE source = ? AND source_record_id = ?`,
				[normalizedSource, normalizedRecordId],
			);
			if (!row) {
				return null;
			}
			await this.run(
				"DELETE FROM raw_samples WHERE source = ? AND source_record_id = ?",
				[normalizedSource, normalizedRecordId],
			);
			return toRawSample(row);
		});
	}

	async pruneEndedBefore(cutoff: number): Promise<number> {
		if (!Number.isInteger(cutoff)) {
			throw new TypeError(
				"Raw sample prune cutoff must be epoch milliseconds.",
			);
		}
		const result = await this.run(
			"DELETE FROM raw_samples WHERE ended_at < ?",
			[cutoff],
		);
		return result.changes;
	}
}
