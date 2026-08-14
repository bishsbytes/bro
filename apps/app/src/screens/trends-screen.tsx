import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { AppText } from "../components/app-text";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import {
	createTrendsStore,
	type TrendsSnapshot,
	type TrendsStore,
} from "../trends/trends-store";
import {
	TREND_PERIODS,
	type TrendPeriod,
	type TrendSeries,
} from "../trends/trend-math";

type TrendsScreenProps = {
	store?: Pick<TrendsStore, "load">;
};

function TrendChart({ series }: { series: TrendSeries }) {
	const { theme } = useUnistyles();
	return (
		<Svg
			accessibilityLabel={`${series.metricSlug} trend chart`}
			viewBox="0 0 300 120"
			height={150}
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

export function TrendsScreen({ store }: TrendsScreenProps) {
	const trends = useMemo(() => store ?? createTrendsStore(), [store]);
	const [period, setPeriod] = useState<TrendPeriod>(7);
	const [snapshot, setSnapshot] = useState<TrendsSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setSnapshot(null);
		setError(null);
		void trends
			.load(period)
			.then(setSnapshot)
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : String(caught)),
			);
	}, [period, trends]);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText color="muted">
				Daily averages; days without a check-in stay as gaps.
			</AppText>
			<View style={styles.periodRow}>
				{TREND_PERIODS.map((option) => (
					<TouchableOpacity
						key={option}
						accessibilityRole="button"
						accessibilityState={{ selected: period === option }}
						style={[
							styles.periodButton,
							period === option && styles.periodSelected,
						]}
						onPress={() => setPeriod(option)}
					>
						<AppText variant="label">{option} days</AppText>
					</TouchableOpacity>
				))}
			</View>

			{!snapshot && !error ? <ActivityIndicator size="large" /> : null}
			{error ? (
				<AppText color="danger">Trends could not be loaded: {error}</AppText>
			) : null}

			{snapshot ? (
				<AppText variant="caption" color="subtle">
					{snapshot.fromLocalDay} to {snapshot.throughLocalDay}
				</AppText>
			) : null}
			{snapshot?.metrics.map(({ metric, series }) => (
				<Card key={metric.slug} style={styles.card}>
					<SectionHeader
						title={metric.label}
						action={
							<AppText variant="caption" color="muted">
								{series.observedDayCount} logged days
							</AppText>
						}
					/>
					<TrendChart series={series} />
					{series.daysUntilMeaningful > 0 ? (
						<AppText color="muted">
							Not enough data yet. Log {series.daysUntilMeaningful} more day
							{series.daysUntilMeaningful === 1 ? "" : "s"} to make this trend
							useful.
						</AppText>
					) : (
						<AppText>Enough data for a first trend.</AppText>
					)}
				</Card>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	periodRow: { flexDirection: "row", gap: theme.spacing.sm },
	periodButton: {
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
	},
	periodSelected: {
		backgroundColor: theme.colors.selected,
		borderColor: theme.colors.brand,
	},
	card: { gap: theme.spacing.md },
}));
