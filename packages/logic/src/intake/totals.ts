import { shiftLocalDay } from "@bro/domain";
import type { IntakeEvent } from "@bro/mobile-model";

export type IntakeDayTotal = {
	code: string;
	localDay: string;
	/** Null when no event that day carries the code; zero when one carries zero. */
	value: number | null;
	/** The events that contributed, in the order given. */
	events: IntakeEvent[];
};

/**
 * One constituent's total for one local day, summed over the events that
 * carry it. A present zero counts and an absent code does not, so "measured as
 * none" and "not applicable or unknown" stay distinct, exactly as the column
 * version did. Codes this build does not know sum the same way; a metric only
 * exists for known ones, so they reach no total.
 */
export function intakeDayTotal(
	code: string,
	localDay: string,
	events: readonly IntakeEvent[],
): IntakeDayTotal {
	const applicable = events.filter(
		(event) => event.localDay === localDay && code in event.constituents,
	);
	return {
		code,
		localDay,
		value:
			applicable.length === 0
				? null
				: applicable.reduce(
						(sum, event) => sum + (event.constituents[code] ?? 0),
						0,
					),
		events: applicable,
	};
}

/**
 * Mean daily total over the window ending at `throughLocalDay`, counting a day
 * with no applicable events as zero. Logging is the only signal, so an
 * unlogged day reads as "nothing taken" — the same stance the alcohol-free
 * habit takes — rather than hiding between logged spikes. The flip side: for
 * increase goals, unlogged days deflate the mean.
 */
export function intakeTrailingDailyMean(
	code: string,
	throughLocalDay: string,
	windowDays: number,
	events: readonly IntakeEvent[],
): number {
	if (!Number.isInteger(windowDays) || windowDays < 1) {
		throw new RangeError("windowDays must be a positive integer.");
	}
	let total = 0;
	for (let offset = 0; offset < windowDays; offset += 1) {
		const localDay = shiftLocalDay(throughLocalDay, -offset);
		total += intakeDayTotal(code, localDay, events).value ?? 0;
	}
	return total / windowDays;
}

export type IntakePeriodTotals = {
	code: string;
	fromLocalDay: string;
	throughLocalDay: string;
	/** One point per calendar day in the window, null where nothing carried the code. */
	days: { localDay: string; value: number | null }[];
	/** The sum over the window; unlogged days contribute nothing. */
	sum: number;
	/** How many days in the window had a value. */
	loggedDays: number;
};

/** Daily series and sum over a window, inclusive at both ends. */
export function intakePeriodTotals(
	code: string,
	fromLocalDay: string,
	throughLocalDay: string,
	events: readonly IntakeEvent[],
): IntakePeriodTotals {
	if (fromLocalDay > throughLocalDay) {
		throw new RangeError("Intake period must run forwards.");
	}
	const days: IntakePeriodTotals["days"] = [];
	let sum = 0;
	let loggedDays = 0;
	for (
		let localDay = fromLocalDay;
		localDay <= throughLocalDay;
		localDay = shiftLocalDay(localDay, 1)
	) {
		const { value } = intakeDayTotal(code, localDay, events);
		days.push({ localDay, value });
		if (value !== null) {
			sum += value;
			loggedDays += 1;
		}
	}
	return { code, fromLocalDay, throughLocalDay, days, sum, loggedDays };
}
