import { CHALLENGE_CATALOGUE } from "@bro/domain/challenge-catalogue";
import { DRINK_CATALOGUE } from "@bro/domain/drink-catalogue";
import { HABIT_CATALOGUE } from "@bro/domain/habit-catalogue";
import { INSIGHT_CATALOGUE } from "@bro/domain/insight-catalogue";
import { LIFE_AREA_CATALOGUE } from "@bro/domain/life-area-catalogue";
import { METRIC_REGISTRY } from "@bro/domain/metric-registry";
import { NICOTINE_CATALOGUE } from "@bro/domain/nicotine-catalogue";

/**
 * The English half of the `content` namespace is derived from the domain
 * catalogues rather than retyped here, so authored product copy keeps exactly
 * one source. `domain` has no runtime dependencies and cannot call i18next, so
 * translation happens on the way out, in `src/content`.
 *
 * A translation for another language supplies the same key shape with its own
 * strings; anything it omits falls through to the English derived below.
 *
 * Slugs carry a `kind:name` prefix and i18next reads `:` as the namespace
 * separator, so every key is stored under its bare name inside a group named
 * for the kind.
 */
function bareSlug(slug: string): string {
	return slug.slice(slug.indexOf(":") + 1);
}

function byBareSlug<T, V>(
	items: readonly T[],
	slugOf: (item: T) => string,
	toValue: (item: T) => V,
): Record<string, V> {
	return Object.fromEntries(
		items.map((item) => [bareSlug(slugOf(item)), toValue(item)]),
	);
}

export const content = {
	metrics: byBareSlug(
		METRIC_REGISTRY,
		(metric) => metric.slug,
		(metric) => metric.label,
	),
	lifeAreas: byBareSlug(
		LIFE_AREA_CATALOGUE,
		(area) => area.slug,
		(area) => area.label,
	),
	habits: byBareSlug(
		HABIT_CATALOGUE,
		(habit) => habit.slug,
		(habit) => ({ label: habit.label, description: habit.description }),
	),
	challenges: byBareSlug(
		CHALLENGE_CATALOGUE,
		(challenge) => challenge.slug,
		(challenge) => ({
			title: challenge.title,
			intro: challenge.intro,
			days: Object.fromEntries(
				challenge.days.map((day) => [
					String(day.day),
					{ title: day.title, action: day.action },
				]),
			),
		}),
	),
	drinks: byBareSlug(
		DRINK_CATALOGUE,
		(drink) => drink.id,
		(drink) => ({
			label: drink.label,
			servings: Object.fromEntries(
				drink.servings.map((serving) => [serving.id, serving.label]),
			),
		}),
	),
	nicotine: byBareSlug(
		NICOTINE_CATALOGUE,
		(entry) => entry.id,
		(entry) => ({
			label: entry.label,
			servings: Object.fromEntries(
				entry.servings.map((serving) => [serving.id, serving.label]),
			),
		}),
	),
	insights: byBareSlug(
		INSIGHT_CATALOGUE,
		(insight) => insight.id,
		(insight) => ({
			summary: insight.copy.summary,
			trueArmLabel: insight.copy.trueArmLabel,
			falseArmLabel: insight.copy.falseArmLabel,
		}),
	),
} as const;
