import type { HabitDirection } from "@bro/domain";
import type { ConstituentAmounts } from "@bro/domain/constituent-catalogue";
import type {
	ConsumableComposition,
	ConsumableKind,
	ContentSource,
	IntakeContext,
	Portion,
	RecipeYield,
} from "@bro/domain/consumable";
import type {
	CheckInSlot,
	CheckInSlotAssignment,
} from "@bro/domain/metric-registry";

export type AssessmentItemSnapshot = {
	slug: string;
	label: string;
	position: number;
};

export type Assessment = {
	id: string;
	templateSlug: string;
	templateVersion: number;
	startedAt: number;
	completedAt: number | null;
	items: AssessmentItemSnapshot[];
	focusItemSlugs: string[];
	createdAt: number;
	updatedAt: number;
};

export type CreateAssessment = Omit<
	Assessment,
	"id" | "createdAt" | "updatedAt"
>;

export type ChallengeEnrolment = {
	id: string;
	challengeSlug: string;
	title: string;
	durationDays: number;
	areaSlug: string;
	startedOn: string;
	completedAt: number | null;
	abandonedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateChallengeEnrolment = Pick<
	ChallengeEnrolment,
	"challengeSlug" | "title" | "durationDays" | "areaSlug" | "startedOn"
>;

export type ChallengeProgress = {
	id: string;
	enrolmentId: string;
	dayIndex: number;
	localDay: string;
	completedAt: number;
	createdAt: number;
	updatedAt: number;
};

/**
 * A thing you can take in, as the library holds it: a name with a composition
 * — constituent amounts per basis, portions that scale the basis — and where
 * it came from. System consumables never reach this table; editing one forks
 * it here with `forkedFrom` naming the catalogue entry.
 */
export type Consumable = ConsumableComposition & {
	id: string;
	kind: ConsumableKind;
	name: string;
	brand: string | null;
	barcode: string | null;
	portions: Portion[];
	/** A recipe's composition is calculated from `recipe_ingredients`. */
	recipe: { yield: RecipeYield } | null;
	source: ContentSource;
	forkedFrom: ContentSource | null;
	/** Archived rather than deleted while an event still references the row. */
	archivedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateConsumable = Omit<
	Consumable,
	"id" | "createdAt" | "updatedAt" | "archivedAt" | "forkedFrom"
> & { forkedFrom?: ContentSource | null };

/** Provenance is fixed at creation; a fork is its own operation. */
export type UpdateConsumable = Pick<
	Consumable,
	| "name"
	| "brand"
	| "barcode"
	| "basis"
	| "constituents"
	| "portions"
	| "defaultPortionId"
	| "recipe"
> &
	Partial<Pick<Consumable, "kind">>;

/**
 * One line of a recipe: a reference to what went in, plus a snapshot of its
 * name and scaled constituents so the recipe still calculates after the
 * ingredient's consumable is edited, archived, or gone.
 */
export type RecipeIngredient = {
	id: string;
	recipeId: string;
	position: number;
	/** Library row, or null when the ingredient is a system item or has gone. */
	consumableId: string | null;
	sourceRef: string | null;
	name: string;
	portionLabel: string | null;
	quantity: number;
	massKg: number | null;
	volumeL: number | null;
	/** Scaled to this ingredient's quantity. */
	constituents: ConstituentAmounts;
	createdAt: number;
	updatedAt: number;
};

export type CreateRecipeIngredient = Omit<
	RecipeIngredient,
	"id" | "recipeId" | "createdAt" | "updatedAt"
>;

export type UpdateRecipeIngredient = CreateRecipeIngredient;

/**
 * What was taken, when. Everything displayed is snapshotted from the
 * consumable at log time and already scaled by quantity; `consumableId` and
 * `sourceRef` exist for re-lookup only, never for display.
 */
export type IntakeEvent = {
	id: string;
	/** The consumable's kind at log time; partitions the stream views. */
	kind: ConsumableKind;
	consumableId: string | null;
	sourceRef: string | null;
	name: string;
	brand: string | null;
	portionLabel: string | null;
	quantity: number;
	/** Amount consumed, where known: provenance, not a total. */
	massKg: number | null;
	volumeL: number | null;
	/** code → canonical amount, already × quantity. Unknown codes survive. */
	constituents: ConstituentAmounts;
	context: IntakeContext | null;
	notes: string | null;
	occurredAt: number;
	localDay: string;
	tzOffsetMinutes: number;
	createdAt: number;
	updatedAt: number;
};

export type CreateIntakeEvent = Omit<
	IntakeEvent,
	"id" | "createdAt" | "updatedAt"
>;

export type UpdateIntakeEvent = Omit<CreateIntakeEvent, "kind">;

/**
 * Which optional streams are on. Food and drink are always on and never have
 * a row; the others are off on a fresh install and switched on here.
 */
export type IntakeStream = {
	id: string;
	kind: ConsumableKind;
	enabledAt: number;
	disabledAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type DailyMetric = {
	id: string;
	metricSlug: string;
	localDay: string;
	value: number;
	source: string;
	computedAt: number;
	createdAt: number;
	updatedAt: number;
};

export type UpsertDailyMetric = {
	metricSlug: string;
	localDay: string;
	value: number;
	source: string;
	computedAt?: number;
};

export type DayNote = {
	id: string;
	localDay: string;
	body: string;
	createdAt: number;
	updatedAt: number;
};

export type FoodCacheEntry<Payload = unknown> = {
	ref: string;
	payload: Payload;
	query: string | null;
	fetchedAt: number;
};

export type UpsertFoodCacheEntry<Payload = unknown> = Pick<
	FoodCacheEntry<Payload>,
	"ref" | "payload" | "query"
>;

export type GoalDirection = "increase" | "decrease";

export type Goal = {
	id: string;
	metricSlug: string;
	direction: GoalDirection;
	targetValue: number;
	targetDate: string | null;
	startedAt: number;
	achievedAt: number | null;
	abandonedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateGoal = Pick<
	Goal,
	"metricSlug" | "direction" | "targetValue" | "targetDate" | "startedAt"
>;

export type HabitKind = "manual" | "metric";

export type Habit = {
	id: string;
	slug: string;
	customLabel: string | null;
	kind: HabitKind;
	metricSlug: string | null;
	direction: HabitDirection | null;
	targetValue: number | null;
	areaSlug: string | null;
	daysOfWeek: number;
	position: number;
	addedAt: number;
	removedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateHabit = Pick<
	Habit,
	| "slug"
	| "customLabel"
	| "kind"
	| "metricSlug"
	| "direction"
	| "targetValue"
	| "areaSlug"
	| "daysOfWeek"
	| "position"
>;

export type UpdateHabit = Pick<
	Habit,
	"customLabel" | "targetValue" | "areaSlug" | "daysOfWeek" | "position"
>;

export type HabitCompletion = {
	id: string;
	habitId: string;
	localDay: string;
	completedAt: number;
	createdAt: number;
	updatedAt: number;
};

export type HealthPlatform = "healthkit" | "health_connect";

export type HealthConnection = {
	id: string;
	platform: HealthPlatform;
	metricSlug: string;
	changeToken: string | null;
	connectedAt: number;
	lastImportedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type Observation = {
	id: string;
	metricSlug: string;
	value: number;
	scaleMin: number | null;
	scaleMax: number | null;
	observedAt: number;
	localDay: string;
	tzOffsetMinutes: number;
	source: string;
	sourceRecordId: string | null;
	assessmentId: string | null;
	/**
	 * The sitting a check-in row was recorded in. Null on everything that is not
	 * a check-in, and on check-ins written before slots existed.
	 */
	slot: CheckInSlot | null;
	createdAt: number;
	updatedAt: number;
};

/**
 * Only the check-in names a sitting, so `slot` is optional here and defaults
 * to null — a body measurement or an imported sample never has to say it has
 * no sitting.
 */
export type CreateObservation = Omit<
	Observation,
	"id" | "createdAt" | "updatedAt" | "slot"
> & { slot?: CheckInSlot | null };

export type UpdateObservation = Pick<
	Observation,
	| "value"
	| "scaleMin"
	| "scaleMax"
	| "observedAt"
	| "localDay"
	| "tzOffsetMinutes"
>;

export type CreateAssessmentObservation = Omit<
	CreateObservation,
	"assessmentId"
>;

export type CreateAssessmentWithObservations = CreateAssessment & {
	observations: CreateAssessmentObservation[];
};

export type SavedAssessment = {
	assessment: Assessment;
	observations: Observation[];
};

export type RawSample = {
	id: string;
	metricSlug: string;
	value: number;
	startedAt: number;
	endedAt: number;
	localDay: string;
	source: string;
	sourceRecordId: string;
	/** Recording app/device identity within the platform; null when unknown. */
	origin: string | null;
	importedAt: number;
};

export type UpsertRawSample = Omit<
	RawSample,
	"id" | "origin" | "importedAt"
> & {
	origin?: string | null;
	importedAt?: number;
};

export type Reminder = {
	id: string;
	minuteOfDay: number;
	daysOfWeek: number;
	/**
	 * The sitting this reminder nags for, so completing one does not silence the
	 * other.
	 */
	slot: CheckInSlot;
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

export type ReminderSchedule = Pick<
	Reminder,
	"minuteOfDay" | "daysOfWeek" | "slot"
>;

export type TrackedMetric = {
	id: string;
	metricSlug: string;
	position: number;
	addedAt: number | null;
	removedAt: number | null;
	customLabel: string | null;
	/**
	 * Overrides which sittings ask this score. Null falls back to the registry
	 * default, so a metric the user has never re-slotted follows the catalogue
	 * as it changes.
	 */
	checkInSlots: CheckInSlotAssignment | null;
	createdAt: number;
	updatedAt: number;
};

export type TrackedMetricConfiguration = {
	metricSlug: string;
	position: number;
	enabled: boolean;
};

export type UnitPreference = {
	id: string;
	dimension: string;
	unit: string;
	createdAt: number;
	updatedAt: number;
};
