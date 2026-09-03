import {
	getDb,
	IntakeStreamRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import {
	DIMENSION_BY_UNIT_PREFERENCE,
	DISPLAY_UNITS_BY_PREFERENCE_DIMENSION,
	type DisplayUnit,
	formatMeasurement,
	isDisplayUnitForPreferenceDimension,
	resolveUnitPreference,
	systemLocale,
} from "@bro/domain";
import {
	CONSTITUENT_CATALOGUE,
	type ConstituentCategory,
	type ConstituentCode,
} from "@bro/domain/constituent-catalogue";
import {
	type ConsumableKind,
	OPTIONAL_STREAM_KINDS,
	type OptionalStreamKind,
} from "@bro/domain/consumable";
import {
	type ConsumptionDerivedMeasurementMetricDefinition,
	intakeMetricSlug,
	listConsumptionDerivedMeasurements,
} from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveMetric } from "../content";
import { i18n } from "../i18n";
import { unitLabel } from "../units/unit-settings-store";
import { unitWords } from "../units/unit-words";

export type IntakeStreamSetting = {
	kind: OptionalStreamKind;
	label: string;
	detail: string;
	enabled: boolean;
};

export type IntakeTrackedSetting = {
	code: ConstituentCode;
	metricSlug: string;
	label: string;
	tracked: boolean;
	/** Shown before the "More nutrients" disclosure. */
	primary: boolean;
};

export type IntakeTrackedGroup = {
	category: ConstituentCategory;
	label: string;
	rows: IntakeTrackedSetting[];
};

export type IntakeUnitDimension = "alcohol" | "volume" | "sodium";

export type IntakeUnitSetting = {
	dimension: IntakeUnitDimension;
	title: string;
	options: { unit: DisplayUnit; label: string }[];
	resolvedUnit: DisplayUnit;
	explicitUnit: DisplayUnit | null;
	preview: string;
};

export type IntakeSettingsSnapshot = {
	streams: IntakeStreamSetting[];
	groups: IntakeTrackedGroup[];
	units: IntakeUnitSetting[];
};

const INTAKE_UNIT_DIMENSIONS = [
	"alcohol",
	"volume",
	"sodium",
] as const satisfies readonly IntakeUnitDimension[];

/** The constituents a quick custom food asks about; the rest are disclosed. */
const PRIMARY_CONSTITUENT_CODES: ReadonlySet<string> = new Set([
	"energy",
	"protein",
	"carbohydrate",
	"fat",
	"fluid",
	"caffeine",
	"ethanol",
	"nicotine",
	"creatine",
]);

/**
 * A pint of lager for alcohol and fluid, a fair pinch of salt for sodium, so a
 * unit choice can be judged against something real.
 */
const UNIT_PREVIEWS = {
	alcohol: 0.020_181_999,
	volume: 0.568_261_25,
	sodium: 0.0006,
} as const satisfies Record<IntakeUnitDimension, number>;

/** Every intake metric is a tracked-metric overlay row that starts off. */
export function intakeTrackedDefaults() {
	return listConsumptionDerivedMeasurements().map((metric) => ({
		metricSlug: metric.slug,
		position: metric.defaultPosition,
		enabled: false,
	}));
}

/** Localised intake metric definitions, in catalogue order. */
export function intakeMetrics(): ConsumptionDerivedMeasurementMetricDefinition[] {
	return listConsumptionDerivedMeasurements().flatMap((metric) => {
		const resolved = resolveMetric(metric.slug);
		return resolved.kind === "known" &&
			resolved.metric.kind === "measurement" &&
			"measurementSource" in resolved.metric
			? [resolved.metric]
			: [];
	});
}

export class IntakeSettingsStore {
	private readonly streams: IntakeStreamRepository;
	private readonly tracked: TrackedMetricsRepository;
	private readonly preferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.streams = new IntakeStreamRepository(db);
		this.tracked = new TrackedMetricsRepository(db);
		this.preferences = new UnitPreferenceRepository(db);
	}

	/** Food and drink first, then every optional stream that is on. */
	async enabledKinds(): Promise<ConsumableKind[]> {
		return await this.streams.listEnabledKinds();
	}

	async isStreamEnabled(kind: ConsumableKind): Promise<boolean> {
		return await this.streams.isEnabled(kind);
	}

	async loadSettings(): Promise<IntakeSettingsSnapshot> {
		const [enabledKinds, overlays, preferences] = await Promise.all([
			this.streams.listEnabledKinds(),
			this.tracked.listResolved(intakeTrackedDefaults()),
			this.preferences.resolveLatestPerDimension(),
		]);
		const overlayBySlug = new Map(
			overlays.map((overlay) => [overlay.metricSlug, overlay]),
		);
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const locale = this.locale();

		// Rows carry the metric's label — "Energy intake", not "Energy" — so a
		// total reads here as it reads on Trends and the tab.
		const metricLabels = new Map(
			intakeMetrics().map((metric) => [metric.slug, metric.label]),
		);
		const groups = new Map<ConstituentCategory, IntakeTrackedSetting[]>();
		for (const constituent of CONSTITUENT_CATALOGUE) {
			const metricSlug = intakeMetricSlug(constituent.code);
			const row: IntakeTrackedSetting = {
				code: constituent.code,
				metricSlug,
				label: metricLabels.get(metricSlug) ?? constituent.label,
				tracked: overlayBySlug.get(metricSlug)?.enabled ?? false,
				primary: PRIMARY_CONSTITUENT_CODES.has(constituent.code),
			};
			const rows = groups.get(constituent.category);
			if (rows) rows.push(row);
			else groups.set(constituent.category, [row]);
		}

		return {
			streams: OPTIONAL_STREAM_KINDS.map((kind) => ({
				kind,
				label: i18n.t(`intake:streams.${kind}`),
				detail: i18n.t(`intake:settings.streamDetail.${kind}`),
				enabled: enabledKinds.includes(kind),
			})),
			groups: [...groups.entries()].map(([category, rows]) => ({
				category,
				label: i18n.t(`intake:settings.categories.${category}`),
				rows,
			})),
			units: INTAKE_UNIT_DIMENSIONS.map((dimension) => {
				const storedUnit = preferenceByDimension.get(dimension);
				const resolvedUnit = resolveUnitPreference(
					dimension,
					storedUnit,
					locale,
				);
				return {
					dimension,
					title: i18n.t(`intake:settings.unitDetail.${dimension}`),
					options: DISPLAY_UNITS_BY_PREFERENCE_DIMENSION[dimension].map(
						(unit) => ({ unit, label: unitLabel(unit) }),
					),
					resolvedUnit,
					explicitUnit:
						storedUnit !== undefined &&
						isDisplayUnitForPreferenceDimension(dimension, storedUnit)
							? storedUnit
							: null,
					preview: formatMeasurement(
						UNIT_PREVIEWS[dimension],
						DIMENSION_BY_UNIT_PREFERENCE[dimension],
						resolvedUnit,
						locale,
						unitWords(),
					),
				};
			}),
		};
	}

	async setStreamEnabled(
		kind: string,
		enabled: boolean,
	): Promise<IntakeSettingsSnapshot> {
		await this.streams.setEnabled(kind, enabled);
		return await this.loadSettings();
	}

	async setTracked(
		metricSlug: string,
		enabled: boolean,
	): Promise<IntakeSettingsSnapshot> {
		const metric = intakeMetrics().find(
			(candidate) => candidate.slug === metricSlug,
		);
		if (!metric) {
			throw new TypeError(
				i18n.t("validation:intake.unknownMetric", { slug: metricSlug }),
			);
		}
		const overlay = (
			await this.tracked.listResolved(intakeTrackedDefaults())
		).find((candidate) => candidate.metricSlug === metric.slug);
		await this.tracked.configure(
			metric.slug,
			overlay?.position ?? metric.defaultPosition,
			enabled,
		);
		return await this.loadSettings();
	}

	async setUnit(
		dimension: IntakeUnitDimension,
		unit: string,
	): Promise<IntakeSettingsSnapshot> {
		if (!isDisplayUnitForPreferenceDimension(dimension, unit)) {
			throw new TypeError(`Unit ${unit} does not measure ${dimension}.`);
		}
		await this.preferences.set(dimension, unit);
		return await this.loadSettings();
	}
}

export function createIntakeSettingsStore(): IntakeSettingsStore {
	return new IntakeSettingsStore(getDb());
}

/**
 * The kinds the quick-log sheet may offer. Eating and drinking are universal;
 * an optional stream appears only once it has been switched on, because a
 * standing smoking or medication button in every man's sheet would be the
 * product having a view about him.
 */
export async function enabledIntakeKinds(): Promise<ConsumableKind[]> {
	return await new IntakeSettingsStore(getDb()).enabledKinds();
}
