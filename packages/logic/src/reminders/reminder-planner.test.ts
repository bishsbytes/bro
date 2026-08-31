import type { Reminder } from "@bro/mobile-model";
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
		slot: null,
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
			new Set(),
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
			new Set(),
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
			new Set(),
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
			new Set(),
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
				new Set(),
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
				new Set(),
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

	it("silences only the sitting that has been answered", () => {
		// Both fire later today, so nothing is dropped for being in the past.
		const morning = reminder({
			id: "morning",
			slot: "morning",
			minuteOfDay: 8 * 60,
		});
		const evening = reminder({
			id: "evening",
			slot: "evening",
			minuteOfDay: 20 * 60,
		});
		const todayFor = (completed: readonly ("morning" | "evening")[]) =>
			planReminderNotifications(
				[morning, evening],
				new Date(2026, 7, 14, 7),
				"2026-08-14",
				new Set(completed),
				completed.length > 0,
			)
				.filter(({ localDay }) => localDay === "2026-08-14")
				.map(({ reminderId }) => reminderId);

		expect(todayFor([])).toEqual(["morning", "evening"]);
		expect(todayFor(["morning"])).toEqual(["evening"]);
		expect(todayFor(["evening"])).toEqual(["morning"]);
		expect(todayFor(["morning", "evening"])).toEqual([]);

		// Tomorrow is untouched by what today holds.
		expect(
			planReminderNotifications(
				[morning, evening],
				new Date(2026, 7, 14, 7),
				"2026-08-14",
				new Set(["morning", "evening"] as const),
				true,
			).some(({ localDay }) => localDay === "2026-08-15"),
		).toBe(true);
	});

	it("keeps a slotless reminder silenced by any check-in", () => {
		const legacy = reminder({ id: "legacy", minuteOfDay: 20 * 60 });
		const todayFor = (
			completed: readonly ("morning" | "evening")[],
			anyCheckIn: boolean,
		) =>
			planReminderNotifications(
				[legacy],
				new Date(2026, 7, 14, 7),
				"2026-08-14",
				new Set(completed),
				anyCheckIn,
			).filter(({ localDay }) => localDay === "2026-08-14");

		expect(todayFor([], false)).toHaveLength(1);
		// One sitting done is a check-in, and that is all a slotless row knows.
		expect(todayFor(["morning"], true)).toHaveLength(0);
		// A check-in that names no sitting still counts for it.
		expect(todayFor([], true)).toHaveLength(0);
	});
});
