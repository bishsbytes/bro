import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	type MetricDefinition,
	resolveMetric,
} from "@bro/domain/metric-registry";
import type {
	Assessment,
	ChallengeEnrolment,
	ChallengeProgress,
	ConsumptionEntry,
	CustomConsumable,
	CustomConsumableComponent,
	DailyMetric,
	DayNote,
	Goal,
	Habit,
	HabitCompletion,
	Observation,
	Reminder,
	TrackedMetric,
	UnitPreference,
} from "@bro/mobile-model";
import {
	buildCheckInExport,
	CHECK_IN_EXPORT_FORMAT_VERSION,
	parseCheckInExport,
	serializeCheckInExport,
} from "./check-in-export";

function knownMetric(slug: string): MetricDefinition {
	const resolved = resolveMetric(slug);
	if (resolved.kind !== "known") {
		throw new Error(`Expected ${slug} to be registered.`);
	}
	return resolved.metric;
}

const moodObservation: Observation = {
	id: "observation-mood",
	metricSlug: "mood",
	value: 4,
	scaleMin: 1,
	scaleMax: 5,
	observedAt: 1_786_701_600_000,
	localDay: "2026-08-14",
	tzOffsetMinutes: -60,
	source: "user",
	sourceRecordId: null,
	assessmentId: null,
	slot: "morning",
	createdAt: 1_786_701_600_100,
	updatedAt: 1_786_701_600_100,
};

const note: DayNote = {
	id: "note-1",
	localDay: "2026-08-14",
	body: "A useful day",
	createdAt: 1_786_708_800_000,
	updatedAt: 1_786_708_800_000,
};

const trackedAlcohol: TrackedMetric = {
	id: "tracked-alcohol",
	metricSlug: "alcohol",
	position: 6,
	addedAt: null,
	removedAt: 1_786_708_800_000,
	customLabel: null,
	checkInSlots: null,
	createdAt: 1_786_708_800_000,
	updatedAt: 1_786_708_800_000,
};

const eveningReminder: Reminder = {
	id: "reminder-evening",
	minuteOfDay: 20 * 60,
	daysOfWeek: 0b111_1111,
	slot: "evening",
	enabled: true,
	createdAt: 1_786_708_800_000,
	updatedAt: 1_786_708_800_000,
};

const assessment: Assessment = {
	id: "assessment-1",
	templateSlug: "wheel-of-life",
	templateVersion: 1,
	startedAt: 1_786_707_100_000,
	completedAt: 1_786_707_400_000,
	items: [{ slug: "wheel:career", label: "Business", position: 0 }],
	focusItemSlugs: ["wheel:career"],
	createdAt: 1_786_707_400_100,
	updatedAt: 1_786_707_400_100,
};

const goal: Goal = {
	id: "goal-1",
	metricSlug: "wheel:career",
	direction: "increase",
	targetValue: 8,
	targetDate: "2026-12-01",
	startedAt: 1_786_708_000_000,
	achievedAt: null,
	abandonedAt: null,
	createdAt: 1_786_708_000_000,
	updatedAt: 1_786_708_000_000,
};

const unitPreferences: UnitPreference[] = [
	{
		id: "unit-length",
		dimension: "length",
		unit: "cm",
		createdAt: 1_786_708_100_000,
		updatedAt: 1_786_708_100_000,
	},
	{
		id: "unit-mass",
		dimension: "mass",
		unit: "st",
		createdAt: 1_786_708_000_000,
		updatedAt: 1_786_708_000_000,
	},
];

const stepsDailyMetric: DailyMetric = {
	id: "daily-steps",
	metricSlug: "steps",
	localDay: "2026-08-13",
	value: 12_345,
	source: "health_connect",
	computedAt: 1_786_621_200_000,
	createdAt: 1_786_621_200_100,
	updatedAt: 1_786_621_200_100,
};

const restingHeartRateDailyMetric: DailyMetric = {
	...stepsDailyMetric,
	id: "daily-resting-heart-rate",
	metricSlug: "resting_heart_rate",
	value: 58,
};

const readingHabit: Habit = {
	id: "habit-reading",
	slug: "habit:reading",
	customLabel: "Read fiction",
	kind: "manual",
	metricSlug: null,
	direction: null,
	targetValue: null,
	areaSlug: "wheel:growth",
	daysOfWeek: 0b111_1111,
	position: 0,
	addedAt: 1_786_621_000_000,
	removedAt: null,
	createdAt: 1_786_621_000_000,
	updatedAt: 1_786_621_000_000,
};

const readingCompletion: HabitCompletion = {
	id: "completion-reading",
	habitId: readingHabit.id,
	localDay: "2026-08-13",
	completedAt: 1_786_621_300_000,
	createdAt: 1_786_621_300_000,
	updatedAt: 1_786_621_300_000,
};

const healthEnrolment: ChallengeEnrolment = {
	id: "enrolment-health",
	challengeSlug: "challenge:health-basics",
	title: "Back to the health basics",
	durationDays: 3,
	areaSlug: "wheel:health",
	startedOn: "2026-08-13",
	completedAt: null,
	abandonedAt: null,
	createdAt: 1_786_621_400_000,
	updatedAt: 1_786_621_400_000,
};

const healthProgress: ChallengeProgress = {
	id: "progress-health-1",
	enrolmentId: healthEnrolment.id,
	dayIndex: 1,
	localDay: "2026-08-13",
	completedAt: 1_786_621_500_000,
	createdAt: 1_786_621_500_000,
	updatedAt: 1_786_621_500_000,
};

const caffeineEntry: ConsumptionEntry = {
	id: "consumption-coffee",
	kind: "drink",
	catalogueRef: "drink:filter-coffee",
	consumableRef: null,
	label: "Filter coffee",
	servingLabel: "mug",
	quantity: 1,
	volumeL: 0.25,
	ethanolKg: 0,
	caffeineKg: 0.000_095,
	nicotineKg: null,
	energyKcal: 2,
	proteinG: null,
	carbsG: null,
	fatG: null,
	occurredAt: 1_786_621_600_000,
	localDay: "2026-08-13",
	tzOffsetMinutes: -60,
	createdAt: 1_786_621_600_100,
	updatedAt: 1_786_621_600_100,
};

const alcoholEntry: ConsumptionEntry = {
	...caffeineEntry,
	id: "consumption-lager",
	catalogueRef: "drink:lager",
	label: "Lager",
	servingLabel: "pint",
	volumeL: 0.568_261_25,
	ethanolKg: 0.020_181_999,
	caffeineKg: 0,
	energyKcal: 227,
	occurredAt: 1_786_621_500_000,
	createdAt: 1_786_621_500_100,
	updatedAt: 1_786_621_500_100,
};

const fluidEntry: ConsumptionEntry = {
	...caffeineEntry,
	id: "consumption-water",
	catalogueRef: "drink:water",
	label: "Water",
	servingLabel: "glass",
	volumeL: 0.3,
	ethanolKg: null,
	caffeineKg: null,
	energyKcal: 0,
	occurredAt: 1_786_621_700_000,
	createdAt: 1_786_621_700_100,
	updatedAt: 1_786_621_700_100,
};

const nicotineEntry: ConsumptionEntry = {
	...caffeineEntry,
	id: "consumption-cigarette",
	kind: "nicotine",
	catalogueRef: "nicotine:cigarette",
	label: "Cigarette",
	servingLabel: "cigarette",
	volumeL: null,
	ethanolKg: null,
	caffeineKg: null,
	nicotineKg: 1.2e-6,
	energyKcal: null,
	occurredAt: 1_786_621_900_000,
	createdAt: 1_786_621_900_100,
	updatedAt: 1_786_621_900_100,
};

const foodEntry: ConsumptionEntry = {
	id: "consumption-chicken-rice",
	kind: "food",
	catalogueRef: null,
	consumableRef: "custom:custom-chicken-rice",
	label: "Chicken and rice",
	servingLabel: "bowl",
	quantity: 1,
	volumeL: null,
	ethanolKg: null,
	caffeineKg: null,
	nicotineKg: null,
	energyKcal: 430,
	proteinG: 38,
	carbsG: 0,
	fatG: null,
	occurredAt: 1_786_621_800_000,
	localDay: "2026-08-13",
	tzOffsetMinutes: -60,
	createdAt: 1_786_621_800_100,
	updatedAt: 1_786_621_800_100,
};

const customYoghurt: CustomConsumable = {
	id: "custom-yoghurt",
	kind: "food",
	label: "Greek yoghurt",
	brand: "Corner shop",
	isRecipe: false,
	servings: [
		{
			id: "pot",
			label: "1 pot",
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: 120,
			proteinG: 15,
			carbsG: 0,
			fatG: null,
		},
	],
	createdAt: 1_786_620_000_000,
	updatedAt: 1_786_620_000_000,
};

const chickenRiceRecipe: CustomConsumable = {
	id: "custom-chicken-rice",
	kind: "food",
	label: "Chicken and rice",
	brand: null,
	isRecipe: true,
	servings: [
		{
			id: "bowl",
			label: "1 bowl",
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: 430,
			proteinG: 38,
			carbsG: 0,
			fatG: null,
		},
	],
	createdAt: 1_786_620_100_000,
	updatedAt: 1_786_620_100_000,
};

const chickenComponent: CustomConsumableComponent = {
	id: "component-chicken",
	consumableId: chickenRiceRecipe.id,
	position: 0,
	label: "Chicken thigh",
	quantity: 2,
	energyKcal: 260,
	proteinG: 38,
	carbsG: 0,
	fatG: null,
	createdAt: 1_786_620_100_100,
	updatedAt: 1_786_620_100_100,
};

describe("check-in export", () => {
	it("matches the golden file and round-trips food snapshots", () => {
		const input = {
			observations: [],
			dayNotes: [],
			trackedMetrics: [],
			reminders: [],
			assessments: [],
			goals: [],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
			consumptionEntries: [foodEntry],
			customConsumables: [chickenRiceRecipe, customYoghurt],
			customConsumableComponents: [chickenComponent],
			registry: [],
		};
		const serialized = serializeCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		const golden = readFileSync(
			join(__dirname, "__fixtures__", "check-in-export.json"),
			"utf8",
		);

		expect(serialized).toBe(`${golden.trimEnd()}\n`);
		expect(JSON.parse(serialized).metadata.formatVersion).toBe(
			CHECK_IN_EXPORT_FORMAT_VERSION,
		);
		expect(parseCheckInExport(serialized)).toEqual(
			buildCheckInExport(input, {
				appVersion: "1.0.0",
				exportedAt: 1_786_708_800_000,
			}),
		);
	});

	it("rejects an export written by an unknown format version", () => {
		const golden = JSON.parse(
			readFileSync(
				join(__dirname, "__fixtures__", "check-in-export.json"),
				"utf8",
			),
		);

		expect(() =>
			parseCheckInExport(
				JSON.stringify({
					...golden,
					metadata: {
						...golden.metadata,
						formatVersion: CHECK_IN_EXPORT_FORMAT_VERSION + 1,
					},
				}),
			),
		).toThrow(RangeError);
	});

	it("rejects an export missing a collection the format requires", () => {
		const golden = JSON.parse(
			readFileSync(
				join(__dirname, "__fixtures__", "check-in-export.json"),
				"utf8",
			),
		);
		const { customConsumableComponents: _omitted, ...withoutComponents } =
			golden;

		expect(() => parseCheckInExport(JSON.stringify(withoutComponents))).toThrow(
			TypeError,
		);
	});

	it("includes sensitive metrics by default and can deliberately exclude them", () => {
		const moodMetric = knownMetric("mood");
		if (moodMetric.kind !== "scored") {
			throw new Error("Expected mood to be a scored metric.");
		}
		const sensitiveMetric: MetricDefinition = {
			...moodMetric,
			slug: "libido",
			label: "Libido",
			sensitive: true,
		};
		const sensitiveObservation: Observation = {
			...moodObservation,
			id: "observation-libido",
			metricSlug: "libido",
		};
		const unknownObservation: Observation = {
			...moodObservation,
			id: "observation-future",
			metricSlug: "future_metric",
		};
		const sensitiveOverlay: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-libido",
			metricSlug: "libido",
		};
		const unknownOverlay: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-future",
			metricSlug: "future_metric",
		};

		const sensitiveWheelAssessment: Assessment = {
			...assessment,
			id: "assessment-2",
			items: [
				{ slug: "wheel:career", label: "Business", position: 0 },
				{ slug: "wheel:sobriety", label: "Sobriety & recovery", position: 1 },
			],
			focusItemSlugs: ["wheel:sobriety"],
		};
		const sensitiveWheelGoal: Goal = {
			...goal,
			id: "goal-2",
			metricSlug: "wheel:sobriety",
		};
		const sensitiveCatalogueHabit: Habit = {
			...readingHabit,
			id: "habit-alcohol-free",
			slug: "habit:alcohol-free",
			customLabel: null,
			areaSlug: "wheel:sobriety",
			position: 1,
		};
		// A stored non-sensitive area does not rescue a custom habit: its
		// user-authored label is itself a disclosure.
		const customHabit: Habit = {
			...readingHabit,
			id: "habit-custom",
			slug: "habit:custom:private",
			customLabel: "Private routine",
			areaSlug: "wheel:growth",
			position: 2,
		};
		const sensitiveMetricHabit: Habit = {
			...readingHabit,
			id: "habit-heart",
			slug: "habit:heart",
			customLabel: null,
			kind: "metric",
			metricSlug: "resting_heart_rate",
			direction: "at_most",
			targetValue: 60,
			areaSlug: "wheel:health",
			position: 3,
		};
		// Retired template, no snapshot: sensitivity is unknowable, so it sits
		// out like a retired-area challenge instead of leaking.
		const retiredUnknowableHabit: Habit = {
			...readingHabit,
			id: "habit-retired-unknowable",
			slug: "habit:retired",
			customLabel: null,
			areaSlug: null,
			position: 4,
		};
		const retiredClassifiedHabit: Habit = {
			...readingHabit,
			id: "habit-retired-classified",
			slug: "habit:retired-classified",
			customLabel: null,
			areaSlug: "wheel:growth",
			position: 5,
		};
		const retiredSensitiveAreaHabit: Habit = {
			...readingHabit,
			id: "habit-retired-sensitive",
			slug: "habit:retired-sensitive",
			customLabel: null,
			areaSlug: "wheel:faith",
			position: 6,
		};
		const completionFor = (habit: Habit): HabitCompletion => ({
			...readingCompletion,
			id: `completion-${habit.id}`,
			habitId: habit.id,
		});
		const faithEnrolment: ChallengeEnrolment = {
			...healthEnrolment,
			id: "enrolment-faith",
			challengeSlug: "challenge:faith-reflection",
			title: "A grounded faith practice",
			areaSlug: "wheel:faith",
		};
		const faithProgress: ChallengeProgress = {
			...healthProgress,
			id: "progress-faith-1",
			enrolmentId: faithEnrolment.id,
		};
		const retiredAreaEnrolment: ChallengeEnrolment = {
			...healthEnrolment,
			id: "enrolment-retired",
			challengeSlug: "challenge:retired-programme",
			title: "A retired programme",
			areaSlug: "wheel:retired",
		};
		const retiredAreaProgress: ChallengeProgress = {
			...healthProgress,
			id: "progress-retired-1",
			enrolmentId: retiredAreaEnrolment.id,
		};

		const input = {
			observations: [moodObservation, sensitiveObservation, unknownObservation],
			dayNotes: [note],
			trackedMetrics: [sensitiveOverlay, unknownOverlay],
			reminders: [],
			assessments: [sensitiveWheelAssessment],
			goals: [sensitiveWheelGoal],
			unitPreferences,
			dailyMetrics: [restingHeartRateDailyMetric, stepsDailyMetric],
			habits: [
				readingHabit,
				sensitiveCatalogueHabit,
				customHabit,
				sensitiveMetricHabit,
				retiredUnknowableHabit,
				retiredClassifiedHabit,
				retiredSensitiveAreaHabit,
			],
			habitCompletions: [
				readingCompletion,
				completionFor(sensitiveCatalogueHabit),
				completionFor(customHabit),
				completionFor(sensitiveMetricHabit),
				completionFor(retiredUnknowableHabit),
				completionFor(retiredClassifiedHabit),
				completionFor(retiredSensitiveAreaHabit),
			],
			challengeEnrolments: [
				healthEnrolment,
				faithEnrolment,
				retiredAreaEnrolment,
			],
			challengeProgress: [healthProgress, faithProgress, retiredAreaProgress],
			consumptionEntries: [],
			customConsumables: [],
			customConsumableComponents: [],
			registry: [
				knownMetric("mood"),
				sensitiveMetric,
				knownMetric("wheel:career"),
				knownMetric("wheel:sobriety"),
				knownMetric("resting_heart_rate"),
			],
		};
		const included = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		expect(included.observations.map((row) => row.metricSlug)).toContain(
			"libido",
		);
		expect(included.assessments[0]?.items.map((item) => item.slug)).toEqual([
			"wheel:career",
			"wheel:sobriety",
		]);
		expect(included.goals.map((row) => row.metricSlug)).toEqual([
			"wheel:sobriety",
		]);
		expect(included.dailyMetrics.map((row) => row.metricSlug)).toEqual([
			"resting_heart_rate",
			"steps",
		]);
		expect(included.habits).toHaveLength(7);
		expect(included.habitCompletions).toHaveLength(7);
		expect(included.challengeEnrolments).toHaveLength(3);
		expect(included.challengeProgress).toHaveLength(3);

		const exported = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
			excludeSensitiveMetrics: true,
		});

		expect(exported.registry.metrics.map((metric) => metric.slug)).toEqual([
			"mood",
			"wheel:career",
		]);
		expect(exported.observations.map((row) => row.metricSlug)).toEqual([
			"future_metric",
			"mood",
		]);
		expect(exported.trackedMetrics.map((row) => row.metricSlug)).toEqual([
			"future_metric",
		]);
		expect(exported.dayNotes).toEqual([note]);
		expect(exported.assessments).toHaveLength(1);
		expect(exported.assessments[0]?.items.map((item) => item.slug)).toEqual([
			"wheel:career",
		]);
		expect(exported.assessments[0]?.focusItemSlugs).toEqual([]);
		expect(exported.goals).toEqual([]);
		expect(exported.unitPreferences).toEqual(unitPreferences);
		expect(exported.dailyMetrics).toEqual([stepsDailyMetric]);
		expect(exported.habits).toEqual([readingHabit, retiredClassifiedHabit]);
		expect(exported.habitCompletions).toEqual([
			completionFor(retiredClassifiedHabit),
			readingCompletion,
		]);
		expect(exported.challengeEnrolments).toEqual([healthEnrolment]);
		expect(exported.challengeProgress).toEqual([healthProgress]);
	});

	it("excludes whole ethanol entries and every alcohol metric reference", () => {
		const trackedAlcoholIntake: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-alcohol-intake",
			metricSlug: "alcohol_intake",
		};
		const trackedCaffeine: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-caffeine-intake",
			metricSlug: "caffeine_intake",
		};
		const alcoholGoal: Goal = {
			...goal,
			id: "goal-alcohol",
			metricSlug: "alcohol_intake",
		};
		const caffeineGoal: Goal = {
			...goal,
			id: "goal-caffeine",
			metricSlug: "caffeine_intake",
		};
		const trackedNicotine: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-nicotine-intake",
			metricSlug: "nicotine_intake",
		};
		const nicotineGoal: Goal = {
			...goal,
			id: "goal-nicotine",
			metricSlug: "nicotine_intake",
		};
		const input = {
			observations: [],
			dayNotes: [],
			trackedMetrics: [trackedAlcoholIntake, trackedCaffeine, trackedNicotine],
			reminders: [],
			assessments: [],
			goals: [alcoholGoal, caffeineGoal, nicotineGoal],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
			consumptionEntries: [
				fluidEntry,
				alcoholEntry,
				caffeineEntry,
				nicotineEntry,
			],
			customConsumables: [],
			customConsumableComponents: [],
			registry: [
				knownMetric("alcohol_intake"),
				knownMetric("caffeine_intake"),
				knownMetric("nicotine_intake"),
				knownMetric("fluid_intake"),
			],
		};

		const included = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		expect(included.consumptionEntries).toEqual([
			alcoholEntry,
			caffeineEntry,
			fluidEntry,
			nicotineEntry,
		]);

		const excluded = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
			excludeSensitiveMetrics: true,
		});
		// Exclusion is keyed on the substance an entry carries, not on its kind:
		// the ethanol drink and the nicotine entry both go, whole.
		expect(excluded.consumptionEntries).toEqual([caffeineEntry, fluidEntry]);
		expect(excluded.registry.metrics.map(({ slug }) => slug)).toEqual([
			"caffeine_intake",
			"fluid_intake",
		]);
		expect(excluded.trackedMetrics.map(({ metricSlug }) => metricSlug)).toEqual(
			["caffeine_intake"],
		);
		expect(excluded.goals.map(({ metricSlug }) => metricSlug)).toEqual([
			"caffeine_intake",
		]);
	});

	it("produces a valid versioned export for an empty database", () => {
		const exported = buildCheckInExport(
			{
				observations: [],
				dayNotes: [],
				trackedMetrics: [],
				reminders: [],
				assessments: [],
				goals: [],
				unitPreferences: [],
				dailyMetrics: [],
				habits: [],
				habitCompletions: [],
				challengeEnrolments: [],
				challengeProgress: [],
				consumptionEntries: [],
				customConsumables: [],
				customConsumableComponents: [],
				registry: [knownMetric("mood")],
			},
			{ appVersion: "1.0.0", exportedAt: 0 },
		);

		expect(exported).toMatchObject({
			metadata: {
				formatVersion: CHECK_IN_EXPORT_FORMAT_VERSION,
				exportedAt: "1970-01-01T00:00:00.000Z",
				appVersion: "1.0.0",
			},
			observations: [],
			dayNotes: [],
			trackedMetrics: [],
			reminders: [],
			assessments: [],
			goals: [],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
			consumptionEntries: [],
			customConsumables: [],
			customConsumableComponents: [],
		});
		expect(exported.registry.metrics).toHaveLength(1);
	});

	it("carries check-in slots, reminder slots, and slot overrides through a round-trip", () => {
		const eveningMood: Observation = {
			...moodObservation,
			id: "observation-mood-evening",
			slot: "evening",
		};
		const weight: Observation = {
			...moodObservation,
			id: "observation-weight",
			metricSlug: "weight",
			value: 80,
			scaleMin: null,
			scaleMax: null,
			slot: null,
		};
		const reslottedLibido: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-libido",
			metricSlug: "libido",
			checkInSlots: "morning",
		};
		const input = {
			observations: [moodObservation, eveningMood, weight],
			dayNotes: [],
			trackedMetrics: [trackedAlcohol, reslottedLibido],
			reminders: [eveningReminder],
			assessments: [],
			goals: [],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
			consumptionEntries: [],
			customConsumables: [],
			customConsumableComponents: [],
			registry: [knownMetric("mood"), knownMetric("weight")],
		};

		const parsed = parseCheckInExport(
			serializeCheckInExport(input, {
				appVersion: "1.0.0",
				exportedAt: 1_786_708_800_000,
			}),
		);

		expect(parsed.observations.map(({ id, slot }) => [id, slot])).toEqual([
			["observation-mood", "morning"],
			["observation-mood-evening", "evening"],
			["observation-weight", null],
		]);
		expect(
			parsed.trackedMetrics.map(({ id, checkInSlots }) => [id, checkInSlots]),
		).toEqual([
			["tracked-alcohol", null],
			["tracked-libido", "morning"],
		]);
		expect(parsed.reminders.map(({ id, slot }) => [id, slot])).toEqual([
			["reminder-evening", "evening"],
		]);
	});
});
