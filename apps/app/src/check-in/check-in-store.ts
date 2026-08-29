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
	CONFIGURABLE_CHECK_IN_METRIC_SLUGS,
	DEFAULT_TRACKED_METRICS,
	type ScoredMetricDefinition,
	TAG_PRESENCE_VALUE,
	type TagMetricDefinition,
} from "@bro/domain/metric-registry";
import {
	coveredTagSlugs,
	type MeasurementPresentation,
	toMeasurementPresentation,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { listTags, resolveMetric } from "../content";
import { i18n } from "../i18n";
import {
	refreshReminderNotifications,
	reportReminderRefreshFailure,
} from "../reminders/reminder-materialiser";
import { unitWords } from "../units/unit-words";

export type CheckInEntry = {
	id: string;
	observedAt: number;
	mood: Observation;
	optionalScores: Observation[];
};

export type TodayCheckIn = {
	localDay: string;
	entries: CheckInEntry[];
	availableOptionalScores: ScoredMetricDefinition[];
	selectedTagSlugs: string[];
	availableTags: TagMetricDefinition[];
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
	optional?: Readonly<Record<string, number>>;
};

const optionalScoreSlugs = new Set<string>(CONFIGURABLE_CHECK_IN_METRIC_SLUGS);

function groupCheckIns(observations: readonly Observation[]): CheckInEntry[] {
	const moods = observations.filter((row) => row.metricSlug === "mood");
	const usedScoreIds = new Set<string>();
	const entries: CheckInEntry[] = [];

	for (const mood of moods) {
		const optionalScores = observations.filter(
			(row) =>
				optionalScoreSlugs.has(row.metricSlug) &&
				!usedScoreIds.has(row.id) &&
				(row.sourceRecordId === mood.id ||
					(row.sourceRecordId === null && row.observedAt === mood.observedAt)),
		);
		for (const score of optionalScores) usedScoreIds.add(score.id);
		entries.push({
			id: mood.id,
			observedAt: Math.max(
				mood.observedAt,
				...optionalScores.map((score) => score.observedAt),
			),
			mood,
			optionalScores,
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
	const values: (readonly [string, number])[] = [["Mood", scores.mood]];
	values.push(
		...Object.entries(scores.optional ?? {}).map(([slug, value]) => {
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
	);
	for (const [label, value] of values) {
		if (!Number.isInteger(value) || value < 1 || value > 5) {
			throw new RangeError(
				i18n.t("validation:checkIn.scoreRange", { score: label }),
			);
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
		const availableOptionalScores = CONFIGURABLE_CHECK_IN_METRIC_SLUGS.flatMap(
			(slug) => {
				if (!enabledSlugs.has(slug)) return [];
				const resolved = resolveMetric(slug);
				return resolved.kind === "known" && resolved.metric.kind === "scored"
					? [resolved.metric]
					: [];
			},
		);
		// A tag an active habit already records is tapped in Habits, not here:
		// showing both tags would ask the same question twice a day.
		const covered = coveredTagSlugs(activeHabits);
		const availableTags = listTags().filter(
			(tag) => enabledSlugs.has(tag.slug) && !covered.has(tag.slug),
		);
		const tagSlugs = new Set(availableTags.map((tag) => tag.slug));
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
									inputLocale,
									unitWords(),
								),
							},
						]
					: [];
			},
		);

		return {
			localDay,
			entries: groupCheckIns(observations),
			availableOptionalScores,
			selectedTagSlugs: [
				...new Set(
					observations
						.filter((row) => tagSlugs.has(row.metricSlug))
						.map((row) => row.metricSlug),
				),
			],
			availableTags,
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
	 * Records one check-in rooted in Mood, plus whichever configurable scores
	 * are active. The rows are written together and the reminder schedule is
	 * refreshed afterwards because Mood marks the day as checked in.
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
				for (const [metricSlug, value] of Object.entries(
					draft.optional ?? {},
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
			for (const [metricSlug, value] of Object.entries(draft.optional ?? {})) {
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
	 * Replaces the day's whole tag set. Tags describe the day rather than
	 * any one check-in, so callers pass everything currently selected and the
	 * day is reconciled to match.
	 */
	async saveDayTags(
		selectedTagSlugs: readonly string[],
	): Promise<TodayCheckIn> {
		for (const slug of selectedTagSlugs) {
			const resolved = resolveMetric(slug);
			if (resolved.kind !== "known" || resolved.metric.kind !== "tag") {
				throw new TypeError(`Unknown tag slug: ${slug}`);
			}
		}
		const capturedAt = this.now();
		const observedAt = capturedAt.getTime();
		const localDay = localDayOf(capturedAt);
		const tzOffsetMinutes = capturedAt.getTimezoneOffset();
		const selected = new Set(selectedTagSlugs);

		await this.db.withTransactionAsync(async () => {
			const [tracked, activeHabits] = await Promise.all([
				this.trackedMetrics.listResolved(DEFAULT_TRACKED_METRICS),
				this.habits.listActive(),
			]);
			// Covered tags are not active here, which keeps them out of the
			// panel's authority twice over: they cannot be passed in, and
			// reconciliation will not delete the row their habit owns.
			const covered = coveredTagSlugs(activeHabits);
			const activeTagSlugs = new Set(
				tracked
					.filter((metric) => {
						const resolved = resolveMetric(metric.metricSlug);
						return (
							metric.enabled &&
							!covered.has(metric.metricSlug) &&
							resolved.kind === "known" &&
							resolved.metric.kind === "tag"
						);
					})
					.map((metric) => metric.metricSlug),
			);
			for (const slug of selected) {
				if (!activeTagSlugs.has(slug)) {
					throw new TypeError(`Tag is not active today: ${slug}`);
				}
			}
			await this.reconcileTags(
				localDay,
				observedAt,
				tzOffsetMinutes,
				activeTagSlugs,
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

	private async reconcileTags(
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
					resolved.metric.kind === "tag"
				);
			},
		);
		const kept = new Set<string>();

		for (const tag of current) {
			if (!selected.has(tag.metricSlug) || kept.has(tag.metricSlug)) {
				await this.observations.delete(tag.id);
			} else {
				kept.add(tag.metricSlug);
			}
		}

		for (const slug of selected) {
			if (kept.has(slug)) {
				continue;
			}
			await this.observations.create({
				metricSlug: slug,
				value: TAG_PRESENCE_VALUE,
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
