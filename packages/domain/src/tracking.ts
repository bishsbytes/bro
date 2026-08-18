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
};
