/**
 * The app's pure computation layer: everything derived from records that have
 * already been read, with no database handle, no network, and no React.
 *
 * The split from `@bro/domain` is forced by the dependency graph rather than
 * chosen. Domain sits upstream of storage — catalogues, units, calendar
 * primitives — and the database package depends on it. Anything that reasons
 * about stored rows has to sit downstream of that, which is here.
 *
 * Keeping it free of platform imports is what lets its suite run under plain
 * vitest instead of the app's React Native test environment.
 */

export { formatLocalDayLabel } from "./calendar/local-day-label";

export {
	type ConsumptionMetricDayTotal,
	consumptionMetricDayTotal,
	consumptionMetricTrailingDailyMean,
} from "./consumption/daily-totals";
export {
	buildCheckInExport,
	CHECK_IN_EXPORT_FORMAT_VERSION,
	type CheckInExport,
	type CheckInExportInput,
	type CheckInExportOptions,
	parseCheckInExport,
	serializeCheckInExport,
} from "./export/check-in-export";
export {
	type GoalSeriesPoint,
	goalTargetReached,
	type ResolvedGoalProgress,
	resolveGoalProgress,
} from "./goals/goal-presentation";
export {
	type GoalStatus,
	goalProgressPercent,
	goalStatus,
} from "./goals/goal-progress";
export {
	deriveHabitAdherence,
	type HabitAdherenceDay,
	type HabitAdherenceInput,
	type HabitAdherenceState,
} from "./habits/adherence";
export {
	isHabitScheduled,
	scheduledDaysBetween,
} from "./habits/cadence";
export {
	type ChallengePosition,
	resolveChallengePosition,
} from "./habits/challenge-position";
export {
	habitMetricDayValue,
	isMetricHabitComplete,
	type MetricHabit,
} from "./habits/completion";
export {
	coveredFactorSlugs,
	type FactorCoveredHabit,
	habitFactorSlug,
} from "./habits/factor-coverage";
export {
	type HabitMetricSlug,
	isHabitMetricSlug,
} from "./habits/metric-support";
export { deriveHabitStreak, type HabitStreakInput } from "./habits/streak";
export {
	type CanonicalHealthSample,
	type HealthSampleUnit,
	localDayAt,
	mapPlatformSample,
	type PlatformHealthSample,
} from "./health/mapping";
export {
	formatMetricDelta,
	formatMetricValue,
	metricDisplayUnit,
} from "./health/metric-presentation";
export {
	HEALTH_BACKFILL_DAYS,
	type HealthMetricSlug,
	isHealthMetricSlug,
	RAW_SAMPLE_RETENTION_DAYS,
	V1_HEALTH_METRIC_SLUGS,
} from "./health/policy";
export {
	type ResolvedMetricDay,
	resolveMetricDay,
} from "./health/resolved-day";
export {
	importedDailyMetricAsObservation,
	type ResolvedMetricObservation,
	resolveMetricObservations,
} from "./health/resolved-series";
export {
	type AppliedHealthSampleChanges,
	applyHealthSampleChanges,
	type HealthSampleChanges,
	type HealthSampleIdentity,
	type RecomputedHealthRollup,
	rollupHealthSamples,
} from "./health/rollup";
export {
	createDailySignalReader,
	type DailySignal,
	type DailySignalReader,
	type DailySignalSource,
	readDailySignal,
} from "./insight/daily-signal";
export {
	aggregateInsightTeaser,
	evaluateInsight,
	INSIGHT_MIN_ARM_DAYS,
	INSIGHT_MIN_HALF_ARM_DAYS,
	INSIGHT_MIN_OUTPUT_DAYS,
	INSIGHT_WINDOW_DAYS,
	type InsightArm,
	type InsightEvaluation,
	type InsightGate,
	type InsightNotYet,
	type InsightTeaser,
	SCORED_EFFECT_FLOOR,
	type ShownInsight,
	type SignalReader,
	SLEEP_EFFECT_FLOOR_SECONDS,
} from "./insight/engine";
export {
	formatInsightValue,
	renderInsightSummary,
	renderInsightTeaserProgress,
} from "./insight/presentation";
export {
	type MeasurementPresentation,
	toMeasurementPresentation,
} from "./measurements/presentation";
export {
	EVERY_DAY_MASK,
	ISO_WEEKDAYS,
	type IsoWeekday,
	type IsoWeekdayIndex,
	includesWeekday,
	isoWeekdayIndex,
	orderedIsoWeekdays,
	weekdaysFromMask,
	weekdaysToMask,
} from "./reminders/day-bitmask";
export {
	MAX_PLANNED_NOTIFICATIONS,
	PLANNING_DAYS,
	type PlannedNotification,
	planReminderNotifications,
	REMINDER_NOTIFICATION_PREFIX,
} from "./reminders/reminder-planner";
export {
	isWheelReviewDue,
	WHEEL_REVIEW_INTERVAL_DAYS,
} from "./review/wheel-review-due";
export {
	buildTrendSeries,
	TREND_PERIODS,
	type TrendPeriod,
	type TrendPoint,
	type TrendSeries,
	trendRange,
} from "./trends/trend-math";
