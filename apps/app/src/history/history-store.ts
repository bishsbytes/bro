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
import { resolveChallenge } from "@bro/domain/challenge-catalogue";
import { resolveHabit } from "@bro/domain/habit-catalogue";
import { resolveMetric } from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	formatMetricValue,
	metricDisplayUnit,
} from "../health/metric-presentation";
import { isHealthMetricSlug } from "../health/policy";
import { resolveMetricDay } from "../health/resolved-day";

export type HistoryMeasurement = {
	id: string;
	metricSlug: string;
	label: string;
	formattedValue: string;
	source: string;
	selected: boolean;
	observation: Observation | null;
};

export type HistoricalCheckIn = {
	id: string;
	observedAt: number;
	mood: Observation;
	energy: Observation;
};

export type HistoryDay = {
	localDay: string;
	checkIns: HistoricalCheckIn[];
	unpairedScored: Observation[];
	factors: Observation[];
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
	factorLabels: string[];
	noteBodies: string[];
	/** Distinct wheel sittings whose scores landed on this day. */
	assessmentCount: number;
	healthLabels?: string[];
	habitLabels?: string[];
	challengeLabels?: string[];
};

function habitLabel(habit: Habit | undefined): string {
	if (!habit) return "Habit";
	return (
		habit.customLabel ??
		resolveHabit(habit.slug)?.label ??
		habit.slug.replace(/^habit:(?:custom:)?/, "")
	);
}

function pairCheckIns(
	observations: readonly Observation[],
): HistoricalCheckIn[] {
	const moods = observations.filter((row) => row.metricSlug === "mood");
	const energies = observations.filter((row) => row.metricSlug === "energy");
	const pairCount = Math.min(moods.length, energies.length);
	const checkIns: HistoricalCheckIn[] = [];

	for (let index = 0; index < pairCount; index += 1) {
		const mood = moods[index];
		const energy = energies[index];
		checkIns.push({
			id: mood.id,
			observedAt: Math.max(mood.observedAt, energy.observedAt),
			mood,
			energy,
		});
	}

	return checkIns;
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
	const checkIns = pairCheckIns(observations);
	const pairedIds = new Set(
		checkIns.flatMap((checkIn) => [checkIn.mood.id, checkIn.energy.id]),
	);
	const unpairedScored: Observation[] = [];
	const factors: Observation[] = [];
	const assessments: Observation[] = [];
	const measurementObservations: Observation[] = [];
	const unknown: Observation[] = [];

	for (const observation of observations) {
		const resolved = resolveMetric(observation.metricSlug);
		if (resolved.kind === "unknown") {
			unknown.push(observation);
		} else if (resolved.metric.kind === "factor") {
			factors.push(observation);
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
	// Keep the pre-import day view unchanged. Manual measurement provenance is
	// shown here only when there is a tracker row to compare it with.
	const measurementSlugs = new Set(dailyMetrics.map((row) => row.metricSlug));
	const measurements = [...measurementSlugs].flatMap((metricSlug) => {
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
		const userRows = measurementObservations.filter(
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
				formattedValue: formatMetricValue(
					metric,
					observation.value,
					displayUnit,
				),
				source: observation.source,
				selected: selectedIds.has(observation.id),
				observation,
			})),
			...importedRows.map((row) => ({
				id: row.id,
				metricSlug,
				label: metric.label,
				formattedValue: formatMetricValue(metric, row.value, displayUnit),
				source: row.source,
				selected: selectedIds.has(row.id),
				observation: null,
			})),
		];
	});

	return {
		localDay,
		checkIns,
		unpairedScored,
		factors,
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
				title: enrolment?.title ?? "Challenge",
				dayIndex: progress.dayIndex,
				dayTitle: day?.title ?? `Day ${progress.dayIndex}`,
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
				const factors = dayObservations.flatMap((row) => {
					const resolved = resolveMetric(row.metricSlug);
					return resolved.kind === "known" && resolved.metric.kind === "factor"
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
								?.title ?? "Challenge",
					);

				return {
					localDay,
					moodValues: dayObservations
						.filter((row) => row.metricSlug === "mood")
						.map((row) => row.value),
					energyValues: dayObservations
						.filter((row) => row.metricSlug === "energy")
						.map((row) => row.value),
					factorLabels: [...new Set(factors)],
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
		const [
			observations,
			notes,
			dailyMetrics,
			preferences,
			habits,
			habitCompletions,
			enrolments,
			challengeProgress,
		] = await Promise.all([
			this.observations.listByDay(localDay),
			this.notes.listByDay(localDay),
			this.dailyMetrics.listByDay(localDay),
			this.unitPreferences.resolveLatestPerDimension(),
			this.habits.listAll(),
			this.habitCompletions.listByDay(localDay),
			this.enrolments.listAll(),
			this.challengeProgress.listByDay(localDay),
		]);
		return assembleHistoryDay(
			localDay,
			observations,
			notes,
			dailyMetrics,
			new Map(
				preferences.map((preference) => [
					preference.dimension,
					preference.unit,
				]),
			),
			Intl.DateTimeFormat().resolvedOptions().locale,
			habits,
			habitCompletions,
			enrolments,
			challengeProgress,
		);
	}

	async updateCheckIn(
		checkIn: HistoricalCheckIn,
		mood: number,
		energy: number,
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
			await this.observations.update(checkIn.energy.id, {
				value: energy,
				scaleMin: checkIn.energy.scaleMin,
				scaleMax: checkIn.energy.scaleMax,
				observedAt: checkIn.energy.observedAt,
				localDay: checkIn.energy.localDay,
				tzOffsetMinutes: checkIn.energy.tzOffsetMinutes,
			});
		});
		return await this.loadDay(checkIn.mood.localDay);
	}

	async deleteCheckIn(checkIn: HistoricalCheckIn): Promise<HistoryDay> {
		await this.db.withTransactionAsync(async () => {
			await this.observations.delete(checkIn.mood.id);
			await this.observations.delete(checkIn.energy.id);
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
