import { describe, expect, it } from "vitest";
import {
	isWheelReviewDue,
	WHEEL_REVIEW_INTERVAL_DAYS,
} from "./wheel-review-due";

const DAY_MS = 24 * 60 * 60 * 1_000;

describe("isWheelReviewDue", () => {
	it("is due before the first completed wheel review", () => {
		expect(isWheelReviewDue(null, Date.parse("2026-08-20T12:00:00Z"))).toBe(
			true,
		);
	});

	it("allows exactly 35 days before becoming due", () => {
		const completedAt = Date.parse("2026-07-16T12:00:00Z");
		const boundary = completedAt + WHEEL_REVIEW_INTERVAL_DAYS * DAY_MS;

		expect(isWheelReviewDue(completedAt, boundary)).toBe(false);
		expect(isWheelReviewDue(completedAt, boundary + 1)).toBe(true);
	});

	it("is not due after a recent review", () => {
		const completedAt = Date.parse("2026-08-01T12:00:00Z");
		expect(
			isWheelReviewDue(completedAt, Date.parse("2026-08-20T12:00:00Z")),
		).toBe(false);
	});
});
