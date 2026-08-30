import type { MeasurementEntry } from "@bro/domain";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type BodyGoalProgress,
	type BodyOverview,
	type BodyStore,
	createBodyStore,
	type MeasurementPresentation,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { MeasurementField } from "../../components/measurement-field";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { TrendChart } from "../../components/trend-chart";
import {
	createDrinksStore,
	type DrinkDaySnapshot,
	type DrinksStore,
} from "../../drinks/drinks-store";
import {
	createFoodStore,
	type FoodDaySnapshot,
	type FoodStore,
} from "../../food/food-store";
import { healthPlatformLabel } from "../../health/platform-label";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	isBlankEntry,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet } from "../../theme/unistyles";

type LogScreenProps = {
	bodyStore?: Pick<
		BodyStore,
		"loadOverview" | "setTracked" | "recordMeasurement"
	>;
	drinksStore?: Pick<DrinksStore, "loadToday">;
	foodStore?: Pick<FoodStore, "loadToday">;
};

type LogSnapshot = {
	body: BodyOverview;
	drinks: DrinkDaySnapshot;
	food: FoodDaySnapshot;
};

function observedLabel(observedAt: number): string {
	return new Date(observedAt).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function sourceLabel(t: TFunction<"log">, source: string): string {
	return healthPlatformLabel(source) ?? t("measurements.sourceYou");
}

function goalLine(t: TFunction<"log">, goal: BodyGoalProgress): string {
	const target = t("goal.target", { value: goal.targetFormatted });
	if (goal.targetReached) {
		return t("goal.targetWithNote", { target, note: t("goal.reached") });
	}
	if (goal.progressPercent === null) {
		return target;
	}
	return t("goal.targetWithNote", {
		target,
		note: t("goal.percentComplete", { percent: goal.progressPercent }),
	});
}

function DailySummary({
	title,
	entryCount,
	metrics,
	onPress,
}: {
	title: string;
	entryCount: number;
	metrics: readonly {
		metric: { slug: string; label: string };
		dayFormatted: string | null;
	}[];
	onPress: () => void;
}) {
	const { t } = useTranslation(["log", "common"]);

	return (
		<ListRow
			title={title}
			value={t("entries", { count: entryCount })}
			accessibilityLabel={t("open", { name: title })}
			onPress={onPress}
		>
			<View style={styles.summaryMetrics}>
				{metrics.map((metric) => (
					<View key={metric.metric.slug} style={styles.summaryMetric}>
						<AppText variant="micro" color="subtle">
							{upperCaseForLanguage(metric.metric.label)}
						</AppText>
						<AppText variant="label">
							{metric.dayFormatted ?? t("common:emDash")}
						</AppText>
					</View>
				))}
			</View>
		</ListRow>
	);
}

export function LogScreen({
	bodyStore,
	drinksStore,
	foodStore,
}: LogScreenProps) {
	const { t } = useTranslation(["log", "common"]);
	const body = useMemo(() => bodyStore ?? createBodyStore(), [bodyStore]);
	const drinks = useMemo(
		() => drinksStore ?? createDrinksStore(),
		[drinksStore],
	);
	const food = useMemo(() => foodStore ?? createFoodStore(), [foodStore]);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [entries, setEntries] = useState<Record<string, MeasurementEntry>>({});
	const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(async (): Promise<LogSnapshot> => {
			const [bodyOverview, drinksToday, foodToday] = await Promise.all([
				body.loadOverview(),
				drinks.loadToday(),
				food.loadToday(),
			]);
			return { body: bodyOverview, drinks: drinksToday, food: foodToday };
		}, [body, drinks, food]),
	);

	async function setTracked(metricSlug: string, enabled: boolean) {
		if (!snapshot) return;
		setBusySlug(metricSlug);
		setError(null);
		try {
			setSnapshot({
				...snapshot,
				body: await body.setTracked(metricSlug, enabled),
			});
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusySlug(null);
		}
	}

	function updateEntry(metricSlug: string, entry: MeasurementEntry) {
		setEntries((current) => ({ ...current, [metricSlug]: entry }));
		setEntryErrors((current) => {
			if (!(metricSlug in current)) return current;
			const next = { ...current };
			delete next[metricSlug];
			return next;
		});
	}

	async function recordMeasurement(
		metricSlug: string,
		presentation: MeasurementPresentation,
	) {
		if (!snapshot || busySlug) return;
		const entry = entries[metricSlug] ?? EMPTY_ENTRY;
		if (isBlankEntry(entry)) return;
		const parsed = parseMeasurementInput(
			entry,
			presentation,
			snapshot.body.inputLocale,
		);
		if (!parsed.ok) {
			setEntryErrors((current) => ({ ...current, [metricSlug]: parsed.error }));
			return;
		}
		setBusySlug(metricSlug);
		setError(null);
		try {
			const recorded = await body.recordMeasurement(
				metricSlug,
				parsed.canonicalValue,
			);
			setSnapshot({ ...snapshot, body: recorded });
			setEntries((current) => ({ ...current, [metricSlug]: EMPTY_ENTRY }));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusySlug(null);
		}
	}

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const visible = snapshot.body.metrics.filter((metric) => metric.visible);
	const untracked = snapshot.body.metrics.filter((metric) => !metric.visible);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("intro")}</AppText>

			<View style={styles.section}>
				<SectionHeader title={t("drinks")} eyebrow={t("todayEyebrow")} />
				<DailySummary
					title={t("drinks")}
					entryCount={snapshot.drinks.entries.length}
					metrics={snapshot.drinks.metrics}
					onPress={() => router.push("/drinks")}
				/>
			</View>

			<View style={styles.section}>
				<SectionHeader title={t("food")} eyebrow={t("todayEyebrow")} />
				<DailySummary
					title={t("food")}
					entryCount={snapshot.food.entries.length}
					metrics={snapshot.food.metrics}
					onPress={() => router.push("/food")}
				/>
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader
					title={t("measurements.title")}
					eyebrow={t("bodyEyebrow")}
				/>
				{visible.length === 0 ? (
					<EmptyState
						title={t("measurements.emptyTitle")}
						body={t("measurements.emptyBody")}
					/>
				) : null}

				{visible.map((metric) => (
					<Card key={metric.metricSlug} style={styles.metricCard}>
						<View style={styles.heading}>
							<View style={styles.grow}>
								<AppText variant="section">{metric.label}</AppText>
								{metric.latest ? (
									<>
										<AppText color="muted">
											{t("measurements.latest", {
												value: metric.latestFormatted ?? t("common:emDash"),
												when:
													metric.latest.source === "user"
														? observedLabel(metric.latest.observedAt)
														: metric.latest.localDay,
											})}
										</AppText>
										{metric.hasImportedData ? (
											<AppText variant="micro" color="subtle">
												{t("measurements.source", {
													name: sourceLabel(t, metric.latest.source),
												})}
											</AppText>
										) : null}
									</>
								) : (
									<AppText color="muted">
										{t("measurements.nothingLogged")}
									</AppText>
								)}
							</View>
							{metric.userEnterable ? (
								<ThemedSwitch
									accessibilityLabel={
										metric.tracked
											? t("measurements.stopTracking", { name: metric.label })
											: t("measurements.track", { name: metric.label })
									}
									value={metric.tracked}
									disabled={busySlug !== null}
									onValueChange={(enabled) =>
										void setTracked(metric.metricSlug, enabled)
									}
								/>
							) : null}
						</View>

						{metric.tracked && metric.editablePresentation ? (
							<View style={styles.entry}>
								<MeasurementField
									label={metric.label}
									unit={metric.editablePresentation.displayUnit}
									entry={entries[metric.metricSlug] ?? EMPTY_ENTRY}
									onChangeEntry={(entry) =>
										updateEntry(metric.metricSlug, entry)
									}
									placeholder={t("measurements.enterPlaceholder", {
										unit: metric.editablePresentation.displayUnit,
									})}
									error={entryErrors[metric.metricSlug]}
								/>
								<Button
									label={t("measurements.logMetric", { name: metric.label })}
									loading={busySlug === metric.metricSlug}
									disabled={busySlug !== null}
									onPress={() => {
										const presentation = metric.editablePresentation;
										if (presentation) {
											void recordMeasurement(metric.metricSlug, presentation);
										}
									}}
								/>
							</View>
						) : null}

						{metric.series.observedDayCount > 0 ? (
							<TrendChart series={metric.series} height={100} />
						) : null}

						{metric.activeGoal ? (
							<AppText variant="caption" color="brand">
								{goalLine(t, metric.activeGoal)}
							</AppText>
						) : null}

						<Button
							label={t("open", { name: metric.label })}
							variant="secondary"
							onPress={() =>
								router.push({
									pathname: "/body/[slug]",
									params: { slug: metric.metricSlug },
								})
							}
						/>
					</Card>
				))}
			</View>

			{untracked.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("measurements.more")}
						eyebrow={t("bodyEyebrow")}
					/>
					{untracked.map((metric) => (
						<Card key={metric.metricSlug} style={styles.heading}>
							<View style={styles.grow}>
								<AppText variant="label">{metric.label}</AppText>
								{metric.displayUnit ? (
									<AppText variant="caption" color="muted">
										{t("measurements.enterIn", { unit: metric.displayUnit })}
									</AppText>
								) : null}
							</View>
							<ThemedSwitch
								accessibilityLabel={t("measurements.track", {
									name: metric.label,
								})}
								value={false}
								disabled={busySlug !== null}
								onValueChange={(enabled) =>
									void setTracked(metric.metricSlug, enabled)
								}
							/>
						</Card>
					))}
				</View>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	metricCard: { gap: theme.spacing.md },
	entry: { gap: theme.spacing.sm },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	grow: { flex: 1, gap: theme.spacing.xs },
	summaryMetrics: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.md,
		marginTop: theme.spacing.sm,
	},
	summaryMetric: { minWidth: "40%", gap: theme.spacing.xs },
}));

export default LogScreen;
