import type {
	ResolvedTrackedMetric,
	TrackedMetricDefault,
} from "@bro/database-app";

export type LifeAreaDefinition = {
	slug: `wheel:${string}`;
	label: string;
	defaultEnabled: boolean;
	defaultPosition: number;
};

/**
 * Permanent authored vocabulary for wheel observations and area-tagged content.
 * Labels may evolve, but a slug must remain resolvable after it has been stored.
 */
export const LIFE_AREA_CATALOGUE = [
	{
		slug: "wheel:career",
		label: "Work & career",
		defaultEnabled: true,
		defaultPosition: 0,
	},
	{
		slug: "wheel:money",
		label: "Money & finances",
		defaultEnabled: true,
		defaultPosition: 1,
	},
	{
		slug: "wheel:health",
		label: "Health & fitness",
		defaultEnabled: true,
		defaultPosition: 2,
	},
	{
		slug: "wheel:partner",
		label: "Partner & love",
		defaultEnabled: true,
		defaultPosition: 3,
	},
	{
		slug: "wheel:family",
		label: "Family",
		defaultEnabled: true,
		defaultPosition: 4,
	},
	{
		slug: "wheel:friends",
		label: "Friends & social",
		defaultEnabled: true,
		defaultPosition: 5,
	},
	{
		slug: "wheel:growth",
		label: "Learning & growth",
		defaultEnabled: true,
		defaultPosition: 6,
	},
	{
		slug: "wheel:fun",
		label: "Fun & recreation",
		defaultEnabled: true,
		defaultPosition: 7,
	},
	{
		slug: "wheel:purpose",
		label: "Purpose & direction",
		defaultEnabled: false,
		defaultPosition: 8,
	},
	{
		slug: "wheel:fatherhood",
		label: "Fatherhood",
		defaultEnabled: false,
		defaultPosition: 9,
	},
	{
		slug: "wheel:faith",
		label: "Faith & spirituality",
		defaultEnabled: false,
		defaultPosition: 10,
	},
	{
		slug: "wheel:sobriety",
		label: "Sobriety & recovery",
		defaultEnabled: false,
		defaultPosition: 11,
	},
] as const satisfies readonly LifeAreaDefinition[];

export type LifeAreaSlug = (typeof LIFE_AREA_CATALOGUE)[number]["slug"];

const lifeAreasBySlug = new Map<string, LifeAreaDefinition>(
	LIFE_AREA_CATALOGUE.map((area) => [area.slug, area]),
);

export const DEFAULT_LIFE_AREA_METRICS = LIFE_AREA_CATALOGUE.map((area) => ({
	metricSlug: area.slug,
	position: area.defaultPosition,
	enabled: area.defaultEnabled,
})) satisfies readonly TrackedMetricDefault[];

export type ResolvedLifeArea = {
	slug: LifeAreaSlug;
	label: string;
	defaultLabel: string;
	position: number;
	enabled: boolean;
	customLabel: string | null;
	overlayId: string | null;
};

export function isLifeAreaSlug(slug: string): slug is LifeAreaSlug {
	return lifeAreasBySlug.has(slug);
}

export function resolveLifeAreas(
	overlays: readonly ResolvedTrackedMetric[],
): ResolvedLifeArea[] {
	return overlays
		.flatMap((overlay): ResolvedLifeArea[] => {
			const area = lifeAreasBySlug.get(overlay.metricSlug);
			if (!area || !isLifeAreaSlug(area.slug)) {
				return [];
			}
			return [
				{
					slug: area.slug,
					label: overlay.customLabel ?? area.label,
					defaultLabel: area.label,
					position: overlay.position,
					enabled: overlay.enabled,
					customLabel: overlay.customLabel,
					overlayId: overlay.overlayId,
				},
			];
		})
		.sort(
			(left, right) =>
				left.position - right.position || left.slug.localeCompare(right.slug),
		);
}

export function listActiveLifeAreas(
	overlays: readonly ResolvedTrackedMetric[],
): ResolvedLifeArea[] {
	return resolveLifeAreas(overlays).filter((area) => area.enabled);
}
