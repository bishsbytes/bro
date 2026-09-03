import { shiftLocalDay } from "@bro/domain";
import {
	CONSTITUENT_CATALOGUE,
	type ConstituentCategory,
	type ConstituentDefinition,
} from "@bro/domain/constituent-catalogue";
import { intakeMetricSlug } from "@bro/domain/metric-registry";
import type { IntakeEvent } from "@bro/mobile-model";
import {
	interpolatedQuantile,
	type MeasurementBaseline,
	type MeasurementReading,
	paddedRail,
} from "../measurements/baseline";
import { intakeDayTotal } from "./totals";

export type IntakeProjectionRow = {
	constituent: ConstituentDefinition;
	metricSlug: string;
	dayValue: number | null;
	/** How many of the day's events carried this constituent. */
	eventCount: number;
};

export type IntakeProjectionGroup = {
	category: ConstituentCategory;
	rows: IntakeProjectionRow[];
};

/**
 * The Intake tab's grouped rows: per category, per tracked constituent, the
 * day's value. Categories the user tracks nothing in do not appear, and the
 * order is the catalogue's, so the same day renders the same way everywhere.
 */
export function intakeProjections(
	events: readonly IntakeEvent[],
	localDay: string,
	trackedCodes: ReadonlySet<string> | readonly string[],
	catalogue: readonly ConstituentDefinition[] = CONSTITUENT_CATALOGUE,
): IntakeProjectionGroup[] {
	const tracked = new Set(trackedCodes);
	const groups = new Map<ConstituentCategory, IntakeProjectionRow[]>();
	for (const constituent of catalogue) {
		if (!tracked.has(constituent.code)) continue;
		const total = intakeDayTotal(constituent.code, localDay, events);
		const row: IntakeProjectionRow = {
			constituent,
			metricSlug: intakeMetricSlug(
				constituent.code as Parameters<typeof intakeMetricSlug>[0],
			),
			dayValue: total.value,
			eventCount: total.events.length,
		};
		const rows = groups.get(constituent.category);
		if (rows) rows.push(row);
		else groups.set(constituent.category, [row]);
	}
	return [...groups.entries()].map(([category, rows]) => ({ category, rows }));
}

/** How far back an intake row looks when working out what is usual for it. */
export const INTAKE_BASELINE_WINDOW_DAYS = 90;
/**
 * A usual-range band needs this many logged days in the window. Below it the
 * row shows the number alone rather than a range that is still a guess.
 */
export const INTAKE_BASELINE_MIN_LOGGED_DAYS = 14;

/**
 * Day totals read against themselves, in the shape the compact gauge draws on
 * Body: the middle half of the last ninety logged days as a band, today as a
 * mark, the day before as "since", and never a target or a population
 * reference. The band needs fourteen logged days — a day is a reading here,
 * so the tape-measure span rule does not apply — and below that the row shows
 * the number alone.
 */
export function intakeBaseline(
	code: string,
	events: readonly IntakeEvent[],
	throughLocalDay: string,
	windowDays: number = INTAKE_BASELINE_WINDOW_DAYS,
	minLoggedDays: number = INTAKE_BASELINE_MIN_LOGGED_DAYS,
): MeasurementBaseline {
	const byDay = new Map<string, IntakeEvent[]>();
	for (const event of events) {
		if (event.localDay > throughLocalDay || !(code in event.constituents)) {
			continue;
		}
		const rows = byDay.get(event.localDay);
		if (rows) rows.push(event);
		else byDay.set(event.localDay, [event]);
	}
	const readings: MeasurementReading[] = [...byDay.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([localDay, dayEvents]) => ({
			value: intakeDayTotal(code, localDay, dayEvents).value ?? 0,
			observedAt: Math.max(...dayEvents.map((event) => event.occurredAt)),
			localDay,
		}));
	const current = readings.at(-1) ?? null;
	const previous = readings.at(-2) ?? null;
	if (!current) {
		return {
			current: null,
			previous: null,
			delta: null,
			usualRange: null,
			rail: null,
			readingCount: 0,
		};
	}
	const fromLocalDay = shiftLocalDay(throughLocalDay, -(windowDays - 1));
	const windowValues = readings
		.filter((reading) => reading.localDay >= fromLocalDay)
		.map((reading) => reading.value)
		.sort((left, right) => left - right);
	const usualRange =
		windowValues.length >= minLoggedDays
			? {
					min: interpolatedQuantile(windowValues, 0.25),
					max: interpolatedQuantile(windowValues, 0.75),
				}
			: null;
	return {
		current,
		previous,
		delta: previous ? current.value - previous.value : null,
		usualRange,
		rail: paddedRail([
			...windowValues,
			current.value,
			...(previous ? [previous.value] : []),
			...(usualRange ? [usualRange.min, usualRange.max] : []),
		]),
		readingCount: windowValues.length,
	};
}
