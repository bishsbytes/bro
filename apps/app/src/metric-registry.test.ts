import {
	DEFAULT_TRACKED_METRICS,
	listFactors,
	listScoredMetrics,
	METRIC_REGISTRY,
	resolveMetric,
} from "./content/metric-registry";

describe("metric registry", () => {
	it("uses unique permanent-format slugs and positions", () => {
		const slugs = METRIC_REGISTRY.map((metric) => metric.slug);
		const positions = METRIC_REGISTRY.map((metric) => metric.defaultPosition);

		expect(new Set(slugs).size).toBe(slugs.length);
		expect(new Set(positions).size).toBe(positions.length);
		for (const slug of slugs) {
			expect(slug).toMatch(/^[a-z][a-z0-9_]*(?::[a-z0-9_]+)*$/);
		}
	});

	it("defines valid scales, categories, and aggregation for every metric", () => {
		for (const metric of METRIC_REGISTRY) {
			if (metric.kind === "scored") {
				expect(metric.scaleMin).toBeLessThan(metric.scaleMax);
				expect(metric.aggregation).toBe("mean");
				expect(metric.category).toBeNull();
			} else {
				expect(metric.scaleMin).toBeNull();
				expect(metric.scaleMax).toBeNull();
				expect(metric.aggregation).toBe("presence");
				expect(metric.category).toMatch(/^(body|lifestyle|mind|social)$/);
			}
		}

		expect(listScoredMetrics().map((metric) => metric.slug)).toEqual([
			"mood",
			"energy",
		]);
		expect(listFactors()).toHaveLength(12);
	});

	it("returns a typed unknown result instead of throwing for future slugs", () => {
		expect(resolveMetric("mood")).toMatchObject({
			kind: "known",
			metric: { label: "Mood" },
		});
		expect(resolveMetric("future_metric")).toEqual({
			kind: "unknown",
			slug: "future_metric",
		});
	});

	it("exposes every authored metric as a lazy tracking default", () => {
		expect(DEFAULT_TRACKED_METRICS).toEqual(
			METRIC_REGISTRY.map((metric) => ({
				metricSlug: metric.slug,
				position: metric.defaultPosition,
			})),
		);
	});
});
