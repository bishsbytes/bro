import {
	ADDITIONAL_CHECK_IN_METRIC_SLUGS,
	CHECK_IN_METRIC_SLUGS,
	CONFIGURABLE_CHECK_IN_METRIC_SLUGS,
	DEFAULT_TRACKED_METRICS,
	hasCompletedCheckIn,
	listAssessmentMetrics,
	listConsumptionDerivedMeasurements,
	listImportedOnlyMeasurements,
	listMeasurements,
	listScoredMetrics,
	listTags,
	listUserEnterableMeasurements,
	METRIC_REGISTRY,
	resolveMetric,
} from "./metric-registry";

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
			if (metric.kind === "tag") {
				expect(metric.scaleMin).toBeNull();
				expect(metric.scaleMax).toBeNull();
				expect(metric.aggregation).toBe("presence");
				expect(metric.category).toMatch(
					/^(body|lifestyle|mind|social|sexual)$/,
				);
			} else if (metric.kind === "measurement") {
				expect(metric.scaleMin).toBeNull();
				expect(metric.scaleMax).toBeNull();
				expect(["last", "mean", "sum"]).toContain(metric.aggregation);
				expect(metric.category).toBeNull();
				expect(metric.dimension).toMatch(
					/^(mass|length|fraction|volume|energy|time|count|rate_bpm)$/,
				);
			} else {
				expect(metric.scaleMin).toBeLessThan(metric.scaleMax);
				expect(metric.aggregation).toBe("mean");
				expect(metric.category).toBeNull();
				expect(metric.dimension).toBeNull();
			}
		}

		expect(listScoredMetrics().map((metric) => metric.slug)).toEqual([
			"mood",
			"energy",
			"motivation",
			"productivity",
			"libido",
		]);
		expect(listTags()).toHaveLength(22);
		expect(
			Object.fromEntries(
				["body", "lifestyle", "mind", "social", "sexual"].map((category) => [
					category,
					listTags().filter((metric) => metric.category === category).length,
				]),
			),
		).toEqual({ body: 5, lifestyle: 5, mind: 4, social: 4, sexual: 4 });
		expect(
			listTags()
				.filter((metric) => metric.sensitive)
				.map((metric) => metric.slug),
		).toEqual([
			"sex",
			"masturbation",
			"porn",
			"morning_erection",
			"hangover",
			"nicotine",
		]);
		expect(
			listTags()
				.filter((metric) => metric.defaultEnabled)
				.map((metric) => metric.slug),
		).toEqual(listTags().map((metric) => metric.slug));
		expect(resolveMetric("libido")).toMatchObject({
			kind: "known",
			metric: { kind: "scored", sensitive: true },
		});
		for (const slug of CONFIGURABLE_CHECK_IN_METRIC_SLUGS) {
			expect(
				DEFAULT_TRACKED_METRICS.find((metric) => metric.metricSlug === slug),
			).not.toHaveProperty("enabled", false);
		}
		expect(ADDITIONAL_CHECK_IN_METRIC_SLUGS).toEqual([
			"motivation",
			"productivity",
			"libido",
		]);
		expect(listMeasurements()).toEqual([
			expect.objectContaining({
				slug: "weight",
				label: "Weight",
				dimension: "mass",
			}),
			expect.objectContaining({
				slug: "waist",
				label: "Waist",
				dimension: "length",
			}),
			expect.objectContaining({
				slug: "body_fat",
				label: "Body fat",
				dimension: "fraction",
			}),
			expect.objectContaining({
				slug: "sleep_duration",
				dimension: "time",
				aggregation: "sum",
			}),
			expect.objectContaining({
				slug: "steps",
				dimension: "count",
				aggregation: "sum",
			}),
			expect.objectContaining({
				slug: "resting_heart_rate",
				dimension: "rate_bpm",
				aggregation: "mean",
			}),
			expect.objectContaining({
				slug: "alcohol_intake",
				dimension: "mass",
				aggregation: "sum",
			}),
			expect.objectContaining({
				slug: "caffeine_intake",
				dimension: "mass",
				fixedDisplayUnit: "mg",
			}),
			expect.objectContaining({
				slug: "fluid_intake",
				dimension: "volume",
			}),
			expect.objectContaining({
				slug: "energy_intake",
				dimension: "energy",
				fixedDisplayUnit: "kcal",
			}),
			expect.objectContaining({
				slug: "protein_intake",
				dimension: "mass",
				fixedDisplayUnit: "g",
			}),
			expect.objectContaining({
				slug: "carbs_intake",
				dimension: "mass",
				fixedDisplayUnit: "g",
			}),
			expect.objectContaining({
				slug: "fat_intake",
				dimension: "mass",
				fixedDisplayUnit: "g",
			}),
		]);
		for (const metric of listUserEnterableMeasurements()) {
			expect(metric).toMatchObject({
				kind: "measurement",
				scaleMin: null,
				scaleMax: null,
				aggregation: "last",
				userEnterable: true,
				sensitive: true,
			});
		}
		expect(listImportedOnlyMeasurements()).toEqual([
			expect.objectContaining({
				slug: "sleep_duration",
				userEnterable: false,
				sensitive: false,
			}),
			expect.objectContaining({
				slug: "steps",
				userEnterable: false,
				sensitive: false,
			}),
			expect.objectContaining({
				slug: "resting_heart_rate",
				userEnterable: false,
				sensitive: true,
			}),
		]);
		expect(listConsumptionDerivedMeasurements()).toEqual([
			expect.objectContaining({
				slug: "alcohol_intake",
				userEnterable: false,
				measurementSource: "consumption",
				sensitive: true,
				unitPreferenceDimension: "alcohol",
			}),
			expect.objectContaining({
				slug: "caffeine_intake",
				sensitive: false,
			}),
			expect.objectContaining({
				slug: "fluid_intake",
				sensitive: false,
				unitPreferenceDimension: "volume",
			}),
			expect.objectContaining({
				slug: "energy_intake",
				sensitive: false,
			}),
			expect.objectContaining({
				slug: "protein_intake",
				sensitive: false,
				fixedDisplayUnit: "g",
			}),
			expect.objectContaining({
				slug: "carbs_intake",
				sensitive: false,
				fixedDisplayUnit: "g",
			}),
			expect.objectContaining({
				slug: "fat_intake",
				sensitive: false,
				fixedDisplayUnit: "g",
			}),
		]);
		expect(listAssessmentMetrics().map((metric) => metric.slug)).toEqual([
			"wheel:career",
			"wheel:money",
			"wheel:health",
			"wheel:partner",
			"wheel:family",
			"wheel:friends",
			"wheel:growth",
			"wheel:fun",
			"wheel:environment",
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
		expect(
			listAssessmentMetrics()
				.filter((metric) => metric.sensitive)
				.map((metric) => metric.slug),
		).toEqual(["wheel:faith", "wheel:sobriety"]);
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
			METRIC_REGISTRY.filter(
				(metric) =>
					metric.userEnterable ||
					(metric.kind === "measurement" &&
						"measurementSource" in metric &&
						metric.measurementSource === "consumption"),
			).map((metric) => ({
				metricSlug: metric.slug,
				position: metric.defaultPosition,
				...(metric.kind === "measurement" ||
				(metric.kind === "tag" && !metric.defaultEnabled)
					? { enabled: false }
					: {}),
			})),
		);
		expect(
			DEFAULT_TRACKED_METRICS.some(({ metricSlug }) =>
				metricSlug.startsWith("wheel:"),
			),
		).toBe(false);
		expect(
			DEFAULT_TRACKED_METRICS.filter(({ metricSlug }) =>
				["weight", "waist", "body_fat"].includes(metricSlug),
			),
		).toEqual([
			{ metricSlug: "weight", position: 0, enabled: false },
			{ metricSlug: "waist", position: 1, enabled: false },
			{ metricSlug: "body_fat", position: 2, enabled: false },
		]);
		for (const imported of ["sleep_duration", "steps", "resting_heart_rate"]) {
			expect(
				DEFAULT_TRACKED_METRICS.some(
					({ metricSlug }) => metricSlug === imported,
				),
			).toBe(false);
			expect(listScoredMetrics().some(({ slug }) => slug === imported)).toBe(
				false,
			);
			expect(listTags().some(({ slug }) => slug === imported)).toBe(false);
			expect(
				listAssessmentMetrics().some(({ slug }) => slug === imported),
			).toBe(false);
		}
		for (const derived of listConsumptionDerivedMeasurements()) {
			expect(
				DEFAULT_TRACKED_METRICS.find(
					({ metricSlug }) => metricSlug === derived.slug,
				),
			).toEqual({
				metricSlug: derived.slug,
				position: derived.defaultPosition,
				enabled: false,
			});
			expect(listUserEnterableMeasurements()).not.toContainEqual(derived);
			expect(listImportedOnlyMeasurements()).not.toContainEqual(derived);
			expect(listScoredMetrics()).not.toContainEqual(derived);
			expect(listTags()).not.toContainEqual(derived);
			expect(listAssessmentMetrics()).not.toContainEqual(derived);
		}
	});

	it("counts Mood as a check-in without requiring configurable scores", () => {
		for (const slug of CHECK_IN_METRIC_SLUGS) {
			expect(listScoredMetrics().some((metric) => metric.slug === slug)).toBe(
				true,
			);
			expect(hasCompletedCheckIn([{ metricSlug: slug }])).toBe(true);
		}

		expect(hasCompletedCheckIn([])).toBe(false);
		expect(
			hasCompletedCheckIn([
				{ metricSlug: "weight" },
				{ metricSlug: "wheel:physical-health" },
			]),
		).toBe(false);
		expect(hasCompletedCheckIn([{ metricSlug: "energy" }])).toBe(false);
		expect(
			hasCompletedCheckIn([{ metricSlug: "mood" }, { metricSlug: "energy" }]),
		).toBe(true);
	});
});
