import {
	localDayOf,
	type MeasurementEntry,
	type ParsedMeasurement,
	parseMeasurementEntry,
	shiftLocalDay,
	type WeekStartDay,
} from "@bro/domain";
import {
	type FactorCategory,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { formatLocalDayLabel, isWheelReviewDue } from "@bro/logic";
import { type Href, router, useFocusEffect, useScrollToTop } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import {
	type CheckInEntry,
	type CheckInMeasurement,
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../../check-in/check-in-store";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { FormField } from "../../components/form-field";
import { MeasurementField } from "../../components/measurement-field";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useSetTodayHeaderVisibleMonthDay } from "../../components/today-header-month-context";
import {
	WeekStrip,
	type WeekStripDayIndicator,
} from "../../components/week-strip";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../../habits/habits-store";
import {
	createHistoryStore,
	type HistoryDay,
	type HistoryStore,
} from "../../history/history-store";
import {
	createReviewStore,
	type ReviewResult,
	type ReviewStore,
} from "../../review/review-store";
import { StyleSheet } from "../../theme/unistyles";
import {
	createUnitSettingsStore,
	type UnitSettingsStore,
} from "../../units/unit-settings-store";

type HomeScreenProps = {
	store?: Pick<CheckInStore, "loadToday" | "save" | "loadCheckInDays">;
	habitsStore?: Pick<
		HabitsStore,
		"loadToday" | "toggleManual" | "completeChallengeDay" | "loadAdherenceRange"
	>;
	historyStore?: Pick<HistoryStore, "loadDay">;
	reviewStore?: Pick<ReviewStore, "loadLatestWheel">;
	unitSettingsStore?: Pick<UnitSettingsStore, "loadWeekStart">;
	now?: () => Date;
};

const SCORES = [1, 2, 3, 4, 5] as const;
const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;
const CATEGORY_LABELS: Record<FactorCategory, string> = {
	body: "Body",
	lifestyle: "Lifestyle",
	mind: "Mind",
	social: "Social",
};

const EMPTY_ENTRY: MeasurementEntry = { major: "", minor: "" };
const systemNow = () => new Date();

function localDaysBetween(fromLocalDay: string, throughLocalDay: string) {
	const days: string[] = [];
	for (
		let localDay = fromLocalDay;
		localDay <= throughLocalDay;
		localDay = shiftLocalDay(localDay, 1)
	) {
		days.push(localDay);
	}
	return days;
}

function parseMeasurementInput(
	entry: MeasurementEntry,
	measurement: CheckInMeasurement,
	locale: string | undefined,
): ParsedMeasurement {
	if (measurement.dimension === "mass") {
		return parseMeasurementEntry(
			entry,
			measurement.dimension,
			measurement.displayUnit,
			locale,
		);
	}
	if (measurement.dimension === "length") {
		return parseMeasurementEntry(
			entry,
			measurement.dimension,
			measurement.displayUnit,
			locale,
		);
	}
	return parseMeasurementEntry(
		entry,
		measurement.dimension,
		measurement.displayUnit,
		locale,
	);
}

function isBlankEntry(entry: MeasurementEntry): boolean {
	return !entry.major.trim() && !entry.minor.trim();
}

type PastDaySectionProps = {
	localDay: string;
	todayLocalDay: string;
	day: HistoryDay | null;
	habits: TodayHabitsSnapshot | null;
	loading: boolean;
	error: string | null;
	routineError: string | null;
	routineBusy: string | null;
	onToggleHabit: (habitId: string) => void;
	onEdit: () => void;
};

function PastDaySection({
	localDay,
	todayLocalDay,
	day,
	habits,
	loading,
	error,
	routineError,
	routineBusy,
	onToggleHabit,
	onEdit,
}: PastDaySectionProps) {
	return (
		<>
			<AppText variant="section" style={styles.pageTitle}>
				{formatLocalDayLabel(localDay, todayLocalDay)}
			</AppText>
			{loading ? <ActivityIndicator size="large" /> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			{day ? (
				<>
					<View style={styles.section}>
						<SectionHeader title="Check-ins" />
						{day.checkIns.length === 0 ? (
							<Card>
								<AppText color="muted">No check-in was logged.</AppText>
							</Card>
						) : (
							day.checkIns.map((checkIn) => (
								<Card key={checkIn.id}>
									<AppText variant="label">
										Mood {checkIn.mood.value} · Energy {checkIn.energy.value}
									</AppText>
									<AppText variant="caption" color="subtle">
										{new Date(checkIn.observedAt).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</AppText>
								</Card>
							))
						)}
					</View>
					{day.factors.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title="Factors" />
							<Card>
								<AppText color="muted">
									{day.factors
										.map((factor) => {
											const resolved = resolveMetric(factor.metricSlug);
											return resolved.kind === "known"
												? resolved.metric.label
												: factor.metricSlug;
										})
										.join(", ")}
								</AppText>
							</Card>
						</View>
					) : null}
					{day.measurements.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title="Measurements" />
							{day.measurements.map((measurement) => (
								<Card key={measurement.id}>
									<AppText variant="label">{measurement.label}</AppText>
									<AppText color="muted">{measurement.formattedValue}</AppText>
								</Card>
							))}
						</View>
					) : null}
					{day.notes.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title="Notes" />
							{day.notes.map((note) => (
								<Card key={note.id}>
									<AppText color="muted">{note.body}</AppText>
								</Card>
							))}
						</View>
					) : null}
				</>
			) : null}
			{habits && habits.habits.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Habits" />
					{habits.habits.map((item) => (
						<Card key={item.habit.id} style={styles.habitCard}>
							<View style={styles.routineCopy}>
								<AppText variant="score">{item.label}</AppText>
								{item.progressLabel ? (
									<AppText color="muted">{item.progressLabel}</AppText>
								) : null}
								<AppText variant="caption" color="subtle">
									{item.completed ? "Done on this day" : "Not done"}
								</AppText>
							</View>
							{item.habit.kind === "manual" ? (
								<Button
									label={item.completed ? "Undo" : "Mark done"}
									variant={item.completed ? "text" : "secondary"}
									loading={routineBusy === item.habit.id}
									onPress={() => onToggleHabit(item.habit.id)}
								/>
							) : null}
						</Card>
					))}
				</View>
			) : null}
			{routineError ? <AppText color="danger">{routineError}</AppText> : null}
			{day && habits ? (
				<Button label="Edit this day" variant="secondary" onPress={onEdit} />
			) : null}
		</>
	);
}

export function HomeScreen({
	store,
	habitsStore,
	historyStore,
	reviewStore,
	unitSettingsStore,
	now,
}: HomeScreenProps) {
	const clockSource = useRef(now ?? systemNow);
	clockSource.current = now ?? systemNow;
	const clock = useCallback(() => clockSource.current(), []);
	const checkIns = useMemo(() => store ?? createCheckInStore(), [store]);
	const routines = useMemo(
		() => habitsStore ?? createHabitsStore(),
		[habitsStore],
	);
	const history = useMemo(
		() => historyStore ?? createHistoryStore(),
		[historyStore],
	);
	const reviews = useMemo(
		() => reviewStore ?? createReviewStore(),
		[reviewStore],
	);
	const settings = useMemo(
		() => unitSettingsStore ?? createUnitSettingsStore(),
		[unitSettingsStore],
	);
	const setHeaderVisibleMonthDay = useSetTodayHeaderVisibleMonthDay();
	const initialTodayLocalDay = localDayOf(clock());
	const [todayLocalDay, setTodayLocalDay] = useState(initialTodayLocalDay);
	const previousTodayLocalDay = useRef(initialTodayLocalDay);
	const [selectedDay, setSelectedDay] = useState<string | null>(null);
	const resolvedSelectedDay = selectedDay ?? todayLocalDay;
	const [resetToTodayCount, setResetToTodayCount] = useState(0);
	const returnToTodayRef = useRef({ scrollToTop: () => undefined });
	returnToTodayRef.current.scrollToTop = () => {
		const nextTodayLocalDay = localDayOf(clock());
		previousTodayLocalDay.current = nextTodayLocalDay;
		setTodayLocalDay(nextTodayLocalDay);
		setSelectedDay(null);
		setResetToTodayCount((count) => count + 1);
	};
	useScrollToTop(returnToTodayRef);
	const [weekStart, setWeekStart] = useState<WeekStartDay | null>(null);
	const indicatorCache = useRef(new Map<string, WeekStripDayIndicator>());
	const indicatorGeneration = useRef(0);
	const indicatorDayRevisions = useRef(new Map<string, number>());
	const visibleRange = useRef<{ from: string; through: string } | null>(null);
	const [indicators, setIndicators] = useState<
		ReadonlyMap<string, WeekStripDayIndicator>
	>(new Map());
	const [pastDay, setPastDay] = useState<HistoryDay | null>(null);
	const [pastHabits, setPastHabits] = useState<TodayHabitsSnapshot | null>(
		null,
	);
	const [pastLoading, setPastLoading] = useState(false);
	const [pastError, setPastError] = useState<string | null>(null);
	const pastLoadGeneration = useRef(0);
	const [today, setToday] = useState<TodayCheckIn | null>(null);
	const [habitsToday, setHabitsToday] = useState<TodayHabitsSnapshot | null>(
		null,
	);
	const [routineBusy, setRoutineBusy] = useState<string | null>(null);
	const [routineError, setRoutineError] = useState<string | null>(null);
	const [latestWheel, setLatestWheel] = useState<
		ReviewResult | null | undefined
	>(undefined);
	const [wheelError, setWheelError] = useState<string | null>(null);
	const [finishedChallenge, setFinishedChallenge] = useState<string | null>(
		null,
	);
	const [mood, setMood] = useState<number | null>(null);
	const [energy, setEnergy] = useState<number | null>(null);
	const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [measurementInputs, setMeasurementInputs] = useState<
		Record<string, MeasurementEntry>
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

	const loadWheel = useCallback(async () => {
		setWheelError(null);
		try {
			setLatestWheel(await reviews.loadLatestWheel());
		} catch (caught) {
			setWheelError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [reviews]);

	useEffect(() => {
		const current = clock();
		const nextMidnight = new Date(current);
		nextMidnight.setHours(24, 0, 0, 50);
		const timeout = setTimeout(
			() => {
				setTodayLocalDay(localDayOf(clock()));
				void load();
				void loadRoutines();
				void loadWheel();
			},
			Math.max(1_000, nextMidnight.getTime() - current.getTime()),
		);
		return () => clearTimeout(timeout);
	}, [clock, load, loadRoutines, loadWheel, todayLocalDay]);

	const loadIndicatorRange = useCallback(
		async (fromLocalDay: string, throughLocalDay: string) => {
			const requestedDays = localDaysBetween(fromLocalDay, throughLocalDay);
			const missingDays = requestedDays.filter(
				(localDay) => !indicatorCache.current.has(localDay),
			);
			if (missingDays.length === 0) return;

			const requestFrom = missingDays[0];
			const requestThrough = missingDays[missingDays.length - 1];
			const days = localDaysBetween(requestFrom, requestThrough);
			const generation = indicatorGeneration.current;
			const revisions = new Map(
				days.map((localDay) => [
					localDay,
					indicatorDayRevisions.current.get(localDay) ?? 0,
				]),
			);

			try {
				const [adherence, checkInDays] = await Promise.all([
					routines.loadAdherenceRange(requestFrom, requestThrough),
					checkIns.loadCheckInDays(requestFrom, requestThrough),
				]);
				if (generation !== indicatorGeneration.current) return;
				const adherenceByDay = new Map(
					adherence.map((day) => [day.localDay, day]),
				);
				for (const localDay of days) {
					if (
						revisions.get(localDay) !==
						(indicatorDayRevisions.current.get(localDay) ?? 0)
					) {
						continue;
					}
					const summary = adherenceByDay.get(localDay);
					indicatorCache.current.set(localDay, {
						hasCheckIn: checkInDays.has(localDay),
						habitsScheduled: summary?.scheduledCount ?? 0,
						habitsCompleted: summary?.completedCount ?? 0,
					});
				}
				setIndicators(new Map(indicatorCache.current));
			} catch (caught) {
				setRoutineError(
					caught instanceof Error ? caught.message : String(caught),
				);
			}
		},
		[checkIns, routines],
	);

	const handleVisibleRangeChange = useCallback(
		(from: string, through: string) => {
			visibleRange.current = { from, through };
			setHeaderVisibleMonthDay(shiftLocalDay(from, 3));
			void loadIndicatorRange(from, through);
		},
		[loadIndicatorRange, setHeaderVisibleMonthDay],
	);

	const invalidateIndicatorDay = useCallback(
		(localDay: string) => {
			indicatorDayRevisions.current.set(
				localDay,
				(indicatorDayRevisions.current.get(localDay) ?? 0) + 1,
			);
			indicatorCache.current.delete(localDay);
			setIndicators(new Map(indicatorCache.current));
			void loadIndicatorRange(localDay, localDay);
		},
		[loadIndicatorRange],
	);

	const loadPastDay = useCallback(
		async (localDay: string) => {
			const generation = ++pastLoadGeneration.current;
			setPastLoading(true);
			setPastError(null);
			try {
				const [day, habits] = await Promise.all([
					history.loadDay(localDay),
					routines.loadToday(localDay),
				]);
				if (generation !== pastLoadGeneration.current) return;
				setPastDay(day);
				setPastHabits(habits);
			} catch (caught) {
				if (generation !== pastLoadGeneration.current) return;
				setPastError(caught instanceof Error ? caught.message : String(caught));
			} finally {
				if (generation === pastLoadGeneration.current) setPastLoading(false);
			}
		},
		[history, routines],
	);

	useEffect(() => {
		if (resolvedSelectedDay === todayLocalDay) {
			pastLoadGeneration.current += 1;
			setPastDay(null);
			setPastHabits(null);
			setPastError(null);
			setPastLoading(false);
			return;
		}
		void loadPastDay(resolvedSelectedDay);
	}, [loadPastDay, resolvedSelectedDay, todayLocalDay]);

	useFocusEffect(
		useCallback(() => {
			const nextTodayLocalDay = localDayOf(clock());
			const previous = previousTodayLocalDay.current;
			setSelectedDay((current) =>
				current === previous && previous !== nextTodayLocalDay ? null : current,
			);
			previousTodayLocalDay.current = nextTodayLocalDay;
			setTodayLocalDay(nextTodayLocalDay);

			indicatorGeneration.current += 1;
			indicatorDayRevisions.current.clear();
			indicatorCache.current.clear();
			setIndicators(new Map());
			const range = visibleRange.current;
			if (range) void loadIndicatorRange(range.from, range.through);

			void load();
			void loadRoutines();
			void loadWheel();
			void settings
				.loadWeekStart()
				.then(setWeekStart)
				.catch((caught) => {
					setWeekStart("monday");
					setRoutineError(
						caught instanceof Error ? caught.message : String(caught),
					);
				});
		}, [clock, load, loadIndicatorRange, loadRoutines, loadWheel, settings]),
	);

	async function toggleHabit(habitId: string) {
		if (!habitsToday || routineBusy) return;
		setRoutineBusy(habitId);
		setRoutineError(null);
		try {
			await routines.toggleManual(habitId, habitsToday.localDay);
			invalidateIndicatorDay(habitsToday.localDay);
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
			invalidateIndicatorDay(habitsToday.localDay);
			await loadRoutines();
		} catch (caught) {
			setRoutineError(
				caught instanceof Error ? caught.message : String(caught),
			);
		} finally {
			setRoutineBusy(null);
		}
	}

	async function togglePastHabit(habitId: string) {
		if (!pastHabits || routineBusy) return;
		const localDay = pastHabits.localDay;
		setRoutineBusy(habitId);
		setRoutineError(null);
		try {
			await routines.toggleManual(habitId, localDay);
			invalidateIndicatorDay(localDay);
			await loadPastDay(localDay);
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

	function updateMeasurementInput(slug: string, entry: MeasurementEntry) {
		setMeasurementInputs((current) => ({ ...current, [slug]: entry }));
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
				const entry = measurementInputs[measurement.metricSlug] ?? EMPTY_ENTRY;
				if (isBlankEntry(entry)) continue;
				const parsed = parseMeasurementInput(
					entry,
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
			invalidateIndicatorDay(saved.localDay);
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

	if ((!today || !weekStart) && !error) {
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

	if (!weekStart) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
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
						<MeasurementField
							key={measurement.metricSlug}
							label={measurement.label}
							unit={measurement.displayUnit}
							entry={measurementInputs[measurement.metricSlug] ?? EMPTY_ENTRY}
							onChangeEntry={(entry) =>
								updateMeasurementInput(measurement.metricSlug, entry)
							}
							placeholder={`Enter ${measurement.displayUnit}`}
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
		<View style={styles.home}>
			<WeekStrip
				todayLocalDay={todayLocalDay}
				selectedDay={resolvedSelectedDay}
				resetToTodayCount={resetToTodayCount}
				weekStart={weekStart}
				indicators={indicators}
				onSelectDay={setSelectedDay}
				onVisibleRangeChange={handleVisibleRangeChange}
			/>
			<Screen
				scroll
				padded
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{resolvedSelectedDay !== todayLocalDay ? (
					<PastDaySection
						localDay={resolvedSelectedDay}
						todayLocalDay={todayLocalDay}
						day={pastDay}
						habits={pastHabits}
						loading={pastLoading}
						error={pastError}
						routineError={routineError}
						routineBusy={routineBusy}
						onToggleHabit={(habitId) => void togglePastHabit(habitId)}
						onEdit={() =>
							router.push(`/history/${resolvedSelectedDay}` as Href)
						}
					/>
				) : (
					<>
						<AppText variant="section" style={styles.pageTitle}>
							How are you?
						</AppText>
						{checkInForm}
						{finishedChallenge ? (
							<Card style={styles.routineCard}>
								<AppText variant="section">Challenge complete</AppText>
								<AppText color="muted">
									You finished {finishedChallenge}.
								</AppText>
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
									onPress={() => router.push("/habits")}
								/>
							</Card>
						) : null}
						{habitsToday && habitsToday.habits.length > 0 ? (
							<View style={styles.section}>
								<SectionHeader
									title="Habits"
									action={
										<TouchableOpacity onPress={() => router.push("/habits")}>
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
						{routineError ? (
							<AppText color="danger">{routineError}</AppText>
						) : null}
						{latestWheel !== undefined &&
						isWheelReviewDue(
							latestWheel?.assessment.completedAt ?? null,
							clock().getTime(),
						) ? (
							<Card style={styles.stockCard}>
								<AppText variant="section">
									Take stock of the bigger picture
								</AppText>
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
						{wheelError ? (
							<AppText color="danger">
								Wheel review status could not be loaded: {wheelError}
							</AppText>
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
					</>
				)}
			</Screen>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	home: { flex: 1 },
	content: { paddingBottom: theme.spacing.xxl * 2 },
	pageTitle: { marginBottom: theme.spacing.lg },
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
