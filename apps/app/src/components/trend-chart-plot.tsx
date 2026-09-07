import type { TrendPoint, TrendRange, TrendSeries } from "@bro/logic";
import Svg, {
	Circle,
	Line,
	Polyline,
	Rect,
	Text as SvgText,
} from "react-native-svg";
import { useUnistyles } from "../theme/unistyles";

/** A little headroom keeps a narrow range from exaggerating small changes. */
export function editorialChartScale(
	points: readonly TrendPoint[],
	range?: TrendRange | null,
): TrendRange {
	const values = points.flatMap((point) =>
		point.value === null ? [] : [point.value],
	);
	if (range) values.push(range.min, range.max);
	if (!values.length) return { min: 0, max: 1 };
	const low = Math.min(...values),
		high = Math.max(...values);
	const span = Math.max(high - low, Math.abs(high) * 0.02, 0.01);
	const rawStep = span / 3;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const step =
		[1, 2, 5, 10].find((value) => value * magnitude >= rawStep) ?? 10;
	const interval = step * magnitude;
	return {
		min: Math.floor((low - span * 0.15) / interval) * interval,
		max: Math.ceil((high + span * 0.15) / interval) * interval,
	};
}

export function editorialPlotInset(
	format: (value: number | null) => string,
	scale: TrendRange,
	fontScale: number,
) {
	return Math.max(
		40,
		Math.max(format(scale.min).length, format(scale.max).length) *
			6.3 *
			fontScale +
			8,
	);
}

function chartDateLabel(localDay: string, weekly: boolean, locale?: string) {
	return new Intl.DateTimeFormat(
		locale,
		weekly
			? { weekday: "short", timeZone: "UTC" }
			: { day: "numeric", month: "short", timeZone: "UTC" },
	).format(new Date(`${localDay}T12:00:00Z`));
}

/** Axes live outside the plot; each missing day ends a line run. */
export function TrendChartPlot({
	series,
	range,
	width,
	height,
	fontScale,
	format,
	label,
	selectedDay,
	locale,
}: {
	series: TrendSeries;
	range?: TrendRange | null;
	width: number;
	height: number;
	fontScale: number;
	format: (value: number | null) => string;
	label: string;
	selectedDay: string | null;
	locale?: string;
}) {
	const { theme } = useUnistyles();
	const scale = editorialChartScale(series.points, range);
	const left = Math.min(
		width * 0.4,
		editorialPlotInset(format, scale, fontScale),
	);
	const right = width - 8,
		top = 10,
		bottom = height - 28 * fontScale;
	const x = (index: number) =>
		left + (index / Math.max(1, series.points.length - 1)) * (right - left);
	const y = (value: number) =>
		bottom - ((value - scale.min) / (scale.max - scale.min)) * (bottom - top);
	const runs: string[][] = [[]];
	series.points.forEach((point, index) => {
		if (point.value === null) {
			if (runs.at(-1)?.length) runs.push([]);
		} else runs.at(-1)?.push(`${x(index)},${y(point.value)}`);
	});
	const labelCount = Math.max(
		2,
		Math.min(
			series.points.length <= 7 ? 7 : 5,
			Math.floor((right - left) / (50 * fontScale)) + 1,
		),
	);
	const dateIndices = Array.from({ length: labelCount }, (_, i) =>
		Math.round((i * (series.points.length - 1)) / (labelCount - 1)),
	);
	return (
		<Svg
			testID="editorial-trend-chart"
			width="100%"
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			accessibilityLabel={label}
		>
			{[0, 1, 2, 3].map((index) => {
				const value = scale.max - (index / 3) * (scale.max - scale.min);
				return (
					<Line
						key={index}
						x1={left}
						x2={right}
						y1={y(value)}
						y2={y(value)}
						stroke={theme.colors.line}
						strokeWidth={0.7}
					/>
				);
			})}
			{range ? (
				<Rect
					testID="terrain-usual-corridor"
					x={left}
					y={y(range.max)}
					width={right - left}
					height={Math.max(1, y(range.min) - y(range.max))}
					fill={theme.colors.historyFill}
				/>
			) : null}
			{[0, 1, 2, 3].map((index) => {
				const value = scale.max - (index / 3) * (scale.max - scale.min);
				return (
					<SvgText
						key={index}
						x={left - 8}
						y={y(value) + 4}
						textAnchor="end"
						fontSize={12 * fontScale}
						fontFamily={theme.fonts.sans}
						fill={theme.colors.ink2}
					>
						{format(value)}
					</SvgText>
				);
			})}
			{runs
				.filter((run) => run.length > 1)
				.map((run) => (
					<Polyline
						key={run[0]}
						testID="trend-observed-run"
						points={run.join(" ")}
						stroke={theme.colors.brand}
						strokeWidth={1.6}
						fill="none"
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
				))}
			{series.points.map((point, index) =>
				point.value === null ? null : (
					<Circle
						key={point.localDay}
						testID="trend-reading-dot"
						cx={x(index)}
						cy={y(point.value)}
						r={point.localDay === selectedDay ? 4 : 2.5}
						fill={theme.colors.brand}
					/>
				),
			)}
			{dateIndices.map((index) => {
				const point = series.points[index];
				if (!point) return null;
				const date = chartDateLabel(
					point.localDay,
					series.points.length <= 7,
					locale,
				);
				return (
					<SvgText
						key={index}
						x={x(index)}
						y={bottom + 20 * fontScale}
						textAnchor={
							index === 0
								? "start"
								: index === series.points.length - 1
									? "end"
									: "middle"
						}
						fontSize={12 * fontScale}
						fontFamily={theme.fonts.sans}
						fill={theme.colors.ink2}
					>
						{date}
					</SvgText>
				);
			})}
		</Svg>
	);
}
