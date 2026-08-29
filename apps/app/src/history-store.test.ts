import type {
	ChallengeProgress,
	DailyMetric,
	HabitCompletion,
	Observation,
} from "@bro/database-app";
import { KILOGRAMS_PER_POUND } from "@bro/domain";
import {
	addPreviousDayMeasurementChanges,
	assembleHistoryDay,
} from "./history/history-store";
import { i18n } from "./i18n";

function observation(
	id: string,
	metricSlug: string,
	value: number,
	assessmentId: string | null = null,
): Observation {
	return {
		id,
		metricSlug,
		value,
		scaleMin: metricSlug === "stress" ? null : 1,
		scaleMax: metricSlug === "stress" ? null : 10,
		observedAt: 1_000,
		localDay: "2026-08-14",
		tzOffsetMinutes: 0,
		source: "user",
		sourceRecordId: null,
		assessmentId,
		createdAt: 1_000,
		updatedAt: 1_000,
	};
}

function dailyMetric(
	id: string,
	metricSlug: string,
	value: number,
	localDay: string,
): DailyMetric {
	return {
		id,
		metricSlug,
		localDay,
		value,
		source: "health_connect",
		computedAt: 2_000,
		createdAt: 2_000,
		updatedAt: 2_000,
	};
}

describe("history store", () => {
	it("localizes missing habit and challenge presentation fallbacks", () => {
		const originalHabit = i18n.getResource(
			"en",
			"history",
			"day.unknownHabit",
		) as string;
		const originalChallenge = i18n.getResource(
			"en",
			"history",
			"day.unknownChallenge",
		) as string;
		const originalDayTitle = i18n.getResource(
			"en",
			"history",
			"day.challengeDayTitle",
		) as string;
		i18n.addResource("en", "history", "day.unknownHabit", "Translated habit");
		i18n.addResource(
			"en",
			"history",
			"day.unknownChallenge",
			"Translated challenge",
		);
		i18n.addResource(
			"en",
			"history",
			"day.challengeDayTitle",
			"Translated day {{day}}",
		);

		try {
			const completion: HabitCompletion = {
				id: "completion",
				habitId: "missing-habit",
				localDay: "2026-08-14",
				completedAt: 1_000,
				createdAt: 1_000,
				updatedAt: 1_000,
			};
			const progress: ChallengeProgress = {
				id: "progress",
				enrolmentId: "missing-enrolment",
				dayIndex: 3,
				localDay: "2026-08-14",
				completedAt: 1_000,
				createdAt: 1_000,
				updatedAt: 1_000,
			};
			const day = assembleHistoryDay(
				"2026-08-14",
				[],
				[],
				[],
				new Map(),
				"en-GB",
				[],
				[completion],
				[],
				[progress],
			);

			expect(day.habitCompletions[0]?.label).toBe("Translated habit");
			expect(day.challengeSteps[0]).toMatchObject({
				title: "Translated challenge",
				dayTitle: "Translated day 3",
			});
		} finally {
			i18n.addResource("en", "history", "day.unknownHabit", originalHabit);
			i18n.addResource(
				"en",
				"history",
				"day.unknownChallenge",
				originalChallenge,
			);
			i18n.addResource(
				"en",
				"history",
				"day.challengeDayTitle",
				originalDayTitle,
			);
		}
	});

	it("treats a Mood observation as a check-in when Energy was disabled", () => {
		const mood = observation("mood", "mood", 4);
		const day = assembleHistoryDay("2026-08-14", [mood], []);

		expect(day.checkIns).toMatchObject([{ mood, optionalScores: [] }]);
		expect(day.unpairedScored).toEqual([]);
	});

	it("classifies assessment metrics separately from daily scored metrics", () => {
		const wheel = observation(
			"wheel-career",
			"wheel:career",
			6,
			"assessment-1",
		);
		const unknownWheel = observation(
			"wheel-future",
			"wheel:future",
			7,
			"assessment-future",
		);
		const day = assembleHistoryDay(
			"2026-08-14",
			[
				observation("mood", "mood", 4),
				observation("energy", "energy", 3),
				observation("motivation", "motivation", 5),
				observation("stress", "stress", 1),
				observation("weight", "weight", 78),
				wheel,
				unknownWheel,
			],
			[],
		);

		expect(day.checkIns).toHaveLength(1);
		expect(day.checkIns[0]?.optionalScores).toMatchObject([
			{ metricSlug: "energy", value: 3 },
			{ metricSlug: "motivation", value: 5 },
		]);
		expect(day.tags.map(({ metricSlug }) => metricSlug)).toEqual(["stress"]);
		expect(day.assessments).toEqual([wheel]);
		expect(day.unpairedScored).toEqual([]);
		expect(day.unknown).toEqual([unknownWheel]);
	});

	it("retains manual and imported measurement provenance while selecting the import", () => {
		const manual = observation("manual-weight", "weight", 80);
		const imported: DailyMetric = {
			id: "imported-weight",
			metricSlug: "weight",
			localDay: "2026-08-14",
			value: 79,
			source: "health_connect",
			computedAt: 2_000,
			createdAt: 2_000,
			updatedAt: 2_000,
		};
		const day = assembleHistoryDay(
			"2026-08-14",
			[manual],
			[],
			[imported],
			new Map([["mass", "kg"]]),
			"en-GB",
		);

		expect(day.measurements).toEqual([
			expect.objectContaining({
				id: manual.id,
				formattedValue: "80.0 kg",
				source: "user",
				selected: false,
			}),
			expect.objectContaining({
				id: imported.id,
				formattedValue: "79.0 kg",
				source: "health_connect",
				selected: true,
			}),
		]);
	});

	it("reports compound-unit changes in the minor unit alone", () => {
		const stones = new Map([["mass", "st"]]);
		const previous = assembleHistoryDay(
			"2026-08-13",
			[],
			[],
			[dailyMetric("previous-weight", "weight", 80, "2026-08-13")],
			stones,
			"en-GB",
		);
		const current = assembleHistoryDay(
			"2026-08-14",
			[],
			[],
			[
				dailyMetric(
					"current-weight",
					"weight",
					80 + KILOGRAMS_PER_POUND,
					"2026-08-14",
				),
			],
			stones,
			"en-GB",
		);

		const compared = addPreviousDayMeasurementChanges(
			current,
			previous.measurements,
			stones,
			"en-GB",
		);

		// `0 st 1 lb` is what formatting the delta as a reading would produce.
		expect(compared.measurements[0]?.changeFromPreviousDay).toMatchObject({
			direction: "increase",
			formattedDelta: "1 lb",
		});
	});

	it("calls a change nobody can see in the values unchanged", () => {
		const stones = new Map([["mass", "st"]]);
		const previous = assembleHistoryDay(
			"2026-08-13",
			[],
			[],
			[dailyMetric("previous-weight", "weight", 80, "2026-08-13")],
			stones,
			"en-GB",
		);
		const current = assembleHistoryDay(
			"2026-08-14",
			[],
			[],
			[dailyMetric("current-weight", "weight", 80.05, "2026-08-14")],
			stones,
			"en-GB",
		);

		const compared = addPreviousDayMeasurementChanges(
			current,
			previous.measurements,
			stones,
			"en-GB",
		);

		expect(compared.measurements[0]?.changeFromPreviousDay).toEqual({
			direction: "unchanged",
		});
	});

	it("reports a sub-minute duration change in seconds", () => {
		const previous = assembleHistoryDay(
			"2026-08-13",
			[],
			[],
			[dailyMetric("previous-sleep", "sleep_duration", 27_000, "2026-08-13")],
		);
		const current = assembleHistoryDay(
			"2026-08-14",
			[],
			[],
			[dailyMetric("current-sleep", "sleep_duration", 27_020, "2026-08-14")],
		);

		const compared = addPreviousDayMeasurementChanges(
			current,
			previous.measurements,
		);

		// Whole-minute rounding would render this as `0 m`.
		expect(compared.measurements[0]?.changeFromPreviousDay).toMatchObject({
			direction: "increase",
			formattedDelta: "20 s",
		});
	});

	it("compares selected measurements with the previous calendar day", () => {
		const previous = assembleHistoryDay(
			"2026-08-13",
			[],
			[],
			[
				dailyMetric("previous-heart", "resting_heart_rate", 50, "2026-08-13"),
				dailyMetric("previous-sleep", "sleep_duration", 27_000, "2026-08-13"),
				dailyMetric("previous-steps", "steps", 0, "2026-08-13"),
			],
		);
		const current = assembleHistoryDay(
			"2026-08-14",
			[],
			[],
			[
				dailyMetric("current-heart", "resting_heart_rate", 55, "2026-08-14"),
				dailyMetric("current-sleep", "sleep_duration", 26_100, "2026-08-14"),
				dailyMetric("current-steps", "steps", 100, "2026-08-14"),
			],
		);

		const compared = addPreviousDayMeasurementChanges(
			current,
			previous.measurements,
		);

		expect(
			compared.measurements.find(
				(measurement) => measurement.metricSlug === "resting_heart_rate",
			)?.changeFromPreviousDay,
		).toEqual({
			direction: "increase",
			formattedDelta: "5 bpm",
			absolutePercentage: 10,
		});
		expect(
			compared.measurements.find(
				(measurement) => measurement.metricSlug === "sleep_duration",
			)?.changeFromPreviousDay,
		).toEqual({
			direction: "decrease",
			formattedDelta: "15 m",
			absolutePercentage: 100 / 30,
		});
		expect(
			compared.measurements.find(
				(measurement) => measurement.metricSlug === "steps",
			)?.changeFromPreviousDay,
		).toEqual({
			direction: "increase",
			formattedDelta: "100",
			absolutePercentage: null,
		});
	});
});
