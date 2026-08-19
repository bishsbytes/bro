import {
	ChallengeEnrolmentRepository,
	ChallengeProgressRepository,
	createUuidV7,
	type DailyMetric,
	DailyMetricRepository,
	getDb,
	type Habit,
	HabitCompletionRepository,
	HabitRepository,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
} from "@bro/database-app";
import { shiftLocalDay } from "@bro/domain";
import {
	type ChallengeDay,
	resolveChallenge,
} from "@bro/domain/challenge-catalogue";
import {
	HABIT_CATALOGUE,
	type HabitTemplate,
	resolveHabit,
} from "@bro/domain/habit-catalogue";
import {
	DEFAULT_LIFE_AREA_METRICS,
	resolveLifeAreas,
} from "@bro/domain/life-area-catalogue";
import {
	deriveHabitAdherence,
	deriveHabitStreak,
	type HabitAdherenceDay,
	type HealthMetricSlug,
	isHabitScheduled,
	isHealthMetricSlug,
	isMetricHabitComplete,
	localDayAt,
	resolveChallengePosition,
	resolveMetricDay,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";

export type TodayHabit = {
	habit: Habit;
	label: string;
	completed: boolean;
	streak: number;
	progressLabel: string | null;
};

export type TodayChallenge = {
	enrolmentId: string;
	challengeSlug: string;
	title: string;
	dayIndex: number;
	durationDays: number;
	dayTitle: string;
	action: string;
};

export type TodayHabitsSnapshot = {
	localDay: string;
	hasHabits: boolean;
	habits: TodayHabit[];
	challenges: TodayChallenge[];
};

export type HabitSettingsItem = {
	habit: Habit;
	label: string;
	template: HabitTemplate | null;
};

export type HabitCatalogueGroup = {
	areaSlug: string;
	areaLabel: string;
	more: boolean;
	habits: HabitTemplate[];
};

export type HabitSettingsSnapshot = {
	active: HabitSettingsItem[];
	groups: HabitCatalogueGroup[];
};

export type HabitDetail = {
	habit: Habit;
	label: string;
	fromLocalDay: string;
	throughLocalDay: string;
	days: HabitAdherenceDay[];
};

export type HabitEditorDraft = {
	label: string;
	daysOfWeek: number;
	targetValue: number | null;
};

export type ChallengeDetail = {
	enrolmentId: string;
	challengeSlug: string;
	title: string;
	durationDays: number;
	areaSlug: string;
	startedOn: string;
	completedAt: number | null;
	abandonedAt: number | null;
	completedDayIndexes: number[];
	nextDayIndex: number | null;
	isFinished: boolean;
	currentDay: ChallengeDay | null;
	contentAvailable: boolean;
};

function systemTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function displayLabel(habit: Habit): string {
	return (
		habit.customLabel ??
		resolveHabit(habit.slug)?.label ??
		habit.slug.replace(/^habit:(?:custom:)?/, "")
	);
}

function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3_600);
	const minutes = Math.round((seconds - hours * 3_600) / 60);
	return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function formatProgress(habit: Habit, value: number | null): string | null {
	if (habit.kind !== "metric" || habit.targetValue === null) return null;
	if (habit.metricSlug === "steps") {
		return `${Math.round(value ?? 0).toLocaleString("en-GB")} / ${Math.round(
			habit.targetValue,
		).toLocaleString("en-GB")} steps`;
	}
	if (habit.metricSlug === "sleep_duration") {
		return `${formatDuration(value ?? 0)} / ${formatDuration(habit.targetValue)}`;
	}
	return `${value ?? 0} / ${habit.targetValue}`;
}

function habitUpdateInput(habit: Habit) {
	return {
		customLabel: habit.customLabel,
		targetValue: habit.targetValue,
		daysOfWeek: habit.daysOfWeek,
		position: habit.position,
	};
}

function nextHabitPosition(habits: readonly Habit[]): number {
	return (
		habits.reduce((highest, habit) => Math.max(highest, habit.position), -1) + 1
	);
}

export class HabitsStore {
	private readonly habits: HabitRepository;
	private readonly completions: HabitCompletionRepository;
	private readonly enrolments: ChallengeEnrolmentRepository;
	private readonly progress: ChallengeProgressRepository;
	private readonly observations: ObservationRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly timeZone: () => string = systemTimeZone,
	) {
		const nowMs = () => this.now().getTime();
		this.habits = new HabitRepository(db, { now: nowMs });
		this.completions = new HabitCompletionRepository(db, { now: nowMs });
		this.enrolments = new ChallengeEnrolmentRepository(db, { now: nowMs });
		this.progress = new ChallengeProgressRepository(db, { now: nowMs });
		this.observations = new ObservationRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
	}

	private today(): string {
		return localDayAt(this.now().getTime(), this.timeZone());
	}

	private async metricDayValues(
		metricSlug: HealthMetricSlug,
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<(localDay: string) => number | null> {
		const [observations, metrics] = await Promise.all([
			this.observations.listByMetricAndDayRange(
				metricSlug,
				fromLocalDay,
				throughLocalDay,
			),
			this.dailyMetrics.listByMetric(metricSlug),
		]);
		const observationsByDay = new Map<string, Observation[]>();
		for (const row of observations) {
			const rows = observationsByDay.get(row.localDay);
			if (rows) rows.push(row);
			else observationsByDay.set(row.localDay, [row]);
		}
		const metricsByDay = new Map<string, DailyMetric[]>();
		for (const row of metrics) {
			const rows = metricsByDay.get(row.localDay);
			if (rows) rows.push(row);
			else metricsByDay.set(row.localDay, [row]);
		}
		const resolvedValues = new Map<string, number | null>();
		return (localDay) => {
			let value = resolvedValues.get(localDay);
			if (!resolvedValues.has(localDay)) {
				value = resolveMetricDay(
					metricSlug,
					localDay,
					observationsByDay.get(localDay) ?? [],
					metricsByDay.get(localDay) ?? [],
				).value;
				resolvedValues.set(localDay, value ?? null);
			}
			return value ?? null;
		};
	}

	async loadToday(localDay = this.today()): Promise<TodayHabitsSnapshot> {
		const [activeHabits, activeEnrolments] = await Promise.all([
			this.habits.listActive(),
			this.enrolments.listActive(),
		]);
		const scheduled = activeHabits.filter((habit) =>
			isHabitScheduled(localDay, habit.daysOfWeek),
		);
		const habitCards = await Promise.all(
			scheduled.map(async (habit): Promise<TodayHabit> => {
				const startedOn = localDayAt(habit.addedAt, this.timeZone());
				if (habit.kind === "manual") {
					const rows = await this.completions.listByHabit(habit.id);
					const completedDays = new Set(rows.map((row) => row.localDay));
					return {
						habit,
						label: displayLabel(habit),
						completed: completedDays.has(localDay),
						streak: deriveHabitStreak({
							startedOn,
							todayLocalDay: localDay,
							daysOfWeek: habit.daysOfWeek,
							isComplete: (day) => completedDays.has(day),
						}),
						progressLabel: null,
					};
				}

				const metricSlug = habit.metricSlug;
				if (!metricSlug || !isHealthMetricSlug(metricSlug)) {
					throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
				}
				const metricValue = await this.metricDayValues(
					metricSlug,
					startedOn,
					localDay,
				);
				const complete = (day: string) =>
					isMetricHabitComplete(habit, {
						metricSlug,
						value: metricValue(day),
					});
				return {
					habit,
					label: displayLabel(habit),
					completed: complete(localDay),
					streak: deriveHabitStreak({
						startedOn,
						todayLocalDay: localDay,
						daysOfWeek: habit.daysOfWeek,
						isComplete: complete,
					}),
					progressLabel: formatProgress(habit, metricValue(localDay)),
				};
			}),
		);

		const challengeCards = await Promise.all(
			activeEnrolments.map(async (enrolment): Promise<TodayChallenge> => {
				const rows = await this.progress.listByEnrolment(enrolment.id);
				const position = resolveChallengePosition(
					enrolment.durationDays,
					rows.map((row) => row.dayIndex),
				);
				const dayIndex = position.nextDayIndex ?? enrolment.durationDays;
				const day = resolveChallenge(enrolment.challengeSlug)?.days.find(
					(candidate) => candidate.day === dayIndex,
				);
				return {
					enrolmentId: enrolment.id,
					challengeSlug: enrolment.challengeSlug,
					title: enrolment.title,
					dayIndex,
					durationDays: enrolment.durationDays,
					dayTitle: day?.title ?? `Day ${dayIndex}`,
					action: day?.action ?? "Open the challenge to review this step.",
				};
			}),
		);

		return {
			localDay,
			hasHabits: activeHabits.length > 0,
			habits: habitCards,
			challenges: challengeCards,
		};
	}

	async toggleManual(habitId: string, localDay: string): Promise<void> {
		const existing = await this.completions.findByHabitDay(habitId, localDay);
		if (existing) await this.completions.uncomplete(habitId, localDay);
		else await this.completions.complete(habitId, localDay);
	}

	async loadSettings(): Promise<HabitSettingsSnapshot> {
		const [activeHabits, overlays] = await Promise.all([
			this.habits.listActive(),
			this.trackedMetrics.listResolved(DEFAULT_LIFE_AREA_METRICS),
		]);
		const active = activeHabits.map((habit) => ({
			habit,
			label: displayLabel(habit),
			template: resolveHabit(habit.slug),
		}));
		const activeSlugs = new Set(activeHabits.map((habit) => habit.slug));
		const areas = resolveLifeAreas(overlays);
		const groups = areas
			.map(
				(area): HabitCatalogueGroup => ({
					areaSlug: area.slug,
					areaLabel: area.label,
					more: !area.enabled,
					habits: HABIT_CATALOGUE.filter(
						(habit) =>
							habit.areaSlug === area.slug && !activeSlugs.has(habit.slug),
					),
				}),
			)
			.filter((group) => group.habits.length > 0)
			.sort((left, right) => Number(left.more) - Number(right.more));
		return { active, groups };
	}

	async loadHabitDetail(id: string): Promise<HabitDetail | null> {
		const habit = await this.habits.findById(id);
		if (!habit) return null;
		const throughLocalDay = this.today();
		const fromLocalDay = shiftLocalDay(throughLocalDay, -55);
		const startedOn = localDayAt(habit.addedAt, this.timeZone());
		const removedOn =
			habit.removedAt === null
				? null
				: localDayAt(habit.removedAt, this.timeZone());

		if (habit.kind === "manual") {
			const completions = await this.completions.listByHabit(habit.id);
			return {
				habit,
				label: displayLabel(habit),
				fromLocalDay,
				throughLocalDay,
				days: deriveHabitAdherence({
					habit,
					fromLocalDay,
					throughLocalDay,
					startedOn,
					removedOn,
					completedDays: new Set(completions.map((row) => row.localDay)),
				}),
			};
		}

		const metricSlug = habit.metricSlug;
		if (!metricSlug || !isHealthMetricSlug(metricSlug)) {
			throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
		}
		const metricValue = await this.metricDayValues(
			metricSlug,
			fromLocalDay,
			throughLocalDay,
		);
		return {
			habit,
			label: displayLabel(habit),
			fromLocalDay,
			throughLocalDay,
			days: deriveHabitAdherence({
				habit,
				fromLocalDay,
				throughLocalDay,
				startedOn,
				removedOn,
				metricValue,
			}),
		};
	}

	async addTemplate(
		template: HabitTemplate,
		draft: HabitEditorDraft,
	): Promise<Habit> {
		const defaultLabel = template.label;
		const active = await this.habits.listActive();
		return await this.habits.create({
			slug: template.slug,
			customLabel:
				draft.label.trim() === defaultLabel ? null : draft.label.trim(),
			kind: template.kind,
			metricSlug: template.metricSlug,
			direction: template.direction,
			targetValue: template.kind === "metric" ? draft.targetValue : null,
			daysOfWeek: draft.daysOfWeek,
			position: nextHabitPosition(active),
		});
	}

	async addCustom(draft: HabitEditorDraft): Promise<Habit> {
		const label = draft.label.trim();
		if (!label) throw new TypeError("Custom habit label must not be empty.");
		const timestamp = this.now().getTime();
		const active = await this.habits.listActive();
		return await this.habits.create({
			slug: `habit:custom:${createUuidV7(timestamp)}`,
			customLabel: label,
			kind: "manual",
			metricSlug: null,
			direction: null,
			targetValue: null,
			daysOfWeek: draft.daysOfWeek,
			position: nextHabitPosition(active),
		});
	}

	async updateHabit(habit: Habit, draft: HabitEditorDraft): Promise<Habit> {
		const template = resolveHabit(habit.slug);
		const updated = await this.habits.update(habit.id, {
			customLabel:
				template && draft.label.trim() === template.label
					? null
					: draft.label.trim(),
			targetValue: habit.kind === "metric" ? draft.targetValue : null,
			daysOfWeek: draft.daysOfWeek,
			position: habit.position,
		});
		if (!updated) throw new Error(`Habit not found: ${habit.id}`);
		return updated;
	}

	async removeHabit(id: string): Promise<void> {
		await this.habits.remove(id);
	}

	async moveHabit(id: string, offset: -1 | 1): Promise<void> {
		const active = await this.habits.listActive();
		const index = active.findIndex((habit) => habit.id === id);
		const habit = active[index];
		const neighbour = active[index + offset];
		if (!habit || !neighbour) return;
		await this.db.withTransactionAsync(async () => {
			await this.habits.update(habit.id, {
				...habitUpdateInput(habit),
				position: neighbour.position,
			});
			await this.habits.update(neighbour.id, {
				...habitUpdateInput(neighbour),
				position: habit.position,
			});
		});
	}

	/**
	 * Idempotent by design: Start on an already-open slug resumes that run.
	 * The repository still rejects a genuine concurrent double enrolment.
	 */
	async startChallenge(challengeSlug: string) {
		const active = (await this.enrolments.listActive()).find(
			(enrolment) => enrolment.challengeSlug === challengeSlug,
		);
		if (active) return active;
		const challenge = resolveChallenge(challengeSlug);
		if (!challenge) throw new Error(`Challenge not found: ${challengeSlug}`);
		return await this.enrolments.enrol({
			challengeSlug: challenge.slug,
			title: challenge.title,
			durationDays: challenge.durationDays,
			areaSlug: challenge.areaSlug,
			startedOn: this.today(),
		});
	}

	async loadChallenge(enrolmentId: string): Promise<ChallengeDetail | null> {
		const enrolment = await this.enrolments.findById(enrolmentId);
		if (!enrolment) return null;
		const rows = await this.progress.listByEnrolment(enrolmentId);
		const position = resolveChallengePosition(
			enrolment.durationDays,
			rows.map((row) => row.dayIndex),
		);
		const template = resolveChallenge(enrolment.challengeSlug);
		return {
			enrolmentId,
			challengeSlug: enrolment.challengeSlug,
			title: enrolment.title,
			durationDays: enrolment.durationDays,
			areaSlug: enrolment.areaSlug,
			startedOn: enrolment.startedOn,
			completedAt: enrolment.completedAt,
			abandonedAt: enrolment.abandonedAt,
			completedDayIndexes: rows.map((row) => row.dayIndex),
			nextDayIndex: position.nextDayIndex,
			isFinished: position.isFinished || enrolment.completedAt !== null,
			currentDay:
				template?.days.find((day) => day.day === position.nextDayIndex) ?? null,
			contentAvailable: template !== null,
		};
	}

	async completeChallengeDay(
		enrolmentId: string,
		dayIndex: number,
		localDay = this.today(),
	): Promise<ChallengeDetail> {
		await this.progress.completeDay(enrolmentId, dayIndex, localDay);
		const detail = await this.loadChallenge(enrolmentId);
		if (!detail) throw new Error(`Challenge not found: ${enrolmentId}`);
		return detail;
	}

	async abandonChallenge(enrolmentId: string): Promise<ChallengeDetail> {
		await this.enrolments.abandon(enrolmentId);
		const detail = await this.loadChallenge(enrolmentId);
		if (!detail) throw new Error(`Challenge not found: ${enrolmentId}`);
		return detail;
	}
}

export function createHabitsStore(): HabitsStore {
	return new HabitsStore(getDb());
}
