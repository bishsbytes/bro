import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type ChallengeProgress = {
	id: string;
	enrolmentId: string;
	dayIndex: number;
	localDay: string;
	completedAt: number;
	createdAt: number;
	updatedAt: number;
};

type ChallengeProgressRow = {
	id: string;
	enrolment_id: string;
	day_index: number;
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
	"id, enrolment_id, day_index, local_day, completed_at, created_at, updated_at";

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

function toChallengeProgress(row: ChallengeProgressRow): ChallengeProgress {
	return {
		id: row.id,
		enrolmentId: row.enrolment_id,
		dayIndex: row.day_index,
		localDay: row.local_day,
		completedAt: row.completed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class ChallengeProgressRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async completeDay(
		enrolmentId: string,
		dayIndex: number,
		localDay: string,
	): Promise<ChallengeProgress> {
		if (!enrolmentId.trim()) {
			throw new TypeError("Challenge enrolment id must not be empty.");
		}
		if (!Number.isInteger(dayIndex) || dayIndex < 1) {
			throw new RangeError("Challenge day index must be a positive integer.");
		}
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Challenge progress local day must be a real YYYY-MM-DD date.",
			);
		}

		return await this.transaction(async () => {
			const existing = await this.findByEnrolmentDay(enrolmentId, dayIndex);
			if (existing) return existing;

			const enrolment = await this.first<{
				duration_days: number;
				completed_at: number | null;
				abandoned_at: number | null;
			}>(
				`SELECT duration_days, completed_at, abandoned_at
				 FROM challenge_enrolments WHERE id = ?`,
				[enrolmentId],
			);
			if (!enrolment) {
				throw new Error(`Challenge enrolment not found: ${enrolmentId}`);
			}
			if (enrolment.completed_at !== null || enrolment.abandoned_at !== null) {
				throw new Error("Cannot add progress to a closed challenge enrolment.");
			}
			if (dayIndex > enrolment.duration_days) {
				throw new RangeError(
					"Challenge day index exceeds the enrolled duration.",
				);
			}

			const completedDays = await this.all<{ day_index: number }>(
				`SELECT day_index FROM challenge_progress
				 WHERE enrolment_id = ? ORDER BY day_index ASC`,
				[enrolmentId],
			);
			const completedIndexes = new Set(
				completedDays.map((row) => row.day_index),
			);
			let expectedDay = 1;
			while (completedIndexes.has(expectedDay)) expectedDay += 1;
			if (dayIndex !== expectedDay) {
				throw new Error(
					`Next challenge day is ${expectedDay}, not ${dayIndex}.`,
				);
			}

			const now = this.now();
			const progress: ChallengeProgress = {
				id: this.createId(now),
				enrolmentId,
				dayIndex,
				localDay,
				completedAt: now,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO challenge_progress (
					id, enrolment_id, day_index, local_day, completed_at, created_at,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					progress.id,
					progress.enrolmentId,
					progress.dayIndex,
					progress.localDay,
					progress.completedAt,
					progress.createdAt,
					progress.updatedAt,
				],
			);

			if (dayIndex === enrolment.duration_days) {
				await this.run(
					`UPDATE challenge_enrolments
					 SET completed_at = ?, updated_at = ?
					 WHERE id = ? AND completed_at IS NULL AND abandoned_at IS NULL`,
					[now, now, enrolmentId],
				);
			}
			return progress;
		});
	}

	async findByEnrolmentDay(
		enrolmentId: string,
		dayIndex: number,
	): Promise<ChallengeProgress | null> {
		const row = await this.first<ChallengeProgressRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_progress
			 WHERE enrolment_id = ? AND day_index = ?`,
			[enrolmentId, dayIndex],
		);
		return row ? toChallengeProgress(row) : null;
	}

	async listByEnrolment(enrolmentId: string): Promise<ChallengeProgress[]> {
		const rows = await this.all<ChallengeProgressRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_progress
			 WHERE enrolment_id = ?
			 ORDER BY day_index ASC, completed_at ASC, id ASC`,
			[enrolmentId],
		);
		return rows.map(toChallengeProgress);
	}

	async listAll(): Promise<ChallengeProgress[]> {
		const rows = await this.all<ChallengeProgressRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_progress
			 ORDER BY local_day ASC, completed_at ASC, id ASC`,
		);
		return rows.map(toChallengeProgress);
	}

	async listByDay(localDay: string): Promise<ChallengeProgress[]> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Challenge progress local day must be a real YYYY-MM-DD date.",
			);
		}
		const rows = await this.all<ChallengeProgressRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_progress
			 WHERE local_day = ?
			 ORDER BY completed_at ASC, created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toChallengeProgress);
	}
}
