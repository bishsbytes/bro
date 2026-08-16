import type { Observation } from "@bro/database-app";
import { assembleHistoryDay } from "./history/history-store";

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

describe("history store", () => {
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
				observation("stress", "stress", 1),
				observation("weight", "weight", 78),
				wheel,
				unknownWheel,
			],
			[],
		);

		expect(day.checkIns).toHaveLength(1);
		expect(day.factors.map(({ metricSlug }) => metricSlug)).toEqual(["stress"]);
		expect(day.assessments).toEqual([wheel]);
		expect(day.unpairedScored).toEqual([]);
		expect(day.unknown).toEqual([unknownWheel]);
	});
});
