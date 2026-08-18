import { type ParsedMeasurement, parseMeasurement } from "@bro/domain";
import {
	type FactorCategory,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import {
	type CheckInEntry,
	type CheckInMeasurement,
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../check-in/check-in-store";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { FormField } from "../components/form-field";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../habits/habits-store";
import { StyleSheet } from "../theme/unistyles";

type HomeScreenProps = {
	store?: Pick<CheckInStore, "loadToday" | "save">;
	habitsStore?: Pick<
		HabitsStore,
		"loadToday" | "toggleManual" | "completeChallengeDay"
	>;
};

const SCORES = [1, 2, 3, 4, 5] as const;
const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;
const CATEGORY_LABELS: Record<FactorCategory, string> = {
	body: "Body",
	lifestyle: "Lifestyle",
	mind: "Mind",
	social: "Social",
};

function parseMeasurementInput(
	input: string,
	measurement: CheckInMeasurement,
	locale: string | undefined,
): ParsedMeasurement {
	if (measurement.dimension === "mass") {
		return parseMeasurement(
			input,
			measurement.dimension,
			measurement.displayUnit,
			locale,
		);
	}
	if (measurement.dimension === "length") {
		return parseMeasurement(
			input,
			measurement.dimension,
			measurement.displayUnit,
			locale,
		);
	}
	return parseMeasurement(
		input,
		measurement.dimension,
		measurement.displayUnit,
		locale,
	);
}

function measurementPlaceholder(measurement: CheckInMeasurement): string {
	return measurement.displayUnit === "st"
		? "e.g. 12 st 4 lb"
		: `Enter ${measurement.displayUnit}`;
}

export function HomeScreen({ store, habitsStore }: HomeScreenProps) {
	const checkIns = useMemo(() => store ?? createCheckInStore(), [store]);
	const routines = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const [today, setToday] = useState<TodayCheckIn | null>(null);
	const [habitsToday, setHabitsToday] = useState<TodayHabitsSnapshot | null>(
		null,
	);
	const [routineBusy, setRoutineBusy] = useState<string | null>(null);
	const [routineError, setRoutineError] = useState<string | null>(null);
	const [finishedChallenge, setFinishedChallenge] = useState<string | null>(
		null,
	);
	const [mood, setMood] = useState<number | null>(null);
	const [energy, setEnergy] = useState<number | null>(null);
	const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [measurementInputs, setMeasurementInputs] = useState<
		Record<string, string>
	>({});
	const [measurementErrors, setMeasurementErrors] = useState<
		Record<string, string>
	>({});
	const [editing, setEditing] = useState<CheckInEntry | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const loaded = await checkIns.loadToday();
			setToday(loaded);
			setSelectedFactors(loaded.selectedFactorSlugs);
			setNote(loaded.note);
			setFormOpen(loaded.entries.length === 0);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [checkIns]);

	const loadRoutines = useCallback(async () => {
		setRoutineError(null);
		try {
			setHabitsToday(await routines.loadToday());
		} catch (caught) {
			setRoutineError(
				caught instanceof Error ? caught.message : String(caught),
			);
		}
	}, [routines]);

	useFocusEffect(
		useCallback(() => {
			void load();
			void loadRoutines();
		}, [load, loadRoutines]),
	);

	async function toggleHabit(habitId: string) {
		if (!habitsToday || routineBusy) return;
		setRoutineBusy(habitId);
		setRoutineError(null);
		try {
			await routines.toggleManual(habitId, habitsToday.localDay);
			await loadRoutines();
		} catch (caught) {
			setRoutineError(
				caught instanceof Error ? caught.message : String(caught),
			);
		} finally {
			setRoutineBusy(null);
		}
	}

	async function completeChallenge(enrolmentId: string, dayIndex: number) {
		if (!habitsToday || routineBusy) return;
		setRoutineBusy(enrolmentId);
		setRoutineError(null);
		try {
			const detail = await routines.completeChallengeDay(
				enrolmentId,
				dayIndex,
				habitsToday.localDay,
			);
			if (detail.isFinished) setFinishedChallenge(detail.title);
			await loadRoutines();
		} catch (caught) {
			setRoutineError(
				caught instanceof Error ? caught.message : String(caught),
			);
		} finally {
			setRoutineBusy(null);
		}
	}

	function toggleFactor(slug: string) {
		setSelectedFactors((current) =>
			current.includes(slug)
				? current.filter((selected) => selected !== slug)
				: [...current, slug],
		);
	}

	function startAnother() {
		setMood(null);
		setEnergy(null);
		setEditing(null);
		setError(null);
		setMeasurementInputs({});
		setMeasurementErrors({});
		setFormOpen(true);
	}

	function startEditing(entry: CheckInEntry) {
		setMood(entry.mood.value);
		setEnergy(entry.energy.value);
		setEditing(entry);
		setError(null);
		setMeasurementInputs({});
		setMeasurementErrors({});
		setFormOpen(true);
	}

	function updateMeasurementInput(slug: string, value: string) {
		setMeasurementInputs((current) => ({ ...current, [slug]: value }));
		setMeasurementErrors((current) => {
			if (!(slug in current)) return current;
			const next = { ...current };
			delete next[slug];
			return next;
		});
	}

	async function save() {
		if (!today || mood === null || energy === null || saving) {
			return;
		}
		const measurements: { metricSlug: string; value: number }[] = [];
		const fieldErrors: Record<string, string> = {};
		if (!editing) {
			for (const measurement of today.availableMeasurements) {
				const input = measurementInputs[measurement.metricSlug]?.trim() ?? "";
				if (!input) continue;
				const parsed = parseMeasurementInput(
					input,
					measurement,
					today.inputLocale,
				);
				if (!parsed.ok) {
					fieldErrors[measurement.metricSlug] = parsed.error;
				} else {
					measurements.push({
						metricSlug: measurement.metricSlug,
						value: parsed.canonicalValue,
					});
				}
			}
		}
		if (Object.keys(fieldErrors).length > 0) {
			setMeasurementErrors(fieldErrors);
			return;
		}

		setSaving(true);
		setError(null);
		try {
			const saved = await checkIns.save(
				{
					mood,
					energy,
					selectedFactorSlugs: selectedFactors,
					measurements,
					note,
				},
				editing,
			);
			setToday(saved);
			setSelectedFactors(saved.selectedFactorSlugs);
			setNote(saved.note);
			setMood(null);
			setEnergy(null);
			setEditing(null);
			setMeasurementInputs({});
			setMeasurementErrors({});
			setFormOpen(false);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}

	if (!today && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!today) {
		return (
			<Screen padded centered contentContainerStyle={styles.loading}>
				<AppText variant="section">Today could not be loaded</AppText>
				<AppText color="danger">{error}</AppText>
				<Button
					label="Try again"
					variant="secondary"
					onPress={() => void load()}
				/>
			</Screen>
		);
	}

	const groupedFactors = Object.entries(CATEGORY_LABELS).map(
		([category, label]) => ({
			category: category as FactorCategory,
			label,
			factors: today.availableFactors.filter(
				(factor) => factor.category === category,
			),
		}),
	);
	const selectedFactorLabels = today.selectedFactorSlugs.map((slug) => {
		const resolved = resolveMetric(slug);
		return resolved.kind === "known" ? resolved.metric.label : slug;
	});
	const checkInForm = formOpen ? (
		<View style={styles.form}>
			<SectionHeader title={editing ? "Edit check-in" : "Check in"} />

			<AppText variant="label" style={styles.prompt}>
				Mood
			</AppText>
			<View style={styles.scoreRow}>
				{SCORES.map((score, index) => {
					const selected = mood === score;
					return (
						<TouchableOpacity
							key={score}
							accessibilityRole="button"
							accessibilityLabel={`Mood ${score}`}
							accessibilityState={{ selected }}
							style={[styles.scoreButton, selected && styles.choiceSelected]}
							onPress={() => setMood(score)}
						>
							<AppText style={styles.face}>{MOOD_FACES[index]}</AppText>
							<AppText
								variant="micro"
								color="subtle"
								style={[selected && styles.choiceSelectedText]}
							>
								{score}
							</AppText>
						</TouchableOpacity>
					);
				})}
			</View>

			<AppText variant="label" style={styles.prompt}>
				Energy
			</AppText>
			<View style={styles.scoreRow}>
				{SCORES.map((score) => {
					const selected = energy === score;
					return (
						<TouchableOpacity
							key={score}
							accessibilityRole="button"
							accessibilityLabel={`Energy ${score}`}
							accessibilityState={{ selected }}
							style={[styles.scoreButton, selected && styles.choiceSelected]}
							onPress={() => setEnergy(score)}
						>
							<AppText
								variant="score"
								style={[selected && styles.choiceSelectedText]}
							>
								{score}
							</AppText>
						</TouchableOpacity>
					);
				})}
			</View>

			<AppText variant="label" style={styles.prompt}>
				What applied today?
			</AppText>
			{groupedFactors.map(({ category, label, factors }) =>
				factors.length > 0 ? (
					<View key={category} style={styles.factorGroup}>
						<AppText
							variant="caption"
							color="subtle"
							style={styles.categoryLabel}
						>
							{label}
						</AppText>
						<View style={styles.factorRow}>
							{factors.map((factor) => {
								const selected = selectedFactors.includes(factor.slug);
								return (
									<TouchableOpacity
										key={factor.slug}
										accessibilityRole="button"
										accessibilityLabel={factor.label}
										accessibilityState={{ selected }}
										style={[
											styles.factorButton,
											selected && styles.choiceSelected,
										]}
										onPress={() => toggleFactor(factor.slug)}
									>
										<AppText
											variant="caption"
											color="muted"
											style={[selected && styles.choiceSelectedText]}
										>
											{factor.label}
										</AppText>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>
				) : null,
			)}

			{!editing && today.availableMeasurements.length > 0 ? (
				<View style={styles.measurementSection}>
					<AppText variant="label">Measurements</AppText>
					<AppText variant="caption" color="subtle">
						Optional — leave a field blank to skip it today.
					</AppText>
					{today.availableMeasurements.map((measurement) => (
						<FormField
							key={measurement.metricSlug}
							label={`${measurement.label} (${measurement.displayUnit})`}
							value={measurementInputs[measurement.metricSlug] ?? ""}
							onChangeText={(value) =>
								updateMeasurementInput(measurement.metricSlug, value)
							}
							placeholder={measurementPlaceholder(measurement)}
							keyboardType={
								measurement.displayUnit === "st" ? "default" : "decimal-pad"
							}
							autoCapitalize="none"
							error={measurementErrors[measurement.metricSlug]}
						/>
					))}
				</View>
			) : null}

			<FormField
				label="Note (optional)"
				containerStyle={styles.noteField}
				value={note}
				onChangeText={setNote}
				placeholder="Anything worth remembering?"
				multiline
			/>

			{error ? <AppText color="danger">{error}</AppText> : null}
			<Button
				label={editing ? "Update check-in" : "Save check-in"}
				loading={saving}
				disabled={mood === null || energy === null || saving}
				onPress={() => void save()}
			/>
		</View>
	) : null;

	return (
		<Screen
			scroll
			padded
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<AppText variant="display" style={styles.pageTitle}>
				How are you?
			</AppText>
			{checkInForm}
			{finishedChallenge ? (
				<Card style={styles.routineCard}>
					<AppText variant="section">Challenge complete</AppText>
					<AppText color="muted">You finished {finishedChallenge}.</AppText>
					<Button
						label="Dismiss"
						variant="text"
						onPress={() => setFinishedChallenge(null)}
					/>
				</Card>
			) : null}
			{habitsToday &&
			habitsToday.habits.length === 0 &&
			habitsToday.challenges.length === 0 &&
			!habitsToday.hasHabits ? (
				<Card style={styles.routineCard}>
					<AppText variant="section">Build a routine</AppText>
					<AppText color="muted">
						Add a habit and Today will keep the next small action in view.
					</AppText>
					<Button
						label="Choose a habit"
						variant="secondary"
						onPress={() => router.push("/settings/habits")}
					/>
				</Card>
			) : null}
			{habitsToday && habitsToday.habits.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title="Habits"
						action={
							<TouchableOpacity onPress={() => router.push("/settings/habits")}>
								<AppText variant="label" color="brand">
									Manage
								</AppText>
							</TouchableOpacity>
						}
					/>
					{habitsToday.habits.map((item) => (
						<Card key={item.habit.id} style={styles.habitCard}>
							<View style={styles.routineCopy}>
								<AppText variant="score">{item.label}</AppText>
								{item.progressLabel ? (
									<AppText color="muted">{item.progressLabel}</AppText>
								) : null}
								<AppText variant="caption" color="subtle">
									{item.completed ? "Done today" : "Still to do"}
									{item.streak > 0 ? ` · ${item.streak} day streak` : ""}
								</AppText>
							</View>
							{item.habit.kind === "manual" ? (
								<Button
									label={item.completed ? "Undo" : "Mark done"}
									variant={item.completed ? "text" : "secondary"}
									loading={routineBusy === item.habit.id}
									onPress={() => void toggleHabit(item.habit.id)}
								/>
							) : null}
						</Card>
					))}
				</View>
			) : null}
			{habitsToday && habitsToday.challenges.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Challenges" />
					{habitsToday.challenges.map((challenge) => (
						<Card key={challenge.enrolmentId} style={styles.routineCard}>
							<AppText variant="caption" color="brand">
								DAY {challenge.dayIndex} OF {challenge.durationDays}
							</AppText>
							<AppText variant="section">{challenge.dayTitle}</AppText>
							<AppText color="muted">{challenge.action}</AppText>
							<Button
								label="Mark step done"
								loading={routineBusy === challenge.enrolmentId}
								onPress={() =>
									void completeChallenge(
										challenge.enrolmentId,
										challenge.dayIndex,
									)
								}
							/>
							<Button
								label="View challenge"
								variant="text"
								onPress={() =>
									router.push(`/challenges/${challenge.enrolmentId}`)
								}
							/>
						</Card>
					))}
				</View>
			) : null}
			{routineError ? <AppText color="danger">{routineError}</AppText> : null}
			{!formOpen && today.entries.length === 0 ? (
				<Card style={styles.stockCard}>
					<AppText variant="section">Take stock of the bigger picture</AppText>
					<AppText color="muted">
						Rate the areas of your life and choose where to focus next.
					</AppText>
					<Button
						label="Take stock"
						variant="secondary"
						onPress={() => router.push("/review/new")}
					/>
				</Card>
			) : null}
			{!formOpen && today.entries.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader
						title="Logged today"
						action={
							<AppText variant="caption" color="subtle">
								{today.entries.length} check-in
								{today.entries.length === 1 ? "" : "s"}
							</AppText>
						}
					/>
					{today.entries.map((entry) => (
						<Card key={entry.id} style={styles.entryCard}>
							<View>
								<AppText variant="label">
									Mood {entry.mood.value} · Energy {entry.energy.value}
								</AppText>
								<AppText variant="caption" color="subtle">
									{new Date(entry.observedAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</AppText>
							</View>
							<TouchableOpacity onPress={() => startEditing(entry)}>
								<AppText variant="label" color="brand">
									Edit
								</AppText>
							</TouchableOpacity>
						</Card>
					))}
					{selectedFactorLabels.length > 0 ? (
						<AppText variant="caption" color="muted">
							Factors: {selectedFactorLabels.join(", ")}
						</AppText>
					) : null}
					{today.loggedMeasurements.length > 0 ? (
						<AppText variant="caption" color="muted">
							Measurements:{" "}
							{today.loggedMeasurements
								.map(
									(measurement) =>
										`${measurement.label} ${measurement.formattedValue}`,
								)
								.join(", ")}
						</AppText>
					) : null}
					{today.note ? (
						<AppText variant="caption" color="muted">
							Note: {today.note}
						</AppText>
					) : null}
					{!formOpen ? (
						<Button
							label="Add another check-in"
							variant="secondary"
							onPress={startAnother}
						/>
					) : null}
				</View>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { paddingBottom: theme.spacing.xxl * 2 },
	pageTitle: { marginBottom: theme.spacing.xl },
	loading: {
		gap: theme.spacing.md,
	},
	stockCard: { gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
	routineCard: { gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
	habitCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	routineCopy: { flex: 1, gap: theme.spacing.xs },
	entryCard: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	form: {
		marginBottom: theme.spacing.xl,
		padding: theme.spacing.xl,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	prompt: {
		fontWeight: "600",
		marginTop: theme.spacing.lg,
		marginBottom: theme.spacing.sm,
	},
	scoreRow: { flexDirection: "row", gap: theme.spacing.sm },
	scoreButton: {
		flex: 1,
		minHeight: theme.control.scoreMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	choiceSelected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	choiceSelectedText: { color: theme.colors.onSelected },
	face: {
		fontSize: theme.typography.face.fontSize,
		lineHeight: theme.typography.face.lineHeight,
	},
	factorGroup: { marginBottom: theme.spacing.md },
	categoryLabel: { marginBottom: theme.spacing.xs },
	factorRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	factorButton: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
		paddingVertical: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
	},
	measurementSection: {
		marginTop: theme.spacing.lg,
		gap: theme.spacing.sm,
	},
	noteField: { marginTop: theme.spacing.lg, marginBottom: theme.spacing.lg },
}));
