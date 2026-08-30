import type { IconName } from "../components/icon";

/**
 * One icon per catalogue life area. Under sync a newer binary can write area
 * slugs this one has never heard of, so unknown slugs fall back to a dashed
 * circle rather than rendering nothing.
 */
const LIFE_AREA_ICONS: Record<string, IconName> = {
	"wheel:career": "life-career",
	"wheel:environment": "life-environment",
	"wheel:faith": "life-faith",
	"wheel:family": "life-family",
	"wheel:fatherhood": "life-fatherhood",
	"wheel:friends": "life-friends",
	"wheel:fun": "life-fun",
	"wheel:growth": "life-growth",
	"wheel:health": "life-health",
	"wheel:money": "life-money",
	"wheel:partner": "life-partner",
	"wheel:purpose": "life-purpose",
	"wheel:sobriety": "life-sobriety",
};

export function lifeAreaIconName(slug: string): IconName {
	return LIFE_AREA_ICONS[slug] ?? "life-area";
}
