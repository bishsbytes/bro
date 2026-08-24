import {
	ChallengeEnrolmentRepository,
	ChallengeProgressRepository,
	type ConsumptionEntry,
	ConsumptionEntryRepository,
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
	UnitPreferenceRepository,
	withTransaction,
} from "@bro/database-app";
import { isCalendarDay, shiftLocalDay, systemLocale } from "@bro/domain";
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
	FACTOR_PRESENCE_VALUE,
	isConsumptionDerivedMeasurementSlug,
	resolveMetric,
} from "@bro/domain/metric-registry";
import {
	deriveHabitAdherence,
	deriveHabitStreak,
	formatMetricValue,
	type HabitAdherenceDay,
	type HabitMetricSlug,
	habitFactorSlug,
	habitMetricDayValue,
	isHabitMetricSlug,
	isHabitScheduled,
	isMetricHabitComplete,
	localDayAt,
	metricDisplayUnit,
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

export type HabitAdherenceSummaryDay = {
	localDay: string;
	scheduledCount: number;
	completedCount: number;
};

export type HabitSettingsItem = {
	habit: Habit;
	label: string;
	template: HabitTemplate | null;
	areaSlug: string | null;
	areaLabel: string | null;
};

export type HabitCatalogueGroup = {
	areaSlug: string;
	areaLabel: string;
	more: boolean;
	habits: HabitTemplate[];
};

export type HabitAreaOption = {
	slug: string;
	label: string;
};

export type HabitSettingsSnapshot = {
	active: HabitSettingsItem[];
	groups: HabitCatalogueGroup[];
	areas: HabitAreaOption[];
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
	areaSlug: string | null;
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

function formatProgress(
	habit: Habit,
	value: number | null,
	formatValue: ((value: number) => string) | null = null,
): string | null {
	if (habit.kind !== "metric" || habit.targetValue === null) return null;
	if (habit.metricSlug === "steps") {
		return `${Math.round(value ?? 0).toLocaleString("en-GB")} / ${Math.round(
			habit.targetValue,
		).toLocaleString("en-GB")} steps`;
	}
	if (habit.metricSlug === "sleep_duration") {
		return `${formatDuration(value ?? 0)} / ${formatDuration(habit.targetValue)}`;
	}
	if (formatValue) {
		// A zero-target ceiling habit needs no counter on a clean day; the card's
		// completion state already says it. A slip shows what was logged.
		if (habit.direction === "at_most" && habit.targetValue === 0) {
			return (value ?? 0) === 0 ? null : `${formatValue(value ?? 0)} logged`;
		}
		return `${formatValue(value ?? 0)} / ${formatValue(habit.targetValue)}`;
	}
	return `${value ?? 0} / ${habit.targetValue}`;
}

function habitUpdateInput(habit: Habit) {
	return {
		customLabel: habit.customLabel,
		targetValue: habit.targetValue,
		areaSlug: habit.areaSlug,
		daysOfWeek: habit.daysOfWeek,
		position: habit.position,
	};
}

function nextHabitPosition(habits: readonly Habit[]): number {
	return (
		habits.reduce((highest, habit) => Math.max(highest, habit.position), -1) + 1
	);
}

function localDaysInRange(
	fromLocalDay: string,
	throughLocalDay: string,
): string[] {
	if (!isCalendarDay(fromLocalDay) || !isCalendarDay(throughLocalDay)) {
		throw new TypeError(
			"Habit adherence range must use real YYYY-MM-DD dates.",
		);
	}
	if (fromLocalDay > throughLocalDay) {
		throw new RangeError("Habit adherence range must run forwards.");
	}
	const localDays: string[] = [];
	for (
		let localDay = fromLocalDay;
		localDay <= throughLocalDay;
		localDay = shiftLocalDay(localDay, 1)
	) {
		localDays.push(localDay);
	}
	return localDays;
}

export class HabitsStore {
	private readonly habits: HabitRepository;
	private readonly completions: HabitCompletionRepository;
	private readonly enrolments: ChallengeEnrolmentRepository;
	private readonly progress: ChallengeProgressRepository;
	private readonly observations: ObservationRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly consumptionEntries: ConsumptionEntryRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly timeZone: () => string = systemTimeZone,
		private readonly locale: () => string | undefined = systemLocale,
	) {
		const nowMs = () => this.now().getTime();
		this.habits = new HabitRepository(db, { now: nowMs });
		this.completions = new HabitCompletionRepository(db, { now: nowMs });
		this.enrolments = new ChallengeEnrolmentRepository(db, { now: nowMs });
		this.progress = new ChallengeProgressRepository(db, { now: nowMs });
		this.observations = new ObservationRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.consumptionEntries = new ConsumptionEntryRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	private today(): string {
		return localDayAt(this.now().getTime(), this.timeZone());
	}

	private async metricDayValues(
		metricSlug: HabitMetricSlug,
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<(localDay: string) => number | null> {
		if (isConsumptionDerivedMeasurementSlug(metricSlug)) {
			const entries = (await this.consumptionEntries.listAll()).filter(
				(entry) =>
					entry.localDay >= fromLocalDay && entry.localDay <= throughLocalDay,
			);
			const entriesByDay = new Map<string, ConsumptionEntry[]>();
			for (const entry of entries) {
				const rows = entriesByDay.get(entry.localDay);
				if (rows) rows.push(entry);
				else entriesByDay.set(entry.localDay, [entry]);
			}
			return (localDay) =>
				resolveMetricDay(
					metricSlug,
					localDay,
					[],
					[],
					entriesByDay.get(localDay) ?? [],
				).value;
		}
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

	/** Display-unit formatter for a consumption-derived habit metric, else null. */
	private async metricValueFormatter(
		metricSlug: string,
	): Promise<((value: number) => string) | null> {
		const resolved = resolveMetric(metricSlug);
		if (
			resolved.kind !== "known" ||
			resolved.metric.kind !== "measurement" ||
			!isConsumptionDerivedMeasurementSlug(metricSlug)
		) {
			return null;
		}
		const metric = resolved.metric;
		const preferences = await this.unitPreferences.resolveLatestPerDimension();
		const displayUnit = metricDisplayUnit(
			metric,
			new Map(
				preferences.map((preference) => [
					preference.dimension,
					preference.unit,
				]),
			),
			this.locale(),
		);
		return (value) => formatMetricValue(metric, value, displayUnit);
	}

	async loadToday(localDay = this.today()): Promise<TodayHabitsSnapshot> {
		const [activeHabits, activeEnrolments] = await Promise.all([
			this.habits.listActive(),
			this.enrolments.listActive(),
		]);
		const scheduled = activeHabits.filter(
			(habit) =>
				localDay >= localDayAt(habit.addedAt, this.timeZone()) &&
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
				if (!metricSlug || !isHabitMetricSlug(metricSlug)) {
					throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
				}
				const rawValue = await this.metricDayValues(
					metricSlug,
					startedOn,
					localDay,
				);
				const metricValue = (day: string) =>
					habitMetricDayValue(habit, rawValue(day));
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
					progressLabel: formatProgress(
						habit,
						metricValue(localDay),
						await this.metricValueFormatter(metricSlug),
					),
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

	async loadAdherenceRange(
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<HabitAdherenceSummaryDay[]> {
		const localDays = localDaysInRange(fromLocalDay, throughLocalDay);
		const [activeHabits, completionRows] = await Promise.all([
			this.habits.listActive(),
			this.completions.listBetweenDays(fromLocalDay, throughLocalDay),
		]);
		const completedDaysByHabit = new Map<string, Set<string>>();
		for (const completion of completionRows) {
			const completedDays = completedDaysByHabit.get(completion.habitId);
			if (completedDays) completedDays.add(completion.localDay);
			else {
				completedDaysByHabit.set(
					completion.habitId,
					new Set([completion.localDay]),
				);
			}
		}

		const metricSlugs = new Set<HabitMetricSlug>();
		for (const habit of activeHabits) {
			if (habit.kind !== "metric") continue;
			if (!habit.metricSlug || !isHabitMetricSlug(habit.metricSlug)) {
				throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
			}
			metricSlugs.add(habit.metricSlug);
		}
		const metricValues = new Map(
			await Promise.all(
				[...metricSlugs].map(
					async (metricSlug) =>
						[
							metricSlug,
							await this.metricDayValues(
								metricSlug,
								fromLocalDay,
								throughLocalDay,
							),
						] as const,
				),
			),
		);

		const summaries = new Map(
			localDays.map((localDay) => [
				localDay,
				{
					localDay,
					scheduledCount: 0,
					completedCount: 0,
				},
			]),
		);
		for (const habit of activeHabits) {
			const startedOn = localDayAt(habit.addedAt, this.timeZone());
			for (const localDay of localDays) {
				if (
					localDay < startedOn ||
					!isHabitScheduled(localDay, habit.daysOfWeek)
				) {
					continue;
				}
				const summary = summaries.get(localDay);
				if (!summary) continue;
				summary.scheduledCount += 1;

				if (habit.kind === "manual") {
					if (completedDaysByHabit.get(habit.id)?.has(localDay)) {
						summary.completedCount += 1;
					}
					continue;
				}

				const metricSlug = habit.metricSlug;
				if (!metricSlug || !isHabitMetricSlug(metricSlug)) {
					throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
				}
				const rawValue = metricValues.get(metricSlug);
				if (!rawValue) {
					throw new Error(`Metric range was not loaded: ${metricSlug}`);
				}
				if (
					isMetricHabitComplete(habit, {
						metricSlug,
						value: habitMetricDayValue(habit, rawValue(localDay)),
					})
				) {
					summary.completedCount += 1;
				}
			}
		}

		return [...summaries.values()];
	}

	/**
	 * Toggles the day's completion and, where the habit stands in for a check-in
	 * factor, the factor row with it. The two land together or not at all, so a
	 * completed habit never leaves its presence row behind and vice versa.
	 */
	async toggleManual(habitId: string, localDay: string): Promise<void> {
		const habit = await this.habits.findById(habitId);
		const factorSlug = habit === null ? null : habitFactorSlug(habit.slug);

		await withTransaction(this.db, async (scope) => {
			const existing = await this.completions.findByHabitDay(habitId, localDay);
			if (existing) {
				await this.completions.uncomplete(habitId, localDay);
				if (factorSlug !== null) {
					await this.releaseHabitFactor(habitId, factorSlug, localDay);
				}
			} else {
				await this.completions.complete(habitId, localDay, scope);
				if (factorSlug !== null) {
					await this.recordHabitFactor(habitId, factorSlug, localDay);
				}
			}
		});
	}

	/**
	 * Writes the habit's factor presence row for the day, unless the day already
	 * carries that factor. A row the user tapped at check-in is left as it is:
	 * presence is presence, and a second row would only be a duplicate to
	 * collapse later.
	 */
	private async recordHabitFactor(
		habitId: string,
		factorSlug: string,
		localDay: string,
	): Promise<void> {
		const existing = await this.factorRowsForDay(factorSlug, localDay);
		if (existing.length > 0) return;

		const capturedAt = this.now();
		await this.observations.create({
			metricSlug: factorSlug,
			value: FACTOR_PRESENCE_VALUE,
			scaleMin: null,
			scaleMax: null,
			observedAt: capturedAt.getTime(),
			localDay,
			tzOffsetMinutes: capturedAt.getTimezoneOffset(),
			source: "user",
			sourceRecordId: habitId,
			assessmentId: null,
		});
	}

	/**
	 * Removes only the rows this habit wrote. A factor the user tapped
	 * themselves — `sourceRecordId` null, or another habit's id — outlives an
	 * un-complete here, so undoing a habit never deletes a fact it did not
	 * record.
	 */
	private async releaseHabitFactor(
		habitId: string,
		factorSlug: string,
		localDay: string,
	): Promise<void> {
		const rows = await this.factorRowsForDay(factorSlug, localDay);
		for (const row of rows) {
			if (row.sourceRecordId === habitId) {
				await this.observations.delete(row.id);
			}
		}
	}

	private async factorRowsForDay(
		factorSlug: string,
		localDay: string,
	): Promise<Observation[]> {
		const rows = await this.observations.listByDay(localDay);
		return rows.filter((row) => row.metricSlug === factorSlug);
	}

	async loadSettings(): Promise<HabitSettingsSnapshot> {
		const [activeHabits, overlays] = await Promise.all([
			this.habits.listActive(),
			this.trackedMetrics.listResolved(DEFAULT_LIFE_AREA_METRICS),
		]);
		const areas = resolveLifeAreas(overlays);
		const areaLabels = new Map<string, string>(
			areas.map((area) => [area.slug, area.label]),
		);
		const active = activeHabits.map((habit): HabitSettingsItem => {
			const template = resolveHabit(habit.slug);
			const areaSlug = habit.areaSlug ?? template?.areaSlug ?? null;
			return {
				habit,
				label: displayLabel(habit),
				template,
				areaSlug,
				areaLabel: areaSlug ? (areaLabels.get(areaSlug) ?? null) : null,
			};
		});
		const activeSlugs = new Set(activeHabits.map((habit) => habit.slug));
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
		return {
			active,
			groups,
			areas: areas.map((area) => ({ slug: area.slug, label: area.label })),
		};
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
		if (!metricSlug || !isHabitMetricSlug(metricSlug)) {
			throw new TypeError(`Unsupported metric habit: ${habit.metricSlug}`);
		}
		const rawValue = await this.metricDayValues(
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
				metricValue: (day) => habitMetricDayValue(habit, rawValue(day)),
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
			areaSlug: template.areaSlug,
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
			areaSlug: draft.areaSlug,
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
			// A template habit's area stays the authored snapshot; only custom
			// habits let the user classify (and re-classify) the area themselves.
			areaSlug: template ? habit.areaSlug : draft.areaSlug,
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
