import type { TagCategory } from "@bro/domain/metric-registry";

/**
 * Panel group headings, in the order the check-in and its settings render
 * them. Shared so the two screens cannot drift apart on wording or ordering.
 * The values are catalogue keys in the `checkIn` namespace, not copy.
 */
export const TAG_CATEGORY_KEYS = {
	body: "tagCategories.body",
	lifestyle: "tagCategories.lifestyle",
	mind: "tagCategories.mind",
	social: "tagCategories.social",
	sexual: "tagCategories.sexual",
} as const satisfies Record<TagCategory, string>;
