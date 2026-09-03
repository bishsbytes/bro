import {
	type ConstituentAmounts,
	carriesSensitiveConstituent,
} from "@bro/domain/constituent-catalogue";
import {
	type ConsumableKind,
	isSensitiveConsumableKind,
	isSensitiveStreamKind,
} from "@bro/domain/consumable";
import { resolveHabit } from "@bro/domain/habit-catalogue";
import { LIFE_AREA_CATALOGUE } from "@bro/domain/life-area-catalogue";
import type { MetricDefinition } from "@bro/domain/metric-registry";
import type {
	Assessment,
	ChallengeEnrolment,
	ChallengeProgress,
	Consumable,
	DailyMetric,
	DayNote,
	Goal,
	Habit,
	HabitCompletion,
	IntakeEvent,
	IntakeStream,
	Observation,
	RecipeIngredient,
	Reminder,
	TrackedMetric,
	UnitPreference,
} from "@bro/mobile-model";

/**
 * Version 2 carries the intake model — events with constituent maps, the
 * library, recipe ingredients, streams — in place of the consumption tables.
 * Only the current version parses: a format change regenerates fixtures.
 */
export const CHECK_IN_EXPORT_FORMAT_VERSION = 2 as const;

export type CheckInExportInput = {
	observations: readonly Observation[];
	dayNotes: readonly DayNote[];
	trackedMetrics: readonly TrackedMetric[];
	reminders: readonly Reminder[];
	assessments: readonly Assessment[];
	goals: readonly Goal[];
	unitPreferences: readonly UnitPreference[];
	dailyMetrics: readonly DailyMetric[];
	habits: readonly Habit[];
	habitCompletions: readonly HabitCompletion[];
	challengeEnrolments: readonly ChallengeEnrolment[];
	challengeProgress: readonly ChallengeProgress[];
	intakeEvents: readonly IntakeEvent[];
	consumables: readonly Consumable[];
	recipeIngredients: readonly RecipeIngredient[];
	intakeStreams: readonly IntakeStream[];
	registry: readonly MetricDefinition[];
};

export type CheckInExportOptions = {
	appVersion: string;
	exportedAt: number;
	excludeSensitiveMetrics?: boolean;
};

export type CheckInExport = {
	metadata: {
		formatVersion: typeof CHECK_IN_EXPORT_FORMAT_VERSION;
		exportedAt: string;
		appVersion: string;
	};
	registry: {
		metrics: MetricDefinition[];
	};
	observations: Observation[];
	dayNotes: DayNote[];
	trackedMetrics: TrackedMetric[];
	reminders: Reminder[];
	assessments: Assessment[];
	goals: Goal[];
	unitPreferences: UnitPreference[];
	dailyMetrics: DailyMetric[];
	habits: Habit[];
	habitCompletions: HabitCompletion[];
	challengeEnrolments: ChallengeEnrolment[];
	challengeProgress: ChallengeProgress[];
	intakeEvents: IntakeEvent[];
	consumables: Consumable[];
	recipeIngredients: RecipeIngredient[];
	intakeStreams: IntakeStream[];
};

function compareText(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

function copyMetric(metric: MetricDefinition): MetricDefinition {
	return { ...metric };
}

function copyObservation(row: Observation): Observation {
	return {
		id: row.id,
		metricSlug: row.metricSlug,
		value: row.value,
		scaleMin: row.scaleMin,
		scaleMax: row.scaleMax,
		observedAt: row.observedAt,
		localDay: row.localDay,
		tzOffsetMinutes: row.tzOffsetMinutes,
		source: row.source,
		sourceRecordId: row.sourceRecordId,
		assessmentId: row.assessmentId,
		slot: row.slot,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function copyDayNote(note: DayNote): DayNote {
	return {
		id: note.id,
		localDay: note.localDay,
		body: note.body,
		createdAt: note.createdAt,
		updatedAt: note.updatedAt,
	};
}

function copyTrackedMetric(metric: TrackedMetric): TrackedMetric {
	return {
		id: metric.id,
		metricSlug: metric.metricSlug,
		position: metric.position,
		addedAt: metric.addedAt,
		removedAt: metric.removedAt,
		customLabel: metric.customLabel,
		checkInSlots: metric.checkInSlots,
		createdAt: metric.createdAt,
		updatedAt: metric.updatedAt,
	};
}

function copyReminder(reminder: Reminder): Reminder {
	return {
		id: reminder.id,
		minuteOfDay: reminder.minuteOfDay,
		daysOfWeek: reminder.daysOfWeek,
		slot: reminder.slot,
		enabled: reminder.enabled,
		createdAt: reminder.createdAt,
		updatedAt: reminder.updatedAt,
	};
}

function copyAssessment(assessment: Assessment): Assessment {
	return {
		id: assessment.id,
		templateSlug: assessment.templateSlug,
		templateVersion: assessment.templateVersion,
		startedAt: assessment.startedAt,
		completedAt: assessment.completedAt,
		items: assessment.items.map((item) => ({ ...item })),
		focusItemSlugs: [...assessment.focusItemSlugs],
		createdAt: assessment.createdAt,
		updatedAt: assessment.updatedAt,
	};
}

function copyGoal(goal: Goal): Goal {
	return {
		id: goal.id,
		metricSlug: goal.metricSlug,
		direction: goal.direction,
		targetValue: goal.targetValue,
		targetDate: goal.targetDate,
		startedAt: goal.startedAt,
		achievedAt: goal.achievedAt,
		abandonedAt: goal.abandonedAt,
		createdAt: goal.createdAt,
		updatedAt: goal.updatedAt,
	};
}

function copyUnitPreference(preference: UnitPreference): UnitPreference {
	return {
		id: preference.id,
		dimension: preference.dimension,
		unit: preference.unit,
		createdAt: preference.createdAt,
		updatedAt: preference.updatedAt,
	};
}

function copyDailyMetric(metric: DailyMetric): DailyMetric {
	return {
		id: metric.id,
		metricSlug: metric.metricSlug,
		localDay: metric.localDay,
		value: metric.value,
		source: metric.source,
		computedAt: metric.computedAt,
		createdAt: metric.createdAt,
		updatedAt: metric.updatedAt,
	};
}

function copyHabit(habit: Habit): Habit {
	return {
		id: habit.id,
		slug: habit.slug,
		customLabel: habit.customLabel,
		kind: habit.kind,
		metricSlug: habit.metricSlug,
		direction: habit.direction,
		targetValue: habit.targetValue,
		areaSlug: habit.areaSlug,
		daysOfWeek: habit.daysOfWeek,
		position: habit.position,
		addedAt: habit.addedAt,
		removedAt: habit.removedAt,
		createdAt: habit.createdAt,
		updatedAt: habit.updatedAt,
	};
}

function copyHabitCompletion(completion: HabitCompletion): HabitCompletion {
	return {
		id: completion.id,
		habitId: completion.habitId,
		localDay: completion.localDay,
		completedAt: completion.completedAt,
		createdAt: completion.createdAt,
		updatedAt: completion.updatedAt,
	};
}

function copyChallengeEnrolment(
	enrolment: ChallengeEnrolment,
): ChallengeEnrolment {
	return {
		id: enrolment.id,
		challengeSlug: enrolment.challengeSlug,
		title: enrolment.title,
		durationDays: enrolment.durationDays,
		areaSlug: enrolment.areaSlug,
		startedOn: enrolment.startedOn,
		completedAt: enrolment.completedAt,
		abandonedAt: enrolment.abandonedAt,
		createdAt: enrolment.createdAt,
		updatedAt: enrolment.updatedAt,
	};
}

function copyChallengeProgress(progress: ChallengeProgress): ChallengeProgress {
	return {
		id: progress.id,
		enrolmentId: progress.enrolmentId,
		dayIndex: progress.dayIndex,
		localDay: progress.localDay,
		completedAt: progress.completedAt,
		createdAt: progress.createdAt,
		updatedAt: progress.updatedAt,
	};
}

/**
 * Whether an intake row is sensitive: by content — a positive amount of a
 * sensitive constituent — or whole, by kind. The predicate reads the catalogue
 * and the kind list, so the next sensitive substance adds a definition there
 * rather than a clause here.
 */
function isSensitiveIntake(row: {
	kind: ConsumableKind;
	constituents: ConstituentAmounts;
}): boolean {
	return (
		isSensitiveConsumableKind(row.kind) ||
		carriesSensitiveConstituent(row.constituents)
	);
}

function copyConstituents(amounts: ConstituentAmounts): ConstituentAmounts {
	return { ...amounts };
}

function copyIntakeEvent(event: IntakeEvent): IntakeEvent {
	return {
		id: event.id,
		kind: event.kind,
		consumableId: event.consumableId,
		sourceRef: event.sourceRef,
		name: event.name,
		brand: event.brand,
		portionLabel: event.portionLabel,
		quantity: event.quantity,
		massKg: event.massKg,
		volumeL: event.volumeL,
		constituents: copyConstituents(event.constituents),
		context: event.context,
		notes: event.notes,
		occurredAt: event.occurredAt,
		localDay: event.localDay,
		tzOffsetMinutes: event.tzOffsetMinutes,
		createdAt: event.createdAt,
		updatedAt: event.updatedAt,
	};
}

function copyConsumable(consumable: Consumable): Consumable {
	return {
		id: consumable.id,
		kind: consumable.kind,
		name: consumable.name,
		brand: consumable.brand,
		barcode: consumable.barcode,
		basis: { ...consumable.basis },
		constituents: copyConstituents(consumable.constituents),
		portions: consumable.portions.map((portion) => ({ ...portion })),
		defaultPortionId: consumable.defaultPortionId,
		recipe:
			consumable.recipe === null
				? null
				: { yield: { ...consumable.recipe.yield } },
		source: { ...consumable.source },
		forkedFrom:
			consumable.forkedFrom === null ? null : { ...consumable.forkedFrom },
		archivedAt: consumable.archivedAt,
		createdAt: consumable.createdAt,
		updatedAt: consumable.updatedAt,
	};
}

function copyRecipeIngredient(ingredient: RecipeIngredient): RecipeIngredient {
	return {
		id: ingredient.id,
		recipeId: ingredient.recipeId,
		position: ingredient.position,
		consumableId: ingredient.consumableId,
		sourceRef: ingredient.sourceRef,
		name: ingredient.name,
		portionLabel: ingredient.portionLabel,
		quantity: ingredient.quantity,
		massKg: ingredient.massKg,
		volumeL: ingredient.volumeL,
		constituents: copyConstituents(ingredient.constituents),
		createdAt: ingredient.createdAt,
		updatedAt: ingredient.updatedAt,
	};
}

function copyIntakeStream(stream: IntakeStream): IntakeStream {
	return {
		id: stream.id,
		kind: stream.kind,
		enabledAt: stream.enabledAt,
		disabledAt: stream.disabledAt,
		createdAt: stream.createdAt,
		updatedAt: stream.updatedAt,
	};
}

export function buildCheckInExport(
	input: CheckInExportInput,
	options: CheckInExportOptions,
): CheckInExport {
	if (options.appVersion.trim().length === 0) {
		throw new TypeError("Export appVersion must not be empty.");
	}
	const exportedAt = new Date(options.exportedAt);
	if (Number.isNaN(exportedAt.getTime())) {
		throw new TypeError("Export exportedAt must be valid epoch milliseconds.");
	}

	const registryBySlug = new Map(
		input.registry.map((metric) => [metric.slug, metric]),
	);
	const lifeAreaBySlug = new Map<string, (typeof LIFE_AREA_CATALOGUE)[number]>(
		LIFE_AREA_CATALOGUE.map((area) => [area.slug, area]),
	);
	const includeSlug = (slug: string): boolean =>
		!options.excludeSensitiveMetrics ||
		registryBySlug.get(slug)?.sensitive !== true;
	const includeHabit = (habit: Habit): boolean => {
		if (!options.excludeSensitiveMetrics) return true;
		// Custom habits sit out even with a stored non-sensitive area: the
		// user-authored label is itself an unclassifiable disclosure.
		if (habit.slug.startsWith("habit:custom:")) return false;
		const template = resolveHabit(habit.slug);
		if (template?.sensitive === true) return false;
		if (habit.metricSlug !== null && !includeSlug(habit.metricSlug)) {
			return false;
		}
		// Fail closed like challenges: a habit whose area sensitivity is
		// unknowable (retired template and no resolvable snapshot) sits out.
		const areaSlug = habit.areaSlug ?? template?.areaSlug ?? null;
		const area = areaSlug === null ? undefined : lifeAreaBySlug.get(areaSlug);
		return area !== undefined && area.sensitive !== true;
	};
	const includeChallenge = (enrolment: ChallengeEnrolment): boolean => {
		if (!options.excludeSensitiveMetrics) return true;
		// A retired area's sensitivity is unknowable, so it sits out like custom habits.
		const area = lifeAreaBySlug.get(enrolment.areaSlug);
		return area !== undefined && area.sensitive !== true;
	};
	const includedHabitIds = new Set(
		input.habits.filter(includeHabit).map((habit) => habit.id),
	);
	const includedEnrolmentIds = new Set(
		input.challengeEnrolments
			.filter(includeChallenge)
			.map((enrolment) => enrolment.id),
	);
	// A library row is sensitive by the same rule as an event; its ingredient
	// rows follow the recipe they belong to.
	const includedConsumableIds = new Set(
		input.consumables
			.filter(
				(consumable) =>
					!options.excludeSensitiveMetrics || !isSensitiveIntake(consumable),
			)
			.map((consumable) => consumable.id),
	);

	return {
		metadata: {
			formatVersion: CHECK_IN_EXPORT_FORMAT_VERSION,
			exportedAt: exportedAt.toISOString(),
			appVersion: options.appVersion,
		},
		registry: {
			metrics: input.registry
				.filter((metric) => includeSlug(metric.slug))
				.map(copyMetric)
				.sort(
					(left, right) =>
						left.defaultPosition - right.defaultPosition ||
						compareText(left.slug, right.slug),
				),
		},
		observations: input.observations
			.filter((row) => includeSlug(row.metricSlug))
			.map(copyObservation)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.observedAt - right.observedAt ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		dayNotes: input.dayNotes
			.map(copyDayNote)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		trackedMetrics: input.trackedMetrics
			.filter((row) => includeSlug(row.metricSlug))
			.map(copyTrackedMetric)
			.sort(
				(left, right) =>
					left.position - right.position ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		reminders: input.reminders
			.map(copyReminder)
			.sort(
				(left, right) =>
					left.minuteOfDay - right.minuteOfDay ||
					compareText(left.id, right.id),
			),
		assessments: input.assessments
			.map(copyAssessment)
			.map((assessment) => {
				const items = assessment.items.filter((item) => includeSlug(item.slug));
				const includedItems = new Set(items.map((item) => item.slug));
				return {
					...assessment,
					items,
					focusItemSlugs: assessment.focusItemSlugs.filter((slug) =>
						includedItems.has(slug),
					),
				};
			})
			.filter((assessment) => assessment.items.length > 0)
			.sort(
				(left, right) =>
					(left.completedAt ?? left.startedAt) -
						(right.completedAt ?? right.startedAt) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		goals: input.goals
			.filter((goal) => includeSlug(goal.metricSlug))
			.map(copyGoal)
			.sort(
				(left, right) =>
					left.startedAt - right.startedAt ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		unitPreferences: input.unitPreferences
			.map(copyUnitPreference)
			.sort(
				(left, right) =>
					compareText(left.dimension, right.dimension) ||
					left.updatedAt - right.updatedAt ||
					compareText(left.id, right.id),
			),
		dailyMetrics: input.dailyMetrics
			.filter((row) => includeSlug(row.metricSlug))
			.map(copyDailyMetric)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					compareText(left.metricSlug, right.metricSlug) ||
					compareText(left.source, right.source) ||
					compareText(left.id, right.id),
			),
		habits: input.habits
			.filter((habit) => includedHabitIds.has(habit.id))
			.map(copyHabit)
			.sort(
				(left, right) =>
					left.position - right.position ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		habitCompletions: input.habitCompletions
			.filter((completion) => includedHabitIds.has(completion.habitId))
			.map(copyHabitCompletion)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.completedAt - right.completedAt ||
					compareText(left.id, right.id),
			),
		challengeEnrolments: input.challengeEnrolments
			.filter((enrolment) => includedEnrolmentIds.has(enrolment.id))
			.map(copyChallengeEnrolment)
			.sort(
				(left, right) =>
					compareText(left.startedOn, right.startedOn) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		challengeProgress: input.challengeProgress
			.filter((progress) => includedEnrolmentIds.has(progress.enrolmentId))
			.map(copyChallengeProgress)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.completedAt - right.completedAt ||
					left.dayIndex - right.dayIndex ||
					compareText(left.id, right.id),
			),
		intakeEvents: input.intakeEvents
			.filter(
				(event) =>
					!options.excludeSensitiveMetrics || !isSensitiveIntake(event),
			)
			.map(copyIntakeEvent)
			.sort(
				(left, right) =>
					compareText(left.localDay, right.localDay) ||
					left.occurredAt - right.occurredAt ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		consumables: input.consumables
			.filter((consumable) => includedConsumableIds.has(consumable.id))
			.map(copyConsumable)
			.sort(
				(left, right) =>
					left.createdAt - right.createdAt || compareText(left.id, right.id),
			),
		recipeIngredients: input.recipeIngredients
			.filter((ingredient) => includedConsumableIds.has(ingredient.recipeId))
			.map(copyRecipeIngredient)
			.sort(
				(left, right) =>
					compareText(left.recipeId, right.recipeId) ||
					left.position - right.position ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
		intakeStreams: input.intakeStreams
			.filter(
				(stream) =>
					!options.excludeSensitiveMetrics ||
					!isSensitiveStreamKind(stream.kind),
			)
			.map(copyIntakeStream)
			.sort(
				(left, right) =>
					compareText(left.kind, right.kind) ||
					left.createdAt - right.createdAt ||
					compareText(left.id, right.id),
			),
	};
}

export function serializeCheckInExport(
	input: CheckInExportInput,
	options: CheckInExportOptions,
): string {
	return `${JSON.stringify(buildCheckInExport(input, options), null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(record: Record<string, unknown>, key: string): void {
	if (!Array.isArray(record[key])) {
		throw new TypeError(`Export ${key} must be an array.`);
	}
}

/** Every collection the current format carries, in the order they are written. */
const EXPORT_COLLECTIONS = [
	"observations",
	"dayNotes",
	"trackedMetrics",
	"reminders",
	"assessments",
	"goals",
	"unitPreferences",
	"dailyMetrics",
	"habits",
	"habitCompletions",
	"challengeEnrolments",
	"challengeProgress",
	"intakeEvents",
	"consumables",
	"recipeIngredients",
	"intakeStreams",
] as const;

export function parseCheckInExport(serialized: string): CheckInExport {
	let parsed: unknown;
	try {
		parsed = JSON.parse(serialized);
	} catch {
		throw new TypeError("Export must be valid JSON.");
	}
	if (!isRecord(parsed) || !isRecord(parsed.metadata)) {
		throw new TypeError("Export metadata is required.");
	}
	if (parsed.metadata.formatVersion !== CHECK_IN_EXPORT_FORMAT_VERSION) {
		throw new RangeError(
			`Unsupported export format version: ${String(parsed.metadata.formatVersion)}`,
		);
	}
	if (!isRecord(parsed.registry)) {
		throw new TypeError("Export registry is required.");
	}
	requireArray(parsed.registry, "metrics");
	for (const key of EXPORT_COLLECTIONS) {
		requireArray(parsed, key);
	}

	return parsed as CheckInExport;
}
