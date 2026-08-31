import { isCheckInSlot } from "@bro/domain/metric-registry";
import type { Reminder, ReminderSchedule } from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type { Reminder, ReminderSchedule } from "@bro/mobile-model";

type ReminderRow = {
	id: string;
	minute_of_day: number;
	days_of_week: number;
	slot: string | null;
	enabled: number;
	created_at: number;
	updated_at: number;
};

const SELECT_COLUMNS =
	"id, minute_of_day, days_of_week, slot, enabled, created_at, updated_at";

function assertSchedule(schedule: ReminderSchedule): void {
	if (
		!Number.isInteger(schedule.minuteOfDay) ||
		schedule.minuteOfDay < 0 ||
		schedule.minuteOfDay > 1_439
	) {
		throw new RangeError("Reminder minuteOfDay must be from 0 through 1439.");
	}
	if (
		!Number.isInteger(schedule.daysOfWeek) ||
		schedule.daysOfWeek < 1 ||
		schedule.daysOfWeek > 0b111_1111
	) {
		throw new RangeError("Reminder daysOfWeek must select at least one day.");
	}
	if (schedule.slot !== null && !isCheckInSlot(schedule.slot)) {
		throw new TypeError("Reminder slot must be a check-in sitting or null.");
	}
}

function toReminder(row: ReminderRow): Reminder {
	return {
		id: row.id,
		minuteOfDay: row.minute_of_day,
		daysOfWeek: row.days_of_week,
		// An unreadable slot behaves as the pre-slot rows do: silenced by any
		// check-in rather than tied to a sitting this build cannot name.
		slot: isCheckInSlot(row.slot) ? row.slot : null,
		enabled: row.enabled === 1,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class ReminderRepository extends BaseRepository {
	async listAll(): Promise<Reminder[]> {
		const rows = await this.all<ReminderRow>(
			`SELECT ${SELECT_COLUMNS} FROM reminders
			 ORDER BY minute_of_day ASC, created_at ASC, id ASC`,
		);
		return rows.map(toReminder);
	}

	async findById(id: string): Promise<Reminder | null> {
		const row = await this.first<ReminderRow>(
			`SELECT ${SELECT_COLUMNS} FROM reminders WHERE id = ?`,
			[id],
		);
		return row ? toReminder(row) : null;
	}

	async create(schedule: ReminderSchedule, enabled = true): Promise<Reminder> {
		assertSchedule(schedule);
		const now = this.now();
		const reminder: Reminder = {
			id: this.createId(now),
			...schedule,
			enabled,
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO reminders (
				id, minute_of_day, days_of_week, slot, enabled, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				reminder.id,
				reminder.minuteOfDay,
				reminder.daysOfWeek,
				reminder.slot,
				reminder.enabled ? 1 : 0,
				reminder.createdAt,
				reminder.updatedAt,
			],
		);
		return reminder;
	}

	async update(
		id: string,
		schedule: ReminderSchedule,
	): Promise<Reminder | null> {
		assertSchedule(schedule);
		await this.run(
			`UPDATE reminders
			 SET minute_of_day = ?, days_of_week = ?, slot = ?, updated_at = ?
			 WHERE id = ?`,
			[
				schedule.minuteOfDay,
				schedule.daysOfWeek,
				schedule.slot,
				this.now(),
				id,
			],
		);
		return await this.findById(id);
	}

	async setEnabled(id: string, enabled: boolean): Promise<Reminder | null> {
		await this.run(
			"UPDATE reminders SET enabled = ?, updated_at = ? WHERE id = ?",
			[enabled ? 1 : 0, this.now(), id],
		);
		return await this.findById(id);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.run("DELETE FROM reminders WHERE id = ?", [id]);
		return result.changes > 0;
	}
}
