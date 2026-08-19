import type { HabitDirection } from "../tracking";
import type { LifeAreaSlug } from "./life-area-catalogue";
import type {
	ConsumptionDerivedMeasurementSlug,
	ImportedOnlyMeasurementSlug,
} from "./metric-registry";

export type { HabitDirection } from "../tracking";

type HabitTemplateBase = {
	slug: `habit:${string}`;
	label: string;
	description: string;
	areaSlug: LifeAreaSlug;
	defaultDaysOfWeek: number;
	defaultPosition: number;
	sensitive: boolean;
};

export type ManualHabitTemplate = HabitTemplateBase & {
	kind: "manual";
	metricSlug: null;
	direction: null;
	defaultTargetValue: null;
};

export type MetricHabitTemplate = HabitTemplateBase & {
	kind: "metric";
	metricSlug: ImportedOnlyMeasurementSlug | ConsumptionDerivedMeasurementSlug;
	direction: HabitDirection;
	defaultTargetValue: number;
};

export type HabitTemplate = ManualHabitTemplate | MetricHabitTemplate;

const EVERY_DAY = 0b111_1111;
const WEEKDAYS = 0b001_1111;
const MONDAY_WEDNESDAY_FRIDAY = 0b001_0101;
const MONDAY = 0b000_0001;
const SATURDAY = 0b010_0000;
const SUNDAY = 0b100_0000;

/**
 * Authored defaults only. Creating a habit snapshots these values into bro.db,
 * so copy and targets can evolve without rewriting anyone's active habit.
 */
export const HABIT_CATALOGUE = [
	{
		slug: "habit:steps-10k",
		label: "Walk 10,000 steps",
		description: "Build everyday movement from the steps your device records.",
		kind: "metric",
		metricSlug: "steps",
		direction: "at_least",
		defaultTargetValue: 10_000,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:health",
		sensitive: false,
		defaultPosition: 0,
	},
	{
		slug: "habit:sleep-7h",
		label: "Sleep for seven hours",
		description: "Aim for seven hours of sleep recorded by your device.",
		kind: "metric",
		metricSlug: "sleep_duration",
		direction: "at_least",
		defaultTargetValue: 25_200,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:health",
		sensitive: false,
		defaultPosition: 1,
	},
	{
		slug: "habit:alcohol-free",
		label: "Have an alcohol-free day",
		description:
			"Counts automatically from your drink log: a day with no alcohol logged is alcohol-free.",
		kind: "metric",
		metricSlug: "alcohol_intake",
		direction: "at_most",
		defaultTargetValue: 0,
		defaultDaysOfWeek: WEEKDAYS,
		areaSlug: "wheel:sobriety",
		sensitive: true,
		defaultPosition: 2,
	},
	{
		slug: "habit:training",
		label: "Train",
		description:
			"Make space for a purposeful session on your scheduled training days.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: MONDAY_WEDNESDAY_FRIDAY,
		areaSlug: "wheel:health",
		sensitive: false,
		defaultPosition: 3,
	},
	{
		slug: "habit:outdoors",
		label: "Get outdoors",
		description: "Spend a little time outside every day.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:health",
		sensitive: false,
		defaultPosition: 4,
	},
	{
		slug: "habit:reading",
		label: "Read",
		description: "Read something chosen for curiosity, learning, or pleasure.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:growth",
		sensitive: false,
		defaultPosition: 5,
	},
	{
		slug: "habit:meditation",
		label: "Meditate",
		description: "Pause for a deliberate moment of stillness or reflection.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:purpose",
		sensitive: false,
		defaultPosition: 6,
	},
	{
		slug: "habit:call-someone",
		label: "Call someone",
		description: "Make one unhurried call to someone you care about.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SUNDAY,
		areaSlug: "wheel:friends",
		sensitive: false,
		defaultPosition: 7,
	},
	{
		slug: "habit:date-night",
		label: "Make time for us",
		description: "Protect a regular block of time for your relationship.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SATURDAY,
		areaSlug: "wheel:partner",
		sensitive: false,
		defaultPosition: 8,
	},
	{
		slug: "habit:tidy-reset",
		label: "Reset one space",
		description: "Give one part of your home a quick, useful reset.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SUNDAY,
		areaSlug: "wheel:environment",
		sensitive: false,
		defaultPosition: 9,
	},
	{
		slug: "habit:weekly-priority",
		label: "Choose the week's priority",
		description: "Name the work outcome that matters most this week.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: MONDAY,
		areaSlug: "wheel:career",
		sensitive: false,
		defaultPosition: 10,
	},
	{
		slug: "habit:money-check-in",
		label: "Check in with your money",
		description: "Look at your balances and recent spending without judging.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SUNDAY,
		areaSlug: "wheel:money",
		sensitive: false,
		defaultPosition: 11,
	},
	{
		slug: "habit:family-moment",
		label: "Make a family moment",
		description: "Give one family connection your deliberate attention.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SUNDAY,
		areaSlug: "wheel:family",
		sensitive: false,
		defaultPosition: 12,
	},
	{
		slug: "habit:fun-break",
		label: "Do something for fun",
		description:
			"Make time for something enjoyable with no productive purpose.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: SATURDAY,
		areaSlug: "wheel:fun",
		sensitive: false,
		defaultPosition: 13,
	},
	{
		slug: "habit:quiet-reflection",
		label: "Take a quiet moment",
		description:
			"Spend a few minutes in prayer, contemplation, or simple stillness.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:faith",
		sensitive: true,
		defaultPosition: 14,
	},
	{
		slug: "habit:fatherhood-moment",
		label: "Be present as a dad",
		description:
			"Give your child a stretch of full attention and let them lead it.",
		kind: "manual",
		metricSlug: null,
		direction: null,
		defaultTargetValue: null,
		defaultDaysOfWeek: EVERY_DAY,
		areaSlug: "wheel:fatherhood",
		sensitive: false,
		defaultPosition: 15,
	},
] as const satisfies readonly HabitTemplate[];

const habitsBySlug = new Map<string, HabitTemplate>(
	HABIT_CATALOGUE.map((habit) => [habit.slug, habit]),
);

export function resolveHabit(slug: string): HabitTemplate | null {
	return habitsBySlug.get(slug) ?? null;
}

export function habitsForArea(areaSlug: string): HabitTemplate[] {
	return HABIT_CATALOGUE.filter((habit) => habit.areaSlug === areaSlug);
}
