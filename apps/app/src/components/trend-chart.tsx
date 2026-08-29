import type { TrendSeries } from "@bro/logic";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useUnistyles } from "../theme/unistyles";

export function TrendChart({
	series,
	height = 150,
}: {
	series: TrendSeries;
	height?: number;
}) {
	const { theme } = useUnistyles();
	const { t } = useTranslation("common");
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
					stroke={theme.colors.brand}
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
					fill={theme.colors.brand}
				/>
			))}
		</Svg>
	);
}
