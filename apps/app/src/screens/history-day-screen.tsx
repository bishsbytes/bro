import type { DayNote, Observation } from "@bro/database-app";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { resolveMetric } from "../content/metric-registry";
import {
	createHistoryStore,
	type HistoricalCheckIn,
	type HistoryDay,
	type HistoryStore,
} from "../history/history-store";

const SCORES = [1, 2, 3, 4, 5] as const;

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
	onSave: (checkIn: HistoricalCheckIn, mood: number, energy: number) => void;
	onDelete: (checkIn: HistoricalCheckIn) => void;
}) {
	const [mood, setMood] = useState(checkIn.mood.value);
	const [energy, setEnergy] = useState(checkIn.energy.value);

	return (
		<View style={styles.card}>
			<Text style={styles.cardTitle}>
				{new Date(checkIn.observedAt).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</Text>
			<Text style={styles.source}>
				Mood source: {checkIn.mood.source} · Energy source:{" "}
				{checkIn.energy.source}
			</Text>
			<Text style={styles.label}>Mood</Text>
			<View style={styles.scoreRow}>
				{SCORES.map((score) => (
					<TouchableOpacity
						key={`mood-${score}`}
						accessibilityLabel={`Mood ${score}`}
						style={[
							styles.scoreButton,
							mood === score && styles.selected,
						]}
						onPress={() => setMood(score)}
					>
						<Text style={styles.scoreText}>{score}</Text>
					</TouchableOpacity>
				))}
			</View>
			<Text style={styles.label}>Energy</Text>
			<View style={styles.scoreRow}>
				{SCORES.map((score) => (
					<TouchableOpacity
						key={`energy-${score}`}
						accessibilityLabel={`Energy ${score}`}
						style={[
							styles.scoreButton,
							energy === score && styles.selected,
						]}
						onPress={() => setEnergy(score)}
					>
						<Text style={styles.scoreText}>{score}</Text>
					</TouchableOpacity>
				))}
			</View>
			<View style={styles.actions}>
				<TouchableOpacity
					style={styles.primaryButton}
					onPress={() => onSave(checkIn, mood, energy)}
				>
					<Text style={styles.primaryButtonText}>Save changes</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onDelete(checkIn)}>
					<Text style={styles.deleteText}>Delete check-in</Text>
				</TouchableOpacity>
			</View>
		</View>
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
		<View style={styles.card}>
			<TextInput
				accessibilityLabel={`Note ${note.id}`}
				style={styles.noteInput}
				multiline
				value={body}
				onChangeText={setBody}
			/>
			<View style={styles.actions}>
				<TouchableOpacity onPress={() => onSave(note, body)}>
					<Text style={styles.link}>Save note</Text>
				</TouchableOpacity>
				<TouchableOpacity onPress={() => onDelete(note)}>
					<Text style={styles.deleteText}>Delete note</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
}

function ObservationRow({
	observation,
	onDelete,
}: {
	observation: Observation;
	onDelete: (observation: Observation) => void;
}) {
	const resolved = resolveMetric(observation.metricSlug);
	const title =
		resolved.kind === "known"
			? resolved.metric.kind === "scored"
				? `${resolved.metric.label}: ${observation.value}`
				: resolved.metric.label
			: `${observation.metricSlug}: ${observation.value}`;

	return (
		<View style={styles.observationRow}>
			<View style={styles.grow}>
				<Text style={styles.cardTitle}>{title}</Text>
				<Text style={styles.source}>Source: {observation.source}</Text>
			</View>
			<TouchableOpacity onPress={() => onDelete(observation)}>
				<Text style={styles.deleteText}>
					{resolved.kind === "known" ? "Remove" : "Delete"}
				</Text>
			</TouchableOpacity>
		</View>
	);
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
			<View style={styles.centered}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<TouchableOpacity onPress={() => router.back()}>
				<Text style={styles.link}>Back to history</Text>
			</TouchableOpacity>
			<Text style={styles.title}>{localDay}</Text>
			{error ? <Text style={styles.error}>{error}</Text> : null}

			{day ? (
				<>
					<Text style={styles.sectionTitle}>Check-ins</Text>
					{day.checkIns.length === 0 ? (
						<Text style={styles.muted}>No scored check-ins.</Text>
					) : null}
					{day.checkIns.map((checkIn) => (
						<CheckInEditor
							key={checkIn.id}
							checkIn={checkIn}
							onSave={(entry, mood, energy) =>
								void mutate(() => history.updateCheckIn(entry, mood, energy))
							}
							onDelete={(entry) =>
								void mutate(() => history.deleteCheckIn(entry))
							}
						/>
					))}
					{day.unpairedScored.length > 0 ? (
						<Text style={styles.sectionTitle}>Unpaired observations</Text>
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

					{day.factors.length > 0 ? (
						<Text style={styles.sectionTitle}>Factors</Text>
					) : null}
					{day.factors.map((factor) => (
						<ObservationRow
							key={factor.id}
							observation={factor}
							onDelete={(row) =>
								void mutate(() => history.deleteObservation(row))
							}
						/>
					))}

					{day.unknown.length > 0 ? (
						<Text style={styles.sectionTitle}>Other observations</Text>
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
						<Text style={styles.sectionTitle}>Notes</Text>
					) : null}
					{day.notes.map((note) => (
						<NoteEditor
							key={note.id}
							note={note}
							onSave={(entry, body) =>
								void mutate(() => history.updateNote(entry, body))
							}
							onDelete={(entry) =>
								void mutate(() => history.deleteNote(entry))
							}
						/>
					))}
				</>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { flex: 1, backgroundColor: theme.colors.background },
	content: { padding: theme.spacing.xl, gap: theme.spacing.md },
	centered: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: theme.colors.background,
	},
	title: { ...theme.typography.title, color: theme.colors.text },
	sectionTitle: {
		...theme.typography.section,
		color: theme.colors.text,
		marginTop: theme.spacing.sm,
	},
	card: {
		padding: theme.spacing.lg,
		gap: theme.spacing.sm,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	cardTitle: { ...theme.typography.score, color: theme.colors.text },
	label: { ...theme.typography.label, color: theme.colors.textMuted },
	source: { ...theme.typography.micro, color: theme.colors.textSubtle },
	muted: { ...theme.typography.body, color: theme.colors.textMuted },
	scoreRow: { flexDirection: "row", gap: theme.spacing.sm },
	scoreButton: {
		flex: 1,
		minHeight: 42,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
	},
	selected: {
		backgroundColor: theme.colors.selected,
		borderColor: theme.colors.brand,
	},
	scoreText: { ...theme.typography.label, color: theme.colors.text },
	actions: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	primaryButton: {
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.sm,
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.brand,
	},
	primaryButtonText: {
		...theme.typography.label,
		color: theme.colors.onBrand,
	},
	link: { ...theme.typography.label, color: theme.colors.brand },
	deleteText: { ...theme.typography.label, color: theme.colors.danger },
	noteInput: {
		...theme.typography.body,
		minHeight: theme.control.noteMinHeight,
		padding: theme.spacing.md,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		color: theme.colors.text,
		textAlignVertical: "top",
	},
	observationRow: {
		flexDirection: "row",
		alignItems: "center",
		padding: theme.spacing.lg,
		gap: theme.spacing.md,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	grow: { flex: 1 },
	error: { ...theme.typography.body, color: theme.colors.danger },
}));
