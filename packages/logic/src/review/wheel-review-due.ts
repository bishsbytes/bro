const DAY_MS = 24 * 60 * 60 * 1_000;

export const WHEEL_REVIEW_INTERVAL_DAYS = 35;

export function isWheelReviewDue(
	latestCompletedAt: number | null,
	now: number,
): boolean {
	return (
		latestCompletedAt === null ||
		now - latestCompletedAt > WHEEL_REVIEW_INTERVAL_DAYS * DAY_MS
	);
}
