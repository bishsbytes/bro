import {
	type Assessment,
	type AssessmentItemSnapshot,
	AssessmentRepository,
	ConsumptionEntryRepository,
	DailyMetricRepository,
	type Goal,
	GoalRepository,
	getDb,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { localDayOf, systemLocale } from "@bro/domain";
import {
	DEFAULT_LIFE_AREA_METRICS,
	listActiveLifeAreas,
	resolveLifeAreas,
} from "@bro/domain/life-area-catalogue";
import {
	isConsumptionDerivedMeasurementSlug,
	resolveMetric,
} from "@bro/domain/metric-registry";
import { WHEEL_OF_LIFE_TEMPLATE } from "@bro/domain/wheel-template";
import {
	consumptionMetricTrailingDailyMean,
	formatMetricValue,
	metricDisplayUnit,
	type ResolvedGoalProgress,
	resolveGoalProgress,
	resolveMetricObservations,
} from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";

export type ReviewDraft = {
	startedAt: number;
	items: AssessmentItemSnapshot[];
};

export type WheelScore = AssessmentItemSnapshot & {
	value: number;
	focused: boolean;
};

export type WheelComparison = {
	slug: string;
	label: string;
	previousLabel: string;
	currentValue: number;
	previousValue: number;
	delta: number;
};

export type ReviewResult = {
	assessment: Assessment;
	scores: WheelScore[];
	previousAssessment: Assessment | null;
	previousScores: WheelScore[];
	comparisons: WheelComparison[];
};

export type GoalProgress = ResolvedGoalProgress & {
	label: string;
};

export type ReviewOverview = {
	sittings: Assessment[];
	goals: GoalProgress[];
};

export type GoalSetup = {
	assessmentId: string;
	metricSlug: string;
	label: string;
	currentValue: number;
};

/** Rolling window a consumption goal's "current level" is averaged over. */
const GOAL_MEAN_WINDOW_DAYS = 7;

function formatWheelScore(value: number): string {
	return `${Number.isInteger(value) ? value : value.toFixed(1)}/10`;
}

function valueOnWheelScale(observation: Observation): number {
	if (
		observation.scaleMin === null ||
		observation.scaleMax === null ||
		observation.scaleMax <= observation.scaleMin
	) {
		return observation.value;
	}
	const position =
		(observation.value - observation.scaleMin) /
		(observation.scaleMax - observation.scaleMin);
	return 1 + position * 9;
}

function scoresFor(
	assessment: Assessment,
	observations: readonly Observation[],
): WheelScore[] {
	const firstBySlug = new Map<string, Observation>();
	for (const observation of observations) {
		if (!firstBySlug.has(observation.metricSlug)) {
			firstBySlug.set(observation.metricSlug, observation);
		}
	}
	const focused = new Set(assessment.focusItemSlugs);

	return [...assessment.items]
		.sort(
			(left, right) =>
				left.position - right.position || left.slug.localeCompare(right.slug),
		)
		.flatMap((item): WheelScore[] => {
			const observation = firstBySlug.get(item.slug);
			return observation
				? [
						{
							...item,
							value: valueOnWheelScale(observation),
							focused: focused.has(item.slug),
						},
					]
				: [];
		});
}

export function compareWheelScores(
	current: readonly WheelScore[],
	previous: readonly WheelScore[],
): WheelComparison[] {
	const previousBySlug = new Map(previous.map((score) => [score.slug, score]));
	return current.flatMap((score): WheelComparison[] => {
		const before = previousBySlug.get(score.slug);
		return before
			? [
					{
						slug: score.slug,
						label: score.label,
						previousLabel: before.label,
						currentValue: score.value,
						previousValue: before.value,
						delta: score.value - before.value,
					},
				]
			: [];
	});
}

function assertScores(
	draft: ReviewDraft,
	scores: Readonly<Record<string, number>>,
): void {
	const itemSlugs = new Set(draft.items.map((item) => item.slug));
	const scoreSlugs = Object.keys(scores);
	if (
		scoreSlugs.length !== itemSlugs.size ||
		scoreSlugs.some((slug) => !itemSlugs.has(slug))
	) {
		throw new TypeError("Rate every displayed life area before saving.");
	}
	for (const item of draft.items) {
		const value = scores[item.slug];
		if (!Number.isInteger(value) || value < 1 || value > 10) {
			throw new RangeError(
				`${item.label} must be a whole number from 1 to 10.`,
			);
		}
	}
}

function assertFocusItems(
	draft: ReviewDraft,
	focusItemSlugs: readonly string[],
): void {
	const itemSlugs = new Set(draft.items.map((item) => item.slug));
	if (
		focusItemSlugs.length > 3 ||
		new Set(focusItemSlugs).size !== focusItemSlugs.length ||
		focusItemSlugs.some((slug) => !itemSlugs.has(slug))
	) {
		throw new TypeError(
			"Choose no more than three unique focus areas from this wheel.",
		);
	}
}

export class ReviewStore {
	private readonly assessments: AssessmentRepository;
	private readonly goals: GoalRepository;
	private readonly observations: ObservationRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;
	private readonly dailyMetrics: DailyMetricRepository;
	private readonly consumptionEntries: ConsumptionEntryRepository;
	private readonly unitPreferences: UnitPreferenceRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
		private readonly locale: () => string | undefined = systemLocale,
	) {
		this.assessments = new AssessmentRepository(db);
		this.goals = new GoalRepository(db);
		this.observations = new ObservationRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
		this.dailyMetrics = new DailyMetricRepository(db);
		this.consumptionEntries = new ConsumptionEntryRepository(db);
		this.unitPreferences = new UnitPreferenceRepository(db);
	}

	async listSittings(): Promise<Assessment[]> {
		return (await this.assessments.listAll()).filter(
			(assessment) => assessment.completedAt !== null,
		);
	}

	async loadOverview(): Promise<ReviewOverview> {
		const [
			sittings,
			goals,
			observations,
			overlays,
			dailyMetrics,
			consumptionEntries,
			preferences,
		] = await Promise.all([
			this.listSittings(),
			this.goals.listAll(),
			this.observations.listAll(),
			this.trackedMetrics.listResolved(DEFAULT_LIFE_AREA_METRICS),
			this.dailyMetrics.listAll(),
			this.consumptionEntries.listAll(),
			this.unitPreferences.resolveLatestPerDimension(),
		]);
		const labels = new Map<string, string>(
			resolveLifeAreas(overlays).map((area) => [area.slug, area.label]),
		);
		const labelFor = (metricSlug: string): string => {
			const overlayLabel = labels.get(metricSlug);
			if (overlayLabel) {
				return overlayLabel;
			}
			const resolved = resolveMetric(metricSlug);
			return resolved.kind === "known" ? resolved.metric.label : metricSlug;
		};
		const preferenceByDimension = new Map(
			preferences.map((preference) => [preference.dimension, preference.unit]),
		);
		const inputLocale = this.locale();
		const observationsByMetric = new Map<string, Observation[]>();
		for (const observation of observations) {
			const metricObservations =
				observationsByMetric.get(observation.metricSlug) ?? [];
			metricObservations.push(observation);
			observationsByMetric.set(observation.metricSlug, metricObservations);
		}
		const sortedObservations = (metricSlug: string): Observation[] =>
			[...(observationsByMetric.get(metricSlug) ?? [])].sort(
				(left, right) =>
					left.observedAt - right.observedAt ||
					left.createdAt - right.createdAt ||
					left.id.localeCompare(right.id),
			);

		// Goals come from three subsystems (wheel areas, body measurements,
		// consumption metrics); this overview is the one place all of them show
		// together, so each kind resolves through its own series and units.
		const progressFor = (goal: Goal): ResolvedGoalProgress => {
			const resolved = resolveMetric(goal.metricSlug);
			if (resolved.kind === "known" && resolved.metric.kind === "assessment") {
				return resolveGoalProgress({
					goal,
					series: sortedObservations(goal.metricSlug).map((observation) => ({
						observedAt: observation.observedAt,
						value: valueOnWheelScale(observation),
					})),
					format: formatWheelScore,
				});
			}
			if (resolved.kind === "known" && resolved.metric.kind === "measurement") {
				const metric = resolved.metric;
				const displayUnit = metricDisplayUnit(
					metric,
					preferenceByDimension,
					inputLocale,
				);
				const format = (value: number) =>
					formatMetricValue(metric, value, displayUnit);
				const slug = metric.slug;
				if (isConsumptionDerivedMeasurementSlug(slug)) {
					const series = resolveMetricObservations(
						slug,
						[],
						[],
						consumptionEntries,
					);
					const hasEntries = series.length > 0;
					const mean = (throughLocalDay: string) =>
						consumptionMetricTrailingDailyMean(
							slug,
							throughLocalDay,
							GOAL_MEAN_WINDOW_DAYS,
							consumptionEntries,
						);
					return resolveGoalProgress({
						goal,
						series,
						startValue: hasEntries
							? mean(localDayOf(new Date(goal.startedAt)))
							: null,
						currentValue: hasEntries ? mean(localDayOf(this.now())) : null,
						format,
					});
				}
				return resolveGoalProgress({
					goal,
					series: resolveMetricObservations(
						metric.slug,
						sortedObservations(metric.slug),
						dailyMetrics.filter((row) => row.metricSlug === metric.slug),
					),
					format,
				});
			}
			// A goal against a slug this build no longer knows still shows its
			// stored numbers rather than disappearing or crashing.
			return resolveGoalProgress({
				goal,
				series: sortedObservations(goal.metricSlug),
				format: (value) => String(value),
			});
		};

		return {
			sittings,
			goals: goals.map((goal) => ({
				...progressFor(goal),
				label: labelFor(goal.metricSlug),
			})),
		};
	}

	async beginSitting(): Promise<ReviewDraft> {
		const overlays = await this.trackedMetrics.listResolved(
			DEFAULT_LIFE_AREA_METRICS,
		);
		const areas = listActiveLifeAreas(overlays);
		if (areas.length === 0) {
			throw new Error("Enable at least one life area before taking stock.");
		}
		return {
			startedAt: this.now().getTime(),
			items: areas.map((area) => ({
				slug: area.slug,
				label: area.label,
				position: area.position,
			})),
		};
	}

	async completeSitting(
		draft: ReviewDraft,
		scores: Readonly<Record<string, number>>,
		focusItemSlugs: readonly string[] = [],
	): Promise<ReviewResult> {
		assertScores(draft, scores);
		assertFocusItems(draft, focusItemSlugs);
		const completed = this.now();
		const completedAt = completed.getTime();
		const saved = await this.assessments.createWithObservations({
			templateSlug: WHEEL_OF_LIFE_TEMPLATE.slug,
			templateVersion: WHEEL_OF_LIFE_TEMPLATE.templateVersion,
			startedAt: draft.startedAt,
			completedAt,
			items: draft.items,
			focusItemSlugs: [...focusItemSlugs],
			observations: draft.items.map((item) => ({
				metricSlug: item.slug,
				value: scores[item.slug],
				scaleMin: 1,
				scaleMax: 10,
				observedAt: completedAt,
				localDay: localDayOf(completed),
				tzOffsetMinutes: completed.getTimezoneOffset(),
				source: "user",
				sourceRecordId: null,
			})),
		});
		return await this.loadSavedResult(saved.assessment, saved.observations);
	}

	async loadGoalSetup(
		assessmentId: string,
		metricSlug: string,
	): Promise<GoalSetup | null> {
		const assessment = await this.assessments.findById(assessmentId);
		if (
			!assessment ||
			assessment.completedAt === null ||
			!assessment.focusItemSlugs.includes(metricSlug)
		) {
			return null;
		}
		const item = assessment.items.find(
			(candidate) => candidate.slug === metricSlug,
		);
		const observation = (
			await this.observations.listByAssessmentId(assessmentId)
		).find((candidate) => candidate.metricSlug === metricSlug);
		if (!item || !observation) {
			return null;
		}
		return {
			assessmentId,
			metricSlug,
			label: item.label,
			currentValue: valueOnWheelScale(observation),
		};
	}

	async createGoal(
		assessmentId: string,
		metricSlug: string,
		targetValue: number,
		targetDate: string | null,
	): Promise<Goal> {
		const setup = await this.loadGoalSetup(assessmentId, metricSlug);
		if (!setup) {
			throw new TypeError("Goals can only be created from a saved focus area.");
		}
		if (!Number.isInteger(targetValue) || targetValue < 1 || targetValue > 10) {
			throw new RangeError("Choose a whole-number target from 1 to 10.");
		}
		if (targetValue === setup.currentValue) {
			throw new RangeError(
				"Choose a target different from your current score.",
			);
		}
		return await this.goals.create({
			metricSlug,
			direction: targetValue > setup.currentValue ? "increase" : "decrease",
			targetValue,
			targetDate,
			startedAt: this.now().getTime(),
		});
	}

	async achieveGoal(id: string): Promise<Goal | null> {
		return await this.goals.achieve(id);
	}

	async abandonGoal(id: string): Promise<Goal | null> {
		return await this.goals.abandon(id);
	}

	async loadResult(id: string): Promise<ReviewResult | null> {
		const assessment = await this.assessments.findById(id);
		if (!assessment || assessment.completedAt === null) {
			return null;
		}
		const observations = await this.observations.listByAssessmentId(id);
		return await this.loadSavedResult(assessment, observations);
	}

	private async loadSavedResult(
		assessment: Assessment,
		observations: readonly Observation[],
	): Promise<ReviewResult> {
		const all = await this.listSittings();
		const currentIndex = all.findIndex(
			(candidate) => candidate.id === assessment.id,
		);
		const previousAssessment =
			currentIndex >= 0 ? (all[currentIndex + 1] ?? null) : null;
		const previousObservations = previousAssessment
			? await this.observations.listByAssessmentId(previousAssessment.id)
			: [];
		const scores = scoresFor(assessment, observations);
		const previousScores = previousAssessment
			? scoresFor(previousAssessment, previousObservations)
			: [];

		return {
			assessment,
			scores,
			previousAssessment,
			previousScores,
			comparisons: compareWheelScores(scores, previousScores),
		};
	}
}

export function createReviewStore(): ReviewStore {
	return new ReviewStore(getDb());
}
