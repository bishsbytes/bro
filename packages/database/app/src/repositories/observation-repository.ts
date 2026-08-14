import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type Observation = {
	id: string;
	metricSlug: string;
	value: number;
	scaleMin: number | null;
	scaleMax: number | null;
	observedAt: number;
	localDay: string;
	tzOffsetMinutes: number;
	source: string;
	sourceRecordId: string | null;
	assessmentId: string | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateObservation = Omit<
	Observation,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateObservation = Pick<
	Observation,
	| "value"
	| "scaleMin"
	| "scaleMax"
	| "observedAt"
	| "localDay"
	| "tzOffsetMinutes"
>;

type ObservationRow = {
	id: string;
	metric_slug: string;
	value: number;
	scale_min: number | null;
	scale_max: number | null;
	observed_at: number;
	local_day: string;
	tz_offset_minutes: number;
	source: string;
	source_record_id: string | null;
	assessment_id: string | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, metric_slug, value, scale_min, scale_max, observed_at, local_day,
	tz_offset_minutes, source, source_record_id, assessment_id, created_at,
	updated_at
`;

function toObservation(row: ObservationRow): Observation {
	return {
		id: row.id,
		metricSlug: row.metric_slug,
		value: row.value,
		scaleMin: row.scale_min,
		scaleMax: row.scale_max,
		observedAt: row.observed_at,
		localDay: row.local_day,
		tzOffsetMinutes: row.tz_offset_minutes,
		source: row.source,
		sourceRecordId: row.source_record_id,
		assessmentId: row.assessment_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertObservation(input: CreateObservation | UpdateObservation): void {
	if (!Number.isFinite(input.value)) {
		throw new RangeError("Observation value must be finite.");
	}
	if ((input.scaleMin === null) !== (input.scaleMax === null)) {
		throw new RangeError(
			"Observation scale bounds must both be set or both be null.",
		);
	}
	if (
		input.scaleMin !== null &&
		input.scaleMax !== null &&
		(input.scaleMin >= input.scaleMax ||
			input.value < input.scaleMin ||
			input.value > input.scaleMax)
	) {
		throw new RangeError(
			"Observation value must fall within its scale bounds.",
		);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.localDay)) {
		throw new TypeError("Observation localDay must use YYYY-MM-DD format.");
	}
	if (!Number.isInteger(input.observedAt)) {
		throw new TypeError("Observation observedAt must be epoch milliseconds.");
	}
	if (!Number.isInteger(input.tzOffsetMinutes)) {
		throw new TypeError("Observation timezone offset must be whole minutes.");
	}
}

export class ObservationRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async create(input: CreateObservation): Promise<Observation> {
		assertObservation(input);
		const now = this.now();
		const observation: Observation = {
			...input,
			id: this.createId(now),
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO observations (
				id, metric_slug, value, scale_min, scale_max, observed_at, local_day,
				tz_offset_minutes, source, source_record_id, assessment_id, created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				observation.id,
				observation.metricSlug,
				observation.value,
				observation.scaleMin,
				observation.scaleMax,
				observation.observedAt,
				observation.localDay,
				observation.tzOffsetMinutes,
				observation.source,
				observation.sourceRecordId,
				observation.assessmentId,
				observation.createdAt,
				observation.updatedAt,
			],
		);

		return observation;
	}

	async findById(id: string): Promise<Observation | null> {
		const row = await this.first<ObservationRow>(
			`SELECT ${SELECT_COLUMNS} FROM observations WHERE id = ?`,
			[id],
		);
		return row ? toObservation(row) : null;
	}

	async listByDay(localDay: string): Promise<Observation[]> {
		const rows = await this.all<ObservationRow>(
			`SELECT ${SELECT_COLUMNS} FROM observations
			 WHERE local_day = ?
			 ORDER BY observed_at ASC, created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toObservation);
	}

	async listByMetricAndDayRange(
		metricSlug: string,
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<Observation[]> {
		const rows = await this.all<ObservationRow>(
			`SELECT ${SELECT_COLUMNS} FROM observations
			 WHERE metric_slug = ? AND local_day >= ? AND local_day <= ?
			 ORDER BY local_day ASC, observed_at ASC, created_at ASC, id ASC`,
			[metricSlug, fromLocalDay, throughLocalDay],
		);
		return rows.map(toObservation);
	}

	async update(
		id: string,
		input: UpdateObservation,
	): Promise<Observation | null> {
		assertObservation(input);
		await this.run(
			`UPDATE observations
			 SET value = ?, scale_min = ?, scale_max = ?, observed_at = ?,
				 local_day = ?, tz_offset_minutes = ?, updated_at = ?
			 WHERE id = ?`,
			[
				input.value,
				input.scaleMin,
				input.scaleMax,
				input.observedAt,
				input.localDay,
				input.tzOffsetMinutes,
				this.now(),
				id,
			],
		);
		return await this.findById(id);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.run("DELETE FROM observations WHERE id = ?", [
			id,
		]);
		return result.changes > 0;
	}

	async untapFactorForDay(
		metricSlug: string,
		localDay: string,
	): Promise<number> {
		const result = await this.run(
			`DELETE FROM observations
			 WHERE metric_slug = ? AND local_day = ? AND source = 'user'
				AND scale_min IS NULL AND scale_max IS NULL`,
			[metricSlug, localDay],
		);
		return result.changes;
	}
}
