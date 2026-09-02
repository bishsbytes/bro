import type { MeasurementSlug } from "@bro/domain/metric-registry";
import type { TrendSeries } from "@bro/logic";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
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
	steps: "load",
	resting_heart_rate: "load",
};

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
	return (
		<Svg
			accessibilityLabel={t("a11y.trendChart", { metric: series.metricSlug })}
			viewBox="0 0 300 120"
			height={height}
			width="100%"
		>
			<Line x1="0" y1="10" x2="300" y2="10" stroke={theme.colors.border} />
			<Line x1="0" y1="60" x2="300" y2="60" stroke={theme.colors.border} />
			<Line x1="0" y1="110" x2="300" y2="110" stroke={theme.colors.border} />
			{series.segments.map((points) => (
				<Polyline
					key={points}
					points={points}
					fill="none"
					stroke={dataColor}
					strokeWidth="4"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			))}
			{series.markers.map((marker) => (
				<Circle
					key={marker.localDay}
					cx={marker.x}
					cy={marker.y}
					r="4"
					fill={dataColor}
				/>
			))}
		</Svg>
	);
}
