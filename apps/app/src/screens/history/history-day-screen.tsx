import type { DayNote, Observation } from "@bro/database-app";
import { type Href, router } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { NoteRow } from "../../components/note-row";
import { ScoreRow } from "../../components/score-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { resolveMetric } from "../../content";
import { healthPlatformLabel } from "../../health/platform-label";
import {
	createHistoryStore,
	type HistoricalCheckIn,
	type HistoryDay,
	type HistoryStore,
} from "../../history/history-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type HistoryDayScreenProps = {
	localDay: string;
	store?: Pick<
		HistoryStore,
		"loadDay" | "updateCheckIn" | "deleteCheckIn" | "deleteObservation"
	>;
};

function CheckInEditor({
	checkIn,
	onSave,
	onDelete,
}: {
	checkIn: HistoricalCheckIn;
	onSave: (
		checkIn: HistoricalCheckIn,
		mood: number,
		optional: Readonly<Record<string, number>>,
	) => void;
	onDelete: (checkIn: HistoricalCheckIn) => void;
}) {
	const { t } = useTranslation(["history", "common", "checkIn"]);
	const [mood, setMood] = useState(checkIn.mood.value);
	const [optional, setOptional] = useState<Record<string, number>>(
		Object.fromEntries(
			checkIn.optionalScores.map((score) => [score.metricSlug, score.value]),
		),
	);

	return (
		<Card style={styles.card}>
			<AppText variant="caption" color="subtle">
				{t(`checkIn:slots.${checkIn.slot}.name`)}
			</AppText>
			<AppText variant="score">
				{new Date(checkIn.observedAt).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</AppText>
			<AppText variant="micro" color="subtle">
				{t("day.moodSource", { source: checkIn.mood.source })}
			</AppText>
			<AppText variant="label" color="muted">
				{t("day.mood")}
			</AppText>
			<ScoreRow
				accessibilityPrefix={t("day.mood")}
				selected={mood}
				onSelect={setMood}
				endLabels={{
					minimum: t("common:ratingEnds.veryBad"),
					maximum: t("common:ratingEnds.veryGood"),
				}}
			/>
			{checkIn.optionalScores.map((score) => {
				const resolved = resolveMetric(score.metricSlug);
				const label =
					resolved.kind === "known" ? resolved.metric.label : score.metricSlug;
				return (
					<View key={score.id} style={styles.scoreEditor}>
						<AppText variant="label" color="muted">
							{label}
						</AppText>
						<ScoreRow
							accessibilityPrefix={label}
							selected={optional[score.metricSlug] ?? score.value}
							onSelect={(value) =>
								setOptional((current) => ({
									...current,
									[score.metricSlug]: value,
								}))
							}
							endLabels={{
								minimum: t("common:ratingEnds.veryLow"),
								maximum: t("common:ratingEnds.veryGood"),
							}}
						/>
					</View>
				);
			})}
			<View style={styles.actions}>
				<Button
					label={t("day.saveCheckIn")}
					onPress={() => onSave(checkIn, mood, optional)}
				/>
				<Button
					label={t("day.deleteCheckIn")}
					variant="text"
					tone="danger"
					onPress={() => onDelete(checkIn)}
				/>
			</View>
		</Card>
	);
}

function DayNoteRow({
	note,
	position,
	count,
}: {
	note: DayNote;
	position: number;
	count: number;
}) {
	const { t } = useTranslation("notes");

	// Editing happens on the note's own screen, so a day stays a day's worth of
	// reading rather than a page of open editors.
	return (
		<NoteRow
			accessibilityLabel={t("actions.open", { position, count })}
			markdown={note.body}
			createdAt={note.createdAt}
			updatedAt={note.updatedAt}
			first={position === 1}
			onPress={() => router.push(`/notes/${note.id}` as Href)}
		/>
	);
}

function ObservationRow({
	observation,
	onDelete,
}: {
	observation: Observation;
	onDelete?: (observation: Observation) => void;
}) {
	const { t } = useTranslation("history");
	const resolved = resolveMetric(observation.metricSlug);
	const title =
		resolved.kind === "known" && resolved.metric.kind === "tag"
			? resolved.metric.label
			: t("day.labelledValue", {
					label:
						resolved.kind === "known"
							? resolved.metric.label
							: observation.metricSlug,
					value: observation.value,
				});

	return (
		<Card style={styles.observationRow}>
			<View style={styles.grow}>
				<AppText variant="score">{title}</AppText>
				<AppText variant="micro" color="subtle">
					{t("day.source", { source: observation.source })}
				</AppText>
			</View>
			{onDelete ? (
				<Button
					label={resolved.kind === "known" ? t("day.remove") : t("day.delete")}
					variant="text"
					tone="danger"
					onPress={() => onDelete(observation)}
				/>
			) : null}
		</Card>
	);
}

/** Unlike the other observation lists, an unrecognised source shows as-is. */
function sourceLabel(t: TFunction<"history">, source: string): string {
	return (
		healthPlatformLabel(source) ??
		(source === "user" ? t("day.sourceYou") : source)
	);
}

export function HistoryDayScreen({ localDay, store }: HistoryDayScreenProps) {
	const { t } = useTranslation("history");
	const history = useMemo(() => store ?? createHistoryStore(), [store]);
	const {
		data: day,
		error,
		loading,
		setData: setDay,
		setError,
	} = useFocusStoreLoad(
		useCallback(() => history.loadDay(localDay), [history, localDay]),
	);

	async function mutate(work: () => Promise<HistoryDay>) {
		setError(null);
		try {
			setDay(await work());
		} catch (caught) {
			setError(toMessage(caught));
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	return (
		<Screen
			scroll
			padded
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			{error ? <AppText color="danger">{error}</AppText> : null}

			{day ? (
				<>
					{day.habitCompletions.length > 0 ? (
						<SectionHeader title={t("day.habitsCompleted")} />
					) : null}
					{day.habitCompletions.map((completion) => (
						<Card key={completion.id} style={styles.card}>
							<AppText variant="score">{completion.label}</AppText>
						</Card>
					))}
					{day.challengeSteps.length > 0 ? (
						<SectionHeader title={t("day.challengeSteps")} />
					) : null}
					{day.challengeSteps.map((step) => (
						<Card key={step.id} style={styles.card}>
							<AppText variant="caption" color="brand">
								{t("day.challengeStep", {
									title: step.title,
									day: step.dayIndex,
								})}
							</AppText>
							<AppText variant="score">{step.dayTitle}</AppText>
						</Card>
					))}
					<SectionHeader title={t("day.checkIns")} />
					{day.checkIns.length === 0 ? (
						<AppText color="muted">{t("day.noCheckIns")}</AppText>
					) : null}
					{day.checkIns.map((checkIn) => (
						<CheckInEditor
							key={checkIn.id}
							checkIn={checkIn}
							onSave={(entry, mood, optional) =>
								void mutate(() => history.updateCheckIn(entry, mood, optional))
							}
							onDelete={(entry) =>
								void mutate(() => history.deleteCheckIn(entry))
							}
						/>
					))}
					{day.unpairedScored.length > 0 ? (
						<SectionHeader title={t("day.unpaired")} />
					) : null}
					{day.unpairedScored.map((observation) => (
						<ObservationRow
							key={observation.id}
							observation={observation}
							onDelete={(row) =>
								void mutate(() => history.deleteObservation(row))
							}
						/>
					))}

					{day.tags.length > 0 ? (
						<SectionHeader title={t("day.whatHappened")} />
					) : null}
					{day.tags.map((tag) => (
						<ObservationRow
							key={tag.id}
							observation={tag}
							onDelete={(row) =>
								void mutate(() => history.deleteObservation(row))
							}
						/>
					))}

					{day.assessments.length > 0 ? (
						<SectionHeader title={t("day.assessments")} />
					) : null}
					{day.assessments.map((assessment) => (
						<ObservationRow key={assessment.id} observation={assessment} />
					))}

					{day.measurements.length > 0 ? (
						<SectionHeader title={t("day.measurements")} />
					) : null}
					{day.measurements.map((measurement) => (
						<Card
							key={`${measurement.source}:${measurement.id}`}
							style={styles.observationRow}
						>
							<View style={styles.grow}>
								<AppText variant="score">
									{t("day.labelledValue", {
										label: measurement.label,
										value: measurement.formattedValue,
									})}
								</AppText>
								<AppText variant="micro" color="subtle">
									{measurement.selected
										? t("day.usedForDay", {
												source: t("day.source", {
													source: sourceLabel(t, measurement.source),
												}),
											})
										: t("day.source", {
												source: sourceLabel(t, measurement.source),
											})}
								</AppText>
							</View>
							{measurement.observation ? (
								<Button
									label={t("day.delete")}
									variant="text"
									tone="danger"
									onPress={() =>
										void mutate(() =>
											history.deleteObservation(
												measurement.observation as Observation,
											),
										)
									}
								/>
							) : null}
						</Card>
					))}

					{day.unknown.length > 0 ? (
						<SectionHeader title={t("day.other")} />
					) : null}
					{day.unknown.map((observation) => (
						<ObservationRow
							key={observation.id}
							observation={observation}
							onDelete={(row) =>
								void mutate(() => history.deleteObservation(row))
							}
						/>
					))}

					{day.notes.length > 0 ? (
						<SectionHeader title={t("day.notes")} />
					) : null}
					{day.notes.length > 0 ? (
						<View>
							{day.notes.map((note, index) => (
								<DayNoteRow
									key={note.id}
									note={note}
									position={index + 1}
									count={day.notes.length}
								/>
							))}
						</View>
					) : null}
				</>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.md },
	card: { gap: theme.spacing.sm },
	scoreEditor: { gap: theme.spacing.sm },
	actions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	observationRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	grow: { flex: 1 },
}));
