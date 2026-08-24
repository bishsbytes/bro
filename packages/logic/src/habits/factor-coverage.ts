import { resolveHabit } from "@bro/domain/habit-catalogue";
import type { FactorSlug } from "@bro/domain/metric-registry";

/** The habit fields this module needs; anything Habit-shaped satisfies it. */
export type FactorCoveredHabit = {
	slug: string;
	removedAt: number | null;
};

/**
 * The factor a habit stands in for, or null when it stands in for none.
 *
 * Resolved from the catalogue rather than the stored row: the link is authored
 * content that may change with the app, and a habit created before the link
 * existed should still be covered. A retired template resolves to null, which
 * fails safe — the tag returns to the check-in panel and nothing is deleted.
 */
export function habitFactorSlug(habitSlug: string): FactorSlug | null {
	const template = resolveHabit(habitSlug);
	return template?.kind === "manual" ? template.factorSlug : null;
}

/**
 * Factors currently covered by an active habit, so the check-in panel can drop
 * their tags and its reconciliation can leave those rows to the habit that
 * owns them. Removed habits release their factor back to the panel.
 */
export function coveredFactorSlugs(
	habits: readonly FactorCoveredHabit[],
): Set<string> {
	const covered = new Set<string>();
	for (const habit of habits) {
		if (habit.removedAt !== null) continue;
		const slug = habitFactorSlug(habit.slug);
		if (slug !== null) covered.add(slug);
	}
	return covered;
}
