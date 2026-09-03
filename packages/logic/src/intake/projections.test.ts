import { shiftLocalDay } from "@bro/domain";
import type { IntakeEvent } from "@bro/mobile-model";
import { intakeBaseline, intakeProjections } from "./projections";

function event(
	id: string,
	localDay: string,
	constituents: IntakeEvent["constituents"],
	kind: IntakeEvent["kind"] = "food",
): IntakeEvent {
	return {
		id,
		kind,
		consumableId: null,
		sourceRef: null,
		name: id,
		brand: null,
		portionLabel: null,
		quantity: 1,
		massKg: null,
		volumeL: null,
		constituents,
		context: null,
		notes: null,
		occurredAt: Date.parse(`${localDay}T12:00:00.000Z`),
		localDay,
		tzOffsetMinutes: 0,
		createdAt: 1,
		updatedAt: 1,
	};
}

describe("intake projections", () => {
	it("groups tracked constituents by category in catalogue order", () => {
		const events = [
			event("lunch", "2026-09-02", { energy: 650, protein: 0.04, caffeine: 0 }),
			event(
				"coffee",
				"2026-09-02",
				{ energy: 2, caffeine: 0.000_095, fluid: 0.25 },
				"drink",
			),
			event("yesterday", "2026-09-01", { energy: 900 }),
		];
		const groups = intakeProjections(events, "2026-09-02", [
			"caffeine",
			"energy",
			"protein",
			"vitamin_d",
			"ethanol",
		]);
		expect(groups.map((group) => group.category)).toEqual([
			"energy",
			"macronutrient",
			"stimulant",
			"alcohol",
			"micronutrient",
		]);
		expect(
			groups.flatMap((group) =>
				group.rows.map((row) => [
					row.constituent.code,
					row.metricSlug,
					row.dayValue,
					row.eventCount,
				]),
			),
		).toEqual([
			["energy", "energy_intake", 652, 2],
			["protein", "protein_intake", 0.04, 1],
			["caffeine", "caffeine_intake", 0.000_095, 2],
			["ethanol", "ethanol_intake", null, 0],
			["vitamin_d", "vitamin_d_intake", null, 0],
		]);
		// A category the user tracks nothing in does not render.
		expect(intakeProjections(events, "2026-09-02", [])).toEqual([]);
		expect(intakeProjections(events, "2026-09-02", ["future_code"])).toEqual(
			[],
		);
	});

	it("draws a usual-range band only from fourteen logged days", () => {
		const today = "2026-09-02";
		const logged = (days: number) =>
			Array.from({ length: days }, (_, index) => {
				const localDay = shiftLocalDay(today, -index);
				return event(`day-${index}`, localDay, { energy: 2_000 + index * 10 });
			});

		const thirteen = intakeBaseline("energy", logged(13), today);
		expect(thirteen.readingCount).toBe(13);
		expect(thirteen.current).toMatchObject({ value: 2_000, localDay: today });
		expect(thirteen.usualRange).toBeNull();

		const fourteen = intakeBaseline("energy", logged(14), today);
		expect(fourteen.readingCount).toBe(14);
		expect(fourteen.usualRange).toEqual({
			min: expect.closeTo(2_032.5, 6),
			max: expect.closeTo(2_097.5, 6),
		});
		expect(fourteen.rail).not.toBeNull();

		// Two events on one day are one reading; days outside the window and
		// events that do not carry the code are not readings at all.
		const doubled = intakeBaseline(
			"energy",
			[
				...logged(14),
				event("second-lunch", today, { energy: 300 }),
				event("old", shiftLocalDay(today, -91), { energy: 5_000 }),
				event("water", today, { fluid: 0.5 }, "drink"),
			],
			today,
		);
		expect(doubled.readingCount).toBe(14);
		expect(doubled.current).toMatchObject({ value: 2_300 });
		expect(intakeBaseline("energy", [], today)).toMatchObject({
			current: null,
			usualRange: null,
			readingCount: 0,
		});
	});
});
