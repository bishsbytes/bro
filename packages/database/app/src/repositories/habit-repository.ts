import type { HabitDirection } from "@bro/domain";
import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type HabitKind = "manual" | "metric";
export type { HabitDirection } from "@bro/domain";

export type Habit = {
	id: string;
	slug: string;
	customLabel: string | null;
	kind: HabitKind;
	metricSlug: string | null;
	direction: HabitDirection | null;
	targetValue: number | null;
	daysOfWeek: number;
	position: number;
	addedAt: number;
	removedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateHabit = Pick<
	Habit,
	| "slug"
	| "customLabel"
	| "kind"
	| "metricSlug"
	| "direction"
	| "targetValue"
	| "daysOfWeek"
	| "position"
>;

export type UpdateHabit = Pick<
	Habit,
	"customLabel" | "targetValue" | "daysOfWeek" | "position"
>;

type HabitRow = {
	id: string;
	slug: string;
	custom_label: string | null;
	kind: string;
	metric_slug: string | null;
	direction: string | null;
	target_value: number | null;
	days_of_week: number;
	position: number;
	added_at: number;
	removed_at: number | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, slug, custom_label, kind, metric_slug, direction, target_value,
	days_of_week, position, added_at, removed_at, created_at, updated_at
`;

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function normalizeLabel(value: string | null): string | null {
	return value?.trim() || null;
}

function assertCadence(daysOfWeek: number): void {
	if (
		!Number.isInteger(daysOfWeek) ||
		daysOfWeek < 1 ||
		daysOfWeek > 0b111_1111
	) {
		throw new RangeError(
			"Habit daysOfWeek must select at least one valid day.",
		);
	}
}

function assertPosition(position: number): void {
	if (!Number.isInteger(position) || position < 0) {
		throw new RangeError("Habit position must be a non-negative integer.");
	}
}

function assertShape(
	kind: HabitKind,
	metricSlug: string | null,
	direction: HabitDirection | null,
	targetValue: number | null,
): void {
	if (kind === "manual") {
		if (metricSlug !== null || direction !== null || targetValue !== null) {
			throw new TypeError(
				"Manual habits cannot have a metric, direction, or target.",
			);
		}
		return;
	}

	if (!metricSlug?.trim()) {
		throw new TypeError("Metric habits require a metric slug.");
	}
	if (direction !== "at_least" && direction !== "at_most") {
		throw new TypeError("Metric habits require a valid direction.");
	}
	if (targetValue === null || !Number.isFinite(targetValue)) {
		throw new TypeError("Metric habits require a finite target value.");
	}
}

function toHabit(row: HabitRow): Habit {
	if (row.kind !== "manual" && row.kind !== "metric") {
		throw new TypeError(`Unknown habit kind: ${row.kind}`);
	}
	if (
		row.direction !== null &&
		row.direction !== "at_least" &&
		row.direction !== "at_most"
	) {
		throw new TypeError(`Unknown habit direction: ${row.direction}`);
	}
	assertShape(row.kind, row.metric_slug, row.direction, row.target_value);
	return {
		id: row.id,
		slug: row.slug,
		customLabel: row.custom_label,
		kind: row.kind,
		metricSlug: row.metric_slug,
		direction: row.direction,
		targetValue: row.target_value,
		daysOfWeek: row.days_of_week,
		position: row.position,
		addedAt: row.added_at,
		removedAt: row.removed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class HabitRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async create(input: CreateHabit): Promise<Habit> {
		const slug = required(input.slug, "Habit slug");
		if (!slug.startsWith("habit:")) {
			throw new TypeError("Habit slug must use the habit: namespace.");
		}
		assertCadence(input.daysOfWeek);
		assertPosition(input.position);
		assertShape(
			input.kind,
			input.metricSlug,
			input.direction,
			input.targetValue,
		);

		const now = this.now();
		const habit: Habit = {
			...input,
			id: this.createId(now),
			slug,
			customLabel: normalizeLabel(input.customLabel),
			metricSlug: input.metricSlug?.trim() || null,
			addedAt: now,
			removedAt: null,
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO habits (
				id, slug, custom_label, kind, metric_slug, direction, target_value,
				days_of_week, position, added_at, removed_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				habit.id,
				habit.slug,
				habit.customLabel,
				habit.kind,
				habit.metricSlug,
				habit.direction,
				habit.targetValue,
				habit.daysOfWeek,
				habit.position,
				habit.addedAt,
				habit.removedAt,
				habit.createdAt,
				habit.updatedAt,
			],
		);
		return habit;
	}

	async findById(id: string): Promise<Habit | null> {
		const row = await this.first<HabitRow>(
			`SELECT ${SELECT_COLUMNS} FROM habits WHERE id = ?`,
			[id],
		);
		return row ? toHabit(row) : null;
	}

	async listAll(): Promise<Habit[]> {
		const rows = await this.all<HabitRow>(
			`SELECT ${SELECT_COLUMNS} FROM habits
			 ORDER BY position ASC, added_at ASC, id ASC`,
		);
		return rows.map(toHabit);
	}

	async listActive(): Promise<Habit[]> {
		const rows = await this.all<HabitRow>(
			`SELECT ${SELECT_COLUMNS} FROM habits
			 WHERE removed_at IS NULL
			 ORDER BY position ASC, added_at ASC, id ASC`,
		);
		return rows.map(toHabit);
	}

	async update(id: string, input: UpdateHabit): Promise<Habit | null> {
		const existing = await this.findById(id);
		if (!existing) {
			return null;
		}
		assertCadence(input.daysOfWeek);
		assertPosition(input.position);
		assertShape(
			existing.kind,
			existing.metricSlug,
			existing.direction,
			input.targetValue,
		);

		const now = this.now();
		await this.run(
			`UPDATE habits
			 SET custom_label = ?, target_value = ?, days_of_week = ?, position = ?,
			 	updated_at = ?
			 WHERE id = ?`,
			[
				normalizeLabel(input.customLabel),
				input.targetValue,
				input.daysOfWeek,
				input.position,
				now,
				id,
			],
		);
		return await this.findById(id);
	}

	async remove(id: string): Promise<Habit | null> {
		const existing = await this.findById(id);
		if (!existing || existing.removedAt !== null) {
			return existing;
		}
		const now = this.now();
		await this.run(
			`UPDATE habits SET removed_at = ?, updated_at = ? WHERE id = ?`,
			[now, now, id],
		);
		return await this.findById(id);
	}
}
