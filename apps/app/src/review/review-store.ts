import {
	type Assessment,
	type AssessmentItemSnapshot,
	AssessmentRepository,
	type Goal,
	GoalRepository,
	getDb,
	type Observation,
	ObservationRepository,
	TrackedMetricsRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	DEFAULT_LIFE_AREA_METRICS,
	listActiveLifeAreas,
	resolveLifeAreas,
} from "../content/life-area-catalogue";
import { WHEEL_OF_LIFE_TEMPLATE } from "../content/wheel-template";

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

export type GoalStatus = "active" | "achieved" | "abandoned";

export type GoalProgress = {
	goal: Goal;
	label: string;
	status: GoalStatus;
	startValue: number | null;
	currentValue: number | null;
	progressPercent: number | null;
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

function localDayOf(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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

function goalStatus(goal: Goal): GoalStatus {
	if (goal.achievedAt !== null) {
		return "achieved";
	}
	if (goal.abandonedAt !== null) {
		return "abandoned";
	}
	return "active";
}

function goalProgressPercent(
	goal: Goal,
	startValue: number | null,
	currentValue: number | null,
): number | null {
	if (startValue === null || currentValue === null) {
		return null;
	}
	const distance =
		goal.direction === "increase"
			? goal.targetValue - startValue
			: startValue - goal.targetValue;
	if (distance <= 0) {
		return null;
	}
	const travelled =
		goal.direction === "increase"
			? currentValue - startValue
			: startValue - currentValue;
	return Math.round(Math.max(0, Math.min(1, travelled / distance)) * 100);
}

export class ReviewStore {
	private readonly assessments: AssessmentRepository;
	private readonly goals: GoalRepository;
	private readonly observations: ObservationRepository;
	private readonly trackedMetrics: TrackedMetricsRepository;

	constructor(
		db: SQLiteDatabase,
		private readonly now: () => Date = () => new Date(),
	) {
		this.assessments = new AssessmentRepository(db);
		this.goals = new GoalRepository(db);
		this.observations = new ObservationRepository(db);
		this.trackedMetrics = new TrackedMetricsRepository(db);
	}

	async listSittings(): Promise<Assessment[]> {
		return (await this.assessments.listAll()).filter(
			(assessment) => assessment.completedAt !== null,
		);
	}

	async loadOverview(): Promise<ReviewOverview> {
		const [sittings, goals, observations, overlays] = await Promise.all([
			this.listSittings(),
			this.goals.listAll(),
			this.observations.listAll(),
			this.trackedMetrics.listResolved(DEFAULT_LIFE_AREA_METRICS),
		]);
		const labels = new Map<string, string>(
			resolveLifeAreas(overlays).map((area) => [area.slug, area.label]),
		);
		const observationsByMetric = new Map<string, Observation[]>();
		for (const observation of observations) {
			const metricObservations =
				observationsByMetric.get(observation.metricSlug) ?? [];
			metricObservations.push(observation);
			observationsByMetric.set(observation.metricSlug, metricObservations);
		}

		return {
			sittings,
			goals: goals.map((goal) => {
				const metricObservations = [
					...(observationsByMetric.get(goal.metricSlug) ?? []),
				].sort(
					(left, right) =>
						left.observedAt - right.observedAt ||
						left.createdAt - right.createdAt ||
						left.id.localeCompare(right.id),
				);
				const startObservation = metricObservations
					.filter((observation) => observation.observedAt <= goal.startedAt)
					.at(-1);
				const currentObservation = metricObservations.at(-1);
				const goalValue = (observation: Observation) =>
					goal.metricSlug.startsWith("wheel:")
						? valueOnWheelScale(observation)
						: observation.value;
				const startValue = startObservation
					? goalValue(startObservation)
					: null;
				const currentValue = currentObservation
					? goalValue(currentObservation)
					: null;
				return {
					goal,
					label: labels.get(goal.metricSlug) ?? goal.metricSlug,
					status: goalStatus(goal),
					startValue,
					currentValue,
					progressPercent: goalProgressPercent(goal, startValue, currentValue),
				};
			}),
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
