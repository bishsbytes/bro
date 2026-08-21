import type { MeasurementEntry } from "@bro/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import {
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
import { LoadingIndicator } from "../../components/loading-indicator";
import { MeasurementField } from "../../components/measurement-field";
import { Screen } from "../../components/screen";
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

function sourceLabel(source: string): string {
	if (source === "healthkit") return "Apple Health";
	if (source === "health_connect") return "Health Connect";
	return "You";
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
	return (
		<ListRow
			title={title}
			value={`${entryCount} entr${entryCount === 1 ? "y" : "ies"}`}
			accessibilityLabel={`Open ${title}`}
			onPress={onPress}
		>
			<View style={styles.summaryMetrics}>
				{metrics.map((metric) => (
					<View key={metric.metric.slug} style={styles.summaryMetric}>
						<AppText variant="micro" color="subtle">
							{metric.metric.label.toUpperCase()}
						</AppText>
						<AppText variant="label">{metric.dayFormatted ?? "—"}</AppText>
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
	const body = useMemo(() => bodyStore ?? createBodyStore(), [bodyStore]);
	const drinks = useMemo(
		() => drinksStore ?? createDrinksStore(),
		[drinksStore],
	);
	const food = useMemo(() => foodStore ?? createFoodStore(), [foodStore]);
	const [snapshot, setSnapshot] = useState<LogSnapshot | null>(null);
	const [busySlug, setBusySlug] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [entries, setEntries] = useState<Record<string, MeasurementEntry>>({});
	const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});

	const load = useCallback(async () => {
		setError(null);
		try {
			const [bodyOverview, drinksToday, foodToday] = await Promise.all([
				body.loadOverview(),
				drinks.loadToday(),
				food.loadToday(),
			]);
			setSnapshot({
				body: bodyOverview,
				drinks: drinksToday,
				food: foodToday,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [body, drinks, food]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
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
			setError(caught instanceof Error ? caught.message : String(caught));
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
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusySlug(null);
		}
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Today's log could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const visible = snapshot.body.metrics.filter((metric) => metric.visible);
	const untracked = snapshot.body.metrics.filter((metric) => !metric.visible);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Record what happened today and keep the measurements that matter in
				view.
			</AppText>

			<View style={styles.section}>
				<SectionHeader title="Drinks" eyebrow="TODAY" />
				<DailySummary
					title="Drinks"
					entryCount={snapshot.drinks.entries.length}
					metrics={snapshot.drinks.metrics}
					onPress={() => router.push("/drinks")}
				/>
			</View>

			<View style={styles.section}>
				<SectionHeader title="Food" eyebrow="TODAY" />
				<DailySummary
					title="Food"
					entryCount={snapshot.food.entries.length}
					metrics={snapshot.food.metrics}
					onPress={() => router.push("/food")}
				/>
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title="Measurements" eyebrow="YOUR BODY" />
				{visible.length === 0 ? (
					<EmptyState
						title="No body metrics tracked"
						body="Turn on a measurement below to log it here and see its trend."
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
											Latest {metric.latestFormatted} ·{" "}
											{metric.latest.source === "user"
												? observedLabel(metric.latest.observedAt)
												: metric.latest.localDay}
										</AppText>
										{metric.hasImportedData ? (
											<AppText variant="micro" color="subtle">
												Source: {sourceLabel(metric.latest.source)}
											</AppText>
										) : null}
									</>
								) : (
									<AppText color="muted">Nothing logged yet</AppText>
								)}
							</View>
							{metric.userEnterable ? (
								<ThemedSwitch
									accessibilityLabel={`${metric.tracked ? "Stop tracking" : "Track"} ${metric.label}`}
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
									placeholder={`Enter ${metric.editablePresentation.displayUnit}`}
									error={entryErrors[metric.metricSlug]}
								/>
								<Button
									label={`Log ${metric.label}`}
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
								Target {metric.activeGoal.targetFormatted}
								{metric.activeGoal.targetReached
									? " · Target reached — mark it achieved?"
									: metric.activeGoal.progressPercent === null
										? ""
										: ` · ${metric.activeGoal.progressPercent}% of the way`}
							</AppText>
						) : null}

						<Button
							label={`Open ${metric.label}`}
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
					<SectionHeader title="More measurements" eyebrow="YOUR BODY" />
					{untracked.map((metric) => (
						<Card key={metric.metricSlug} style={styles.heading}>
							<View style={styles.grow}>
								<AppText variant="label">{metric.label}</AppText>
								<AppText variant="caption" color="muted">
									Enter in {metric.displayUnit}
								</AppText>
							</View>
							<ThemedSwitch
								accessibilityLabel={`Track ${metric.label}`}
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
