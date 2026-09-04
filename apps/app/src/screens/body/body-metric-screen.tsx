import type { Observation } from "@bro/database-app";
import type { MeasurementEntry } from "@bro/domain";
import { isTapeSiteSlug } from "@bro/domain/metric-registry";
import { router, Stack } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type BodyMetricDetail,
	type BodyStore,
	createBodyStore,
	type MeasurementPresentation,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DateField } from "../../components/date-field";
import { EmptyState } from "../../components/empty-state";
import { HeaderIconButton } from "../../components/header-icon-button";
import { MeasurementField } from "../../components/measurement-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TrendChart } from "../../components/trend-chart";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	measurementInputOf,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet } from "../../theme/unistyles";
import { BodyBaselineGauge } from "./body-baseline-gauge";

type BodyMetricScreenProps = {
	metricSlug: string;
	store?: Pick<
		BodyStore,
		| "loadMetric"
		| "updateMeasurement"
		| "deleteMeasurement"
		| "createGoal"
		| "achieveGoal"
		| "abandonGoal"
	>;
};

function dateTimeLabel(observation: Observation): string {
	if (observation.source !== "user") return observation.localDay;
	return new Date(observation.observedAt).toLocaleString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function sourceLabel(t: TFunction<"body">, source: string): string {
	return healthPlatformLabel(source) ?? t("sourceYou");
}

function HistoryEditor({
	entry,
	presentation,
	inputLocale,
	busy,
	onSave,
	onDelete,
}: {
	entry: BodyMetricDetail["history"][number];
	presentation: MeasurementPresentation;
	inputLocale: string | undefined;
	busy: boolean;
	onSave: (canonicalValue: number) => void;
	onDelete: () => void;
}) {
	const { t } = useTranslation("body");
	const [value, setValue] = useState(() =>
		measurementInputOf(entry.observation.value, presentation, inputLocale),
	);
	const [error, setError] = useState<string | null>(null);

	function save() {
		const parsed = parseMeasurementInput(value, presentation, inputLocale);
		if (!parsed.ok) {
			setError(parsed.error);
			return;
		}
		setError(null);
		onSave(parsed.canonicalValue);
	}

	return (
		<Card style={styles.historyCard}>
			<AppText variant="caption" color="muted">
				{dateTimeLabel(entry.observation)}
			</AppText>
			<MeasurementField
				label={t("history.valueField")}
				unit={presentation.displayUnit}
				accessibilityLabel={t("history.editA11y", {
					name: presentation.label,
					id: entry.observation.id,
				})}
				entry={value}
				error={error}
				editable={!busy}
				onChangeEntry={setValue}
			/>
			<AppText variant="micro" color="subtle">
				{t("history.source", { source: entry.observation.source })}
			</AppText>
			<View style={styles.actions}>
				<Button
					label={t("history.save")}
					accessibilityLabel={t("history.saveA11y", {
						id: entry.observation.id,
					})}
					variant="secondary"
					disabled={busy}
					style={styles.actionButton}
					onPress={save}
				/>
				<Button
					label={t("history.delete")}
					accessibilityLabel={t("history.deleteA11y", {
						id: entry.observation.id,
					})}
					variant="text"
					tone="danger"
					disabled={busy}
					style={styles.actionButton}
					onPress={onDelete}
				/>
			</View>
		</Card>
	);
}

function ImportedHistoryRow({
	entry,
}: {
	entry: BodyMetricDetail["history"][number];
}) {
	const { t } = useTranslation("body");

	return (
		<Card style={styles.historyCard}>
			<AppText variant="section">{entry.formattedValue}</AppText>
			<AppText variant="caption" color="muted">
				{t("latestWithSource", {
					when: dateTimeLabel(entry.observation),
					source: sourceLabel(t, entry.observation.source),
				})}
			</AppText>
			{entry.selected ? (
				<AppText variant="micro" color="brand">
					{t("history.usedForDay")}
				</AppText>
			) : null}
		</Card>
	);
}

export function BodyMetricScreen({ metricSlug, store }: BodyMetricScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [target, setTarget] = useState<MeasurementEntry>(EMPTY_ENTRY);
	const [targetDate, setTargetDate] = useState("");
	const [targetError, setTargetError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const {
		data: detail,
		error,
		loading,
		setData: setDetail,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => body.loadMetric(metricSlug), [body, metricSlug]),
	);

	async function mutate(work: () => Promise<BodyMetricDetail | null>) {
		setBusy(true);
		setError(null);
		try {
			setDetail(await work());
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	async function updateGoal(id: string, action: "achieve" | "abandon") {
		setBusy(true);
		setError(null);
		try {
			if (action === "achieve") {
				await body.achieveGoal(id);
			} else {
				await body.abandonGoal(id);
			}
			setDetail(await body.loadMetric(metricSlug));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	async function saveGoal() {
		if (!detail?.editablePresentation || busy) return;
		const parsed = parseMeasurementInput(
			target,
			detail.editablePresentation,
			detail.inputLocale,
		);
		if (!parsed.ok) {
			setTargetError(parsed.error);
			return;
		}
		setTargetError(null);
		setBusy(true);
		setError(null);
		try {
			await body.createGoal(
				detail.metricSlug,
				parsed.canonicalValue,
				targetDate.trim() || null,
			);
			setTarget(EMPTY_ENTRY);
			setTargetDate("");
			setDetail(await body.loadMetric(metricSlug));
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("notFound")}
					body={error ?? t("notFoundBody")}
					actionLabel={t("backToBody")}
					onAction={() => router.replace("/body")}
				/>
			</Screen>
		);
	}

	const activeGoal = detail.goals.find((goal) => goal.status === "active");

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Stack.Screen
				options={{
					headerRight: isTapeSiteSlug(detail.metricSlug)
						? () => (
								<HeaderIconButton
									icon="measure"
									testID="measuring-guide-header-icon"
									label={t("measuring.link")}
									onPress={() =>
										router.push({
											pathname: "/body/measuring",
											params: { site: detail.metricSlug },
										})
									}
								/>
							)
						: undefined,
				}}
			/>
			<Card style={styles.summaryCard}>
				<BodyBaselineGauge
					metric={detail}
					locale={detail.inputLocale}
					valueVariant="metric"
				/>
			</Card>

			{detail.series.observedDayCount > 0 ? (
				<TrendChart
					series={detail.series}
					usualRange={detail.baseline.usualRange}
				/>
			) : null}

			{error ? <AppText color="danger">{error}</AppText> : null}

			{detail.editablePresentation ? (
				<View style={styles.section}>
					<SectionHeader title={t("goal.title")} />
					{activeGoal ? (
						<Card style={styles.goalCard}>
							<AppText variant="section">
								{t("goal.target", { value: activeGoal.targetFormatted })}
							</AppText>
							<AppText color="muted">
								{t("goal.summary", {
									start: activeGoal.startFormatted
										? t("goal.startValue", {
												value: activeGoal.startFormatted,
											})
										: t("goal.startValueUnknown"),
									current: activeGoal.currentFormatted
										? t("goal.currentValue", {
												value: activeGoal.currentFormatted,
											})
										: t("goal.currentValueUnknown"),
								})}
							</AppText>
							{activeGoal.goal.targetDate ? (
								<AppText variant="caption" color="subtle">
									{t("goal.targetDate", { date: activeGoal.goal.targetDate })}
								</AppText>
							) : null}
							<View style={styles.actions}>
								<Button
									label={t("goal.achieve")}
									variant="secondary"
									disabled={busy}
									style={styles.actionButton}
									onPress={() => void updateGoal(activeGoal.goal.id, "achieve")}
								/>
								<Button
									label={t("goal.abandon")}
									variant="text"
									disabled={busy}
									style={styles.actionButton}
									onPress={() => void updateGoal(activeGoal.goal.id, "abandon")}
								/>
							</View>
						</Card>
					) : detail.latest ? (
						<Card style={styles.goalCard}>
							<MeasurementField
								label={t("goal.targetField")}
								unit={detail.editablePresentation.displayUnit}
								entry={target}
								error={targetError}
								onChangeEntry={setTarget}
							/>
							<DateField
								label={t("goal.targetDateField")}
								value={targetDate}
								onChangeDate={setTargetDate}
								allowClear
							/>
							<Button
								label={t("goal.save")}
								loading={busy}
								onPress={() => void saveGoal()}
							/>
						</Card>
					) : (
						<AppText color="muted">{t("goal.needMeasurement")}</AppText>
					)}

					{detail.goals
						.filter((goal) => goal.status !== "active")
						.map((goal) => (
							<AppText key={goal.goal.id} variant="caption" color="muted">
								{t("goal.pastGoal", {
									status:
										goal.status === "achieved"
											? t("goal.statusAchieved")
											: t("goal.statusAbandoned"),
									value: goal.targetFormatted,
								})}
							</AppText>
						))}
				</View>
			) : (
				<AppText color="muted">{t("readOnly")}</AppText>
			)}

			<View style={styles.section}>
				<SectionHeader title={t("history.title")} />
				{detail.history.length === 0 ? (
					<AppText color="muted">{t("history.empty")}</AppText>
				) : null}
				{detail.history.map((entry) =>
					entry.editable && detail.editablePresentation ? (
						<HistoryEditor
							key={`${entry.observation.id}:${entry.observation.updatedAt}`}
							entry={entry}
							presentation={detail.editablePresentation}
							inputLocale={detail.inputLocale}
							busy={busy}
							onSave={(canonicalValue) =>
								void mutate(() =>
									body.updateMeasurement(entry.observation.id, canonicalValue),
								)
							}
							onDelete={() =>
								void mutate(() => body.deleteMeasurement(entry.observation.id))
							}
						/>
					) : (
						<ImportedHistoryRow
							key={`${entry.observation.id}:${entry.observation.updatedAt}`}
							entry={entry}
						/>
					),
				)}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	summaryCard: { gap: theme.spacing.md },
	section: { gap: theme.spacing.md },
	goalCard: { gap: theme.spacing.md },
	historyCard: { gap: theme.spacing.sm },
	actions: { flexDirection: "row", gap: theme.spacing.sm },
	actionButton: { flex: 1 },
}));
