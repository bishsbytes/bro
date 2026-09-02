import { shiftLocalDay } from "@bro/domain";
import type { Observation } from "@bro/mobile-model";

/** How far back a measurement looks when working out what is usual for it. */
export const MEASUREMENT_BASELINE_WINDOW_DAYS = 180;

/**
 * A band needs both enough readings to have a spread and enough calendar to be
 * a habit rather than an afternoon. The reading floor is lower than the check-in
 * gauge's because a tape site is taped in weeks, not days: asking for fourteen
 * readings would mean a man who tapes monthly never sees his own range.
 */
export const MEASUREMENT_BASELINE_MIN_READINGS = 4;
export const MEASUREMENT_BASELINE_MIN_SPAN_DAYS = 14;

export type MeasurementReading = {
	value: number;
	observedAt: number;
	localDay: string;
};

export type MeasurementRange = { min: number; max: number };

export type MeasurementBaseline = {
	/** The most recent reading, whatever its age. */
	current: MeasurementReading | null;
	/** The reading before it, which is what "since" and the delta are measured from. */
	previous: MeasurementReading | null;
	/** Current minus previous in canonical units; null without both. */
	delta: number | null;
	/** The middle half of the window's readings, or null while it would be a guess. */
	usualRange: MeasurementRange | null;
	/** The span a gauge draws, padded around everything it has to place. */
	rail: MeasurementRange | null;
	readingCount: number;
};

function ascending(rows: readonly Observation[]): Observation[] {
	return [...rows].sort(
		(left, right) =>
			left.observedAt - right.observedAt ||
			left.createdAt - right.createdAt ||
			left.id.localeCompare(right.id),
	);
}

function toReading(row: Observation): MeasurementReading {
	return {
		value: row.value,
		observedAt: row.observedAt,
		localDay: row.localDay,
	};
}

/**
 * Linear-interpolated quantile over values already sorted ascending. The
 * interpolation matters at these sample sizes: with five readings, a nearest-rank
 * quartile would jump a whole reading's width the moment a sixth arrives.
 */
function quantile(sorted: readonly number[], fraction: number): number {
	const position = (sorted.length - 1) * fraction;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	const low = sorted[lower] ?? 0;
	const high = sorted[upper] ?? low;
	return low + (high - low) * (position - lower);
}

function padded(values: readonly number[]): MeasurementRange {
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min;
	// A single repeated reading has no span to pad from, so the rail falls back
	// to a share of the value itself and keeps the marker off the end stop.
	const padding = span > 0 ? span * 0.15 : Math.abs(min) * 0.05 || 1;
	return { min: Math.max(0, min - padding), max: max + padding };
}

/**
 * What one measurement looks like against itself: where it sits now, where it
 * sat last time, and the range it usually occupies.
 *
 * Nothing here compares the user to anyone else. The band is his own middle
 * half, the delta is unsigned direction only, and neither carries a verdict.
 */
export function resolveMeasurementBaseline(
	rows: readonly Observation[],
	throughLocalDay: string,
	windowDays: number = MEASUREMENT_BASELINE_WINDOW_DAYS,
): MeasurementBaseline {
	const sorted = ascending(rows).filter(
		(row) => row.localDay <= throughLocalDay,
	);
	const current = sorted.at(-1) ?? null;
	const previous = sorted.at(-2) ?? null;
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
	const window = sorted.filter((row) => row.localDay >= fromLocalDay);
	const windowValues = window.map((row) => row.value).sort((a, b) => a - b);
	const firstDay = window[0]?.localDay ?? current.localDay;
	const spannedDays =
		(Date.parse(`${current.localDay}T00:00:00.000Z`) -
			Date.parse(`${firstDay}T00:00:00.000Z`)) /
		86_400_000;
	const banded =
		window.length >= MEASUREMENT_BASELINE_MIN_READINGS &&
		spannedDays >= MEASUREMENT_BASELINE_MIN_SPAN_DAYS;

	const usualRange = banded
		? { min: quantile(windowValues, 0.25), max: quantile(windowValues, 0.75) }
		: null;

	return {
		current: toReading(current),
		previous: previous ? toReading(previous) : null,
		delta: previous ? current.value - previous.value : null,
		usualRange,
		// Everything the gauge has to place has to fit on the rail, including a
		// previous reading old enough to have fallen out of the window.
		rail: padded([
			...windowValues,
			current.value,
			...(previous ? [previous.value] : []),
			...(usualRange ? [usualRange.min, usualRange.max] : []),
		]),
		readingCount: window.length,
	};
}
