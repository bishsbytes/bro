import {
	type DayNote,
	DayNoteRepository,
	getDb,
	type RecentDayNotes,
} from "@bro/database-app";
import { isCalendarDay } from "@bro/domain";
import type { SQLiteDatabase } from "expo-sqlite";

/**
 * How many days of notes one read covers. The notes screen widens its window
 * by this much each time the reader asks for older notes, so it is also the
 * size of a "show older" step.
 */
export const NOTE_DAY_PAGE = 30;

export class NotesStore {
	private readonly notes: DayNoteRepository;

	constructor(db: SQLiteDatabase) {
		this.notes = new DayNoteRepository(db);
	}

	/**
	 * The most recent `dayLimit` days that hold notes, newest day first.
	 *
	 * Bounded so a reader with years of notes behind them does not pay for all
	 * of them to open the screen.
	 */
	async listNotes(dayLimit = NOTE_DAY_PAGE): Promise<RecentDayNotes> {
		return await this.notes.listRecentDays(dayLimit);
	}

	/**
	 * Writes a note for the day, or returns null for a body that is blank once
	 * trimmed — there is nothing to keep, and callers show that back rather than
	 * storing an empty card.
	 */
	async createNote(localDay: string, body: string): Promise<DayNote | null> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError("A note day must be a real YYYY-MM-DD date.");
		}
		const trimmed = body.trim();
		if (trimmed.length === 0) return null;
		return await this.notes.create(localDay, trimmed);
	}
}

export function createNotesStore(): NotesStore {
	return new NotesStore(getDb());
}
