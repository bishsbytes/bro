import type { MeasurementSlug } from "@bro/domain/metric-registry";
import type { TrendSeries } from "@bro/logic";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import Svg, {
	Circle,
	Defs,
	Line,
	LinearGradient,
	Pattern,
	Polygon,
	Polyline,
	Stop,
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
	height = 150,
	domain,
}: {
	series: TrendSeries;
	height?: number;
	domain?: DataDomain;
}) {
	const { theme } = useUnistyles();
	const { t } = useTranslation("common");
	const dataColor =
		theme.colors[domain ?? dataDomainForMetric(series.metricSlug)];
	const finalMarker = series.markers.at(-1);
	return (
		<Svg
			accessibilityLabel={t("a11y.trendChart", { metric: series.metricSlug })}
			viewBox="0 0 300 120"
			height={height}
			width="100%"
		>
			<Defs>
				<LinearGradient id="terrain-fade" x1="0" y1="0" x2="0" y2="1">
					<Stop offset="0" stopColor={dataColor} stopOpacity="0.35" />
					<Stop offset="1" stopColor={dataColor} stopOpacity="0" />
				</LinearGradient>
				<Pattern
					id="terrain-hatch"
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
			<Line
				x1="0"
				y1="60"
				x2="300"
				y2="60"
				stroke={theme.colors.surface3}
				strokeWidth="18"
				strokeOpacity="0.8"
			/>
			{series.segments.map((points) => (
				<Fragment key={points}>
					<Polygon
						points={terrainPolygonPoints(points)}
						fill="url(#terrain-fade)"
					/>
					<Polygon
						points={terrainPolygonPoints(points)}
						fill="url(#terrain-hatch)"
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
		</Svg>
	);
}
