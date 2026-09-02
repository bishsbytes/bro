import type { DayNote } from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type { DayNote } from "@bro/mobile-model";

type DayNoteRow = {
	id: string;
	local_day: string;
	body: string;
	created_at: number;
	updated_at: number;
};

function toDayNote(row: DayNoteRow): DayNote {
	return {
		id: row.id,
		localDay: row.local_day,
		body: row.body,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** One page of {@link DayNoteRepository.listRecentDays}. */
export type RecentDayNotes = {
	notes: DayNote[];
	/** Whether days older than the window also hold notes. */
	hasMore: boolean;
};

export class DayNoteRepository extends BaseRepository {
	async create(localDay: string, body: string): Promise<DayNote> {
		const now = this.now();
		const note: DayNote = {
			id: this.createId(now),
			localDay,
			body,
			createdAt: now,
			updatedAt: now,
		};
		await this.insert(note);
		return note;
	}

	async findById(id: string): Promise<DayNote | null> {
		const row = await this.first<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes WHERE id = ?`,
			[id],
		);
		return row ? toDayNote(row) : null;
	}

	async listAll(): Promise<DayNote[]> {
		const rows = await this.all<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes
			 ORDER BY local_day DESC, created_at ASC, id ASC`,
		);
		return rows.map(toDayNote);
	}

	async listByDay(localDay: string): Promise<DayNote[]> {
		const rows = await this.all<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes WHERE local_day = ?
			 ORDER BY created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toDayNote);
	}

	/**
	 * Notes from the most recent `dayLimit` days that have any, newest day
	 * first — and whether older days remain behind them.
	 *
	 * The window is measured in days rather than notes so a day's notes are
	 * never split across two reads: the notes screen renders them grouped under
	 * one date heading, and half a day under a heading would read as the whole
	 * of it. Pass a larger `dayLimit` to widen the window.
	 */
	async listRecentDays(dayLimit: number): Promise<RecentDayNotes> {
		if (!Number.isInteger(dayLimit) || dayLimit < 1 || dayLimit > 3_650) {
			throw new RangeError("Day note window must be from 1 through 3650 days.");
		}
		// One day past the window answers `hasMore` without a second count query.
		const days = await this.all<{ local_day: string }>(
			`SELECT DISTINCT local_day FROM day_notes
			 ORDER BY local_day DESC LIMIT ?`,
			[dayLimit + 1],
		);
		const hasMore = days.length > dayLimit;
		const windowDays = days.slice(0, dayLimit);
		if (windowDays.length === 0) {
			return { notes: [], hasMore: false };
		}
		const oldest = windowDays[windowDays.length - 1].local_day;
		const rows = await this.all<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes
			 WHERE local_day >= ?
			 ORDER BY local_day DESC, created_at ASC, id ASC`,
			[oldest],
		);
		return { notes: rows.map(toDayNote), hasMore };
	}

	async listBetweenDays(
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<DayNote[]> {
		const rows = await this.all<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes
			 WHERE local_day >= ? AND local_day <= ?
			 ORDER BY local_day DESC, created_at ASC, id ASC`,
			[fromLocalDay, throughLocalDay],
		);
		return rows.map(toDayNote);
	}

	async update(id: string, body: string): Promise<DayNote | null> {
		await this.run(
			"UPDATE day_notes SET body = ?, updated_at = ? WHERE id = ?",
			[body, this.now(), id],
		);
		const row = await this.first<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes WHERE id = ?`,
			[id],
		);
		return row ? toDayNote(row) : null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.run("DELETE FROM day_notes WHERE id = ?", [id]);
		return result.changes > 0;
	}

	private async insert(note: DayNote): Promise<void> {
		await this.run(
			`INSERT INTO day_notes (id, local_day, body, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[note.id, note.localDay, note.body, note.createdAt, note.updatedAt],
		);
	}
}
