import type { TagCategory } from "@bro/domain/metric-registry";

/**
 * Panel group headings, in the order the check-in and its settings render
 * them. Shared so the two screens cannot drift apart on wording or ordering.
 */
export const TAG_CATEGORY_LABELS: Record<TagCategory, string> = {
	body: "Body",
	lifestyle: "Lifestyle",
	mind: "Mind",
	social: "Social",
	sexual: "Sexual",
};
