import type { ConsumptionEntry } from "@bro/database-app";
import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";

const ENTRY_FIELD_BY_METRIC = {
	alcohol_intake: "ethanolKg",
	caffeine_intake: "caffeineKg",
	fluid_intake: "volumeL",
	energy_intake: "energyKcal",
} as const satisfies Record<
	ConsumptionDerivedMeasurementSlug,
	"ethanolKg" | "caffeineKg" | "volumeL" | "energyKcal"
>;

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
export function consumptionMetricDayTotal(
	metricSlug: ConsumptionDerivedMeasurementSlug,
	localDay: string,
	entries: readonly ConsumptionEntry[],
): ConsumptionMetricDayTotal {
	const field = ENTRY_FIELD_BY_METRIC[metricSlug];
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
						(sum, entry) => sum + (entry[field] ?? 0),
						0,
					),
		entries: applicableEntries,
	};
}
