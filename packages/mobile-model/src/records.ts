import type { HabitDirection } from "@bro/domain";

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

export type ConsumptionEntryKind = "drink" | "food";

export type ConsumptionEntry = {
	id: string;
	kind: ConsumptionEntryKind;
	catalogueRef: string | null;
	consumableRef: string | null;
	label: string;
	servingLabel: string | null;
	quantity: number;
	volumeL: number | null;
	ethanolKg: number | null;
	caffeineKg: number | null;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
	occurredAt: number;
	localDay: string;
	tzOffsetMinutes: number;
	createdAt: number;
	updatedAt: number;
};

type FoodSnapshotFields = Pick<
	ConsumptionEntry,
	"consumableRef" | "proteinG" | "carbsG" | "fatG"
>;

export type CreateConsumptionEntry = Omit<
	ConsumptionEntry,
	"id" | "createdAt" | "updatedAt" | keyof FoodSnapshotFields
> &
	Partial<FoodSnapshotFields>;

export type UpdateConsumptionEntry = Omit<CreateConsumptionEntry, "kind">;

export type CustomConsumableKind = "food" | "drink";

export type CustomConsumableServing = {
	id: string;
	label: string;
	volumeL: number | null;
	ethanolKg: number | null;
	caffeineKg: number | null;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

export type CustomConsumable = {
	id: string;
	kind: CustomConsumableKind;
	label: string;
	brand: string | null;
	isRecipe: boolean;
	servings: CustomConsumableServing[];
	createdAt: number;
	updatedAt: number;
};

export type CreateCustomConsumable = Pick<
	CustomConsumable,
	"kind" | "label" | "brand" | "isRecipe" | "servings"
>;

export type UpdateCustomConsumable = Omit<CreateCustomConsumable, "kind">;

export type CustomConsumableComponent = {
	id: string;
	consumableId: string;
	position: number;
	label: string;
	quantity: number;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateCustomConsumableComponent = Omit<
	CustomConsumableComponent,
	"id" | "consumableId" | "createdAt" | "updatedAt"
>;

export type UpdateCustomConsumableComponent = CreateCustomConsumableComponent;

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
	createdAt: number;
	updatedAt: number;
};

export type CreateObservation = Omit<
	Observation,
	"id" | "createdAt" | "updatedAt"
>;

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
	enabled: boolean;
	createdAt: number;
	updatedAt: number;
};

export type ReminderSchedule = Pick<Reminder, "minuteOfDay" | "daysOfWeek">;

export type TrackedMetric = {
	id: string;
	metricSlug: string;
	position: number;
	addedAt: number | null;
	removedAt: number | null;
	customLabel: string | null;
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
