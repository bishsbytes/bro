import type { RawSample, UpsertRawSample } from "@bro/mobile-model";
import { BaseRepository, type SQLiteParam } from "./base-repository";

export type { RawSample, UpsertRawSample } from "@bro/mobile-model";

type RawSampleRow = {
	id: string;
	metric_slug: string;
	value: number;
	started_at: number;
	ended_at: number;
	local_day: string;
	source: string;
	source_record_id: string;
	origin: string | null;
	imported_at: number;
};

const SELECT_COLUMNS =
	"id, metric_slug, value, started_at, ended_at, local_day, source, source_record_id, origin, imported_at";
const LOCAL_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/**
 * SQLite's own ceiling is far higher, but a bounded batch keeps one statement's
 * size predictable and lets the callers below take a list of any length.
 */
const MAX_STATEMENT_PARAMETERS = 500;
const UPSERT_COLUMNS = [
	"id",
	"metric_slug",
	"value",
	"started_at",
	"ended_at",
	"local_day",
	"source",
	"source_record_id",
	"origin",
	"imported_at",
] as const;

function chunked<Value>(values: readonly Value[], size: number): Value[][] {
	const batches: Value[][] = [];
	for (let index = 0; index < values.length; index += size) {
		batches.push(values.slice(index, index + size));
	}
	return batches;
}

function placeholders(count: number): string {
	return new Array(count).fill("?").join(", ");
}

/** The order `listByMetricSource` reads in, reapplied after a chunked read. */
function byDayThenInterval(left: RawSample, right: RawSample): number {
	return (
		left.localDay.localeCompare(right.localDay) ||
		left.endedAt - right.endedAt ||
		left.startedAt - right.startedAt ||
		left.sourceRecordId.localeCompare(right.sourceRecordId)
	);
}

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
		origin: row.origin,
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
	async upsert(input: UpsertRawSample): Promise<RawSample> {
		validate(input);
		const importedAt = input.importedAt ?? this.now();
		const source = input.source.trim();
		const sourceRecordId = input.sourceRecordId.trim();
		const origin = input.origin?.trim() || null;
		const id = this.createId(importedAt);

		await this.run(
			`INSERT INTO raw_samples (
				id, metric_slug, value, started_at, ended_at, local_day,
				source, source_record_id, origin, imported_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (source, source_record_id) DO UPDATE SET
				metric_slug = excluded.metric_slug,
				value = excluded.value,
				started_at = excluded.started_at,
				ended_at = excluded.ended_at,
				local_day = excluded.local_day,
				origin = excluded.origin,
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
				origin,
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

	/**
	 * Writes a whole platform batch, last value winning per identity.
	 *
	 * A health snapshot can carry tens of thousands of samples, and a statement
	 * plus a read-back per row is enough round-tripping to stall the caller. This
	 * inserts in multi-row batches and reports only how many rows it sent, so an
	 * importer that does not need the stored rows never pays to read them back.
	 */
	async upsertMany(inputs: readonly UpsertRawSample[]): Promise<number> {
		const latest = new Map<string, UpsertRawSample>();
		for (const input of inputs) {
			validate(input);
			latest.set(
				JSON.stringify([input.source.trim(), input.sourceRecordId.trim()]),
				input,
			);
		}
		const rows = [...latest.values()];
		if (rows.length === 0) {
			return 0;
		}

		const values = placeholders(UPSERT_COLUMNS.length);
		for (const batch of chunked(
			rows,
			Math.floor(MAX_STATEMENT_PARAMETERS / UPSERT_COLUMNS.length),
		)) {
			const parameters: SQLiteParam[] = [];
			for (const input of batch) {
				const importedAt = input.importedAt ?? this.now();
				parameters.push(
					this.createId(importedAt),
					input.metricSlug.trim(),
					input.value,
					input.startedAt,
					input.endedAt,
					input.localDay,
					input.source.trim(),
					input.sourceRecordId.trim(),
					input.origin?.trim() || null,
					importedAt,
				);
			}
			await this.run(
				`INSERT INTO raw_samples (${UPSERT_COLUMNS.join(", ")})
				 VALUES ${batch.map(() => `(${values})`).join(", ")}
				 ON CONFLICT (source, source_record_id) DO UPDATE SET
					metric_slug = excluded.metric_slug,
					value = excluded.value,
					started_at = excluded.started_at,
					ended_at = excluded.ended_at,
					local_day = excluded.local_day,
					origin = excluded.origin,
					imported_at = excluded.imported_at`,
				parameters,
			);
		}
		return rows.length;
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

	async listByMetricSource(
		metricSlug: string,
		source: string,
	): Promise<RawSample[]> {
		const rows = await this.all<RawSampleRow>(
			`SELECT ${SELECT_COLUMNS} FROM raw_samples
			 WHERE metric_slug = ? AND source = ?
			 ORDER BY local_day ASC, ended_at ASC, started_at ASC, source_record_id ASC`,
			[
				required(metricSlug, "Raw sample metric slug"),
				required(source, "Raw sample source"),
			],
		);
		return rows.map(toRawSample);
	}

	/**
	 * The samples on a named set of days, for callers that already know which
	 * days they have to reason about.
	 *
	 * Recomputing a daily rollup only ever needs that day's samples, so an
	 * importer applying a change batch should ask for the days the batch touches
	 * rather than the whole retention window — which for a per-minute metric is
	 * tens of thousands of rows to marshal and discard.
	 */
	async listByMetricSourceDays(
		metricSlug: string,
		source: string,
		localDays: readonly string[],
	): Promise<RawSample[]> {
		const slug = required(metricSlug, "Raw sample metric slug");
		const normalizedSource = required(source, "Raw sample source");
		const days = [...new Set(localDays)];
		for (const localDay of days) {
			if (!LOCAL_DAY_PATTERN.test(localDay)) {
				throw new TypeError("Raw sample local day must use YYYY-MM-DD.");
			}
		}

		const rows: RawSampleRow[] = [];
		// The metric and source are bound ahead of the day list in every batch.
		for (const batch of chunked(days, MAX_STATEMENT_PARAMETERS - 2)) {
			rows.push(
				...(await this.all<RawSampleRow>(
					`SELECT ${SELECT_COLUMNS} FROM raw_samples
					 WHERE metric_slug = ? AND source = ?
					   AND local_day IN (${placeholders(batch.length)})`,
					[slug, normalizedSource, ...batch],
				)),
			);
		}
		return rows.map(toRawSample).sort(byDayThenInterval);
	}

	/**
	 * The stored samples for a set of platform record ids, whatever metric or day
	 * they are currently filed under. A change batch names a deletion by record
	 * id alone, so this is how a caller discovers the day that deletion affects.
	 */
	async listBySourceRecords(
		source: string,
		sourceRecordIds: readonly string[],
	): Promise<RawSample[]> {
		const normalizedSource = required(source, "Raw sample source");
		const identifiers = [
			...new Set(
				sourceRecordIds.map((sourceRecordId) =>
					required(sourceRecordId, "Raw sample source record id"),
				),
			),
		];

		const rows: RawSampleRow[] = [];
		// The source is bound ahead of the identifier list in every batch.
		for (const batch of chunked(identifiers, MAX_STATEMENT_PARAMETERS - 1)) {
			rows.push(
				...(await this.all<RawSampleRow>(
					`SELECT ${SELECT_COLUMNS} FROM raw_samples
					 WHERE source = ?
					   AND source_record_id IN (${placeholders(batch.length)})`,
					[normalizedSource, ...batch],
				)),
			);
		}
		return rows
			.map(toRawSample)
			.sort((left, right) =>
				left.sourceRecordId.localeCompare(right.sourceRecordId),
			);
	}

	async deleteBySourceRecord(
		source: string,
		sourceRecordId: string,
	): Promise<RawSample | null> {
		return await this.transaction(
			async () =>
				await this.deleteBySourceRecordInCurrentTransaction(
					source,
					sourceRecordId,
				),
		);
	}

	/** Used by import orchestration that already owns the local-store transaction. */
	async deleteBySourceRecordInCurrentTransaction(
		source: string,
		sourceRecordId: string,
	): Promise<RawSample | null> {
		const normalizedSource = required(source, "Raw sample source");
		const normalizedRecordId = required(
			sourceRecordId,
			"Raw sample source record id",
		);
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
	}

	/** Used before a fresh platform snapshot is applied. */
	async deleteByMetricSourceInCurrentTransaction(
		metricSlug: string,
		source: string,
	): Promise<number> {
		const result = await this.run(
			"DELETE FROM raw_samples WHERE metric_slug = ? AND source = ?",
			[
				required(metricSlug, "Raw sample metric slug"),
				required(source, "Raw sample source"),
			],
		);
		return result.changes;
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
