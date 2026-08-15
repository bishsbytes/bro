import {
	DEFAULT_TRACKED_METRICS,
	listAssessmentMetrics,
	listFactors,
	listScoredMetrics,
	METRIC_REGISTRY,
	resolveMetric,
} from "./content/metric-registry";

describe("metric registry", () => {
	it("uses unique permanent-format slugs and positions", () => {
		const slugs = METRIC_REGISTRY.map((metric) => metric.slug);
		const positions = METRIC_REGISTRY.map(
			(metric) => `${metric.kind}:${metric.defaultPosition}`,
		);

		expect(new Set(slugs).size).toBe(slugs.length);
		expect(new Set(positions).size).toBe(positions.length);
		for (const slug of slugs) {
			expect(slug).toMatch(/^[a-z][a-z0-9_]*(?::[a-z0-9_]+)*$/);
		}
	});

	it("defines valid scales, categories, and aggregation for every metric", () => {
		for (const metric of METRIC_REGISTRY) {
			if (metric.kind === "factor") {
				expect(metric.scaleMin).toBeNull();
				expect(metric.scaleMax).toBeNull();
				expect(metric.aggregation).toBe("presence");
				expect(metric.category).toMatch(/^(body|lifestyle|mind|social)$/);
			} else {
				expect(metric.scaleMin).toBeLessThan(metric.scaleMax);
				expect(metric.aggregation).toBe("mean");
				expect(metric.category).toBeNull();
			}
		}

		expect(listScoredMetrics().map((metric) => metric.slug)).toEqual([
			"mood",
			"energy",
		]);
		expect(listFactors()).toHaveLength(12);
		expect(
			listAssessmentMetrics().map((metric) => metric.slug),
		).toEqual([
			"wheel:career",
			"wheel:money",
			"wheel:health",
			"wheel:partner",
			"wheel:family",
			"wheel:friends",
			"wheel:growth",
			"wheel:fun",
			"wheel:purpose",
			"wheel:fatherhood",
			"wheel:faith",
			"wheel:sobriety",
		]);
		for (const metric of listAssessmentMetrics()) {
			expect(metric).toMatchObject({
				kind: "assessment",
				scaleMin: 1,
				scaleMax: 10,
				aggregation: "mean",
				userEnterable: false,
			});
		}
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

	it("exposes only daily check-in metrics as lazy check-in defaults", () => {
		expect(DEFAULT_TRACKED_METRICS).toEqual(
			METRIC_REGISTRY.filter((metric) => metric.userEnterable).map(
				(metric) => ({
					metricSlug: metric.slug,
					position: metric.defaultPosition,
				}),
			),
		);
		expect(
			DEFAULT_TRACKED_METRICS.some(({ metricSlug }) =>
				metricSlug.startsWith("wheel:"),
			),
		).toBe(false);
	});
});
