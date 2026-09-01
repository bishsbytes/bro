import {
	type ConsumptionEntry,
	type ConsumptionEntryKind,
	getDb,
} from "@bro/database-app";
import { resolveLocalMoment } from "@bro/domain";
import type {
	ConsumptionDerivedMeasurementMetricDefinition,
	ConsumptionDerivedMeasurementSlug,
} from "@bro/domain/metric-registry";
import {
	type SubstanceCanonicalAmountKey,
	type SubstanceCatalogueEntry,
	snapshotSubstanceServing,
} from "@bro/domain/substance-catalogue";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	type ConsumptionDaySnapshot,
	type ConsumptionEntryEdit,
	type ConsumptionGoalProgress,
	type ConsumptionMetricSetting,
	type ConsumptionMetricSummary,
	type ConsumptionOccurrence,
	ConsumptionStore,
	type PresentedConsumptionEntry,
} from "../consumption/consumption-store";

export type SubstanceOccurrence = ConsumptionOccurrence;
export type SubstanceEntryEdit = ConsumptionEntryEdit;
export type PresentedSubstanceEntry = PresentedConsumptionEntry;
export type SubstanceGoalProgress = ConsumptionGoalProgress;

/**
 * Everything that differs between one substance stream and the next. A new
 * substance is this object plus its authored catalogue, its registry metric,
 * and a migration column — not another store or another set of screens.
 */
export type SubstanceDescriptor<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = {
	/** The entry kind this stream owns; entries of other kinds are invisible. */
	kind: ConsumptionEntryKind;
	/** The single summed metric the stream presents. */
	metricSlug: Slug;
	/** The entry column that metric sums, and the amount key servings carry. */
	amountKey: SubstanceCanonicalAmountKey;
	/** Authored, already-localised content. */
	catalogue: () => SubstanceCatalogueEntry[];
	resolveEntry: (id: string) => SubstanceCatalogueEntry | null;
	/**
	 * The stream's own copy, resolved by its module against its own namespace.
	 * Passed as functions rather than a namespace name so each substance keeps
	 * i18next's typed keys and the shared code never builds a key by hand.
	 */
	copy: SubstanceCopy;
	/** Where the stream's screens live, as `/nicotine`. */
	routeBase: string;
};

/**
 * The copy the shared substance code needs from whichever stream it serves.
 * Functions rather than strings so a language change re-resolves them, and
 * per-stream rather than a namespace name so i18next's key types survive.
 */
export type SubstanceCopy = {
	chooseCatalogue: () => string;
	amountInvalid: () => string;
	loadFailed: () => string;
	loadFailedBody: () => string;
	disclaimer: () => string;
	weekTotal: (value: string) => string;
	quickAddEyebrow: () => string;
	quickAddEmpty: () => string;
	quickAddOption: (item: string, serving: string) => string;
	repeatA11y: (name: string) => string;
	browseTitle: () => string;
	freeTitle: () => string;
	freeDetail: () => string;
	goals: () => string;
	goalsDetail: () => string;
	manageTitle: () => string;
	dayEmpty: () => string;
	dayEmptyBody: () => string;
	dayTotal: () => string;
	goalSummary: (target: string, current: string) => string;
	goalTargetReached: () => string;
	goalPercent: (percent: number) => string;
	goalTargetField: (unit: string) => string;
	goalTargetDateField: () => string;
	goalSave: () => string;
	goalSetFor: (name: string) => string;
	goalAchieve: () => string;
	goalAbandon: () => string;
	goalNeedsLog: () => string;
};

export type SubstanceMetric<Slug extends ConsumptionDerivedMeasurementSlug> =
	ConsumptionDerivedMeasurementMetricDefinition & { slug: Slug };

export type SubstanceMetricSummary<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = ConsumptionMetricSummary<SubstanceMetric<Slug>>;

export type SubstanceMetricSetting<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = ConsumptionMetricSetting<Slug>;

export type SubstanceDaySnapshot<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = ConsumptionDaySnapshot<SubstanceMetric<Slug>> & {
	catalogue: SubstanceCatalogueEntry[];
};

export type SubstanceSettingsSnapshot<
	Slug extends ConsumptionDerivedMeasurementSlug,
> = {
	metrics: SubstanceMetricSetting<Slug>[];
};

/** A free entry: a label and how much of the substance it delivered. */
export type FreeSubstanceDraft = SubstanceOccurrence & {
	label: string;
	servingLabel: string | null;
	quantity: number;
	/** In the substance's own readable unit, converted by the descriptor. */
	amount: number;
};

/**
 * One log for every substance stream, configured by a descriptor. Nicotine is
 * its first configuration; a later substance supplies another and inherits the
 * day snapshot, recents, totals, goals, corrections, and settings unchanged.
 */
export class SubstanceStore<
	Slug extends ConsumptionDerivedMeasurementSlug,
> extends ConsumptionStore<Slug, SubstanceMetric<Slug>> {
	protected readonly kind: ConsumptionEntryKind;
	protected readonly metricSlugs: readonly Slug[];

	constructor(
		private readonly descriptor: SubstanceDescriptor<Slug>,
		db: SQLiteDatabase,
		now?: () => Date,
		locale?: () => string | undefined,
	) {
		super(db, now, locale);
		this.kind = descriptor.kind;
		this.metricSlugs = [descriptor.metricSlug];
	}

	/**
	 * A zero is noise here, as it is for drinks: a stream's entries all carry
	 * the substance, so only a positive amount is worth naming on an entry row.
	 */
	protected contributionOf(
		entry: ConsumptionEntry,
		_slug: Slug,
	): number | null {
		const value = entry[this.descriptor.amountKey] ?? null;
		return value !== null && value > 0 ? value : null;
	}

	async loadToday(): Promise<SubstanceDaySnapshot<Slug>> {
		return await this.loadDay(this.today());
	}

	async loadDay(localDay: string): Promise<SubstanceDaySnapshot<Slug>> {
		const base = await this.loadDayBase(localDay);
		return { ...base, catalogue: this.descriptor.catalogue() };
	}

	/** Logs a catalogue item as the immutable snapshot the catalogue defines. */
	async logCatalogue(
		catalogueId: string,
		servingId: string,
		quantity: number,
		occurrence: SubstanceOccurrence,
	): Promise<ConsumptionEntry> {
		const entry = this.descriptor.resolveEntry(catalogueId);
		const serving = entry?.servings.find(
			(candidate) => candidate.id === servingId,
		);
		if (!entry || !serving) {
			throw new TypeError(this.descriptor.copy.chooseCatalogue());
		}
		const snapshot = snapshotSubstanceServing(entry, serving, quantity);
		return await this.entries.create({
			kind: this.descriptor.kind,
			catalogueRef: snapshot.catalogueRef,
			label: snapshot.label,
			servingLabel: snapshot.servingLabel,
			quantity: snapshot.quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: null,
			...snapshot.amounts,
			...resolveLocalMoment(occurrence),
		});
	}

	async logFree(draft: FreeSubstanceDraft): Promise<ConsumptionEntry> {
		this.assertQuantity(draft.quantity);
		if (!Number.isFinite(draft.amount) || draft.amount < 0) {
			throw new RangeError(this.descriptor.copy.amountInvalid());
		}
		return await this.entries.create({
			kind: this.descriptor.kind,
			catalogueRef: null,
			label: draft.label,
			servingLabel: draft.servingLabel,
			quantity: draft.quantity,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: null,
			...({
				[this.descriptor.amountKey]: draft.amount * draft.quantity,
			} as Partial<Record<SubstanceCanonicalAmountKey, number>>),
			...resolveLocalMoment(draft),
		});
	}

	async loadSettings(): Promise<SubstanceSettingsSnapshot<Slug>> {
		return { metrics: await this.trackedMetricSettings() };
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<SubstanceSettingsSnapshot<Slug>> {
		await this.configureTracked(metricSlug, enabled);
		return await this.loadSettings();
	}

	/** Whether this stream is on: its metric tracked, or a habit targeting it. */
	async isTracked(): Promise<boolean> {
		const settings = await this.trackedMetricSettings();
		return settings.some((setting) => setting.tracked);
	}
}

export function createSubstanceStore<
	Slug extends ConsumptionDerivedMeasurementSlug,
>(descriptor: SubstanceDescriptor<Slug>): SubstanceStore<Slug> {
	return new SubstanceStore(descriptor, getDb());
}
