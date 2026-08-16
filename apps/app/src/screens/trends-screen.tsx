import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { TrendChart } from "../components/trend-chart";
import { StyleSheet } from "../theme/unistyles";
import { TREND_PERIODS, type TrendPeriod } from "../trends/trend-math";
import {
	createTrendsStore,
	type TrendsSnapshot,
	type TrendsStore,
} from "../trends/trends-store";

type TrendsScreenProps = {
	store?: Pick<TrendsStore, "load">;
};

export function TrendsScreen({ store }: TrendsScreenProps) {
	const trends = useMemo(() => store ?? createTrendsStore(), [store]);
	const [period, setPeriod] = useState<TrendPeriod>(7);
	const [snapshot, setSnapshot] = useState<TrendsSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);

	useFocusEffect(
		useCallback(() => {
			let active = true;
			setSnapshot(null);
			setError(null);
			void trends
				.load(period)
				.then((nextSnapshot) => {
					if (active) setSnapshot(nextSnapshot);
				})
				.catch((caught: unknown) => {
					if (active) {
						setError(caught instanceof Error ? caught.message : String(caught));
					}
				});
			return () => {
				active = false;
			};
		}, [period, trends]),
	);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<View style={styles.destinationRow}>
				<Card style={styles.destinationCard}>
					<SectionHeader title="Wheel of life" eyebrow="PERIODIC REVIEW" />
					<AppText color="muted">Compare your wheel and revisit goals.</AppText>
					<Button
						label="Open wheel reviews"
						variant="secondary"
						onPress={() => router.push("/review")}
					/>
				</Card>
				<Card style={styles.destinationCard}>
					<SectionHeader title="Body" eyebrow="MEASUREMENTS" />
					<AppText color="muted">See body history and manage targets.</AppText>
					<Button
						label="Open Body"
						variant="secondary"
						onPress={() => router.push("/body")}
					/>
				</Card>
			</View>
			<AppText color="muted">
				Daily summaries; scored metrics use averages and measurements use the
				last reading. Missing days stay as gaps.
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
			{snapshot?.metrics.map(({ metric, label, series, latestFormatted }) => (
				<Card key={metric.slug} style={styles.card}>
					<SectionHeader
						title={label}
						action={
							<AppText variant="caption" color="muted">
								{series.observedDayCount} logged days
							</AppText>
						}
					/>
					{latestFormatted ? (
						<AppText color="muted">Latest {latestFormatted}</AppText>
					) : null}
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
	destinationRow: { flexDirection: "row", gap: theme.spacing.md },
	destinationCard: { flex: 1, gap: theme.spacing.sm },
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
