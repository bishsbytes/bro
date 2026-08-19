import type { ConsumptionEntry } from "@bro/database-app";
import { shiftLocalDay } from "@bro/domain";
import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";

const ENTRY_FIELD_BY_METRIC = {
	alcohol_intake: "ethanolKg",
	caffeine_intake: "caffeineKg",
	fluid_intake: "volumeL",
	energy_intake: "energyKcal",
	protein_intake: "proteinG",
	carbs_intake: "carbsG",
	fat_intake: "fatG",
} as const satisfies Record<
	ConsumptionDerivedMeasurementSlug,
	| "ethanolKg"
	| "caffeineKg"
	| "volumeL"
	| "energyKcal"
	| "proteinG"
	| "carbsG"
	| "fatG"
>;

const ENTRY_SCALE_BY_METRIC = {
	alcohol_intake: 1,
	caffeine_intake: 1,
	fluid_intake: 1,
	energy_intake: 1,
	protein_intake: 1 / 1_000,
	carbs_intake: 1 / 1_000,
	fat_intake: 1 / 1_000,
} as const satisfies Record<ConsumptionDerivedMeasurementSlug, number>;

export type ConsumptionMetricDayTotal = {
	metricSlug: ConsumptionDerivedMeasurementSlug;
	localDay: string;
	value: number | null;
	entries: ConsumptionEntry[];
};

/**
 * Projects immutable entry snapshots into one canonical daily total. A zero is
 * retained when it was explicitly logged; no applicable entries means null.
 */
/**
 * Mean daily total over the window ending at `throughLocalDay`, counting a day
 * with no applicable entries as zero. Logging is the only signal, so an
 * unlogged day reads as "nothing consumed" — the same stance the alcohol-free
 * habit takes — rather than hiding between logged spikes. The flip side: for
 * increase goals, unlogged days deflate the mean.
 */
export function consumptionMetricTrailingDailyMean(
	metricSlug: ConsumptionDerivedMeasurementSlug,
	throughLocalDay: string,
	windowDays: number,
	entries: readonly ConsumptionEntry[],
): number {
	if (!Number.isInteger(windowDays) || windowDays < 1) {
		throw new RangeError("windowDays must be a positive integer.");
	}
	let total = 0;
	for (let offset = 0; offset < windowDays; offset += 1) {
		const localDay = shiftLocalDay(throughLocalDay, -offset);
		total +=
			consumptionMetricDayTotal(metricSlug, localDay, entries).value ?? 0;
	}
	return total / windowDays;
}

export function consumptionMetricDayTotal(
	metricSlug: ConsumptionDerivedMeasurementSlug,
	localDay: string,
	entries: readonly ConsumptionEntry[],
): ConsumptionMetricDayTotal {
	const field = ENTRY_FIELD_BY_METRIC[metricSlug];
	const scale = ENTRY_SCALE_BY_METRIC[metricSlug];
	const applicableEntries = entries.filter(
		(entry) => entry.localDay === localDay && entry[field] !== null,
	);
	return {
		metricSlug,
		localDay,
		value:
			applicableEntries.length === 0
				? null
				: applicableEntries.reduce(
						(sum, entry) => sum + (entry[field] ?? 0) * scale,
						0,
					),
		entries: applicableEntries,
	};
}
