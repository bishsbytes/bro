import type { CheckInSlotAssignment } from "./content/metric-registry";

export type HabitDirection = "at_least" | "at_most";

export type TrackedMetricDefault = {
	metricSlug: string;
	position: number;
	enabled?: boolean;
};

export type ResolvedTrackedMetric = TrackedMetricDefault & {
	enabled: boolean;
	overlayId: string | null;
	addedAt: number | null;
	removedAt: number | null;
	customLabel: string | null;
	/**
	 * The user's slot override, or null to follow the metric's registry default.
	 * Resolved against the registry by whoever holds the metric definition.
	 */
	checkInSlots: CheckInSlotAssignment | null;
};
