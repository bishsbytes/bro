import type { ResolvedTrackedMetric } from "@bro/database-app";
import {
	DEFAULT_LIFE_AREA_METRICS,
	LIFE_AREA_CATALOGUE,
	listActiveLifeAreas,
	resolveLifeAreas,
} from "./content/life-area-catalogue";
import { WHEEL_OF_LIFE_TEMPLATE } from "./content/wheel-template";

const PERMANENT_AREAS = [
	["wheel:career", "Work & career", true, false],
	["wheel:money", "Money & finances", true, false],
	["wheel:health", "Health & fitness", true, false],
	["wheel:partner", "Partner & love", true, false],
	["wheel:family", "Family", true, false],
	["wheel:friends", "Friends & social", true, false],
	["wheel:growth", "Learning & growth", true, false],
	["wheel:fun", "Fun & recreation", true, false],
	["wheel:purpose", "Purpose & direction", false, false],
	["wheel:fatherhood", "Fatherhood", false, false],
	["wheel:faith", "Faith & spirituality", false, true],
	["wheel:sobriety", "Sobriety & recovery", false, true],
] as const;

function defaultOverlays(): ResolvedTrackedMetric[] {
	return DEFAULT_LIFE_AREA_METRICS.map((area) => ({
		...area,
		enabled: area.enabled ?? true,
		overlayId: null,
		addedAt: null,
		removedAt: null,
		customLabel: null,
	}));
}

describe("life-area catalogue", () => {
	it("pins the permanent vocabulary, labels, defaults, and order", () => {
		expect(
			LIFE_AREA_CATALOGUE.map((area) => [
				area.slug,
				area.label,
				area.defaultEnabled,
				area.sensitive,
			]),
		).toEqual(PERMANENT_AREAS);
		expect(LIFE_AREA_CATALOGUE.map((area) => area.defaultPosition)).toEqual(
			Array.from({ length: 12 }, (_, index) => index),
		);
	});

	it("defines an editable versioned wheel template over every area", () => {
		expect(WHEEL_OF_LIFE_TEMPLATE).toEqual({
			slug: "wheel-of-life",
			templateVersion: 1,
			locked: false,
			itemSlugs: PERMANENT_AREAS.map(([slug]) => slug),
		});
	});

	it("resolves order, enabled state, and custom labels while ignoring unknowns", () => {
		const overlays = defaultOverlays().map((area) =>
			area.metricSlug === "wheel:career"
				? {
						...area,
						position: 20,
						enabled: false,
						customLabel: "Business",
						overlayId: "overlay-career",
					}
				: area,
		);
		overlays.push({
			metricSlug: "wheel:future",
			position: 0,
			enabled: true,
			overlayId: "overlay-future",
			addedAt: 1,
			removedAt: null,
			customLabel: "Future area",
		});

		const resolved = resolveLifeAreas(overlays);
		expect(resolved).toHaveLength(12);
		expect(resolved.at(-1)).toMatchObject({
			slug: "wheel:career",
			label: "Business",
			defaultLabel: "Work & career",
			position: 20,
			enabled: false,
			overlayId: "overlay-career",
		});
		expect(listActiveLifeAreas(overlays)).toHaveLength(7);
		expect(resolved.some(({ slug }) => String(slug) === "wheel:future")).toBe(
			false,
		);
	});
});
