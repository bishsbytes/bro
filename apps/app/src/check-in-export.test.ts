import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	Assessment,
	ChallengeEnrolment,
	ChallengeProgress,
	DailyMetric,
	DayNote,
	Goal,
	Habit,
	HabitCompletion,
	Observation,
	TrackedMetric,
	UnitPreference,
} from "@bro/database-app";
import {
	type MetricDefinition,
	resolveMetric,
} from "./content/metric-registry";
import {
	buildCheckInExport,
	CHECK_IN_EXPORT_FORMAT_VERSION,
	parseCheckInExport,
	serializeCheckInExport,
} from "./export/check-in-export";

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

describe("check-in export", () => {
	it("matches the version 5 golden file and round-trips habit and challenge data", () => {
		const input = {
			observations: [],
			dayNotes: [],
			trackedMetrics: [],
			assessments: [],
			goals: [],
			unitPreferences: [],
			dailyMetrics: [stepsDailyMetric, restingHeartRateDailyMetric],
			habits: [readingHabit],
			habitCompletions: [readingCompletion],
			challengeEnrolments: [healthEnrolment],
			challengeProgress: [healthProgress],
			registry: [knownMetric("resting_heart_rate"), knownMetric("steps")],
		};
		const serialized = serializeCheckInExport(input, {
			appVersion: "1.0.0",
			exportedAt: 1_786_708_800_000,
		});
		const golden = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v5.json"),
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

	it("continues to parse the committed version 4 fixture", () => {
		const fixture = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v4.json"),
			"utf8",
		);

		const parsed = parseCheckInExport(fixture);
		expect(parsed.metadata.formatVersion).toBe(4);
		expect("dailyMetrics" in parsed ? parsed.dailyMetrics : []).toHaveLength(2);
		expect("habits" in parsed).toBe(false);
	});

	it("continues to parse the committed version 3 fixture", () => {
		const fixture = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v3.json"),
			"utf8",
		);

		const parsed = parseCheckInExport(fixture);
		expect(parsed.metadata.formatVersion).toBe(3);
		expect(parsed.observations).toHaveLength(3);
		expect("dailyMetrics" in parsed).toBe(false);
	});

	it("continues to parse the committed version 2 fixture", () => {
		const fixture = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v2.json"),
			"utf8",
		);

		const parsed = parseCheckInExport(fixture);
		expect(parsed.metadata.formatVersion).toBe(2);
		expect(parsed.observations).toHaveLength(3);
		expect("unitPreferences" in parsed).toBe(false);
	});

	it("continues to parse the committed version 1 fixture", () => {
		const fixture = readFileSync(
			join(__dirname, "export", "__fixtures__", "check-in-export-v1.json"),
			"utf8",
		);

		const parsed = parseCheckInExport(fixture);
		expect(parsed.metadata.formatVersion).toBe(1);
		expect(parsed.observations).toHaveLength(2);
		expect("assessments" in parsed).toBe(false);
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
			position: 1,
		};
		const customHabit: Habit = {
			...readingHabit,
			id: "habit-custom",
			slug: "habit:custom:private",
			customLabel: "Private routine",
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
			position: 3,
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
			assessments: [sensitiveWheelAssessment],
			goals: [sensitiveWheelGoal],
			unitPreferences,
			dailyMetrics: [restingHeartRateDailyMetric, stepsDailyMetric],
			habits: [
				readingHabit,
				sensitiveCatalogueHabit,
				customHabit,
				sensitiveMetricHabit,
			],
			habitCompletions: [
				readingCompletion,
				completionFor(sensitiveCatalogueHabit),
				completionFor(customHabit),
				completionFor(sensitiveMetricHabit),
			],
			challengeEnrolments: [
				healthEnrolment,
				faithEnrolment,
				retiredAreaEnrolment,
			],
			challengeProgress: [healthProgress, faithProgress, retiredAreaProgress],
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
		expect(included.habits).toHaveLength(4);
		expect(included.habitCompletions).toHaveLength(4);
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
		expect(exported.habits).toEqual([readingHabit]);
		expect(exported.habitCompletions).toEqual([readingCompletion]);
		expect(exported.challengeEnrolments).toEqual([healthEnrolment]);
		expect(exported.challengeProgress).toEqual([healthProgress]);
	});

	it("produces a valid versioned export for an empty database", () => {
		const exported = buildCheckInExport(
			{
				observations: [],
				dayNotes: [],
				trackedMetrics: [],
				assessments: [],
				goals: [],
				unitPreferences: [],
				dailyMetrics: [],
				habits: [],
				habitCompletions: [],
				challengeEnrolments: [],
				challengeProgress: [],
				registry: [knownMetric("mood")],
			},
			{ appVersion: "1.0.0", exportedAt: 0 },
		);

		expect(exported).toMatchObject({
			metadata: {
				formatVersion: 5,
				exportedAt: "1970-01-01T00:00:00.000Z",
				appVersion: "1.0.0",
			},
			observations: [],
			dayNotes: [],
			trackedMetrics: [],
			assessments: [],
			goals: [],
			unitPreferences: [],
			dailyMetrics: [],
			habits: [],
			habitCompletions: [],
			challengeEnrolments: [],
			challengeProgress: [],
		});
		expect(exported.registry.metrics).toHaveLength(1);
	});
});
