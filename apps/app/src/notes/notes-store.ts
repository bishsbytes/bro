import { type DayNote, DayNoteRepository, getDb } from "@bro/database-app";
import { isCalendarDay } from "@bro/domain";
import type { SQLiteDatabase } from "expo-sqlite";

export class NotesStore {
	private readonly notes: DayNoteRepository;

	constructor(db: SQLiteDatabase) {
		this.notes = new DayNoteRepository(db);
	}

	async listNotes(): Promise<DayNote[]> {
		return await this.notes.listAll();
	}

	async createNote(localDay: string, body: string): Promise<DayNote | null> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError("A note day must be a real YYYY-MM-DD date.");
		}
		if (body.trim().length === 0) return null;
		return await this.notes.create(localDay, body);
	}
}

export function createNotesStore(): NotesStore {
	return new NotesStore(getDb());
}
