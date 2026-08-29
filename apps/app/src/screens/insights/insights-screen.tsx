import {
	renderInsightSummary,
	renderInsightTeaserProgress,
	TREND_PERIODS,
	type TrendPeriod,
} from "@bro/logic";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingIndicator } from "../../components/loading-indicator";
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
	const { t } = useTranslation(["insights", "common"]);
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
			<AppText color="muted">{t("intro")}</AppText>

			<View style={styles.section}>
				<SectionHeader
					title={t("patterns.title")}
					eyebrow={t("patterns.eyebrow")}
				/>
				{!insightSnapshot && !insightError ? (
					<LoadingIndicator size="large" />
				) : null}
				{insightError ? (
					<EmptyState
						title={t("patterns.loadFailed")}
						body={insightError}
						actionLabel={t("common:actions.tryAgain")}
						onAction={() => void loadInsights()}
						tone="danger"
					/>
				) : null}
				{insightSnapshot?.state === "empty" ? (
					<Card style={styles.card}>
						<AppText variant="section">{t("patterns.emptyTitle")}</AppText>
						<AppText color="muted">{t("patterns.emptyBody")}</AppText>
					</Card>
				) : null}
				{insightSnapshot?.state === "not-yet" ? (
					<Card style={styles.card}>
						<AppText variant="section">
							{t("patterns.watchingTitle", {
								count: insightSnapshot.teaser.watchedCount,
							})}
						</AppText>
						<AppText color="muted">
							{renderInsightTeaserProgress(insightSnapshot.teaser)}
						</AppText>
					</Card>
				) : null}
				{insightSnapshot?.shown.map((insight) => (
					<ListRow
						key={insight.pair.id}
						title={t("patterns.rowTitle")}
						detail={renderInsightSummary(insight)}
						accessibilityLabel={t("patterns.open", {
							summary: renderInsightSummary(insight),
						})}
						onPress={() =>
							router.push(
								`/insights/${encodeURIComponent(insight.pair.id)}` as Href,
							)
						}
					/>
				))}
			</View>

			<View style={styles.section}>
				<SectionHeader
					title={t("trends.title")}
					eyebrow={t("trends.eyebrow")}
				/>
				<AppText color="muted">{t("trends.intro")}</AppText>
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
							<AppText variant="label">
								{t("trends.period", { count: option })}
							</AppText>
						</TouchableOpacity>
					))}
				</View>

				{!snapshot && !error ? <LoadingIndicator size="large" /> : null}
				{error ? (
					<EmptyState
						title={t("trends.loadFailed")}
						body={error}
						tone="danger"
					/>
				) : null}
				{snapshot ? (
					<AppText variant="caption" color="subtle">
						{t("trends.range", {
							from: snapshot.fromLocalDay,
							through: snapshot.throughLocalDay,
						})}
					</AppText>
				) : null}
				{snapshot?.metrics.map(({ metric, label, series, latestFormatted }) => (
					<Card key={metric.slug} style={styles.card}>
						<SectionHeader
							title={label}
							action={
								<AppText variant="caption" color="muted">
									{t("trends.loggedDays", { count: series.observedDayCount })}
								</AppText>
							}
						/>
						{latestFormatted ? (
							<AppText color="muted">
								{t("trends.latest", { value: latestFormatted })}
							</AppText>
						) : null}
						<TrendChart series={series} />
						{series.daysUntilMeaningful > 0 ? (
							<AppText color="muted">
								{t("trends.notEnoughData", {
									count: series.daysUntilMeaningful,
								})}
							</AppText>
						) : (
							<AppText>{t("trends.enoughData")}</AppText>
						)}
					</Card>
				))}
			</View>

			<ListRow
				title={t("history.title")}
				detail={t("history.detail")}
				accessibilityLabel={t("history.open")}
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
