import { LIFE_AREA_CATALOGUE, type LifeAreaSlug } from "./life-area-catalogue";

export type AssessmentTemplate<ItemSlug extends string> = {
	slug: string;
	templateVersion: number;
	locked: boolean;
	itemSlugs: readonly ItemSlug[];
};

export const WHEEL_OF_LIFE_TEMPLATE = {
	slug: "wheel-of-life",
	templateVersion: 1,
	locked: false,
	itemSlugs: LIFE_AREA_CATALOGUE.map((area) => area.slug),
} satisfies AssessmentTemplate<LifeAreaSlug>;
