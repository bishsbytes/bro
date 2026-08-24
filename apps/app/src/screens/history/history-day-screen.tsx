import type { DayNote, Observation } from "@bro/database-app";
import { resolveMetric } from "@bro/domain/metric-registry";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { ScoreRow } from "../../components/score-row";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createHistoryStore,
	type HistoricalCheckIn,
	type HistoryDay,
	type HistoryStore,
} from "../../history/history-store";
import { StyleSheet } from "../../theme/unistyles";

type HistoryDayScreenProps = {
	localDay: string;
	store?: Pick<
		HistoryStore,
		| "loadDay"
		| "updateCheckIn"
		| "deleteCheckIn"
		| "deleteObservation"
		| "updateNote"
		| "deleteNote"
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
		energy: number,
		additional: Readonly<Record<string, number>>,
	) => void;
	onDelete: (checkIn: HistoricalCheckIn) => void;
}) {
	const [mood, setMood] = useState(checkIn.mood.value);
	const [energy, setEnergy] = useState(checkIn.energy.value);
	const [additional, setAdditional] = useState<Record<string, number>>(
		Object.fromEntries(
			checkIn.optionalScores.map((score) => [score.metricSlug, score.value]),
		),
	);

	return (
		<Card style={styles.card}>
			<AppText variant="score">
				{new Date(checkIn.observedAt).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</AppText>
			<AppText variant="micro" color="subtle">
				Mood source: {checkIn.mood.source} · Energy source:{" "}
				{checkIn.energy.source}
			</AppText>
			<AppText variant="label" color="muted">
				Mood
			</AppText>
			<ScoreRow accessibilityPrefix="Mood" selected={mood} onSelect={setMood} />
			<AppText variant="label" color="muted">
				Energy
			</AppText>
			<ScoreRow
				accessibilityPrefix="Energy"
				selected={energy}
				onSelect={setEnergy}
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
							selected={additional[score.metricSlug] ?? score.value}
							onSelect={(value) =>
								setAdditional((current) => ({
									...current,
									[score.metricSlug]: value,
								}))
							}
						/>
					</View>
				);
			})}
			<View style={styles.actions}>
				<Button
					label="Save changes"
					onPress={() => onSave(checkIn, mood, energy, additional)}
				/>
				<Button
					label="Delete check-in"
					variant="text"
					tone="danger"
					onPress={() => onDelete(checkIn)}
				/>
			</View>
		</Card>
	);
}

function NoteEditor({
	note,
	onSave,
	onDelete,
}: {
	note: DayNote;
	onSave: (note: DayNote, body: string) => void;
	onDelete: (note: DayNote) => void;
}) {
	const [body, setBody] = useState(note.body);
	return (
		<Card style={styles.card}>
			<FormField
				label="Note"
				showLabel={false}
				accessibilityLabel={`Note ${note.id}`}
				multiline
				value={body}
				onChangeText={setBody}
			/>
			<View style={styles.actions}>
				<Button
					label="Save note"
					variant="text"
					onPress={() => onSave(note, body)}
				/>
				<Button
					label="Delete note"
					variant="text"
					tone="danger"
					onPress={() => onDelete(note)}
				/>
			</View>
		</Card>
	);
}

function ObservationRow({
	observation,
	onDelete,
}: {
	observation: Observation;
	onDelete?: (observation: Observation) => void;
}) {
	const resolved = resolveMetric(observation.metricSlug);
	const title =
		resolved.kind === "known"
			? resolved.metric.kind === "tag"
				? resolved.metric.label
				: `${resolved.metric.label}: ${observation.value}`
			: `${observation.metricSlug}: ${observation.value}`;

	return (
		<Card style={styles.observationRow}>
			<View style={styles.grow}>
				<AppText variant="score">{title}</AppText>
				<AppText variant="micro" color="subtle">
					Source: {observation.source}
				</AppText>
			</View>
			{onDelete ? (
				<Button
					label={resolved.kind === "known" ? "Remove" : "Delete"}
					variant="text"
					tone="danger"
					onPress={() => onDelete(observation)}
				/>
			) : null}
		</Card>
	);
}

function sourceLabel(source: string): string {
	if (source === "healthkit") return "Apple Health";
	if (source === "health_connect") return "Health Connect";
	return source === "user" ? "You" : source;
}

export function HistoryDayScreen({ localDay, store }: HistoryDayScreenProps) {
	const history = useMemo(() => store ?? createHistoryStore(), [store]);
	const [day, setDay] = useState<HistoryDay | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void history
			.loadDay(localDay)
			.then(setDay)
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : String(caught)),
			);
	}, [history, localDay]);

	async function mutate(work: () => Promise<HistoryDay>) {
		setError(null);
		try {
			setDay(await work());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}

	if (!day && !error) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
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
						<SectionHeader title="Habits completed" />
					) : null}
					{day.habitCompletions.map((completion) => (
						<Card key={completion.id} style={styles.card}>
							<AppText variant="score">{completion.label}</AppText>
						</Card>
					))}
					{day.challengeSteps.length > 0 ? (
						<SectionHeader title="Challenge steps" />
					) : null}
					{day.challengeSteps.map((step) => (
						<Card key={step.id} style={styles.card}>
							<AppText variant="caption" color="brand">
								{step.title} · Day {step.dayIndex}
							</AppText>
							<AppText variant="score">{step.dayTitle}</AppText>
						</Card>
					))}
					<SectionHeader title="Check-ins" />
					{day.checkIns.length === 0 ? (
						<AppText color="muted">No scored check-ins.</AppText>
					) : null}
					{day.checkIns.map((checkIn) => (
						<CheckInEditor
							key={checkIn.id}
							checkIn={checkIn}
							onSave={(entry, mood, energy, additional) =>
								void mutate(() =>
									history.updateCheckIn(entry, mood, energy, additional),
								)
							}
							onDelete={(entry) =>
								void mutate(() => history.deleteCheckIn(entry))
							}
						/>
					))}
					{day.unpairedScored.length > 0 ? (
						<SectionHeader title="Unpaired observations" />
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

					{day.tags.length > 0 ? <SectionHeader title="What happened" /> : null}
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
						<SectionHeader title="Assessment scores" />
					) : null}
					{day.assessments.map((assessment) => (
						<ObservationRow key={assessment.id} observation={assessment} />
					))}

					{day.measurements.length > 0 ? (
						<SectionHeader title="Measurements" />
					) : null}
					{day.measurements.map((measurement) => (
						<Card
							key={`${measurement.source}:${measurement.id}`}
							style={styles.observationRow}
						>
							<View style={styles.grow}>
								<AppText variant="score">
									{measurement.label}: {measurement.formattedValue}
								</AppText>
								<AppText variant="micro" color="subtle">
									Source: {sourceLabel(measurement.source)}
									{measurement.selected ? " · Used for daily value" : ""}
								</AppText>
							</View>
							{measurement.observation ? (
								<Button
									label="Delete"
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
						<SectionHeader title="Other observations" />
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

					{day.notes.length > 0 ? <SectionHeader title="Notes" /> : null}
					{day.notes.map((note) => (
						<NoteEditor
							key={note.id}
							note={note}
							onSave={(entry, body) =>
								void mutate(() => history.updateNote(entry, body))
							}
							onDelete={(entry) => void mutate(() => history.deleteNote(entry))}
						/>
					))}
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
