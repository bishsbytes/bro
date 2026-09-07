import { type DisplayUnit, systemLocale } from "@bro/domain";
import type { MeasurementSlug } from "@bro/domain/metric-registry";
import {
	formatMetricValue,
	metricDisplayUnit,
	type TrendPoint,
	type TrendRange,
	type TrendSeries,
} from "@bro/logic";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import Svg, {
	Circle,
	Line,
	Polyline,
	Rect,
	Text as SvgText,
} from "react-native-svg";
import { resolveMetric } from "../content";
import { useUnistyles } from "../theme/unistyles";
import { unitWords } from "../units/unit-words";
import { AppText } from "./app-text";
import { Button } from "./button";

export type DataDomain = "mind" | "body" | "sleep" | "load";

/**
 * Domains the slug heuristic below cannot infer. Body metrics carry a group in
 * the registry, so their ink is stated rather than guessed: everything in
 * Measurements is `--body`, and the Health & fitness signals take their own, so
 * the two cards on Body do not end up sharing one colour by accident.
 */
const STATED_DOMAINS: Partial<Record<MeasurementSlug, DataDomain>> = {
	sleep_duration: "sleep",
	steps: "body",
	resting_heart_rate: "body",
};

const TERRAIN_BASELINE_Y = 110;
const TERRAIN_TOP_Y = 10;
const TERRAIN_PLOT_HEIGHT = TERRAIN_BASELINE_Y - TERRAIN_TOP_Y;

export type TrendChartUsualRange = TrendRange & {
	minFormatted: string;
	maxFormatted: string;
};

export type TrendChartHeading = {
	value: number;
	formatted: string;
};

/**
 * Close each observed run against its own horizontal extent. Closing every
 * run against the full chart width turns short or isolated runs into the large
 * crossing triangles that appear when there are gaps between observations.
 */
export function terrainPolygonPoints(points: string): string {
	const coordinates = points.trim().split(/\s+/);
	const first = coordinates[0];
	const last = coordinates.at(-1);
	if (!first || !last) return points;

	const firstX = first.split(",", 1)[0];
	const lastX = last.split(",", 1)[0];
	return `${points} ${lastX},${TERRAIN_BASELINE_Y} ${firstX},${TERRAIN_BASELINE_Y}`;
}

export function terrainYForValue(value: number, scale: TrendRange): number {
	if (scale.max === scale.min) return TERRAIN_TOP_Y + TERRAIN_PLOT_HEIGHT / 2;
	const position = (value - scale.min) / (scale.max - scale.min);
	return TERRAIN_TOP_Y + (1 - position) * TERRAIN_PLOT_HEIGHT;
}

function terrainLocalDayLabel(localDay: string, locale?: string): string {
	const date = new Date(`${localDay}T00:00:00.000Z`);
	if (!Number.isFinite(date.getTime())) return localDay;
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	}).format(date);
}

export function terrainDateRangeLabel(
	series: TrendSeries,
	locale?: string,
): string | null {
	const first = series.points[0]?.localDay;
	const last = series.points.at(-1)?.localDay;
	if (!first || !last) return null;
	return `${terrainLocalDayLabel(first, locale)} – ${terrainLocalDayLabel(last, locale)}`;
}

export function dataDomainForMetric(metricSlug: string): DataDomain {
	const stated = STATED_DOMAINS[metricSlug as MeasurementSlug];
	if (stated) return stated;
	if (metricSlug.includes("sleep")) return "sleep";
	if (
		["mood", "stress", "energy", "motivation", "productivity", "libido"].some(
			(slug) => metricSlug.includes(slug),
		)
	) {
		return "mind";
	}
	if (metricSlug.includes("training") || metricSlug.includes("strain")) {
		return "load";
	}
	return "body";
}

export function TrendChart({
	series,
	height = 170,
	domain,
	usualRange,
	heading,
	displayUnit,
	label,
	onSelect,
}: {
	series: TrendSeries;
	height?: number;
	domain?: DataDomain;
	usualRange?: TrendChartUsualRange | null;
	heading?: TrendChartHeading | null;
	displayUnit?: DisplayUnit | null;
	label?: string;
	onSelect?: (point: TrendPoint | null, formatted: string) => void;
}) {
	const { theme } = useUnistyles();
	const { t } = useTranslation("common");
	const [selectedDay, setSelectedDay] = useState<string | null>(null);
	const [showReadings, setShowReadings] = useState(false);
	const [chartWidth, setChartWidth] = useState(300);
	const { fontScale = 1 } = useWindowDimensions();
	// Counter the SVG viewBox scaling so labels remain at least 12 device points.
	const chartLabelSize =
		(12 * fontScale) / Math.max(Math.min(chartWidth / 300, height / 140), 0.1);
	const width = useRef(300);
	const touchStart = useRef({ x: 0, y: 0 });
	const resolved = resolveMetric(series.metricSlug);
	const metricLabel =
		label ??
		(resolved.kind === "known" ? resolved.metric.label : series.metricSlug);
	const selected =
		series.points.find((point) => point.localDay === selectedDay) ?? null;
	const format = (value: number | null) => {
		if (value === null) return t("terrain.missing");
		if (resolved.kind === "known" && resolved.metric.kind === "measurement") {
			return formatMetricValue(
				resolved.metric,
				value,
				displayUnit === undefined
					? metricDisplayUnit(resolved.metric, new Map(), systemLocale())
					: displayUnit,
				systemLocale(),
				unitWords(),
			);
		}
		return new Intl.NumberFormat(systemLocale(), {
			maximumFractionDigits: 1,
		}).format(value);
	};
	function select(index: number) {
		const point =
			series.points[Math.max(0, Math.min(series.points.length - 1, index))];
		if (!point) return;
		setSelectedDay(point.localDay);
		onSelect?.(point, format(point.value));
	}
	function selectAt(x: number) {
		select(
			Math.round((x / Math.max(1, width.current)) * (series.points.length - 1)),
		);
	}
	const selectedIndex = selected
		? series.points.indexOf(selected)
		: series.points.length - 1;
	const selectionLabel = selected
		? `${selected.localDay}: ${format(selected.value)}`
		: t("terrain.explore");

	const dataColor =
		theme.colors[domain ?? dataDomainForMetric(series.metricSlug)];
	const finalMarker = series.markers.at(-1);
	const corridor = usualRange
		? {
				top: terrainYForValue(usualRange.max, series.scale),
				bottom: terrainYForValue(usualRange.min, series.scale),
			}
		: null;
	const headingY = heading
		? terrainYForValue(heading.value, series.scale)
		: null;
	const dateRange = terrainDateRangeLabel(series, systemLocale());
	return (
		<View>
			<View
				testID="terrain-explorer"
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={`${metricLabel}. ${selectionLabel}`}
				accessibilityHint={t("terrain.explore")}
				accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
				onAccessibilityAction={(event) =>
					select(
						selectedIndex +
							(event.nativeEvent.actionName === "increment" ? 1 : -1),
					)
				}
				onLayout={(event) => {
					width.current = event.nativeEvent.layout.width;
					setChartWidth(event.nativeEvent.layout.width);
				}}
				onTouchStart={(event) => {
					touchStart.current = {
						x: event.nativeEvent.pageX,
						y: event.nativeEvent.pageY,
					};
				}}
				onMoveShouldSetResponder={(event) =>
					Math.abs(event.nativeEvent.pageX - touchStart.current.x) > 8 &&
					Math.abs(event.nativeEvent.pageX - touchStart.current.x) >
						Math.abs(event.nativeEvent.pageY - touchStart.current.y)
				}
				onResponderGrant={(event) => selectAt(event.nativeEvent.locationX)}
				onResponderMove={(event) => selectAt(event.nativeEvent.locationX)}
			>
				<Svg
					accessibilityLabel={[
						t("a11y.trendChart", { metric: series.metricSlug }),
						usualRange
							? t("a11y.trendChartUsualRange", {
									min: usualRange.minFormatted,
									max: usualRange.maxFormatted,
								})
							: null,
						heading
							? t("a11y.trendChartHeading", { value: heading.formatted })
							: null,
					]
						.filter((part) => part !== null)
						.join(" ")}
					viewBox="0 0 300 140"
					height={height}
					width="100%"
				>
					{corridor ? (
						<Rect
							testID="terrain-usual-corridor"
							x="0"
							y={corridor.top}
							width="300"
							height={Math.max(corridor.bottom - corridor.top, 1)}
							fill={theme.colors.historyFill}
						/>
					) : null}
					{series.segments.map((points) => (
						<Polyline
							key={points}
							points={points}
							fill="none"
							stroke={dataColor}
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					))}
					{series.segments
						.filter((points) => points.trim().split(/\s+/).length === 1)
						.map((points) => {
							const [x, y] = points.split(",").map(Number);
							return (
								<Line
									key={points}
									testID="terrain-isolated-reading"
									x1={x - 2}
									x2={x + 2}
									y1={y}
									y2={y}
									stroke={dataColor}
									strokeWidth="2"
								/>
							);
						})}
					{selected && selected.value !== null ? (
						<Line
							testID="terrain-selected-reading"
							x1={(selectedIndex / Math.max(series.points.length - 1, 1)) * 300}
							x2={(selectedIndex / Math.max(series.points.length - 1, 1)) * 300}
							y1="10"
							y2="110"
							stroke={theme.colors.ink}
							strokeDasharray="3 3"
						/>
					) : null}
					{headingY !== null ? (
						<Line
							testID="terrain-heading-line"
							x1="0"
							y1={headingY}
							x2="300"
							y2={headingY}
							stroke={theme.colors.ink}
							strokeOpacity="0.8"
							strokeWidth="1"
							strokeDasharray="4 4"
						/>
					) : null}
					{finalMarker ? (
						<Circle
							testID="terrain-current-marker"
							cx={finalMarker.x}
							cy={finalMarker.y}
							r={theme.terrain.currentDot}
							fill={dataColor}
						/>
					) : null}
					{corridor && usualRange ? (
						<>
							<SvgText
								testID="terrain-usual-max-label"
								x="0"
								y={Math.max(TERRAIN_TOP_Y + 8, corridor.top - 3)}
								fill={theme.colors.ink2}
								fontFamily={theme.typography.monoInline.fontFamily}
								fontSize={chartLabelSize}
							>
								{usualRange.maxFormatted}
							</SvgText>
							{usualRange.minFormatted !== usualRange.maxFormatted ? (
								<SvgText
									testID="terrain-usual-min-label"
									x="0"
									y={Math.min(TERRAIN_BASELINE_Y, corridor.bottom + 10)}
									fill={theme.colors.ink2}
									fontFamily={theme.typography.monoInline.fontFamily}
									fontSize={chartLabelSize}
								>
									{usualRange.minFormatted}
								</SvgText>
							) : null}
							<SvgText
								testID="terrain-usual-range-label"
								x="0"
								y="136"
								fill={theme.colors.ink2}
								fontFamily={theme.typography.caption.fontFamily}
								fontSize={chartLabelSize}
							>
								{t("terrain.usualRange")}
							</SvgText>
						</>
					) : null}
					{headingY !== null && heading ? (
						<SvgText
							testID="terrain-heading-label"
							x="0"
							y={Math.max(TERRAIN_TOP_Y + 8, headingY - 3)}
							fill={theme.colors.ink2}
							fontFamily={theme.typography.monoInline.fontFamily}
							fontSize={chartLabelSize}
						>
							{t("terrain.heading", { value: heading.formatted })}
						</SvgText>
					) : null}
					{dateRange ? (
						<SvgText
							testID="terrain-date-range-label"
							x="300"
							y="136"
							textAnchor="end"
							fill={theme.colors.ink2}
							fontFamily={theme.typography.monoInline.fontFamily}
							fontSize={chartLabelSize}
						>
							{dateRange}
						</SvgText>
					) : null}
				</Svg>
			</View>
			{selected ? (
				<View>
					<AppText variant="monoInline">{selectionLabel}</AppText>
					<Button
						label={t("terrain.latest")}
						variant="text"
						onPress={() => {
							setSelectedDay(null);
							onSelect?.(null, "");
						}}
					/>
				</View>
			) : null}
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
					gap: theme.spacing.sm,
				}}
			>
				<Button
					label={t("terrain.previous")}
					variant="text"
					disabled={selectedIndex <= 0}
					onPress={() => select(selectedIndex - 1)}
				/>
				<Button
					label={t("terrain.next")}
					variant="text"
					disabled={selectedIndex >= series.points.length - 1}
					onPress={() => select(selectedIndex + 1)}
				/>
			</View>
			<Button
				label={t(
					showReadings ? "terrain.hideReadings" : "terrain.showReadings",
				)}
				variant="text"
				onPress={() => setShowReadings(!showReadings)}
			/>
			{showReadings
				? series.points.map((point) => (
						<AppText
							key={point.localDay}
							variant="monoInline"
						>{`${point.localDay}: ${format(point.value)}`}</AppText>
					))
				: null}
		</View>
	);
}
