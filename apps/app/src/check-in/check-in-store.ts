import {
	DayNoteRepository,
	getDb,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	DEFAULT_TRACKED_METRICS,
	FACTOR_PRESENCE_VALUE,
	type FactorMetricDefinition,
	listFactors,
	type MeasurementSlug,
	resolveMetric,
} from "../content/metric-registry";
import { refreshReminderNotifications } from "../reminders/reminder-materialiser";
import {
	type Dimension,
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForDimension,
	resolveDisplayUnit,
} from "../units";

export type CheckInEntry = {
	id: string;
	observedAt: number;
	mood: Observation;
	energy: Observation;
};

export type TodayCheckIn = {
	localDay: string;
	entries: CheckInEntry[];
	selectedFactorSlugs: string[];
	availableFactors: FactorMetricDefinition[];
	availableMeasurements: CheckInMeasurement[];
	loggedMeasurements: LoggedCheckInMeasurement[];
	inputLocale: string | undefined;
	note: string;
};

type CheckInMeasurementBase = {
	metricSlug: MeasurementSlug;
	label: string;
};

export type CheckInMeasurement =
	| (CheckInMeasurementBase & {
			dimension: "mass";
			displayUnit: "kg" | "lb" | "st";
	  })
	| (CheckInMeasurementBase & {
			dimension: "length";
			displayUnit: "cm" | "in";
	  })
	| (CheckInMeasurementBase & {
			dimension: "fraction";
			displayUnit: "%";
	  });

export type LoggedCheckInMeasurement = CheckInMeasurement & {
	observation: Observation;
	formattedValue: string;
};

export type CheckInMeasurementDraft = {
	metricSlug: string;
	value: number;
};

export type CheckInDraft = {
	mood: number;
	energy: number;
	selectedFactorSlugs: readonly string[];
	measurements: readonly CheckInMeasurementDraft[];
	note: string;
};

export function localDayOf(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

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
		});
	}

	return entries.reverse();
}

function systemLocale(): string | undefined {
	try {
		return Intl.DateTimeFormat().resolvedOptions().locale;
	} catch {
		return undefined;
	}
}

function toCheckInMeasurement(
	metricSlug: MeasurementSlug,
	label: string,
	dimension: Dimension,
	displayUnit: DisplayUnit,
): CheckInMeasurement {
	if (
		dimension === "mass" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return {
			metricSlug,
			label,
			dimension,
			displayUnit,
		};
	}
	if (
		dimension === "length" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return {
			metricSlug,
			label,
			dimension,
			displayUnit,
		};
	}
	if (
		dimension === "fraction" &&
		isDisplayUnitForDimension(dimension, displayUnit)
	) {
		return { metricSlug, label, dimension, displayUnit };
	}
	throw new TypeError(`Unit ${displayUnit} does not measure ${dimension}.`);
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

function assertDraft(draft: CheckInDraft): void {
	for (const [label, value] of [
		["Mood", draft.mood],
		["Energy", draft.energy],
	] as const) {
		if (!Number.isInteger(value) || value < 1 || value > 5) {
			throw new RangeError(`${label} must be a whole number from 1 to 5.`);
		}
	}

	for (const slug of draft.selectedFactorSlugs) {
		const resolved = resolveMetric(slug);
		if (resolved.kind !== "known" || resolved.metric.kind !== "factor") {
			throw new TypeError(`Unknown factor slug: ${slug}`);
		}
	}

	const measurementSlugs = new Set<string>();
	for (const measurement of draft.measurements) {
		const resolved = resolveMetric(measurement.metricSlug);
		if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
			throw new TypeError(
				`Unknown measurement slug: ${measurement.metricSlug}`,
			);
		}
		if (measurementSlugs.has(measurement.metricSlug)) {
			throw new TypeError(
				`Measurement appears more than once: ${measurement.metricSlug}`,
			);
		}
		if (!Number.isFinite(measurement.value) || measurement.value < 0) {
			throw new RangeError(
				"Measurement values must be finite and non-negative.",
			);
		}
		if (resolved.metric.dimension === "fraction" && measurement.value > 1) {
			throw new RangeError(
				"Fraction measurements must be between zero and one.",
			);
		}
		measurementSlugs.add(measurement.metricSlug);
	}
}

export class CheckInStore {
	private readonly observations: ObservationRepository;
	private readonly notes: DayNoteRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.observations = new ObservationRepository(db);
		this.notes = new DayNoteRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async loadToday(date = this.now()): Promise<TodayCheckIn> {
		const localDay = localDayOf(date);
		const inputLocale = this.locale();
		const [observations, notes, tracked, preferences] = await Promise.all([
			this.observations.listByDay(localDay),
			this.notes.listByDay(localDay),
			this.trackedMetrics.listResolved(DEFAULT_TRACKED_METRICS),
			this.unitPreferences.resolveLatestPerDimension(),
		]);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const enabledSlugs = new Set(
			tracked
				.filter((metric) => metric.enabled)
				.map((metric) => metric.metricSlug),
		);
		const availableFactors = listFactors().filter((factor) =>
			enabledSlugs.has(factor.slug),
		);
		const factorSlugs = new Set(availableFactors.map((factor) => factor.slug));
		const resolvedMeasurements = tracked.flatMap((overlay) => {
			const resolved = resolveMetric(overlay.metricSlug);
			if (resolved.kind !== "known" || resolved.metric.kind !== "measurement") {
				return [];
			}
			const metric = resolved.metric;
			const displayUnit = resolveDisplayUnit(
				metric.dimension,
				preferenceByDimension.get(metric.dimension),
				inputLocale,
			);
			return [
				{
					measurement: toCheckInMeasurement(
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

	async save(
		draft: CheckInDraft,
		entry: CheckInEntry | null = null,
	): Promise<TodayCheckIn> {
		assertDraft(draft);
		if (entry && draft.measurements.length > 0) {
			throw new TypeError(
				"Measurements can only be logged with a new check-in.",
			);
		}
		const capturedAt = this.now();
		const observedAt = capturedAt.getTime();
		const localDay = localDayOf(capturedAt);
		const tzOffsetMinutes = capturedAt.getTimezoneOffset();
		const selectedFactors = new Set(draft.selectedFactorSlugs);
		const measurements = new Map(
			draft.measurements.map((measurement) => [
				measurement.metricSlug,
				measurement.value,
			]),
		);

		await this.db.withTransactionAsync(async () => {
			const tracked = await this.trackedMetrics.listResolved(
				DEFAULT_TRACKED_METRICS,
			);
			const activeFactorSlugs = new Set(
				tracked
					.filter((metric) => {
						const resolved = resolveMetric(metric.metricSlug);
						return (
							metric.enabled &&
							resolved.kind === "known" &&
							resolved.metric.kind === "factor"
						);
					})
					.map((metric) => metric.metricSlug),
			);
			const activeMeasurementSlugs = new Set(
				tracked
					.filter((metric) => {
						const resolved = resolveMetric(metric.metricSlug);
						return (
							metric.enabled &&
							resolved.kind === "known" &&
							resolved.metric.kind === "measurement"
						);
					})
					.map((metric) => metric.metricSlug),
			);
			for (const slug of selectedFactors) {
				if (!activeFactorSlugs.has(slug)) {
					throw new TypeError(`Factor is not active in this check-in: ${slug}`);
				}
			}
			for (const slug of measurements.keys()) {
				if (!activeMeasurementSlugs.has(slug)) {
					throw new TypeError(
						`Measurement is not active in this check-in: ${slug}`,
					);
				}
			}

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
			} else {
				await this.observations.create({
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
			}

			await this.reconcileFactors(
				localDay,
				observedAt,
				tzOffsetMinutes,
				activeFactorSlugs,
				selectedFactors,
			);
			for (const [metricSlug, value] of measurements) {
				await this.observations.create({
					metricSlug,
					value,
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
			if (draft.note.trim().length > 0) {
				await this.notes.upsertForDayInCurrentTransaction(localDay, draft.note);
			} else {
				// The form prefills the day's note, so an emptied field is an
				// explicit clear of the note the user was shown — not an absent one.
				const [uiNote] = await this.notes.listByDay(localDay);
				if (uiNote) {
					await this.notes.delete(uiNote.id);
				}
			}
		});

		const today = await this.loadToday(capturedAt);
		// The product transaction has committed. Notification reconciliation is a
		// derived install-local side effect and must never make that durable save
		// appear to have failed.
		await refreshReminderNotifications().catch(() => undefined);
		return today;
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
