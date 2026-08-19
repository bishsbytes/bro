import type { Observation } from "@bro/database-app";
import {
	type MeasurementEntry,
	measurementEntryOf,
	type ParsedMeasurement,
	parseMeasurementEntry,
} from "@bro/domain";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
	type BodyMetricDetail,
	type BodyStore,
	createBodyStore,
	type MeasurementPresentation,
} from "../../body/body-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { MeasurementField } from "../../components/measurement-field";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TrendChart } from "../../components/trend-chart";
import { StyleSheet } from "../../theme/unistyles";

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

const EMPTY_ENTRY: MeasurementEntry = { major: "", minor: "" };

function parsePresentedMeasurement(
	entry: MeasurementEntry,
	presentation: MeasurementPresentation,
	locale: string | undefined,
): ParsedMeasurement {
	if (presentation.dimension === "mass") {
		return parseMeasurementEntry(
			entry,
			presentation.dimension,
			presentation.displayUnit,
			locale,
		);
	}
	if (presentation.dimension === "length") {
		return parseMeasurementEntry(
			entry,
			presentation.dimension,
			presentation.displayUnit,
			locale,
		);
	}
	return parseMeasurementEntry(
		entry,
		presentation.dimension,
		presentation.displayUnit,
		locale,
	);
}

function presentedEntryOf(
	canonicalValue: number,
	presentation: MeasurementPresentation,
): MeasurementEntry {
	if (presentation.dimension === "mass") {
		return measurementEntryOf(
			canonicalValue,
			presentation.dimension,
			presentation.displayUnit,
		);
	}
	if (presentation.dimension === "length") {
		return measurementEntryOf(
			canonicalValue,
			presentation.dimension,
			presentation.displayUnit,
		);
	}
	return measurementEntryOf(
		canonicalValue,
		presentation.dimension,
		presentation.displayUnit,
	);
}

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

function sourceLabel(source: string): string {
	if (source === "healthkit") return "Apple Health";
	if (source === "health_connect") return "Health Connect";
	return "You";
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
	const [value, setValue] = useState(() =>
		presentedEntryOf(entry.observation.value, presentation),
	);
	const [error, setError] = useState<string | null>(null);

	function save() {
		const parsed = parsePresentedMeasurement(value, presentation, inputLocale);
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
				label="Value"
				unit={presentation.displayUnit}
				accessibilityLabel={`Edit ${presentation.label} ${entry.observation.id}`}
				entry={value}
				error={error}
				editable={!busy}
				onChangeEntry={setValue}
			/>
			<AppText variant="micro" color="subtle">
				Source: {entry.observation.source}
			</AppText>
			<View style={styles.actions}>
				<Button
					label="Save measurement"
					accessibilityLabel={`Save measurement ${entry.observation.id}`}
					variant="secondary"
					disabled={busy}
					style={styles.actionButton}
					onPress={save}
				/>
				<Button
					label="Delete measurement"
					accessibilityLabel={`Delete measurement ${entry.observation.id}`}
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
	return (
		<Card style={styles.historyCard}>
			<AppText variant="section">{entry.formattedValue}</AppText>
			<AppText variant="caption" color="muted">
				{dateTimeLabel(entry.observation)} · Source:{" "}
				{sourceLabel(entry.observation.source)}
			</AppText>
			{entry.selected ? (
				<AppText variant="micro" color="brand">
					Used for this day's value
				</AppText>
			) : null}
		</Card>
	);
}

export function BodyMetricScreen({ metricSlug, store }: BodyMetricScreenProps) {
	const body = useMemo(() => store ?? createBodyStore(), [store]);
	const [detail, setDetail] = useState<BodyMetricDetail | null | undefined>(
		undefined,
	);
	const [target, setTarget] = useState<MeasurementEntry>(EMPTY_ENTRY);
	const [targetDate, setTargetDate] = useState("");
	const [targetError, setTargetError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			setDetail(await body.loadMetric(metricSlug));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [body, metricSlug]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(work: () => Promise<BodyMetricDetail | null>) {
		setBusy(true);
		setError(null);
		try {
			setDetail(await work());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
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
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	async function saveGoal() {
		if (!detail?.editablePresentation || busy) return;
		const parsed = parsePresentedMeasurement(
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
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	if (detail === undefined && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!detail) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Measurement not found"
					body={error ?? "This measurement is not available."}
					actionLabel="Back to Body"
					onAction={() => router.replace("/body")}
				/>
			</Screen>
		);
	}

	const activeGoal = detail.goals.find((goal) => goal.status === "active");

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.summaryCard}>
				<SectionHeader title={detail.label} eyebrow="LATEST" />
				<AppText variant="display">{detail.latestFormatted ?? "—"}</AppText>
				<AppText color="muted">
					{detail.latest
						? detail.hasImportedData
							? `${dateTimeLabel(detail.latest)} · Source: ${sourceLabel(detail.latest.source)}`
							: dateTimeLabel(detail.latest)
						: detail.userEnterable
							? "Log this measurement from your daily check-in."
							: "No imported measurements yet."}
				</AppText>
				{detail.series.observedDayCount > 0 ? (
					<TrendChart series={detail.series} />
				) : null}
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{detail.editablePresentation ? (
				<View style={styles.section}>
					<SectionHeader title="Goal" />
					{activeGoal ? (
						<Card style={styles.goalCard}>
							<AppText variant="section">
								Target {activeGoal.targetFormatted}
							</AppText>
							<AppText color="muted">
								{activeGoal.startFormatted
									? `Started at ${activeGoal.startFormatted}`
									: "No starting measurement"}
								{" · "}
								{activeGoal.currentFormatted
									? `Latest ${activeGoal.currentFormatted}`
									: "No current measurement"}
							</AppText>
							{activeGoal.goal.targetDate ? (
								<AppText variant="caption" color="subtle">
									Target date {activeGoal.goal.targetDate}
								</AppText>
							) : null}
							{activeGoal.progressPercent !== null ? (
								<AppText variant="caption" color="brand">
									{activeGoal.progressPercent}% of the way
								</AppText>
							) : null}
							<View style={styles.actions}>
								<Button
									label="Mark goal achieved"
									variant="secondary"
									disabled={busy}
									style={styles.actionButton}
									onPress={() => void updateGoal(activeGoal.goal.id, "achieve")}
								/>
								<Button
									label="Stop goal"
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
								label="Target"
								unit={detail.editablePresentation.displayUnit}
								entry={target}
								error={targetError}
								onChangeEntry={setTarget}
							/>
							<FormField
								label="Target date (optional)"
								value={targetDate}
								placeholder="YYYY-MM-DD"
								autoCapitalize="none"
								onChangeText={setTargetDate}
							/>
							<Button
								label="Save goal"
								loading={busy}
								onPress={() => void saveGoal()}
							/>
						</Card>
					) : (
						<AppText color="muted">
							Log a measurement before setting a goal.
						</AppText>
					)}

					{detail.goals
						.filter((goal) => goal.status !== "active")
						.map((goal) => (
							<AppText key={goal.goal.id} variant="caption" color="muted">
								{goal.status === "achieved" ? "Achieved" : "Stopped"}: target{" "}
								{goal.targetFormatted}
							</AppText>
						))}
				</View>
			) : (
				<AppText color="muted">
					Imported measurements are read-only in bro. Manage access in your
					health platform settings.
				</AppText>
			)}

			<View style={styles.section}>
				<SectionHeader title="History" />
				{detail.history.length === 0 ? (
					<AppText color="muted">No measurements logged yet.</AppText>
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
