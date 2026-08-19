import { KILOGRAMS_ETHANOL_PER_UK_UNIT } from "../index";
import { INSIGHT_CATALOGUE } from "./insight-catalogue";
import { resolveMetric } from "./metric-registry";

describe("insight catalogue", () => {
	it("keeps the signed-off pairs stable, premium, and type-compatible", () => {
		expect(INSIGHT_CATALOGUE).toHaveLength(16);
		expect(new Set(INSIGHT_CATALOGUE.map((entry) => entry.id)).size).toBe(16);

		for (const entry of INSIGHT_CATALOGUE) {
			expect(entry.tier).toBe("premium");
			expect(entry.id.endsWith("-lag1")).toBe(entry.lagDays === 1);
			const input = resolveMetric(entry.input.metricSlug);
			const output = resolveMetric(entry.outputMetricSlug);
			expect(input.kind).toBe("known");
			expect(output.kind).toBe("known");
			if (input.kind === "known") {
				// Presence inputs read user-ticked factors or consumption-derived
				// intake metrics (a day's entries prove presence; a check-in day
				// without entries proves absence). Thresholds need a quantity.
				if (entry.input.kind === "presence") {
					const consumptionDerived =
						input.metric.kind === "measurement" &&
						"measurementSource" in input.metric &&
						input.metric.measurementSource === "consumption";
					expect(input.metric.kind === "factor" || consumptionDerived).toBe(
						true,
					);
				} else {
					expect(input.metric.kind).toBe("measurement");
				}
			}
			if (output.kind === "known") {
				expect(["scored", "measurement"]).toContain(output.metric.kind);
			}
			if (entry.input.kind === "threshold") {
				expect(entry.input.value).toBeGreaterThan(0);
				expect(["seconds", "count", "kilograms"]).toContain(entry.input.unit);
			}
		}
	});

	it("uses exactly four canonical UK units for the two alcohol thresholds", () => {
		const alcoholThresholds = INSIGHT_CATALOGUE.filter(
			(entry) =>
				entry.input.kind === "threshold" &&
				entry.input.metricSlug === "alcohol_intake",
		);
		expect(alcoholThresholds).toHaveLength(2);
		for (const pair of alcoholThresholds) {
			if (pair.input.kind !== "threshold")
				throw new Error("Expected threshold");
			expect(pair.input).toMatchObject({
				operator: "at_least",
				value: 4 * KILOGRAMS_ETHANOL_PER_UK_UNIT,
				unit: "kilograms",
			});
		}
	});

	it("makes comparative evidence and both counts part of every template", () => {
		for (const { copy } of INSIGHT_CATALOGUE) {
			expect(copy.summary).toContain("{trueMean}");
			expect(copy.summary).toContain("{falseMean}");
			expect(copy.summary).toContain("{trueCount}");
			expect(copy.summary).toContain("{falseCount}");
			expect(copy.summary.toLowerCase()).toContain("against");
			expect(copy.summary).not.toMatch(
				/\b(should|must|try|avoid|stop|start)\b/i,
			);
		}
	});
});
