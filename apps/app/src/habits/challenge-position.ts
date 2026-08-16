export type ChallengePosition = {
	completedDays: number;
	nextDayIndex: number | null;
	isFinished: boolean;
};

/** The programme advances to its first uncompleted authored day. */
export function resolveChallengePosition(
	durationDays: number,
	completedDayIndexes: readonly number[],
): ChallengePosition {
	if (!Number.isInteger(durationDays) || durationDays < 1) {
		throw new RangeError("Challenge duration must be a positive integer.");
	}
	const completed = new Set<number>();
	for (const dayIndex of completedDayIndexes) {
		if (
			!Number.isInteger(dayIndex) ||
			dayIndex < 1 ||
			dayIndex > durationDays
		) {
			throw new RangeError("Completed challenge day is outside the programme.");
		}
		completed.add(dayIndex);
	}

	for (let dayIndex = 1; dayIndex <= durationDays; dayIndex += 1) {
		if (!completed.has(dayIndex)) {
			return {
				completedDays: completed.size,
				nextDayIndex: dayIndex,
				isFinished: false,
			};
		}
	}
	return {
		completedDays: completed.size,
		nextDayIndex: null,
		isFinished: true,
	};
}
