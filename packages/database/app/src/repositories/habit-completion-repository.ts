import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type HabitCompletion = {
	id: string;
	habitId: string;
	localDay: string;
	completedAt: number;
	createdAt: number;
	updatedAt: number;
};

type HabitCompletionRow = {
	id: string;
	habit_id: string;
	local_day: string;
	completed_at: number;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS =
	"id, habit_id, local_day, completed_at, created_at, updated_at";

function isCalendarDay(value: string): boolean {
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
	if (!match) return false;
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}

function toHabitCompletion(row: HabitCompletionRow): HabitCompletion {
	return {
		id: row.id,
		habitId: row.habit_id,
		localDay: row.local_day,
		completedAt: row.completed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class HabitCompletionRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async complete(habitId: string, localDay: string): Promise<HabitCompletion> {
		if (!habitId.trim()) {
			throw new TypeError("Habit id must not be empty.");
		}
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Habit completion local day must be a real YYYY-MM-DD date.",
			);
		}

		return await this.transaction(async () => {
			const habit = await this.first<{ kind: string }>(
				"SELECT kind FROM habits WHERE id = ?",
				[habitId],
			);
			if (!habit) {
				throw new Error(`Habit not found: ${habitId}`);
			}
			if (habit.kind !== "manual") {
				throw new TypeError(
					"Metric habit completion is derived and cannot be stored.",
				);
			}

			const existing = await this.findByHabitDay(habitId, localDay);
			if (existing) {
				return existing;
			}

			const now = this.now();
			const completion: HabitCompletion = {
				id: this.createId(now),
				habitId,
				localDay,
				completedAt: now,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT OR IGNORE INTO habit_completions (
					id, habit_id, local_day, completed_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				[
					completion.id,
					completion.habitId,
					completion.localDay,
					completion.completedAt,
					completion.createdAt,
					completion.updatedAt,
				],
			);
			const persisted = await this.findByHabitDay(habitId, localDay);
			if (!persisted) {
				throw new Error("Habit completion did not persist a row.");
			}
			return persisted;
		});
	}

	async findByHabitDay(
		habitId: string,
		localDay: string,
	): Promise<HabitCompletion | null> {
		const row = await this.first<HabitCompletionRow>(
			`SELECT ${SELECT_COLUMNS} FROM habit_completions
			 WHERE habit_id = ? AND local_day = ?`,
			[habitId, localDay],
		);
		return row ? toHabitCompletion(row) : null;
	}

	async listByHabit(habitId: string): Promise<HabitCompletion[]> {
		const rows = await this.all<HabitCompletionRow>(
			`SELECT ${SELECT_COLUMNS} FROM habit_completions
			 WHERE habit_id = ?
			 ORDER BY local_day ASC, completed_at ASC, id ASC`,
			[habitId],
		);
		return rows.map(toHabitCompletion);
	}

	async listByDay(localDay: string): Promise<HabitCompletion[]> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Habit completion local day must be a real YYYY-MM-DD date.",
			);
		}
		const rows = await this.all<HabitCompletionRow>(
			`SELECT ${SELECT_COLUMNS} FROM habit_completions
			 WHERE local_day = ?
			 ORDER BY completed_at ASC, created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toHabitCompletion);
	}

	async uncomplete(habitId: string, localDay: string): Promise<boolean> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Habit completion local day must be a real YYYY-MM-DD date.",
			);
		}
		const result = await this.run(
			"DELETE FROM habit_completions WHERE habit_id = ? AND local_day = ?",
			[habitId, localDay],
		);
		return result.changes > 0;
	}
}
