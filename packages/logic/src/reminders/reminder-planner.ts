import type { Reminder } from "@bro/database-app";
import { localDayOf } from "@bro/domain";
import { includesWeekday, isoWeekdayIndex } from "./day-bitmask";

export const REMINDER_NOTIFICATION_PREFIX = "checkin-reminder:";
export const PLANNING_DAYS = 14;
export const MAX_PLANNED_NOTIFICATIONS = 56;

export type PlannedNotification = {
	identifier: string;
	reminderId: string;
	localDay: string;
	fireAt: Date;
};

function dateAtMinute(day: Date, minuteOfDay: number): Date {
	return new Date(
		day.getFullYear(),
		day.getMonth(),
		day.getDate(),
		Math.floor(minuteOfDay / 60),
		minuteOfDay % 60,
		0,
		0,
	);
}

function comparePlanned(
	left: PlannedNotification,
	right: PlannedNotification,
): number {
	return (
		left.fireAt.getTime() - right.fireAt.getTime() ||
		left.reminderId.localeCompare(right.reminderId)
	);
}

/**
 * Turns replicated wall-clock schedules into a bounded set of install-local,
 * one-shot notifications. The cap is applied at a day boundary, so a busy day
 * is never partially scheduled.
 */
export function planReminderNotifications(
	reminders: readonly Reminder[],
	now: Date,
	todayLocalDay: string,
	todayHasCheckIn: boolean,
): PlannedNotification[] {
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	const planned: PlannedNotification[] = [];

	for (let dayOffset = 0; dayOffset < PLANNING_DAYS; dayOffset += 1) {
		const day = new Date(
			startOfToday.getFullYear(),
			startOfToday.getMonth(),
			startOfToday.getDate() + dayOffset,
		);
		const localDay = localDayOf(day);
		const weekday = isoWeekdayIndex(day);
		const dayPlan = reminders
			.filter(
				(reminder) =>
					reminder.enabled && includesWeekday(reminder.daysOfWeek, weekday),
			)
			.map((reminder): PlannedNotification => {
				const fireAt = dateAtMinute(day, reminder.minuteOfDay);
				return {
					identifier: `${REMINDER_NOTIFICATION_PREFIX}${reminder.id}:${localDay}`,
					reminderId: reminder.id,
					localDay,
					fireAt,
				};
			})
			.filter(
				(notification) =>
					notification.fireAt.getTime() > now.getTime() &&
					!(todayHasCheckIn && notification.localDay === todayLocalDay),
			)
			.sort(comparePlanned);

		if (planned.length + dayPlan.length > MAX_PLANNED_NOTIFICATIONS) {
			break;
		}
		planned.push(...dayPlan);
	}

	return planned;
}
