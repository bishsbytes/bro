import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
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
		<View style={styles.screen}>
			<ScrollView
				style={styles.container}
				contentContainerStyle={styles.content}
			>
				<Text style={styles.intro}>
					Daily averages; days without a check-in stay as gaps.
				</Text>
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
							<Text style={styles.periodText}>{option} days</Text>
						</TouchableOpacity>
					))}
				</View>

				{!snapshot && !error ? <ActivityIndicator size="large" /> : null}
				{error ? (
					<Text style={styles.error}>Trends could not be loaded: {error}</Text>
				) : null}

				{snapshot ? (
					<Text style={styles.range}>
						{snapshot.fromLocalDay} to {snapshot.throughLocalDay}
					</Text>
				) : null}
				{snapshot?.metrics.map(({ metric, series }) => (
					<View key={metric.slug} style={styles.card}>
						<View style={styles.cardHeader}>
							<Text style={styles.sectionTitle}>{metric.label}</Text>
							<Text style={styles.count}>
								{series.observedDayCount} logged days
							</Text>
						</View>
						<TrendChart series={series} />
						{series.daysUntilMeaningful > 0 ? (
							<Text style={styles.notEnough}>
								Not enough data yet. Log {series.daysUntilMeaningful} more day
								{series.daysUntilMeaningful === 1 ? "" : "s"} to make this trend
								useful.
							</Text>
						) : (
							<Text style={styles.ready}>Enough data for a first trend.</Text>
						)}
					</View>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	screen: { flex: 1, backgroundColor: theme.colors.background },
	container: { flex: 1, backgroundColor: theme.colors.background },
	content: { padding: theme.spacing.xl, gap: theme.spacing.lg },
	intro: { ...theme.typography.body, color: theme.colors.textMuted },
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
	periodText: { ...theme.typography.label, color: theme.colors.text },
	range: { ...theme.typography.caption, color: theme.colors.textSubtle },
	card: {
		padding: theme.spacing.lg,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	sectionTitle: { ...theme.typography.section, color: theme.colors.text },
	count: { ...theme.typography.caption, color: theme.colors.textMuted },
	notEnough: { ...theme.typography.body, color: theme.colors.textMuted },
	ready: { ...theme.typography.body, color: theme.colors.text },
	error: { ...theme.typography.body, color: theme.colors.danger },
}));
