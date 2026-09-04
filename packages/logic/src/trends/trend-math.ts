import { shiftLocalDay } from "@bro/domain";
import type { MetricDefinition } from "@bro/domain/metric-registry";
import type { Observation } from "@bro/mobile-model";

export const TREND_PERIODS = [7, 30] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

export type TrendPoint = {
	localDay: string;
	value: number | null;
};

export type TrendRange = { min: number; max: number };

export type TrendSeries = {
	metricSlug: string;
	points: TrendPoint[];
	segments: string[];
	markers: { localDay: string; x: number; y: number }[];
	scale: TrendRange;
	observedDayCount: number;
	daysUntilMeaningful: number;
};

const CHART_WIDTH = 300;
const CHART_TOP = 10;
const CHART_HEIGHT = 100;
const MEANINGFUL_DAY_COUNT = 7;

export function trendRange(
	throughLocalDay: string,
	period: TrendPeriod,
): { fromLocalDay: string; throughLocalDay: string } {
	return {
		fromLocalDay: shiftLocalDay(throughLocalDay, -(period - 1)),
		throughLocalDay,
	};
}

function valueOnCurrentScale(
	row: Observation,
	metric: MetricDefinition,
): number {
	if (
		metric.kind === "tag" ||
		metric.scaleMin === null ||
		metric.scaleMax === null ||
		row.scaleMin === null ||
		row.scaleMax === null ||
		row.scaleMax <= row.scaleMin
	) {
		return row.value;
	}

	const position = (row.value - row.scaleMin) / (row.scaleMax - row.scaleMin);
	return metric.scaleMin + position * (metric.scaleMax - metric.scaleMin);
}

function aggregateDay(
	rows: readonly Observation[],
	metric: MetricDefinition,
): number | null {
	if (rows.length === 0) {
		return null;
	}
	if (metric.aggregation === "presence") {
		return 1;
	}
	if (metric.aggregation === "last") {
		const latest = [...rows].sort(
			(left, right) =>
				right.observedAt - left.observedAt ||
				right.createdAt - left.createdAt ||
				right.id.localeCompare(left.id),
		)[0];
		return latest ? valueOnCurrentScale(latest, metric) : null;
	}

	const total = rows.reduce(
		(sum, row) => sum + valueOnCurrentScale(row, metric),
		0,
	);
	if (metric.aggregation === "sum") {
		return total;
	}
	return total / rows.length;
}

function chartGeometry(
	points: readonly TrendPoint[],
	metric: MetricDefinition,
	includedRange?: TrendRange | null,
): Pick<TrendSeries, "segments" | "markers" | "scale"> {
	const segments: string[] = [];
	const markers: TrendSeries["markers"] = [];
	let current: string[] = [];
	const denominator = Math.max(points.length - 1, 1);
	const observedValues = points.flatMap((point) =>
		point.value === null ? [] : [point.value],
	);
	const scaleValues = [
		...observedValues,
		...(includedRange ? [includedRange.min, includedRange.max] : []),
	];
	const observedMin = scaleValues.length > 0 ? Math.min(...scaleValues) : 0;
	const observedMax = scaleValues.length > 0 ? Math.max(...scaleValues) : 1;
	const scaleMin =
		metric.scaleMin ?? (metric.kind === "measurement" ? observedMin : 0);
	const scaleMax =
		metric.scaleMax ?? (metric.kind === "measurement" ? observedMax : 1);

	for (const [index, point] of points.entries()) {
		if (point.value === null) {
			if (current.length > 0) {
				segments.push(current.join(" "));
				current = [];
			}
			continue;
		}

		const x = (index / denominator) * CHART_WIDTH;
		const position =
			scaleMax === scaleMin
				? 0.5
				: (point.value - scaleMin) / (scaleMax - scaleMin);
		const y = CHART_TOP + (1 - position) * CHART_HEIGHT;
		current.push(`${x.toFixed(2)},${y.toFixed(2)}`);
		markers.push({ localDay: point.localDay, x, y });
	}

	if (current.length > 0) {
		segments.push(current.join(" "));
	}
	return { segments, markers, scale: { min: scaleMin, max: scaleMax } };
}

export function buildTrendSeries(
	rows: readonly Observation[],
	metric: MetricDefinition,
	throughLocalDay: string,
	period: TrendPeriod,
	includedRange?: TrendRange | null,
): TrendSeries {
	const { fromLocalDay } = trendRange(throughLocalDay, period);
	const points: TrendPoint[] = [];

	for (let offset = 0; offset < period; offset += 1) {
		const localDay = shiftLocalDay(fromLocalDay, offset);
		const dayRows = rows.filter(
			(row) => row.metricSlug === metric.slug && row.localDay === localDay,
		);
		points.push({ localDay, value: aggregateDay(dayRows, metric) });
	}

	const observedDayCount = points.filter(
		(point) => point.value !== null,
	).length;
	const geometry = chartGeometry(points, metric, includedRange);
	return {
		metricSlug: metric.slug,
		points,
		...geometry,
		observedDayCount,
		daysUntilMeaningful: Math.max(0, MEANINGFUL_DAY_COUNT - observedDayCount),
	};
}
