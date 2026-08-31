import { localDayOf, shiftLocalDay, type WeekStartDay } from "@bro/domain";
import type { TagCategory } from "@bro/domain/metric-registry";
import { formatLocalDayLabel, isWheelReviewDue } from "@bro/logic";
import { type Href, router, useFocusEffect, useScrollToTop } from "expo-router";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import {
	checkInScoreSummary,
	MOOD_FACES,
	metricLabel,
} from "../../check-in/check-in-presentation";
import {
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../../check-in/check-in-store";
import { TAG_CATEGORY_KEYS } from "../../check-in/tag-categories";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DayPager } from "../../components/day-pager";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { ScoreRow } from "../../components/score-row";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { useSetTodayHeaderVisibleMonthDay } from "../../components/today-header-month-context";
import {
	WeekStrip,
	type WeekStripDayIndicator,
} from "../../components/week-strip";
import { playSelectionHaptic } from "../../feedback/selection-haptic";
import {
	createHabitsStore,
	type HabitsStore,
	type TodayHabitsSnapshot,
} from "../../habits/habits-store";
import {
	createHistoryStore,
	type HistoryDay,
	type HistoryMeasurementChange,
	type HistoryStore,
} from "../../history/history-store";
import { toMessage } from "../../lib/errors";
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
	store?: Pick<
		CheckInStore,
		| "loadToday"
		| "saveCheckIn"
		| "saveDayTags"
		| "saveDayNote"
		| "loadCheckInDays"
	>;
	habitsStore?: Pick<
		HabitsStore,
		"loadToday" | "toggleManual" | "completeChallengeDay" | "loadAdherenceRange"
	>;
	historyStore?: Pick<HistoryStore, "loadDay">;
	reviewStore?: Pick<ReviewStore, "loadLatestWheel">;
	unitSettingsStore?: Pick<UnitSettingsStore, "loadWeekStart">;
	now?: () => Date;
};

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

function measurementChangeBadgeLabel(
	t: TFunction<"home">,
	change: HistoryMeasurementChange,
): string {
	if (change.direction === "unchanged") {
		return t("measurements.unchangedBadge");
	}
	const arrow = change.direction === "increase" ? "↑" : "↓";
	const amount =
		change.absolutePercentage === null
			? change.formattedDelta
			: `${new Intl.NumberFormat(undefined, {
					maximumFractionDigits: 1,
				}).format(change.absolutePercentage)}%`;
	return t("measurements.changeBadge", { arrow, amount });
}

function measurementChangeDetailLabel(
	t: TFunction<"home">,
	change: HistoryMeasurementChange,
): string {
	if (change.direction === "unchanged") {
		return t("measurements.unchanged");
	}
	return change.direction === "increase"
		? t("measurements.higher", { delta: change.formattedDelta })
		: t("measurements.lower", { delta: change.formattedDelta });
}

function habitStatus(
	t: TFunction<"home">,
	item: TodayHabitsSnapshot["habits"][number],
): string {
	const status = item.completed ? t("habits.doneToday") : t("habits.stillToDo");
	return item.streak > 0
		? t("habits.withStreak", { status, days: item.streak })
		: status;
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

type PastDaySnapshot = {
	day: HistoryDay | null;
	habits: TodayHabitsSnapshot | null;
	loading: boolean;
	error: string | null;
	/** Freshness stamp; entries below the current generation are refetched. */
	generation: number;
};

/**
 * The pager renders at most three days, so a handful of entries covers paging
 * back and forth. Anything older is dropped rather than kept for the session.
 */
const PAST_DAY_CACHE_LIMIT = 7;

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
	const { t } = useTranslation("home");

	return (
		<>
			<AppText variant="section" style={styles.pageTitle}>
				{formatLocalDayLabel(localDay, todayLocalDay)}
			</AppText>
			{loading ? <LoadingIndicator size="large" /> : null}
			{error ? <AppText color="danger">{error}</AppText> : null}
			{day ? (
				<>
					<View style={styles.section}>
						<SectionHeader title={t("checkIns.title")} />
						{day.checkIns.length === 0 ? (
							<Card>
								<AppText color="muted">{t("checkIns.none")}</AppText>
							</Card>
						) : (
							day.checkIns.map((checkIn) => (
								<Card key={checkIn.id}>
									<AppText variant="label">
										{checkInScoreSummary(checkIn)}
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
					{day.tags.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title={t("tags.title")} />
							<Card>
								<AppText color="muted">
									{day.tags
										.map((tag) => metricLabel(tag.metricSlug))
										.join(", ")}
								</AppText>
							</Card>
						</View>
					) : null}
					{day.measurements.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title={t("measurements.title")} />
							{day.measurements.map((measurement) => (
								<Card
									key={measurement.id}
									style={styles.measurementSummaryCard}
								>
									<View style={styles.measurementSummaryHeader}>
										<AppText
											variant="caption"
											color="muted"
											style={styles.measurementSummaryLabel}
										>
											{measurement.label}
										</AppText>
										{measurement.changeFromPreviousDay ? (
											<View style={styles.measurementDeltaBadge}>
												<AppText
													variant="micro"
													color="brand"
													style={styles.measurementDeltaText}
												>
													{measurementChangeBadgeLabel(
														t,
														measurement.changeFromPreviousDay,
													)}
												</AppText>
											</View>
										) : null}
									</View>
									<AppText variant="title">
										{measurement.formattedValue}
									</AppText>
									{measurement.changeFromPreviousDay ? (
										<AppText variant="micro" color="subtle">
											{measurementChangeDetailLabel(
												t,
												measurement.changeFromPreviousDay,
											)}
										</AppText>
									) : null}
								</Card>
							))}
						</View>
					) : null}
					{day.notes.length > 0 ? (
						<View style={styles.section}>
							<SectionHeader title={t("notes.title")} />
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
					<SectionHeader title={t("habits.title")} />
					{habits.habits.map((item) => (
						<Card key={item.habit.id} style={styles.habitCard}>
							<View style={styles.routineCopy}>
								<AppText variant="score">{item.label}</AppText>
								{item.progressLabel ? (
									<AppText color="muted">{item.progressLabel}</AppText>
								) : null}
								<AppText variant="caption" color="subtle">
									{item.completed ? t("habits.doneOnDay") : t("habits.notDone")}
								</AppText>
							</View>
							{item.habit.kind === "manual" ? (
								<Button
									label={
										item.completed ? t("habits.undo") : t("habits.markDone")
									}
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
				<Button
					label={t("pastDay.edit")}
					variant="secondary"
					onPress={onEdit}
				/>
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
	const { t } = useTranslation(["home", "checkIn", "common"]);
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
	const [previewDay, setPreviewDay] = useState<string | null>(null);
	const calendarSelectedDay = previewDay ?? resolvedSelectedDay;
	const calendarSelectedDayRef = useRef(calendarSelectedDay);
	calendarSelectedDayRef.current = calendarSelectedDay;
	const previewPagerDay = useCallback(
		(localDay: string) => {
			setPreviewDay(localDay === resolvedSelectedDay ? null : localDay);
		},
		[resolvedSelectedDay],
	);
	const commitDay = useCallback(
		(localDay: string) => {
			setPreviewDay(null);
			if (localDay === resolvedSelectedDay) return;
			setSelectedDay(localDay === todayLocalDay ? null : localDay);
		},
		[resolvedSelectedDay, todayLocalDay],
	);
	const selectDay = useCallback(
		(localDay: string) => {
			if (localDay === resolvedSelectedDay) return;
			playSelectionHaptic();
			commitDay(localDay);
		},
		[commitDay, resolvedSelectedDay],
	);
	const pagerDays = useMemo(() => {
		const previous = shiftLocalDay(resolvedSelectedDay, -1);
		const next = shiftLocalDay(resolvedSelectedDay, 1);
		return next <= todayLocalDay
			? [previous, resolvedSelectedDay, next]
			: [previous, resolvedSelectedDay];
	}, [resolvedSelectedDay, todayLocalDay]);
	const [resetToTodayCount, setResetToTodayCount] = useState(0);
	const returnToTodayRef = useRef({ scrollToTop: () => undefined });
	returnToTodayRef.current.scrollToTop = () => {
		const nextTodayLocalDay = localDayOf(clock());
		if (resolvedSelectedDay !== nextTodayLocalDay) playSelectionHaptic();
		previousTodayLocalDay.current = nextTodayLocalDay;
		setTodayLocalDay(nextTodayLocalDay);
		setSelectedDay(null);
		setPreviewDay(null);
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
	const pastDayCache = useRef(new Map<string, PastDaySnapshot>());
	const pastLoadGenerations = useRef(new Map<string, number>());
	const [pastDayGeneration, setPastDayGeneration] = useState(0);
	const pastDayGenerationRef = useRef(0);
	pastDayGenerationRef.current = pastDayGeneration;
	const [pastDays, setPastDays] = useState<
		ReadonlyMap<string, PastDaySnapshot>
	>(new Map());
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
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	// Only the latest tag toggle may apply its result, and a reload must not
	// pull the chips back to a set the user has already moved on from.
	const tagRequestRef = useRef(0);
	const tagsInFlightRef = useRef(0);
	// The note field is the user's draft until they save it; a background reload
	// may only refill it while it matches what was last loaded or saved.
	const savedNoteRef = useRef("");
	// Every read and write returns a whole snapshot of the day, so a slow one
	// must not land on top of a newer one — a note save in flight while a
	// check-in commits would otherwise put the day back as it was.
	const todayWriteRef = useRef(0);
	const [savingNote, setSavingNote] = useState(false);
	const [reviewingCheckIns, setReviewingCheckIns] = useState(false);
	const noteDirty = note !== savedNoteRef.current;

	const load = useCallback(async () => {
		setError(null);
		todayWriteRef.current += 1;
		const stamp = todayWriteRef.current;
		try {
			const loaded = await checkIns.loadToday();
			if (stamp !== todayWriteRef.current) return;
			setToday(loaded);
			if (tagsInFlightRef.current === 0) {
				setSelectedTags(loaded.selectedTagSlugs);
			}
			const previouslySaved = savedNoteRef.current;
			savedNoteRef.current = loaded.note;
			setNote((current) =>
				current === previouslySaved ? loaded.note : current,
			);
		} catch (caught) {
			setError(toMessage(caught));
		}
	}, [checkIns]);

	const loadRoutines = useCallback(async () => {
		setRoutineError(null);
		try {
			setHabitsToday(await routines.loadToday());
		} catch (caught) {
			setRoutineError(toMessage(caught));
		}
	}, [routines]);

	const loadWheel = useCallback(async () => {
		setWheelError(null);
		try {
			setLatestWheel(await reviews.loadLatestWheel());
		} catch (caught) {
			setWheelError(toMessage(caught));
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
				setRoutineError(toMessage(caught));
			}
		},
		[checkIns, routines],
	);

	const handleVisibleRangeChange = useCallback(
		(from: string, through: string) => {
			visibleRange.current = { from, through };
			const selected = calendarSelectedDayRef.current;
			setHeaderVisibleMonthDay(
				selected >= from && selected <= through
					? selected
					: shiftLocalDay(from, 3),
			);
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

	const writePastDay = useCallback(
		(localDay: string, snapshot: PastDaySnapshot) => {
			// Re-inserting moves the day to the end, so the entries evicted below
			// are always the ones touched least recently.
			pastDayCache.current.delete(localDay);
			pastDayCache.current.set(localDay, snapshot);
			while (pastDayCache.current.size > PAST_DAY_CACHE_LIMIT) {
				const oldest = pastDayCache.current.keys().next();
				if (oldest.done) break;
				pastDayCache.current.delete(oldest.value);
				pastLoadGenerations.current.delete(oldest.value);
			}
			setPastDays(new Map(pastDayCache.current));
		},
		[],
	);

	const loadPastDay = useCallback(
		async (localDay: string, force = false) => {
			const cached = pastDayCache.current.get(localDay);
			// Captured up front: a refocus mid-flight must leave the result stamped
			// stale so the refocus-triggered load refetches it.
			const stamp = pastDayGenerationRef.current;
			const fresh = cached?.generation === stamp;
			if (
				!force &&
				fresh &&
				(cached.loading || (cached.day && cached.habits))
			) {
				return;
			}
			const generation = (pastLoadGenerations.current.get(localDay) ?? 0) + 1;
			pastLoadGenerations.current.set(localDay, generation);
			// Keep any previous data on screen while refetching so a revisit shows
			// stale-but-real content rather than flashing back to a spinner.
			writePastDay(localDay, {
				day: cached?.day ?? null,
				habits: cached?.habits ?? null,
				loading: true,
				error: null,
				generation: stamp,
			});
			try {
				const [day, habits] = await Promise.all([
					history.loadDay(localDay),
					routines.loadToday(localDay),
				]);
				if (generation !== pastLoadGenerations.current.get(localDay)) return;
				writePastDay(localDay, {
					day,
					habits,
					loading: false,
					error: null,
					generation: stamp,
				});
			} catch (caught) {
				if (generation !== pastLoadGenerations.current.get(localDay)) return;
				writePastDay(localDay, {
					day: cached?.day ?? null,
					habits: cached?.habits ?? null,
					loading: false,
					error: toMessage(caught),
					generation: stamp,
				});
			}
		},
		[history, routines, writePastDay],
	);

	// `pastDayGeneration` is a dependency so that refocusing the tab — which bumps
	// it — refetches the visible days after an edit made on another screen.
	useEffect(() => {
		for (const localDay of pagerDays) {
			if (localDay < todayLocalDay) void loadPastDay(localDay);
		}
	}, [loadPastDay, pagerDays, todayLocalDay, pastDayGeneration]);

	useFocusEffect(
		useCallback(() => {
			const nextTodayLocalDay = localDayOf(clock());
			const previous = previousTodayLocalDay.current;
			setPreviewDay(null);
			setSelectedDay((current) =>
				current === previous && previous !== nextTodayLocalDay ? null : current,
			);
			previousTodayLocalDay.current = nextTodayLocalDay;
			setTodayLocalDay(nextTodayLocalDay);

			indicatorGeneration.current += 1;
			indicatorDayRevisions.current.clear();
			indicatorCache.current.clear();
			setIndicators(new Map());

			// A past day may have been edited on the history screen while this tab
			// was blurred, so every cached snapshot is now suspect.
			setPastDayGeneration((generation) => generation + 1);
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
					setRoutineError(toMessage(caught));
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
			setRoutineError(toMessage(caught));
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
			setRoutineError(toMessage(caught));
		} finally {
			setRoutineBusy(null);
		}
	}

	async function togglePastHabit(localDay: string, habitId: string) {
		const habits = pastDayCache.current.get(localDay)?.habits;
		if (!habits || routineBusy) return;
		setRoutineBusy(habitId);
		setRoutineError(null);
		try {
			await routines.toggleManual(habitId, localDay);
			invalidateIndicatorDay(localDay);
			await loadPastDay(localDay, true);
		} catch (caught) {
			setRoutineError(toMessage(caught));
		} finally {
			setRoutineBusy(null);
		}
	}

	async function toggleTag(slug: string) {
		const next = selectedTags.includes(slug)
			? selectedTags.filter((selected) => selected !== slug)
			: [...selectedTags, slug];
		const previous = selectedTags;
		playSelectionHaptic();
		setSelectedTags(next);
		setError(null);
		const request = tagRequestRef.current + 1;
		tagRequestRef.current = request;
		tagsInFlightRef.current += 1;
		todayWriteRef.current += 1;
		const stamp = todayWriteRef.current;
		try {
			const saved = await checkIns.saveDayTags(next);
			if (request !== tagRequestRef.current) return;
			setSelectedTags(saved.selectedTagSlugs);
			if (stamp !== todayWriteRef.current) return;
			setToday(saved);
			invalidateIndicatorDay(saved.localDay);
		} catch (caught) {
			if (request !== tagRequestRef.current) return;
			setSelectedTags(previous);
			setError(toMessage(caught));
		} finally {
			tagsInFlightRef.current -= 1;
		}
	}

	function startCheckIn(moodScore: number) {
		playSelectionHaptic();
		router.push(`/check-in?mood=${moodScore}` as Href);
	}

	async function saveNote() {
		if (savingNote) return;
		setSavingNote(true);
		setError(null);
		todayWriteRef.current += 1;
		const stamp = todayWriteRef.current;
		try {
			const saved = await checkIns.saveDayNote(note);
			savedNoteRef.current = saved.note;
			setNote(saved.note);
			if (stamp !== todayWriteRef.current) return;
			setToday(saved);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setSavingNote(false);
		}
	}

	if ((!today || !weekStart) && !error) {
		return <LoadingScreen variant="tab" />;
	}

	if (!today) {
		return (
			<Screen padded centered contentContainerStyle={styles.loading}>
				<AppText variant="section">{t("loadFailed")}</AppText>
				<AppText color="danger">{error}</AppText>
				<Button
					label={t("common:actions.tryAgain")}
					variant="secondary"
					onPress={() => void load()}
				/>
			</Screen>
		);
	}

	if (!weekStart) {
		return <LoadingScreen variant="tab" />;
	}
	const groupedTags = Object.entries(TAG_CATEGORY_KEYS).map(
		([category, key]) => ({
			category: category as TagCategory,
			label: t(`checkIn:${key}` as const),
			tags: today.availableTags.filter((tag) => tag.category === category),
		}),
	);
	const checkInCount = today.entries.length;
	const latestCheckIn = today.entries[0] ?? null;
	const checkInsSection = (
		<View style={styles.section}>
			<SectionHeader
				title={t("checkIns.title")}
				action={
					checkInCount > 0 ? (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={
								reviewingCheckIns ? t("checkIns.hide") : t("checkIns.review")
							}
							accessibilityState={{ expanded: reviewingCheckIns }}
							onPress={() => setReviewingCheckIns((open) => !open)}
						>
							<AppText variant="label" color="brand">
								{t("checkIns.count", { count: checkInCount })}
							</AppText>
						</TouchableOpacity>
					) : null
				}
			/>

			{/* The journal reads the day; the scores themselves are answered in the
			    check-in flow, so nothing here grows under the user's thumb. */}
			<Card>
				<AppText variant="label" style={styles.prompt}>
					{checkInCount === 0
						? t("checkIns.promptFirst")
						: t("checkIns.promptAgain")}
				</AppText>
				<ScoreRow
					accessibilityPrefix={t("checkIns.moodPrefix")}
					selected={null}
					onSelect={startCheckIn}
					faces={MOOD_FACES}
					endLabels={{
						minimum: t("common:ratingEnds.veryBad"),
						maximum: t("common:ratingEnds.veryGood"),
					}}
				/>
				<AppText variant="caption" color="subtle" style={styles.hint}>
					{latestCheckIn
						? t("checkIns.last", {
								summary: checkInScoreSummary(latestCheckIn),
							})
						: today.availableOptionalScores.length > 0
							? t("checkIns.hintWithOptional")
							: t("checkIns.hint")}
				</AppText>
				{error ? <AppText color="danger">{error}</AppText> : null}
			</Card>

			{reviewingCheckIns
				? today.entries.map((entry) => (
						<Card key={entry.id} style={styles.entryCard}>
							<View>
								<AppText variant="label">{checkInScoreSummary(entry)}</AppText>
								<AppText variant="caption" color="subtle">
									{new Date(entry.observedAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</AppText>
							</View>
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel={t("checkIns.editA11y", {
									summary: checkInScoreSummary(entry),
								})}
								onPress={() =>
									router.push(`/check-in?entry=${entry.id}` as Href)
								}
							>
								<AppText variant="label" color="brand">
									{t("checkIns.edit")}
								</AppText>
							</TouchableOpacity>
						</Card>
					))
				: null}
		</View>
	);

	const tagsSection =
		today.availableTags.length > 0 ? (
			<View style={styles.section}>
				<SectionHeader title={t("tags.title")} />
				<AppText variant="caption" color="subtle">
					{t("tags.hint")}
				</AppText>
				{groupedTags.map(({ category, label, tags }) =>
					tags.length > 0 ? (
						<View key={category} style={styles.tagGroup}>
							<AppText
								variant="caption"
								color="subtle"
								style={styles.categoryLabel}
							>
								{label}
							</AppText>
							<View style={styles.tagRow}>
								{tags.map((tag) => {
									const selected = selectedTags.includes(tag.slug);
									return (
										<TouchableOpacity
											key={tag.slug}
											accessibilityRole="button"
											accessibilityLabel={tag.label}
											accessibilityState={{ selected }}
											style={[
												styles.tagButton,
												selected && styles.choiceSelected,
											]}
											onPress={() => void toggleTag(tag.slug)}
										>
											<AppText
												variant="caption"
												color="muted"
												style={[selected && styles.choiceSelectedText]}
											>
												{tag.label}
											</AppText>
										</TouchableOpacity>
									);
								})}
							</View>
						</View>
					) : null,
				)}
			</View>
		) : null;

	const noteSection = (
		<View style={styles.section}>
			<SectionHeader title={t("note.title")} />
			<FormField
				label={t("note.field")}
				value={note}
				onChangeText={setNote}
				placeholder={t("note.placeholder")}
				multiline
			/>
			{noteDirty ? (
				<Button
					label={t("note.save")}
					variant="secondary"
					loading={savingNote}
					onPress={() => void saveNote()}
				/>
			) : null}
		</View>
	);

	function renderPagerDay(localDay: string) {
		const past = pastDays.get(localDay);
		return (
			<Screen
				scroll
				padded
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{localDay !== todayLocalDay ? (
					<PastDaySection
						localDay={localDay}
						todayLocalDay={todayLocalDay}
						day={past?.day ?? null}
						habits={past?.habits ?? null}
						loading={past?.loading ?? true}
						error={past?.error ?? null}
						routineError={routineError}
						routineBusy={routineBusy}
						onToggleHabit={(habitId) => void togglePastHabit(localDay, habitId)}
						onEdit={() => router.push(`/history/${localDay}` as Href)}
					/>
				) : (
					<>
						<AppText variant="section" style={styles.pageTitle}>
							{formatLocalDayLabel(localDay, todayLocalDay)}
						</AppText>
						{checkInsSection}
						{finishedChallenge ? (
							<Card style={styles.routineCard}>
								<AppText variant="section">
									{t("challenges.completeTitle")}
								</AppText>
								<AppText color="muted">
									{t("challenges.completeBody", { name: finishedChallenge })}
								</AppText>
								<Button
									label={t("challenges.dismiss")}
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
								<AppText variant="section">{t("habits.emptyTitle")}</AppText>
								<AppText color="muted">{t("habits.emptyBody")}</AppText>
								<Button
									label={t("habits.choose")}
									variant="secondary"
									onPress={() => router.push("/habits")}
								/>
							</Card>
						) : null}
						{habitsToday && habitsToday.habits.length > 0 ? (
							<View style={styles.section}>
								<SectionHeader
									title={t("habits.title")}
									action={
										<TouchableOpacity onPress={() => router.push("/habits")}>
											<AppText variant="label" color="brand">
												{t("habits.manage")}
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
												{habitStatus(t, item)}
											</AppText>
										</View>
										{item.habit.kind === "manual" ? (
											<Button
												label={
													item.completed
														? t("habits.undo")
														: t("habits.markDone")
												}
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
								<SectionHeader title={t("challenges.title")} />
								{habitsToday.challenges.map((challenge) => (
									<Card key={challenge.enrolmentId} style={styles.routineCard}>
										<AppText variant="caption" color="brand">
											{t("challenges.dayOf", {
												day: challenge.dayIndex,
												total: challenge.durationDays,
											})}
										</AppText>
										<AppText variant="section">{challenge.dayTitle}</AppText>
										<AppText color="muted">{challenge.action}</AppText>
										<Button
											label={t("challenges.markStepDone")}
											loading={routineBusy === challenge.enrolmentId}
											onPress={() =>
												void completeChallenge(
													challenge.enrolmentId,
													challenge.dayIndex,
												)
											}
										/>
										<Button
											label={t("challenges.view")}
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
								<AppText variant="section">{t("wheel.title")}</AppText>
								<AppText color="muted">{t("wheel.body")}</AppText>
								<Button
									label={t("wheel.takeStock")}
									accessibilityLabel={t("wheel.takeStock")}
									variant="secondary"
									onPress={() => router.push("/review/new")}
								/>
							</Card>
						) : null}
						{wheelError ? (
							<AppText color="danger">
								{t("wheel.statusFailed", { error: wheelError })}
							</AppText>
						) : null}
						{tagsSection}
						{noteSection}
					</>
				)}
			</Screen>
		);
	}

	return (
		<View style={styles.home}>
			<WeekStrip
				todayLocalDay={todayLocalDay}
				selectedDay={calendarSelectedDay}
				resetToTodayCount={resetToTodayCount}
				weekStart={weekStart}
				indicators={indicators}
				onSelectDay={selectDay}
				onVisibleRangeChange={handleVisibleRangeChange}
			/>
			<DayPager
				days={pagerDays}
				selectedDay={resolvedSelectedDay}
				onPreviewDay={previewPagerDay}
				onSelectDay={commitDay}
				renderDay={renderPagerDay}
			/>
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
	measurementSummaryCard: { gap: theme.spacing.xs },
	measurementSummaryHeader: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.sm,
	},
	measurementSummaryLabel: { flex: 1 },
	measurementDeltaBadge: {
		paddingVertical: theme.spacing.xs,
		paddingHorizontal: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.selected,
	},
	measurementDeltaText: { fontWeight: "600" },
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
	prompt: {
		fontWeight: "600",
		marginBottom: theme.spacing.sm,
	},
	choiceSelected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	choiceSelectedText: { color: theme.colors.onSelected },
	tagGroup: { marginBottom: theme.spacing.md },
	categoryLabel: { marginBottom: theme.spacing.xs },
	tagRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	tagButton: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
		paddingVertical: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
	},
	hint: { marginTop: theme.spacing.sm },
}));
