import type { Assessment } from "@bro/database-app";

/**
 * A wheel score as a bare numeral. Scores are whole numbers when a person
 * types them, but a rescaled observation can land between two points, so the
 * screens that show one share this rounding rather than each picking its own.
 */
export function formatScore(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * When a sitting happened. A review is dated by the moment it was completed,
 * falling back to when it was started so an abandoned sitting still shows a
 * date rather than nothing.
 */
export function assessmentDate(
	assessment: Pick<Assessment, "completedAt" | "startedAt">,
): number {
	return assessment.completedAt ?? assessment.startedAt;
}

/**
 * A review date as a person reads it. `month` is long where the date is a
 * screen's own subject, and short in a list, where it shares a row with the
 * rest of the entry.
 */
export function formatReviewDate(
	at: number,
	month: "long" | "short" = "long",
): string {
	return new Date(at).toLocaleDateString(undefined, {
		day: "numeric",
		month,
		year: "numeric",
	});
}
