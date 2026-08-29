import {
	type ChallengeEnrolment,
	ChallengeEnrolmentRepository,
	type ChallengeProgress,
	ChallengeProgressRepository,
	type DailyMetric,
	DailyMetricRepository,
	type DayNote,
	DayNoteRepository,
	getDb,
	type Habit,
	type HabitCompletion,
	HabitCompletionRepository,
	HabitRepository,
	type Observation,
	ObservationRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { previousLocalDay } from "@bro/domain";
import { CONFIGURABLE_CHECK_IN_METRIC_SLUGS } from "@bro/domain/metric-registry";
import {
	formatMetricDelta,
	formatMetricValue,
	isHealthMetricSlug,
	metricDisplayUnit,
	resolveMetricDay,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveChallenge, resolveHabit, resolveMetric } from "../content";
import { i18n } from "../i18n";
import { unitWords } from "../units/unit-words";

export type HistoryMeasurement = {
	id: string;
	metricSlug: string;
	label: string;
	value: number;
	formattedValue: string;
	source: string;
	selected: boolean;
	observation: Observation | null;
	changeFromPreviousDay: HistoryMeasurementChange | null;
};

/**
 * A change is only ever reported as moved when it is large enough to render, so
 * the formatted amount is present exactly when there is a direction to show.
 */
export type HistoryMeasurementChange =
	| { direction: "unchanged" }
	| {
			direction: "increase" | "decrease";
			formattedDelta: string;
			absolutePercentage: number | null;
	  };

export type HistoricalCheckIn = {
	id: string;
	observedAt: number;
	mood: Observation;
	optionalScores: Observation[];
};

const optionalScoreSlugs = new Set<string>(CONFIGURABLE_CHECK_IN_METRIC_SLUGS);

export type HistoryDay = {
	localDay: string;
	checkIns: HistoricalCheckIn[];
	unpairedScored: Observation[];
	tags: Observation[];
	assessments: Observation[];
	measurements: HistoryMeasurement[];
	unknown: Observation[];
	notes: DayNote[];
	habitCompletions: HistoryHabitCompletion[];
	challengeSteps: HistoryChallengeStep[];
};

export type HistoryHabitCompletion = {
	id: string;
	habitId: string;
	label: string;
};

export type HistoryChallengeStep = {
	id: string;
	enrolmentId: string;
	title: string;
	dayIndex: number;
	dayTitle: string;
};

export type HistoryDaySummary = {
	localDay: string;
	moodValues: number[];
	energyValues: number[];
	tagLabels: string[];
	noteBodies: string[];
	/** Distinct wheel sittings whose scores landed on this day. */
	assessmentCount: number;
	healthLabels?: string[];
	habitLabels?: string[];
	challengeLabels?: string[];
};

function habitLabel(habit: Habit | undefined): string {
	if (!habit) return i18n.t("history:day.unknownHabit");
	return (
		habit.customLabel ??
		resolveHabit(habit.slug)?.label ??
		habit.slug.replace(/^habit:(?:custom:)?/, "")
	);
}

function groupCheckIns(
	observations: readonly Observation[],
): HistoricalCheckIn[] {
	const moods = observations.filter((row) => row.metricSlug === "mood");
	const usedScoreIds = new Set<string>();
	const checkIns: HistoricalCheckIn[] = [];

	for (const mood of moods) {
		const optionalScores = observations.filter(
			(row) =>
				optionalScoreSlugs.has(row.metricSlug) &&
				!usedScoreIds.has(row.id) &&
				(row.sourceRecordId === mood.id ||
					(row.sourceRecordId === null && row.observedAt === mood.observedAt)),
		);
		for (const score of optionalScores) usedScoreIds.add(score.id);
		checkIns.push({
			id: mood.id,
			observedAt: Math.max(
				mood.observedAt,
				...optionalScores.map((score) => score.observedAt),
			),
			mood,
			optionalScores,
		});
	}

	return checkIns;
}

/**
 * Builds just the measurement rows of a day. Kept separate so a comparison
 * against the previous day can load those rows without assembling the check-ins,
 * notes, habits and challenges nobody reads from it.
 */
function assembleMeasurements(
	localDay: string,
	observations: readonly Observation[],
	dailyMetrics: readonly DailyMetric[] = [],
	preferenceByDimension: ReadonlyMap<string, string> = new Map(),
	locale?: string,
): HistoryMeasurement[] {
	// Keep the pre-import day view unchanged. Manual measurement provenance is
	// shown here only when there is a tracker row to compare it with.
	const measurementSlugs = new Set(dailyMetrics.map((row) => row.metricSlug));
	return [...measurementSlugs].flatMap((metricSlug) => {
		const resolved = resolveMetric(metricSlug);
		if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
			return [];
		}
		const metric = resolved.metric;
		const displayUnit = metricDisplayUnit(
			metric,
			preferenceByDimension,
			locale,
		);
		const userRows = observations.filter(
			(row) => row.metricSlug === metricSlug,
		);
		const importedRows = dailyMetrics.filter(
			(row) => row.metricSlug === metricSlug,
		);
		const selectedIds = new Set<string>();
		if (isHealthMetricSlug(metricSlug)) {
			const selected = resolveMetricDay(
				metricSlug,
				localDay,
				userRows,
				importedRows,
			).selected;
			if (selected?.kind === "imported") selectedIds.add(selected.row.id);
			if (selected?.kind === "user") {
				const selectedUser = selected.rows.at(-1);
				if (selectedUser) selectedIds.add(selectedUser.id);
			}
		} else {
			const selectedUser = [...userRows]
				.sort(
					(left, right) =>
						left.observedAt - right.observedAt ||
						left.id.localeCompare(right.id),
				)
				.at(-1);
			if (selectedUser) selectedIds.add(selectedUser.id);
		}
		return [
			...userRows.map((observation) => ({
				id: observation.id,
				metricSlug,
				label: metric.label,
				value: observation.value,
				formattedValue: formatMetricValue(
					metric,
					observation.value,
					displayUnit,
					locale,
					unitWords(),
				),
				source: observation.source,
				selected: selectedIds.has(observation.id),
				observation,
				changeFromPreviousDay: null,
			})),
			...importedRows.map((row) => ({
				id: row.id,
				metricSlug,
				label: metric.label,
				value: row.value,
				formattedValue: formatMetricValue(
					metric,
					row.value,
					displayUnit,
					locale,
					unitWords(),
				),
				source: row.source,
				selected: selectedIds.has(row.id),
				observation: null,
				changeFromPreviousDay: null,
			})),
		];
	});
}

export function assembleHistoryDay(
	localDay: string,
	observations: readonly Observation[],
	notes: readonly DayNote[],
	dailyMetrics: readonly DailyMetric[] = [],
	preferenceByDimension: ReadonlyMap<string, string> = new Map(),
	locale?: string,
	habits: readonly Habit[] = [],
	habitCompletions: readonly HabitCompletion[] = [],
	enrolments: readonly ChallengeEnrolment[] = [],
	challengeProgress: readonly ChallengeProgress[] = [],
): HistoryDay {
	const checkIns = groupCheckIns(observations);
	const pairedIds = new Set(
		checkIns.flatMap((checkIn) => [
			checkIn.mood.id,
			...checkIn.optionalScores.map((score) => score.id),
		]),
	);
	const unpairedScored: Observation[] = [];
	const tags: Observation[] = [];
	const assessments: Observation[] = [];
	const measurementObservations: Observation[] = [];
	const unknown: Observation[] = [];

	for (const observation of observations) {
		const resolved = resolveMetric(observation.metricSlug);
		if (resolved.kind === "unknown") {
			unknown.push(observation);
		} else if (resolved.metric.kind === "tag") {
			tags.push(observation);
		} else if (resolved.metric.kind === "assessment") {
			assessments.push(observation);
		} else if (resolved.metric.kind === "measurement") {
			measurementObservations.push(observation);
		} else if (
			resolved.metric.kind === "scored" &&
			!pairedIds.has(observation.id)
		) {
			unpairedScored.push(observation);
		}
	}
	const measurements = assembleMeasurements(
		localDay,
		measurementObservations,
		dailyMetrics,
		preferenceByDimension,
		locale,
	);

	return {
		localDay,
		checkIns,
		unpairedScored,
		tags,
		assessments,
		measurements,
		unknown,
		notes: [...notes],
		habitCompletions: habitCompletions.map((completion) => ({
			id: completion.id,
			habitId: completion.habitId,
			label: habitLabel(
				habits.find((habit) => habit.id === completion.habitId),
			),
		})),
		challengeSteps: challengeProgress.map((progress) => {
			const enrolment = enrolments.find(
				(candidate) => candidate.id === progress.enrolmentId,
			);
			const day = enrolment
				? resolveChallenge(enrolment.challengeSlug)?.days.find(
						(candidate) => candidate.day === progress.dayIndex,
					)
				: null;
			return {
				id: progress.id,
				enrolmentId: progress.enrolmentId,
				title: enrolment?.title ?? i18n.t("history:day.unknownChallenge"),
				dayIndex: progress.dayIndex,
				dayTitle:
					day?.title ??
					i18n.t("history:day.challengeDayTitle", { day: progress.dayIndex }),
			};
		}),
	};
}

export function addPreviousDayMeasurementChanges(
	day: HistoryDay,
	previousMeasurements: readonly HistoryMeasurement[],
	preferenceByDimension: ReadonlyMap<string, string> = new Map(),
	locale?: string,
): HistoryDay {
	const previousSelectedByMetric = new Map(
		previousMeasurements
			.filter((measurement) => measurement.selected)
			.map((measurement) => [measurement.metricSlug, measurement]),
	);

	return {
		...day,
		measurements: day.measurements.map((measurement) => {
			if (!measurement.selected) return measurement;
			const previous = previousSelectedByMetric.get(measurement.metricSlug);
			if (!previous) return measurement;

			const resolved = resolveMetric(measurement.metricSlug);
			if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
				return measurement;
			}
			const delta = measurement.value - previous.value;
			const displayUnit = metricDisplayUnit(
				resolved.metric,
				preferenceByDimension,
				locale,
			);
			const formattedDelta = formatMetricDelta(
				resolved.metric,
				Math.abs(delta),
				displayUnit,
				locale,
				unitWords(),
			);

			// A change too small to format is one the two readings do not show
			// either, so calling it unchanged keeps the badge and the values honest.
			if (formattedDelta === null) {
				return {
					...measurement,
					changeFromPreviousDay: { direction: "unchanged" },
				};
			}

			return {
				...measurement,
				changeFromPreviousDay: {
					direction: delta > 0 ? "increase" : "decrease",
					formattedDelta,
					absolutePercentage:
						previous.value === 0
							? null
							: (Math.abs(delta) / Math.abs(previous.value)) * 100,
				},
			};
		}),
	};
}

export class HistoryStore {
	private readonly observations: ObservationRepository;
	private readonly notes: DayNoteRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly unitPreferences: UnitPreferenceRepository;
	private readonly habits: HabitRepository;
	private readonly habitCompletions: HabitCompletionRepository;
	private readonly enrolments: ChallengeEnrolmentRepository;
	private readonly challengeProgress: ChallengeProgressRepository;

	constructor(private readonly db: SQLiteDatabase) {
		this.observations = new ObservationRepository(db);
		this.notes = new DayNoteRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
		this.habits = new HabitRepository(db);
		this.habitCompletions = new HabitCompletionRepository(db);
		this.enrolments = new ChallengeEnrolmentRepository(db);
		this.challengeProgress = new ChallengeProgressRepository(db);
	}

	async loadHistory(): Promise<HistoryDaySummary[]> {
		const [
			observations,
			notes,
			dailyMetrics,
			habits,
			habitCompletions,
			enrolments,
			challengeProgress,
		] = await Promise.all([
			this.observations.listAll(),
			this.notes.listAll(),
			this.dailyMetrics.listAll(),
			this.habits.listAll(),
			this.habitCompletions.listAll(),
			this.enrolments.listAll(),
			this.challengeProgress.listAll(),
		]);
		const assessmentObservations: Observation[] = [];
		const dailyObservations: Observation[] = [];
		for (const row of observations) {
			const resolved = resolveMetric(row.metricSlug);
			if (resolved.kind === "known" && resolved.metric.kind === "assessment") {
				assessmentObservations.push(row);
			} else {
				dailyObservations.push(row);
			}
		}
		const localDays = new Set([
			...observations.map((row) => row.localDay),
			...notes.map((note) => note.localDay),
			...dailyMetrics.map((row) => row.localDay),
			...habitCompletions.map((row) => row.localDay),
			...challengeProgress.map((row) => row.localDay),
		]);

		return [...localDays]
			.sort((left, right) => right.localeCompare(left))
			.map((localDay) => {
				const dayObservations = dailyObservations.filter(
					(row) => row.localDay === localDay,
				);
				const assessmentIds = new Set(
					assessmentObservations
						.filter((row) => row.localDay === localDay)
						.map((row) => row.assessmentId ?? row.id),
				);
				const tags = dayObservations.flatMap((row) => {
					const resolved = resolveMetric(row.metricSlug);
					return resolved.kind === "known" && resolved.metric.kind === "tag"
						? [resolved.metric.label]
						: [];
				});
				const healthLabels = dailyMetrics
					.filter((row) => row.localDay === localDay)
					.flatMap((row) => {
						const resolved = resolveMetric(row.metricSlug);
						return resolved.kind === "known" ? [resolved.metric.label] : [];
					});
				const uniqueHealthLabels = [...new Set(healthLabels)];
				const habitLabels = habitCompletions
					.filter((row) => row.localDay === localDay)
					.map((row) =>
						habitLabel(habits.find((habit) => habit.id === row.habitId)),
					);
				const challengeLabels = challengeProgress
					.filter((row) => row.localDay === localDay)
					.map(
						(row) =>
							enrolments.find((candidate) => candidate.id === row.enrolmentId)
								?.title ?? i18n.t("history:day.unknownChallenge"),
					);

				return {
					localDay,
					moodValues: dayObservations
						.filter((row) => row.metricSlug === "mood")
						.map((row) => row.value),
					energyValues: dayObservations
						.filter((row) => row.metricSlug === "energy")
						.map((row) => row.value),
					tagLabels: [...new Set(tags)],
					noteBodies: notes
						.filter((note) => note.localDay === localDay)
						.map((note) => note.body),
					assessmentCount: assessmentIds.size,
					...(uniqueHealthLabels.length > 0
						? { healthLabels: uniqueHealthLabels }
						: {}),
					...(habitLabels.length > 0 ? { habitLabels } : {}),
					...(challengeLabels.length > 0 ? { challengeLabels } : {}),
				};
			});
	}

	async loadDay(localDay: string): Promise<HistoryDay> {
		const previousDay = previousLocalDay(localDay);
		const [
			observations,
			previousObservations,
			notes,
			dailyMetrics,
			previousDailyMetrics,
			preferences,
			habits,
			habitCompletions,
			enrolments,
			challengeProgress,
		] = await Promise.all([
			this.observations.listByDay(localDay),
			this.observations.listByDay(previousDay),
			this.notes.listByDay(localDay),
			this.dailyMetrics.listByDay(localDay),
			this.dailyMetrics.listByDay(previousDay),
			this.unitPreferences.resolveLatestPerDimension(),
			this.habits.listAll(),
			this.habitCompletions.listByDay(localDay),
			this.enrolments.listAll(),
			this.challengeProgress.listByDay(localDay),
		]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const locale = Intl.DateTimeFormat().resolvedOptions().locale;
		const day = assembleHistoryDay(
			localDay,
			observations,
			notes,
			dailyMetrics,
			preferenceByDimension,
			locale,
			habits,
			habitCompletions,
			enrolments,
			challengeProgress,
		);
		return addPreviousDayMeasurementChanges(
			day,
			assembleMeasurements(
				previousDay,
				previousObservations,
				previousDailyMetrics,
				preferenceByDimension,
				locale,
			),
			preferenceByDimension,
			locale,
		);
	}

	async updateCheckIn(
		checkIn: HistoricalCheckIn,
		mood: number,
		optional: Readonly<Record<string, number>> = {},
	): Promise<HistoryDay> {
		await this.db.withTransactionAsync(async () => {
			await this.observations.update(checkIn.mood.id, {
				value: mood,
				scaleMin: checkIn.mood.scaleMin,
				scaleMax: checkIn.mood.scaleMax,
				observedAt: checkIn.mood.observedAt,
				localDay: checkIn.mood.localDay,
				tzOffsetMinutes: checkIn.mood.tzOffsetMinutes,
			});
			for (const score of checkIn.optionalScores) {
				const value = optional[score.metricSlug];
				if (value === undefined) continue;
				await this.observations.update(score.id, {
					value,
					scaleMin: score.scaleMin,
					scaleMax: score.scaleMax,
					observedAt: score.observedAt,
					localDay: score.localDay,
					tzOffsetMinutes: score.tzOffsetMinutes,
				});
			}
		});
		return await this.loadDay(checkIn.mood.localDay);
	}

	async deleteCheckIn(checkIn: HistoricalCheckIn): Promise<HistoryDay> {
		await this.db.withTransactionAsync(async () => {
			await this.observations.delete(checkIn.mood.id);
			for (const score of checkIn.optionalScores) {
				await this.observations.delete(score.id);
			}
		});
		return await this.loadDay(checkIn.mood.localDay);
	}

	async deleteObservation(observation: Observation): Promise<HistoryDay> {
		await this.observations.delete(observation.id);
		return await this.loadDay(observation.localDay);
	}

	async updateNote(note: DayNote, body: string): Promise<HistoryDay> {
		await this.notes.update(note.id, body);
		return await this.loadDay(note.localDay);
	}

	async deleteNote(note: DayNote): Promise<HistoryDay> {
		await this.notes.delete(note.id);
		return await this.loadDay(note.localDay);
	}
}

export function createHistoryStore(): HistoryStore {
	return new HistoryStore(getDb());
}
