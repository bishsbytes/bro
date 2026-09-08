import type { Observation } from "@bro/database-app";
import { localDayOf, type MeasurementEntry } from "@bro/domain";
import { isTapeSiteSlug } from "@bro/domain/metric-registry";
import {
	buildTrendSeries,
	type TrendPeriod,
	type TrendPoint,
} from "@bro/logic";
import { router, Stack } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
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
import { FormSheet } from "../../components/form-sheet";
import { HeaderIconButton } from "../../components/header-icon-button";
import { ListRow } from "../../components/list-row";
import { MeasurementField } from "../../components/measurement-field";
import { ModalSheet } from "../../components/modal-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { SegmentedControl } from "../../components/segmented-control";
import { formatReadingDay, SourceStamp } from "../../components/source-stamp";
import { TextAction } from "../../components/text-action";
import { TrendChart } from "../../components/trend-chart";
import { resolveMetric } from "../../content";
import { healthPlatformLabel } from "../../health/platform-label";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	EMPTY_ENTRY,
	measurementInputOf,
	parseMeasurementInput,
} from "../../measurements/measurement-entry";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { BodyBaselineGauge, BodyRecentRange } from "./body-baseline-gauge";
import { BodyReadingSheet } from "./body-reading-sheet";

type BodyMetricScreenProps = {
	metricSlug: string;
	store?: Pick<
		BodyStore,
		| "loadMetric"
		| "recordMeasurements"
		| "setTracked"
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
	return (
		healthPlatformLabel(source) ??
		(source === "user" ? t("reading.manual") : source)
	);
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
			<AppText variant="footnote" color="subtle">
				{t("history.source", {
					source: sourceLabel(t, entry.observation.source),
				})}
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

export function BodyMetricScreen({ metricSlug, store }: BodyMetricScreenProps) {
	const { t } = useTranslation(["body", "common"]);
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const { theme } = useUnistyles();
	const scrollRef = useRef<ScrollView>(null);
	const [historyY, setHistoryY] = useState(0);
	const [managingHeading, setManagingHeading] = useState(false);
	const [adding, setAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingHeading, setEditingHeading] = useState(false);
	const [period, setPeriod] = useState<TrendPeriod | 365>(30);
	const [target, setTarget] = useState<MeasurementEntry>(EMPTY_ENTRY);
	const [targetDate, setTargetDate] = useState("");
	const [targetError, setTargetError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [explored, setExplored] = useState<{
		detail: BodyMetricDetail;
		point: TrendPoint;
		formatted: string;
	} | null>(null);
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
			setEditingId(null);
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
			setManagingHeading(false);
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
			setEditingHeading(false);
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
	const resolved = resolveMetric(detail.metricSlug);
	const series =
		resolved.kind === "known"
			? buildTrendSeries(
					detail.history
						.filter((entry) => entry.selected)
						.map((entry) => entry.observation),
					resolved.metric,
					localDayOf(new Date()),
					period,
					{
						usualRange: detail.baseline.usualRange,
					},
				)
			: detail.series;
	const editingEntry = detail.history.find(
		(entry) => entry.observation.id === editingId,
	);

	return (
		<Screen contentContainerStyle={{ flex: 1, minHeight: 0 }}>
			<ScrollView
				ref={scrollRef}
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Stack.Screen
					options={{
						headerTitleAlign: "center",
						headerTitleStyle: {
							fontFamily: theme.fonts.sans,
							fontSize: 12,
							fontWeight: "500",
						},
						headerTitle: () => (
							<AppText variant="eyebrow">{t("measurementTitle")}</AppText>
						),
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
				<View style={styles.summaryCard}>
					<AppText variant="title">{detail.label}</AppText>
					<BodyBaselineGauge
						metric={detail}
						showLabel={false}
						explored={explored?.detail === detail ? explored : null}
						locale={detail.inputLocale}
						valueVariant="hero"
					/>
				</View>
				<SegmentedControl
					label={t("period.title")}
					options={[
						{ value: 7, label: t("period.week") },
						{ value: 30, label: t("period.month") },
						{ value: 365, label: t("period.year") },
					]}
					value={period}
					onChange={(value) => {
						setPeriod(value as TrendPeriod | 365);
						setExplored(null);
					}}
				/>

				<View>
					{series.observedDayCount > 0 ? (
						<TrendChart
							compact
							height={156}
							showReadingsAction={false}
							key={`${detail.metricSlug}:${period}`}
							onSelect={(point, formatted) =>
								setExplored(point ? { detail, point, formatted } : null)
							}
							series={series}
							label={detail.label}
							displayUnit={detail.displayUnit}
							usualRange={detail.baseline.usualRange}
						/>
					) : (
						<AppText variant="caption" color="muted">
							{t("period.empty")}
						</AppText>
					)}

					<BodyRecentRange metric={detail} />
					<TextAction
						label={t("common:terrain.showReadings")}
						chevron
						onPress={() =>
							scrollRef.current?.scrollTo({ y: historyY, animated: false })
						}
					/>
				</View>

				{error ? <AppText color="danger">{error}</AppText> : null}

				{detail.editablePresentation ? (
					<View style={styles.section}>
						<SectionHeader compact title={t("goal.title")} />
						{activeGoal ? (
							<>
								<ListRow
									title={t("goal.reach", { value: activeGoal.targetFormatted })}
									detail={
										activeGoal.goal.targetDate
											? t("goal.targetDate", {
													date: formatReadingDay(
														activeGoal.goal.targetDate,
														detail.inputLocale,
													),
												})
											: undefined
									}
									onPress={() => setManagingHeading(true)}
									style={styles.headingSummary}
								/>
								<TextAction
									label={t("goal.view")}
									onPress={() => setManagingHeading(true)}
								/>
							</>
						) : detail.latest && !editingHeading ? (
							<Button
								label={t("goal.add")}
								variant="secondary"
								onPress={() => setEditingHeading(true)}
							/>
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

				<View
					style={styles.section}
					onLayout={(event) => setHistoryY(event.nativeEvent.layout.y)}
				>
					<SectionHeader compact title={t("history.title")} />
					{detail.history.length === 0 ? (
						<AppText color="muted">{t("history.empty")}</AppText>
					) : null}
					{detail.history.map((entry) => (
						<ListRow
							key={`${entry.observation.id}:${entry.observation.updatedAt}`}
							layout="inline"
							title={formatReadingDay(
								entry.observation.localDay,
								detail.inputLocale,
							)}
							value={entry.formattedValue}
							disabled={busy}
							accessibilityRole="button"
							accessibilityLabel={
								entry.editable
									? t("history.editA11y", {
											name: detail.label,
											id: entry.observation.id,
										})
									: `${entry.formattedValue}. ${dateTimeLabel(entry.observation)}. ${sourceLabel(t, entry.observation.source)}`
							}
							onPress={() => setEditingId(entry.observation.id)}
							style={styles.historyRow}
						/>
					))}
				</View>
			</ScrollView>
			{detail.editablePresentation ? (
				<View style={styles.footer}>
					<Button
						label={t("log.addReading")}
						disabled={busy}
						onPress={() => {
							setError(null);
							setAdding(true);
						}}
					/>
				</View>
			) : null}
			{activeGoal ? (
				<ModalSheet
					visible={managingHeading}
					onClose={() => setManagingHeading(false)}
					closeAccessibilityLabel={t("common:actions.close")}
				>
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
				</ModalSheet>
			) : null}
			{adding ? (
				<BodyReadingSheet
					metric={detail}
					locale={detail.inputLocale}
					busy={busy}
					error={error}
					onClose={() => setAdding(false)}
					onSave={(draft) => {
						if (busy) return;
						setBusy(true);
						setError(null);
						void (async () => {
							if (!detail.tracked) await body.setTracked(metricSlug, true);
							await body.recordMeasurements([draft]);
						})()
							.then(async () => {
								setAdding(false);
								setDetail(await body.loadMetric(metricSlug));
							})
							.catch((caught) => setError(toMessage(caught)))
							.finally(() => setBusy(false));
					}}
				/>
			) : null}
			{editingEntry ? (
				<FormSheet
					visible
					title={t("history.valueField")}
					busy={busy}
					onClose={() => setEditingId(null)}
					footer={
						<Button
							label={t("common:datePicker.cancel")}
							variant="secondary"
							disabled={busy}
							onPress={() => setEditingId(null)}
						/>
					}
				>
					{editingEntry.editable && detail.editablePresentation ? (
						<HistoryEditor
							key={`${editingEntry.observation.id}:${editingEntry.observation.updatedAt}`}
							entry={editingEntry}
							presentation={detail.editablePresentation}
							inputLocale={detail.inputLocale}
							busy={busy}
							onSave={(value) =>
								void mutate(() =>
									body.updateMeasurement(editingEntry.observation.id, value),
								)
							}
							onDelete={() =>
								void mutate(() =>
									body.deleteMeasurement(editingEntry.observation.id),
								)
							}
						/>
					) : (
						<View style={styles.section}>
							<AppText variant="title">{detail.label}</AppText>
							<AppText variant="monoReadout">
								{editingEntry.formattedValue}
							</AppText>
							<SourceStamp
								source={editingEntry.observation.source}
								observedAt={editingEntry.observation.observedAt}
								localDay={editingEntry.observation.localDay}
								locale={detail.inputLocale}
							/>
							<AppText color="muted">{t("readOnly")}</AppText>
						</View>
					)}
					{error ? <AppText color="danger">{error}</AppText> : null}
				</FormSheet>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	scroll: { flex: 1 },
	content: {
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.sm,
		paddingBottom: theme.spacing.lg,
		gap: theme.spacing.md,
	},
	footer: {
		paddingHorizontal: theme.spacing.gutter,
		paddingVertical: theme.spacing.sm,
		flexShrink: 0,
	},
	historyRow: {
		backgroundColor: "transparent",
		borderRadius: 0,
		paddingHorizontal: 0,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	summaryCard: { gap: theme.spacing.xs },
	section: { gap: theme.spacing.sm },
	headingSummary: {
		paddingVertical: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.line,
		backgroundColor: "transparent",
	},
	goalCard: { gap: theme.spacing.md },
	historyCard: { gap: theme.spacing.sm },
	actions: { flexDirection: "row", gap: theme.spacing.sm },
	actionButton: { flex: 1 },
}));
