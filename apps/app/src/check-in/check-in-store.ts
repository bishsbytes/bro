import {
	DayNoteRepository,
	getDb,
	HabitRepository,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import {
	formatMeasurement,
	isCalendarDay,
	localDayOf,
	resolveUnitPreference,
	systemLocale,
} from "@bro/domain";
import {
	DEFAULT_TRACKED_METRICS,
	FACTOR_PRESENCE_VALUE,
	type FactorMetricDefinition,
	listFactors,
	OPTIONAL_CHECK_IN_METRIC_SLUGS,
	resolveMetric,
	type ScoredMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	coveredFactorSlugs,
	type MeasurementPresentation,
	toMeasurementPresentation,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	refreshReminderNotifications,
	reportReminderRefreshFailure,
} from "../reminders/reminder-materialiser";

export type CheckInEntry = {
	id: string;
	observedAt: number;
	mood: Observation;
	energy: Observation;
	optionalScores: Observation[];
};

export type TodayCheckIn = {
	localDay: string;
	entries: CheckInEntry[];
	availableOptionalScores: ScoredMetricDefinition[];
	selectedFactorSlugs: string[];
	availableFactors: FactorMetricDefinition[];
	availableMeasurements: CheckInMeasurement[];
	loggedMeasurements: LoggedCheckInMeasurement[];
	inputLocale: string | undefined;
	note: string;
};

export type CheckInMeasurement = MeasurementPresentation;

export type LoggedCheckInMeasurement = CheckInMeasurement & {
	observation: Observation;
	formattedValue: string;
};

export type CheckInScores = {
	mood: number;
	energy: number;
	additional?: Readonly<Record<string, number>>;
};

const optionalScoreSlugs = new Set<string>(OPTIONAL_CHECK_IN_METRIC_SLUGS);

function pairCheckIns(observations: readonly Observation[]): CheckInEntry[] {
	const moods = observations.filter((row) => row.metricSlug === "mood");
	const energies = observations.filter((row) => row.metricSlug === "energy");
	const pairCount = Math.min(moods.length, energies.length);
	const entries: CheckInEntry[] = [];

	for (let index = 0; index < pairCount; index += 1) {
		const mood = moods[index];
		const energy = energies[index];
		entries.push({
			id: mood.id,
			observedAt: Math.max(mood.observedAt, energy.observedAt),
			mood,
			energy,
			optionalScores: observations.filter(
				(row) =>
					optionalScoreSlugs.has(row.metricSlug) &&
					(row.sourceRecordId === mood.id ||
						(row.sourceRecordId === null &&
							row.observedAt === mood.observedAt)),
			),
		});
	}

	return entries.reverse();
}

function latestObservation(
	rows: readonly Observation[],
	metricSlug: string,
): Observation | null {
	let latest: Observation | null = null;
	for (const row of rows) {
		if (row.metricSlug !== metricSlug) continue;
		if (
			latest === null ||
			row.observedAt > latest.observedAt ||
			(row.observedAt === latest.observedAt &&
				row.createdAt > latest.createdAt) ||
			(row.observedAt === latest.observedAt &&
				row.createdAt === latest.createdAt &&
				row.id.localeCompare(latest.id) > 0)
		) {
			latest = row;
		}
	}
	return latest;
}

function assertScores(scores: CheckInScores): void {
	for (const [label, value] of [
		["Mood", scores.mood],
		["Energy", scores.energy],
		...Object.entries(scores.additional ?? {}).map(([slug, value]) => {
			const resolved = resolveMetric(slug);
			if (
				!optionalScoreSlugs.has(slug) ||
				resolved.kind !== "known" ||
				resolved.metric.kind !== "scored"
			) {
				throw new TypeError(`Unknown optional check-in score: ${slug}`);
			}
			return [resolved.metric.label, value] as const;
		}),
	] as const) {
		if (!Number.isInteger(value) || value < 1 || value > 5) {
			throw new RangeError(`${label} must be a whole number from 1 to 5.`);
		}
	}
}

export class CheckInStore {
	private readonly observations: ObservationRepository;
	private readonly notes: DayNoteRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;
	private readonly habits: HabitRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
		private readonly refreshReminders: () => Promise<unknown> = () =>
			refreshReminderNotifications(),
	) {
		this.observations = new ObservationRepository(db);
		this.notes = new DayNoteRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
		this.habits = new HabitRepository(db);
	}

	async loadToday(date = this.now()): Promise<TodayCheckIn> {
		const localDay = localDayOf(date);
		const inputLocale = this.locale();
		const [observations, notes, tracked, preferences, activeHabits] =
			await Promise.all([
				this.observations.listByDay(localDay),
				this.notes.listByDay(localDay),
				this.trackedMetrics.listResolved(DEFAULT_TRACKED_METRICS),
				this.unitPreferences.resolveLatestPerDimension(),
				this.habits.listActive(),
			]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const enabledSlugs = new Set(
			tracked
				.filter((metric) => metric.enabled)
				.map((metric) => metric.metricSlug),
		);
		const availableOptionalScores = OPTIONAL_CHECK_IN_METRIC_SLUGS.flatMap(
			(slug) => {
				if (!enabledSlugs.has(slug)) return [];
				const resolved = resolveMetric(slug);
				return resolved.kind === "known" && resolved.metric.kind === "scored"
					? [resolved.metric]
					: [];
			},
		);
		// A factor an active habit already records is tapped in Habits, not here:
		// showing both tags would ask the same question twice a day.
		const covered = coveredFactorSlugs(activeHabits);
		const availableFactors = listFactors().filter(
			(factor) => enabledSlugs.has(factor.slug) && !covered.has(factor.slug),
		);
		const factorSlugs = new Set(availableFactors.map((factor) => factor.slug));
		const resolvedMeasurements = tracked.flatMap((overlay) => {
			const resolved = resolveMetric(overlay.metricSlug);
			if (
				resolved.kind !== "known" ||
				resolved.metric.kind !== "measurement" ||
				!resolved.metric.userEnterable
			) {
				return [];
			}
			const metric = resolved.metric;
			const preferenceDimension =
				metric.unitPreferenceDimension ?? metric.dimension;
			const displayUnit = resolveUnitPreference(
				preferenceDimension,
				preferenceByDimension.get(preferenceDimension),
				inputLocale,
			);
			return [
				{
					measurement: toMeasurementPresentation(
						metric.slug,
						overlay.customLabel ?? metric.label,
						metric.dimension,
						displayUnit,
					),
					enabled: overlay.enabled,
				},
			];
		});
		const loggedMeasurements = resolvedMeasurements.flatMap(
			({ measurement }) => {
				const observation = latestObservation(
					observations,
					measurement.metricSlug,
				);
				return observation
					? [
							{
								...measurement,
								observation,
								formattedValue: formatMeasurement(
									observation.value,
									measurement.dimension,
									measurement.displayUnit,
								),
							},
						]
					: [];
			},
		);

		return {
			localDay,
			entries: pairCheckIns(observations),
			availableOptionalScores,
			selectedFactorSlugs: [
				...new Set(
					observations
						.filter((row) => factorSlugs.has(row.metricSlug))
						.map((row) => row.metricSlug),
				),
			],
			availableFactors,
			availableMeasurements: resolvedMeasurements.flatMap(
				({ measurement, enabled }) => (enabled ? [measurement] : []),
			),
			loggedMeasurements,
			inputLocale,
			note: notes[0]?.body ?? "",
		};
	}

	async loadCheckInDays(
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<Set<string>> {
		if (!isCalendarDay(fromLocalDay) || !isCalendarDay(throughLocalDay)) {
			throw new TypeError("Check-in range must use real YYYY-MM-DD dates.");
		}
		if (fromLocalDay > throughLocalDay) {
			throw new RangeError("Check-in range must run forwards.");
		}
		const moods = await this.observations.listByMetricAndDayRange(
			"mood",
			fromLocalDay,
			throughLocalDay,
		);
		return new Set(moods.map((mood) => mood.localDay));
	}

	/**
	 * Records one mood-and-energy pair. The two rows are written together so a
	 * check-in never exists half-scored, and the reminder schedule is refreshed
	 * afterwards because only this pair marks the day as checked in.
	 */
	async saveCheckIn(
		draft: CheckInScores,
		entry: CheckInEntry | null = null,
	): Promise<TodayCheckIn> {
		assertScores(draft);
		const capturedAt = this.now();
		const observedAt = capturedAt.getTime();
		const localDay = localDayOf(capturedAt);
		const tzOffsetMinutes = capturedAt.getTimezoneOffset();

		await this.db.withTransactionAsync(async () => {
			if (entry) {
				// An edit rewrites the value, never the row's scale snapshot: rows
				// recorded under an older scale must keep the bounds they were
				// scored on.
				await this.observations.update(entry.mood.id, {
					value: draft.mood,
					scaleMin: entry.mood.scaleMin,
					scaleMax: entry.mood.scaleMax,
					observedAt: entry.mood.observedAt,
					localDay: entry.mood.localDay,
					tzOffsetMinutes: entry.mood.tzOffsetMinutes,
				});
				await this.observations.update(entry.energy.id, {
					value: draft.energy,
					scaleMin: entry.energy.scaleMin,
					scaleMax: entry.energy.scaleMax,
					observedAt: entry.energy.observedAt,
					localDay: entry.energy.localDay,
					tzOffsetMinutes: entry.energy.tzOffsetMinutes,
				});
				for (const [metricSlug, value] of Object.entries(
					draft.additional ?? {},
				)) {
					const existing = entry.optionalScores.find(
						(row) => row.metricSlug === metricSlug,
					);
					if (existing) {
						await this.observations.update(existing.id, {
							value,
							scaleMin: existing.scaleMin,
							scaleMax: existing.scaleMax,
							observedAt: existing.observedAt,
							localDay: existing.localDay,
							tzOffsetMinutes: existing.tzOffsetMinutes,
						});
					} else {
						await this.observations.create({
							metricSlug,
							value,
							scaleMin: 1,
							scaleMax: 5,
							observedAt: entry.mood.observedAt,
							localDay: entry.mood.localDay,
							tzOffsetMinutes: entry.mood.tzOffsetMinutes,
							source: "user",
							sourceRecordId: entry.id,
							assessmentId: null,
						});
					}
				}
				return;
			}
			const mood = await this.observations.create({
				metricSlug: "mood",
				value: draft.mood,
				scaleMin: 1,
				scaleMax: 5,
				observedAt,
				localDay,
				tzOffsetMinutes,
				source: "user",
				sourceRecordId: null,
				assessmentId: null,
			});
			await this.observations.create({
				metricSlug: "energy",
				value: draft.energy,
				scaleMin: 1,
				scaleMax: 5,
				observedAt,
				localDay,
				tzOffsetMinutes,
				source: "user",
				sourceRecordId: null,
				assessmentId: null,
			});
			for (const [metricSlug, value] of Object.entries(
				draft.additional ?? {},
			)) {
				await this.observations.create({
					metricSlug,
					value,
					scaleMin: 1,
					scaleMax: 5,
					observedAt,
					localDay,
					tzOffsetMinutes,
					source: "user",
					sourceRecordId: mood.id,
					assessmentId: null,
				});
			}
		});

		const today = await this.loadToday(capturedAt);
		// The product transaction has committed. Notification reconciliation is a
		// derived install-local side effect and must never make that durable save
		// appear to have failed.
		await this.refreshReminders().catch(reportReminderRefreshFailure);
		return today;
	}

	/**
	 * Replaces the day's whole factor set. Factors describe the day rather than
	 * any one check-in, so callers pass everything currently selected and the
	 * day is reconciled to match.
	 */
	async saveDayFactors(
		selectedFactorSlugs: readonly string[],
	): Promise<TodayCheckIn> {
		for (const slug of selectedFactorSlugs) {
			const resolved = resolveMetric(slug);
			if (resolved.kind !== "known" || resolved.metric.kind !== "factor") {
				throw new TypeError(`Unknown factor slug: ${slug}`);
			}
		}
		const capturedAt = this.now();
		const observedAt = capturedAt.getTime();
		const localDay = localDayOf(capturedAt);
		const tzOffsetMinutes = capturedAt.getTimezoneOffset();
		const selected = new Set(selectedFactorSlugs);

		await this.db.withTransactionAsync(async () => {
			const [tracked, activeHabits] = await Promise.all([
				this.trackedMetrics.listResolved(DEFAULT_TRACKED_METRICS),
				this.habits.listActive(),
			]);
			// Covered factors are not active here, which keeps them out of the
			// panel's authority twice over: they cannot be passed in, and
			// reconciliation will not delete the row their habit owns.
			const covered = coveredFactorSlugs(activeHabits);
			const activeFactorSlugs = new Set(
				tracked
					.filter((metric) => {
						const resolved = resolveMetric(metric.metricSlug);
						return (
							metric.enabled &&
							!covered.has(metric.metricSlug) &&
							resolved.kind === "known" &&
							resolved.metric.kind === "factor"
						);
					})
					.map((metric) => metric.metricSlug),
			);
			for (const slug of selected) {
				if (!activeFactorSlugs.has(slug)) {
					throw new TypeError(`Factor is not active today: ${slug}`);
				}
			}
			await this.reconcileFactors(
				localDay,
				observedAt,
				tzOffsetMinutes,
				activeFactorSlugs,
				selected,
			);
		});

		return await this.loadToday(capturedAt);
	}

	/** Replaces the day's single note; an empty body clears it. */
	async saveDayNote(note: string): Promise<TodayCheckIn> {
		const capturedAt = this.now();
		const localDay = localDayOf(capturedAt);

		if (note.trim().length > 0) {
			await this.notes.upsertForDay(localDay, note);
		} else {
			// The form prefills the day's note, so an emptied field is an explicit
			// clear of the note the user was shown — not an absent one.
			const [uiNote] = await this.notes.listByDay(localDay);
			if (uiNote) {
				await this.notes.delete(uiNote.id);
			}
		}

		return await this.loadToday(capturedAt);
	}

	private async reconcileFactors(
		localDay: string,
		observedAt: number,
		tzOffsetMinutes: number,
		active: ReadonlySet<string>,
		selected: ReadonlySet<string>,
	): Promise<void> {
		const current = (await this.observations.listByDay(localDay)).filter(
			(row) => {
				const resolved = resolveMetric(row.metricSlug);
				return (
					active.has(row.metricSlug) &&
					resolved.kind === "known" &&
					resolved.metric.kind === "factor"
				);
			},
		);
		const kept = new Set<string>();

		for (const factor of current) {
			if (!selected.has(factor.metricSlug) || kept.has(factor.metricSlug)) {
				await this.observations.delete(factor.id);
			} else {
				kept.add(factor.metricSlug);
			}
		}

		for (const slug of selected) {
			if (kept.has(slug)) {
				continue;
			}
			await this.observations.create({
				metricSlug: slug,
				value: FACTOR_PRESENCE_VALUE,
				scaleMin: null,
				scaleMax: null,
				observedAt,
				localDay,
				tzOffsetMinutes,
				source: "user",
				sourceRecordId: null,
				assessmentId: null,
			});
		}
	}
}

export function createCheckInStore(): CheckInStore {
	return new CheckInStore(getDb());
}
