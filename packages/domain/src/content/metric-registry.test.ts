import { CONSTITUENT_CATALOGUE } from "./constituent-catalogue";
import {
	assignmentIncludesSlot,
	CHECK_IN_METRIC_SLUGS,
	CHECK_IN_SLOTS,
	type CheckInSlotAssignment,
	CONFIGURABLE_CHECK_IN_METRIC_SLUGS,
	checkInSlotForMinuteOfDay,
	completedCheckInSlots,
	DEFAULT_TRACKED_METRICS,
	hasCompletedCheckIn,
	isCheckInSlot,
	isCheckInSlotAssignment,
	listAssessmentMetrics,
	listConsumptionDerivedMeasurements,
	listImportedOnlyMeasurements,
	listMeasurements,
	listScoredMetrics,
	listTags,
	listUserEnterableMeasurements,
	METRIC_REGISTRY,
	resolveMetric,
	suggestedCheckInSlot,
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
		expect(listTags()).toHaveLength(21);
		expect(
			Object.fromEntries(
				["body", "lifestyle", "mind", "social", "sexual"].map((category) => [
					category,
					listTags().filter((metric) => metric.category === category).length,
				]),
			),
		).toEqual({ body: 5, lifestyle: 4, mind: 4, social: 4, sexual: 4 });
		expect(
			listTags()
				.filter((metric) => metric.sensitive)
				.map((metric) => metric.slug),
		).toEqual(["sex", "masturbation", "porn", "morning_erection", "hangover"]);
		// The nicotine tag was replaced outright by its quantified counterpart.
		expect(listTags().some((metric) => metric.slug === "nicotine")).toBe(false);
		expect(resolveMetric("nicotine")).toEqual({
			kind: "unknown",
			slug: "nicotine",
		});
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
				slug: "neck",
				label: "Neck",
				dimension: "length",
			}),
			expect.objectContaining({
				slug: "chest",
				label: "Chest",
				dimension: "length",
			}),
			expect.objectContaining({
				slug: "bicep",
				label: "Bicep",
				dimension: "length",
			}),
			expect.objectContaining({
				slug: "hip",
				label: "Hip",
				dimension: "length",
			}),
			expect.objectContaining({
				slug: "thigh",
				label: "Thigh",
				dimension: "length",
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
			// One generated intake metric per constituent, in catalogue order.
			...CONSTITUENT_CATALOGUE.map((constituent) =>
				expect.objectContaining({
					slug: `${constituent.code}_intake`,
					dimension: constituent.dimension,
					aggregation: "sum",
					constituentCode: constituent.code,
				}),
			),
		]);
		for (const metric of listUserEnterableMeasurements()) {
			expect(metric).toMatchObject({
				kind: "measurement",
				scaleMin: null,
				scaleMax: null,
				userEnterable: true,
				sensitive: true,
			});
			expect(["last", "mean"]).toContain(metric.aggregation);
		}
		expect(listImportedOnlyMeasurements()).toEqual([
			expect.objectContaining({
				slug: "sleep_duration",
				userEnterable: false,
				sensitive: false,
				bodyGroup: "health_fitness",
			}),
			expect.objectContaining({
				slug: "steps",
				userEnterable: false,
				sensitive: false,
				bodyGroup: "health_fitness",
			}),
		]);
		expect(resolveMetric("resting_heart_rate")).toMatchObject({
			kind: "known",
			metric: {
				userEnterable: true,
				dimension: "rate_bpm",
				aggregation: "mean",
				bodyGroup: "health_fitness",
				manualCapture: "standalone",
				healthImport: true,
			},
		});
		expect(resolveMetric("weight")).toMatchObject({
			kind: "known",
			metric: {
				bodyGroup: "measurements",
				manualCapture: "both",
				healthImport: true,
			},
		});
		expect(resolveMetric("waist")).toMatchObject({
			kind: "known",
			metric: {
				bodyGroup: "measurements",
				manualCapture: "measurement_session",
				healthImport: false,
			},
		});
		// The intake block is generated: every constituent has exactly one
		// metric, slug `<code>_intake`, carrying the constituent's dimension,
		// display, and sensitivity, and no hand-written or legacy slug survives.
		const intake = listConsumptionDerivedMeasurements();
		expect(intake.map((metric) => metric.slug)).toEqual(
			CONSTITUENT_CATALOGUE.map((constituent) => `${constituent.code}_intake`),
		);
		for (const constituent of CONSTITUENT_CATALOGUE) {
			const metric = intake.find(
				(candidate) => candidate.constituentCode === constituent.code,
			);
			expect(metric).toMatchObject({
				slug: `${constituent.code}_intake`,
				label: constituent.metricLabel ?? constituent.label,
				dimension: constituent.dimension,
				sensitive: constituent.sensitive,
				userEnterable: false,
				measurementSource: "consumption",
				healthImport: false,
				...constituent.display,
			});
		}
		expect(
			intake.filter((metric) => metric.sensitive).map((m) => m.slug),
		).toEqual(["nicotine_intake", "ethanol_intake"]);
		expect(resolveMetric("ethanol_intake")).toMatchObject({
			kind: "known",
			metric: {
				label: "Alcohol",
				dimension: "mass",
				unitPreferenceDimension: "alcohol",
				sensitive: true,
			},
		});
		expect(resolveMetric("energy_intake")).toMatchObject({
			kind: "known",
			metric: { label: "Energy intake", fixedDisplayUnit: "kcal" },
		});
		expect(resolveMetric("fluid_intake")).toMatchObject({
			kind: "known",
			metric: { label: "Fluid intake", unitPreferenceDimension: "volume" },
		});
		expect(resolveMetric("sodium_intake")).toMatchObject({
			kind: "known",
			metric: { unitPreferenceDimension: "sodium" },
		});
		expect(resolveMetric("vitamin_d_intake")).toMatchObject({
			kind: "known",
			metric: { fixedDisplayUnit: "µg" },
		});
		// The eight shipped names gave way to uniform generated slugs.
		for (const legacy of ["alcohol_intake", "carbs_intake"]) {
			expect(resolveMetric(legacy)).toEqual({ kind: "unknown", slug: legacy });
		}
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
		for (const imported of ["sleep_duration", "steps"]) {
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
		expect(
			DEFAULT_TRACKED_METRICS.find(
				({ metricSlug }) => metricSlug === "resting_heart_rate",
			),
		).toEqual({
			metricSlug: "resting_heart_rate",
			position: 5,
			enabled: false,
		});
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

	it("completes only the sittings a Mood was actually recorded in", () => {
		expect([...completedCheckInSlots([])]).toEqual([]);
		expect([
			...completedCheckInSlots([{ metricSlug: "mood", slot: "morning" }]),
		]).toEqual(["morning"]);
		expect([
			...completedCheckInSlots([
				{ metricSlug: "mood", slot: "evening" },
				{ metricSlug: "mood", slot: "morning" },
			]),
		]).toEqual(["morning", "evening"]);
		// A configurable score alone does not complete a sitting.
		expect([
			...completedCheckInSlots([{ metricSlug: "energy", slot: "morning" }]),
		]).toEqual([]);
	});

	it("assigns every scored prompt to a sitting, with Mood in both", () => {
		const bySlug = new Map(
			listScoredMetrics().map((metric) => [
				metric.slug,
				metric.defaultCheckInSlots,
			]),
		);

		expect(bySlug.get("mood")).toBe("both");
		for (const slug of CONFIGURABLE_CHECK_IN_METRIC_SLUGS) {
			const assignment = bySlug.get(slug);
			expect(isCheckInSlotAssignment(assignment)).toBe(true);
			// Every configurable prompt is asked somewhere; none is stranded.
			expect(
				CHECK_IN_SLOTS.some((slot) =>
					assignmentIncludesSlot(assignment as CheckInSlotAssignment, slot),
				),
			).toBe(true);
		}
	});

	it("reads a time's sitting the same way the reminder backfill does", () => {
		expect(checkInSlotForMinuteOfDay(0)).toBe("morning");
		expect(checkInSlotForMinuteOfDay(11 * 60 + 59)).toBe("morning");
		expect(checkInSlotForMinuteOfDay(12 * 60)).toBe("evening");
		expect(checkInSlotForMinuteOfDay(23 * 60 + 59)).toBe("evening");
		expect(suggestedCheckInSlot(new Date(2026, 7, 31, 9, 30))).toBe("morning");
		expect(suggestedCheckInSlot(new Date(2026, 7, 31, 20, 0))).toBe("evening");
	});

	it("rejects slot values it did not write", () => {
		expect(isCheckInSlot("morning")).toBe(true);
		expect(isCheckInSlot("afternoon")).toBe(false);
		expect(isCheckInSlot(null)).toBe(false);
		expect(isCheckInSlotAssignment("both")).toBe(true);
		expect(isCheckInSlotAssignment("neither")).toBe(false);
		expect(assignmentIncludesSlot("both", "evening")).toBe(true);
		expect(assignmentIncludesSlot("morning", "evening")).toBe(false);
	});
});
