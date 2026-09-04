import { systemLocale } from "@bro/domain";
import type { MeasurementSlug } from "@bro/domain/metric-registry";
import type { TrendRange, TrendSeries } from "@bro/logic";
import { Fragment, useId } from "react";
import { useTranslation } from "react-i18next";
import Svg, {
	Circle,
	Defs,
	Line,
	LinearGradient,
	Pattern,
	Polygon,
	Polyline,
	Rect,
	Stop,
	Text as SvgText,
} from "react-native-svg";
import { useUnistyles } from "../theme/unistyles";

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
}: {
	series: TrendSeries;
	height?: number;
	domain?: DataDomain;
	usualRange?: TrendChartUsualRange | null;
}) {
	const { theme } = useUnistyles();
	const { t } = useTranslation("common");
	const dataColor =
		theme.colors[domain ?? dataDomainForMetric(series.metricSlug)];
	const finalMarker = series.markers.at(-1);
	const definitionId = useId().replaceAll(":", "");
	const fadeId = `terrain-fade-${definitionId}`;
	const hatchId = `terrain-hatch-${definitionId}`;
	const corridor = usualRange
		? {
				top: terrainYForValue(usualRange.max, series.scale),
				bottom: terrainYForValue(usualRange.min, series.scale),
			}
		: null;
	const dateRange = terrainDateRangeLabel(series, systemLocale());
	return (
		<Svg
			accessibilityLabel={
				usualRange
					? t("a11y.trendChartWithUsualRange", {
							metric: series.metricSlug,
							min: usualRange.minFormatted,
							max: usualRange.maxFormatted,
						})
					: t("a11y.trendChart", { metric: series.metricSlug })
			}
			viewBox="0 0 300 140"
			height={height}
			width="100%"
		>
			<Defs>
				<LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
					<Stop offset="0" stopColor={dataColor} stopOpacity="0.35" />
					<Stop offset="1" stopColor={dataColor} stopOpacity="0" />
				</LinearGradient>
				<Pattern
					id={hatchId}
					width="6"
					height="6"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(-20)"
				>
					<Line
						x1="0"
						y1="0"
						x2="0"
						y2="6"
						stroke={dataColor}
						strokeOpacity="0.22"
						strokeWidth="1"
					/>
				</Pattern>
			</Defs>
			{corridor ? (
				<Rect
					testID="terrain-usual-corridor"
					x="0"
					y={corridor.top}
					width="300"
					height={Math.max(corridor.bottom - corridor.top, 1)}
					fill={theme.colors.surface3}
					fillOpacity="0.8"
				/>
			) : null}
			{series.segments.map((points) => (
				<Fragment key={points}>
					<Polygon
						points={terrainPolygonPoints(points)}
						fill={`url(#${fadeId})`}
					/>
					<Polygon
						points={terrainPolygonPoints(points)}
						fill={`url(#${hatchId})`}
					/>
					<Polyline
						points={points}
						fill="none"
						stroke={dataColor}
						strokeOpacity="0.22"
						strokeWidth="8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<Polyline
						points={points}
						fill="none"
						stroke={dataColor}
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</Fragment>
			))}
			{finalMarker ? (
				<Circle
					key={finalMarker.localDay}
					cx={finalMarker.x}
					cy={finalMarker.y}
					r="4"
					fill={dataColor}
				/>
			) : null}
			{corridor && usualRange ? (
				<>
					<SvgText
						testID="terrain-usual-max-label"
						x="0"
						y={Math.max(TERRAIN_TOP_Y + 8, corridor.top - 3)}
						fill={theme.colors.ink3}
						fontFamily={theme.typography.monoInline.fontFamily}
						fontSize="9"
					>
						{usualRange.maxFormatted}
					</SvgText>
					{usualRange.minFormatted !== usualRange.maxFormatted ? (
						<SvgText
							testID="terrain-usual-min-label"
							x="0"
							y={Math.min(TERRAIN_BASELINE_Y, corridor.bottom + 10)}
							fill={theme.colors.ink3}
							fontFamily={theme.typography.monoInline.fontFamily}
							fontSize="9"
						>
							{usualRange.minFormatted}
						</SvgText>
					) : null}
					<SvgText
						testID="terrain-usual-range-label"
						x="0"
						y="136"
						fill={theme.colors.ink3}
						fontFamily={theme.typography.caption.fontFamily}
						fontSize="9"
					>
						{t("terrain.usualRange")}
					</SvgText>
				</>
			) : null}
			{dateRange ? (
				<SvgText
					testID="terrain-date-range-label"
					x="300"
					y="136"
					textAnchor="end"
					fill={theme.colors.ink3}
					fontFamily={theme.typography.monoInline.fontFamily}
					fontSize="9"
				>
					{dateRange}
				</SvgText>
			) : null}
		</Svg>
	);
}
