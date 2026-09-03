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
	Consumable,
	DailyMetric,
	DayNote,
	Goal,
	Habit,
	HabitCompletion,
	IntakeEvent,
	IntakeStream,
	Observation,
	Reminder,
	TrackedMetric,
	UnitPreference,
} from "@bro/mobile-model";
import {
	goldenInput,
	goldenOptions,
	goldenYoghurt,
} from "./__fixtures__/golden-input";
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

const caffeineEvent: IntakeEvent = {
	id: "intake-coffee",
	kind: "drink",
	consumableId: null,
	sourceRef: "system:drink:filter-coffee",
	name: "Filter coffee",
	brand: null,
	portionLabel: "250 ml mug",
	quantity: 1,
	massKg: null,
	volumeL: 0.25,
	constituents: { fluid: 0.25, ethanol: 0, caffeine: 0.0001, energy: 2.5 },
	context: null,
	notes: null,
	occurredAt: 1_786_621_600_000,
	localDay: "2026-08-13",
	tzOffsetMinutes: -60,
	createdAt: 1_786_621_600_100,
	updatedAt: 1_786_621_600_100,
};

const alcoholEvent: IntakeEvent = {
	...caffeineEvent,
	id: "intake-lager",
	sourceRef: "system:drink:lager-4_5",
	name: "Lager, 4.5%",
	portionLabel: "pint",
	volumeL: 0.568_261_25,
	constituents: {
		fluid: 0.568_261_25,
		ethanol: 0.020_181_999,
		caffeine: 0,
		energy: 244,
	},
	occurredAt: 1_786_621_500_000,
	createdAt: 1_786_621_500_100,
	updatedAt: 1_786_621_500_100,
};

const fluidEvent: IntakeEvent = {
	...caffeineEvent,
	id: "intake-water",
	sourceRef: "system:drink:water",
	name: "Water",
	portionLabel: "250 ml glass",
	volumeL: 0.3,
	constituents: { fluid: 0.3, ethanol: 0, caffeine: 0, energy: 0 },
	occurredAt: 1_786_621_700_000,
	createdAt: 1_786_621_700_100,
	updatedAt: 1_786_621_700_100,
};

const nicotineEvent: IntakeEvent = {
	...caffeineEvent,
	id: "intake-cigarette",
	kind: "nicotine",
	sourceRef: "system:nicotine:cigarette",
	name: "Cigarette",
	portionLabel: "cigarette",
	volumeL: null,
	constituents: { nicotine: 1.2e-6 },
	occurredAt: 1_786_621_900_000,
	createdAt: 1_786_621_900_100,
	updatedAt: 1_786_621_900_100,
};

// Sensitive whole, by kind: the label is the disclosure, whatever it carries —
// here an unknown code that no total ever reads.
const medicationEvent: IntakeEvent = {
	...caffeineEvent,
	id: "intake-tablet",
	kind: "medication",
	sourceRef: null,
	name: "Tablet",
	portionLabel: "tablet",
	volumeL: null,
	constituents: { ibuprofen: 0.0002 },
	context: "medication",
	occurredAt: 1_786_621_950_000,
	createdAt: 1_786_621_950_100,
	updatedAt: 1_786_621_950_100,
};

const vapeFork: Consumable = {
	...goldenYoghurt,
	id: "library-vape",
	kind: "nicotine",
	name: "My vape",
	brand: null,
	basis: { type: "portion", portionId: "puffs-10" },
	constituents: { nicotine: 6e-7 },
	portions: [
		{
			id: "puffs-10",
			label: "10 puffs",
			massKg: null,
			volumeL: null,
			basisUnits: 1,
		},
	],
	defaultPortionId: "puffs-10",
	forkedFrom: { type: "system", key: "nicotine:vape-20" },
	createdAt: 1_786_620_200_000,
	updatedAt: 1_786_620_200_000,
};

const nicotineStream: IntakeStream = {
	id: "stream-nicotine",
	kind: "nicotine",
	enabledAt: 1_786_620_000_000,
	disabledAt: null,
	createdAt: 1_786_620_000_000,
	updatedAt: 1_786_620_000_000,
};

const supplementStream: IntakeStream = {
	...nicotineStream,
	id: "stream-supplement",
	kind: "supplement",
};

const noIntake = {
	intakeEvents: [],
	consumables: [],
	recipeIngredients: [],
	intakeStreams: [],
} as const;

describe("check-in export", () => {
	it("matches the golden file and round-trips intake snapshots", () => {
		const input = goldenInput;
		const serialized = serializeCheckInExport(input, goldenOptions);
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
		const { recipeIngredients: _omitted, ...withoutIngredients } = golden;

		expect(() =>
			parseCheckInExport(JSON.stringify(withoutIngredients)),
		).toThrow(TypeError);
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
			...noIntake,
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

	it("excludes sensitive intake by constituent and by kind, with every metric reference", () => {
		const trackedEthanol: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-ethanol-intake",
			metricSlug: "ethanol_intake",
		};
		const trackedCaffeine: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-caffeine-intake",
			metricSlug: "caffeine_intake",
		};
		const trackedNicotine: TrackedMetric = {
			...trackedAlcohol,
			id: "tracked-nicotine-intake",
			metricSlug: "nicotine_intake",
		};
		const ethanolGoal: Goal = {
			...goal,
			id: "goal-ethanol",
			metricSlug: "ethanol_intake",
		};
		const caffeineGoal: Goal = {
			...goal,
			id: "goal-caffeine",
			metricSlug: "caffeine_intake",
		};
		const nicotineGoal: Goal = {
			...goal,
			id: "goal-nicotine",
			metricSlug: "nicotine_intake",
		};
		const input = {
			observations: [],
			dayNotes: [],
			trackedMetrics: [trackedEthanol, trackedCaffeine, trackedNicotine],
			reminders: [],
			assessments: [],
			goals: [ethanolGoal, caffeineGoal, nicotineGoal],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
			intakeEvents: [
				fluidEvent,
				alcoholEvent,
				medicationEvent,
				caffeineEvent,
				nicotineEvent,
			],
			consumables: [vapeFork, goldenYoghurt],
			recipeIngredients: [],
			intakeStreams: [nicotineStream, supplementStream],
			registry: [
				knownMetric("ethanol_intake"),
				knownMetric("caffeine_intake"),
				knownMetric("nicotine_intake"),
				knownMetric("fluid_intake"),
			],
		};

		const included = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		expect(included.intakeEvents).toEqual([
			alcoholEvent,
			caffeineEvent,
			fluidEvent,
			nicotineEvent,
			medicationEvent,
		]);
		expect(included.consumables).toEqual([goldenYoghurt, vapeFork]);
		expect(included.intakeStreams).toEqual([nicotineStream, supplementStream]);

		const excluded = buildCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
			excludeSensitiveMetrics: true,
		});
		// Exclusion reads the catalogue and the kind list: the ethanol drink and
		// the nicotine event go for what they carry, the tablet for what it is,
		// and everything else survives untouched.
		expect(excluded.intakeEvents).toEqual([caffeineEvent, fluidEvent]);
		expect(excluded.consumables).toEqual([goldenYoghurt]);
		expect(excluded.intakeStreams).toEqual([supplementStream]);
		// Registry order is by default position: fluid sits before caffeine.
		expect(excluded.registry.metrics.map(({ slug }) => slug)).toEqual([
			"fluid_intake",
			"caffeine_intake",
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
				...noIntake,
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
			intakeEvents: [],
			consumables: [],
			recipeIngredients: [],
			intakeStreams: [],
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
			...noIntake,
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
