import { resolveHabit } from "@bro/domain/habit-catalogue";
import type { TagSlug } from "@bro/domain/metric-registry";

/** The habit fields this module needs; anything Habit-shaped satisfies it. */
export type TagCoveredHabit = {
	slug: string;
	removedAt: number | null;
};

/**
 * The tag a habit stands in for, or null when it stands in for none.
 *
 * Resolved from the catalogue rather than the stored row: the link is authored
 * content that may change with the app, and a habit created before the link
 * existed should still be covered. A retired template resolves to null, which
 * fails safe — the tag returns to the check-in panel and nothing is deleted.
 */
export function habitTagSlug(habitSlug: string): TagSlug | null {
	const template = resolveHabit(habitSlug);
	return template?.kind === "manual" ? template.tagSlug : null;
}

/**
 * Tags currently covered by an active habit, so the check-in panel can drop
 * them and its reconciliation can leave those rows to the habit that owns
 * them. Removed habits release their tag back to the panel.
 */
export function coveredTagSlugs(
	habits: readonly TagCoveredHabit[],
): Set<string> {
	const covered = new Set<string>();
	for (const habit of habits) {
		if (habit.removedAt !== null) continue;
		const slug = habitTagSlug(habit.slug);
		if (slug !== null) covered.add(slug);
	}
	return covered;
}
