import {
	renderInsightSummary,
	renderInsightTeaserProgress,
	TREND_PERIODS,
	type TrendPeriod,
} from "@bro/logic";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TrendChart } from "../../components/trend-chart";
import {
	createInsightStore,
	type InsightSnapshot,
	type InsightStore,
} from "../../insight/insight-store";
import { StyleSheet } from "../../theme/unistyles";
import {
	createTrendsStore,
	type TrendsSnapshot,
	type TrendsStore,
} from "../../trends/trends-store";

type InsightsScreenProps = {
	store?: Pick<TrendsStore, "load">;
	insightStore?: Pick<InsightStore, "load">;
};

export function InsightsScreen({ store, insightStore }: InsightsScreenProps) {
	const trends = useMemo(() => store ?? createTrendsStore(), [store]);
	const insights = useMemo(
		() => insightStore ?? createInsightStore(),
		[insightStore],
	);
	const [period, setPeriod] = useState<TrendPeriod>(7);
	const [snapshot, setSnapshot] = useState<TrendsSnapshot | null>(null);
	const [insightSnapshot, setInsightSnapshot] =
		useState<InsightSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [insightError, setInsightError] = useState<string | null>(null);

	const loadInsights = useCallback(async () => {
		setInsightError(null);
		try {
			setInsightSnapshot(await insights.load());
		} catch (caught) {
			setInsightError(
				caught instanceof Error ? caught.message : String(caught),
			);
		}
	}, [insights]);

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
			void loadInsights();
			return () => {
				active = false;
			};
		}, [loadInsights, period, trends]),
	);

	return (
		<Screen scroll padded contentContainerStyle={styles.content}>
			<AppText color="muted">
				See the patterns in your record and how every tracked measure changes
				over time.
			</AppText>

			<View style={styles.section}>
				<SectionHeader title="Insights" eyebrow="LAST 90 DAYS" />
				{!insightSnapshot && !insightError ? (
					<ActivityIndicator size="large" />
				) : null}
				{insightError ? (
					<EmptyState
						title="Insights could not be loaded"
						body={insightError}
						actionLabel="Try again"
						onAction={() => void loadInsights()}
						tone="danger"
					/>
				) : null}
				{insightSnapshot?.state === "empty" ? (
					<Card style={styles.card}>
						<AppText variant="section">
							Your patterns start with check-ins
						</AppText>
						<AppText color="muted">
							As your record grows, this space compares days to show
							associations that you did not have to type in yourself.
						</AppText>
					</Card>
				) : null}
				{insightSnapshot?.state === "not-yet" ? (
					<Card style={styles.card}>
						<AppText variant="section">
							Watching {insightSnapshot.teaser.watchedCount} patterns
						</AppText>
						<AppText color="muted">
							{renderInsightTeaserProgress(insightSnapshot.teaser)}
						</AppText>
					</Card>
				) : null}
				{insightSnapshot?.shown.map((insight) => (
					<ListRow
						key={insight.pair.id}
						title="Pattern in your record"
						detail={renderInsightSummary(insight)}
						accessibilityLabel={`Open insight: ${renderInsightSummary(insight)}`}
						onPress={() =>
							router.push(
								`/insights/${encodeURIComponent(insight.pair.id)}` as Href,
							)
						}
					/>
				))}
			</View>

			<View style={styles.section}>
				<SectionHeader title="Trends" eyebrow="YOUR TRACKED DATA" />
				<AppText color="muted">
					Scored metrics use daily averages, body metrics use the last reading,
					and consumption totals are summed. Missing days stay as gaps.
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
					<EmptyState
						title="Trends could not be loaded"
						body={error}
						tone="danger"
					/>
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
			</View>

			<ListRow
				title="History"
				detail="Browse check-ins and reviews by day."
				accessibilityLabel="Open history"
				onPress={() => router.push("/history")}
			/>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.lg },
	section: { gap: theme.spacing.md },
	card: { gap: theme.spacing.md },
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
}));

export default InsightsScreen;
