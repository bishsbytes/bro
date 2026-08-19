import type { Reminder } from "@bro/database-app";
import { EVERY_DAY_MASK } from "./day-bitmask";
import {
	MAX_PLANNED_NOTIFICATIONS,
	planReminderNotifications,
} from "./reminder-planner";

function reminder(overrides: Partial<Reminder> = {}): Reminder {
	return {
		id: "reminder-1",
		minuteOfDay: 20 * 60,
		daysOfWeek: EVERY_DAY_MASK,
		enabled: true,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
}

describe("reminder planner", () => {
	it("plans future enabled occurrences deterministically and suppresses today", () => {
		const now = new Date(2026, 7, 14, 10);
		const schedules = [
			reminder({ id: "b" }),
			reminder({ id: "a" }),
			reminder({ id: "disabled", enabled: false }),
		];
		const withoutCheckIn = planReminderNotifications(
			schedules,
			now,
			"2026-08-14",
			false,
		);
		expect(
			withoutCheckIn.slice(0, 2).map(({ reminderId }) => reminderId),
		).toEqual(["a", "b"]);
		expect(withoutCheckIn[0]?.identifier).toBe("checkin-reminder:a:2026-08-14");

		const checkedIn = planReminderNotifications(
			schedules,
			now,
			"2026-08-14",
			true,
		);
		expect(checkedIn.every(({ localDay }) => localDay !== "2026-08-14")).toBe(
			true,
		);
		expect(checkedIn.some(({ localDay }) => localDay === "2026-08-15")).toBe(
			true,
		);
	});

	it("drops times already past today", () => {
		const planned = planReminderNotifications(
			[reminder({ minuteOfDay: 9 * 60 })],
			new Date(2026, 7, 14, 10),
			"2026-08-14",
			false,
		);
		expect(planned[0]?.localDay).toBe("2026-08-15");
	});

	it("shrinks the horizon at a day boundary to stay below the iOS cap", () => {
		const schedules = Array.from({ length: 5 }, (_, index) =>
			reminder({ id: `reminder-${index}` }),
		);
		const planned = planReminderNotifications(
			schedules,
			new Date(2026, 7, 14, 10),
			"2026-08-14",
			false,
		);
		expect(planned).toHaveLength(55);
		expect(planned.length).toBeLessThanOrEqual(MAX_PLANNED_NOTIFICATIONS);
		expect(new Set(planned.map(({ localDay }) => localDay)).size).toBe(11);
	});

	it("plans a repeated fall-back wall time exactly once", () => {
		const previousTimezone = process.env.TZ;
		process.env.TZ = "Europe/London";
		try {
			const planned = planReminderNotifications(
				[reminder({ minuteOfDay: 90 })],
				new Date(2026, 9, 24, 12),
				"2026-10-24",
				false,
			);
			const fallBackDay = planned.filter(
				({ localDay }) => localDay === "2026-10-25",
			);
			expect(fallBackDay).toHaveLength(1);
			expect(Number.isFinite(fallBackDay[0]?.fireAt.getTime())).toBe(true);
		} finally {
			process.env.TZ = previousTimezone;
		}
	});

	it("resolves a spring-forward wall time without duplicating it", () => {
		const previousTimezone = process.env.TZ;
		process.env.TZ = "Europe/London";
		try {
			const planned = planReminderNotifications(
				[reminder({ minuteOfDay: 90 })],
				new Date(2026, 2, 28, 12),
				"2026-03-28",
				false,
			);
			const springDay = planned.filter(
				({ localDay }) => localDay === "2026-03-29",
			);
			expect(springDay).toHaveLength(1);
			expect(Number.isFinite(springDay[0]?.fireAt.getTime())).toBe(true);
		} finally {
			process.env.TZ = previousTimezone;
		}
	});
});
