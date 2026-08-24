import type { DayNote } from "@bro/mobile-model";
import type { TransactionScope } from "../transaction";
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

	/**
	 * Writes the day's single note, replacing any note already there.
	 *
	 * Pass `scope` to join a transaction the caller already holds, for a note
	 * that must land with the rest of a larger domain write.
	 */
	async upsertForDay(
		localDay: string,
		body: string,
		scope?: TransactionScope,
	): Promise<DayNote> {
		return await this.transaction(
			async () => await this.upsert(localDay, body),
			scope,
		);
	}

	private async upsert(localDay: string, body: string): Promise<DayNote> {
		const existing = await this.first<DayNoteRow>(
			`SELECT id, local_day, body, created_at, updated_at
			 FROM day_notes WHERE local_day = ?
			 ORDER BY created_at ASC, id ASC LIMIT 1`,
			[localDay],
		);
		const now = this.now();

		if (existing) {
			await this.run(
				"UPDATE day_notes SET body = ?, updated_at = ? WHERE id = ?",
				[body, now, existing.id],
			);
			return toDayNote({ ...existing, body, updated_at: now });
		}

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
