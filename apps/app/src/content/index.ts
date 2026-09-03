import {
	type ChallengeTemplate,
	challengeForArea as challengeForAreaSource,
	resolveChallenge as resolveChallengeSource,
} from "@bro/domain/challenge-catalogue";
import {
	type ConstituentDefinition,
	resolveConstituent as resolveConstituentSource,
} from "@bro/domain/constituent-catalogue";
import type { ConsumableKind, SystemConsumable } from "@bro/domain/consumable";
import {
	HABIT_CATALOGUE as HABIT_CATALOGUE_SOURCE,
	type HabitTemplate,
	habitsForArea as habitsForAreaSource,
	resolveHabit as resolveHabitSource,
} from "@bro/domain/habit-catalogue";
import {
	INSIGHT_CATALOGUE as INSIGHT_CATALOGUE_SOURCE,
	type InsightCatalogueEntry,
	resolveInsight as resolveInsightSource,
} from "@bro/domain/insight-catalogue";
import {
	listActiveLifeAreas as listActiveLifeAreasSource,
	type ResolvedLifeArea,
	resolveLifeAreas as resolveLifeAreasSource,
} from "@bro/domain/life-area-catalogue";
import {
	listMeasurements as listMeasurementsSource,
	listScoredMetrics as listScoredMetricsSource,
	listTags as listTagsSource,
	type MetricDefinition,
	type MetricResolution,
	resolveMetric as resolveMetricSource,
} from "@bro/domain/metric-registry";
import {
	listSystemConsumables as listSystemConsumablesSource,
	resolveSystemConsumable as resolveSystemConsumableSource,
} from "@bro/domain/system-consumables";
import { i18n } from "../i18n";

/**
 * Authored product content — metric names, life areas, habits, challenges,
 * consumables, constituents, insight copy — is translated here, on the way out
 * of `@bro/domain`.
 *
 * The domain package holds the English wording and has no runtime dependencies,
 * so it cannot call i18next itself. These wrappers keep the same shapes and
 * substitute the copy, which lets the rest of the app read `metric.label` as it
 * always has. Import them from here rather than from `@bro/domain/*` whenever
 * the value reaches a screen.
 *
 * Anything a language has not translated resolves to the English derived from
 * the catalogues, so a partial translation degrades one string at a time.
 */
function translate(key: string, english: string): string {
	return i18n.t(`content:${key}`, { defaultValue: english });
}

/** Slugs read `kind:name`; i18next reads `:` as its namespace separator. */
function bareSlug(slug: string): string {
	return slug.slice(slug.indexOf(":") + 1);
}

function localiseMetric<T extends MetricDefinition>(metric: T): T {
	return {
		...metric,
		label: translate(`metrics.${bareSlug(metric.slug)}`, metric.label),
	};
}

export function resolveMetric(slug: string): MetricResolution {
	const resolved = resolveMetricSource(slug);
	return resolved.kind === "known"
		? { ...resolved, metric: localiseMetric(resolved.metric) }
		: resolved;
}

export function listScoredMetrics(): ReturnType<
	typeof listScoredMetricsSource
> {
	return listScoredMetricsSource().map(localiseMetric);
}

export function listTags(): ReturnType<typeof listTagsSource> {
	return listTagsSource().map(localiseMetric);
}

export function listMeasurements(): ReturnType<typeof listMeasurementsSource> {
	return listMeasurementsSource().map(localiseMetric);
}

function localiseLifeArea(area: ResolvedLifeArea): ResolvedLifeArea {
	const defaultLabel = translate(
		`lifeAreas.${bareSlug(area.slug)}`,
		area.defaultLabel,
	);
	// A person's own renaming outranks the translation, exactly as it outranks
	// the authored English.
	return { ...area, defaultLabel, label: area.customLabel ?? defaultLabel };
}

export function resolveLifeAreas(
	...args: Parameters<typeof resolveLifeAreasSource>
): ResolvedLifeArea[] {
	return resolveLifeAreasSource(...args).map(localiseLifeArea);
}

export function listActiveLifeAreas(
	...args: Parameters<typeof listActiveLifeAreasSource>
): ResolvedLifeArea[] {
	return listActiveLifeAreasSource(...args).map(localiseLifeArea);
}

function localiseHabit(habit: HabitTemplate): HabitTemplate {
	const key = `habits.${bareSlug(habit.slug)}`;
	return {
		...habit,
		label: translate(`${key}.label`, habit.label),
		description: translate(`${key}.description`, habit.description),
	};
}

export function resolveHabit(slug: string): HabitTemplate | null {
	const habit = resolveHabitSource(slug);
	return habit && localiseHabit(habit);
}

export function habitsForArea(areaSlug: string): HabitTemplate[] {
	return habitsForAreaSource(areaSlug).map(localiseHabit);
}

export function habitCatalogue(): HabitTemplate[] {
	return HABIT_CATALOGUE_SOURCE.map(localiseHabit);
}

function localiseChallenge(challenge: ChallengeTemplate): ChallengeTemplate {
	const key = `challenges.${bareSlug(challenge.slug)}`;
	return {
		...challenge,
		title: translate(`${key}.title`, challenge.title),
		intro: translate(`${key}.intro`, challenge.intro),
		days: challenge.days.map((day) => ({
			...day,
			title: translate(`${key}.days.${day.day}.title`, day.title),
			action: translate(`${key}.days.${day.day}.action`, day.action),
		})),
	};
}

export function resolveChallenge(slug: string): ChallengeTemplate | null {
	const challenge = resolveChallengeSource(slug);
	return challenge && localiseChallenge(challenge);
}

export function challengeForArea(areaSlug: string): ChallengeTemplate | null {
	const challenge = challengeForAreaSource(areaSlug);
	return challenge && localiseChallenge(challenge);
}

function localiseSystemConsumable<T extends SystemConsumable>(
	consumable: T,
): T {
	const key = `consumables.${consumable.key.replace(":", ".")}`;
	return {
		...consumable,
		name: translate(`${key}.name`, consumable.name),
		portions: consumable.portions.map((portion) => ({
			...portion,
			label: translate(`${key}.portions.${portion.id}`, portion.label),
		})),
	};
}

export function resolveSystemConsumable(key: string): SystemConsumable | null {
	const consumable = resolveSystemConsumableSource(key);
	return consumable && localiseSystemConsumable(consumable);
}

export function listSystemConsumables(
	kind?: ConsumableKind,
): SystemConsumable[] {
	return listSystemConsumablesSource(kind).map(localiseSystemConsumable);
}

/** A constituent's own name, as an editor or a total row shows it. */
export function resolveConstituent(code: string): ConstituentDefinition | null {
	const constituent = resolveConstituentSource(code);
	return (
		constituent && {
			...constituent,
			label: translate(`constituents.${constituent.code}`, constituent.label),
		}
	);
}

function localiseInsight(
	insight: InsightCatalogueEntry,
): InsightCatalogueEntry {
	const key = `insights.${bareSlug(insight.id)}`;
	return {
		...insight,
		copy: {
			summary: translate(`${key}.summary`, insight.copy.summary),
			trueArmLabel: translate(`${key}.trueArmLabel`, insight.copy.trueArmLabel),
			falseArmLabel: translate(
				`${key}.falseArmLabel`,
				insight.copy.falseArmLabel,
			),
		},
	};
}

export function resolveInsight(id: string): InsightCatalogueEntry | null {
	const insight = resolveInsightSource(id);
	return insight && localiseInsight(insight);
}

export function insightCatalogue(): InsightCatalogueEntry[] {
	return INSIGHT_CATALOGUE_SOURCE.map(localiseInsight);
}
