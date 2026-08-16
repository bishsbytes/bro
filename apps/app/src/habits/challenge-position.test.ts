import { resolveChallengePosition } from "./challenge-position";

describe("challenge position", () => {
	it("starts at day one and advances to the first incomplete day", () => {
		expect(resolveChallengePosition(3, [])).toEqual({
			completedDays: 0,
			nextDayIndex: 1,
			isFinished: false,
		});
		expect(resolveChallengePosition(5, [1, 2, 4])).toEqual({
			completedDays: 3,
			nextDayIndex: 3,
			isFinished: false,
		});
	});

	it("depends on completion rather than elapsed calendar time", () => {
		expect(resolveChallengePosition(30, [1, 2, 3])).toMatchObject({
			nextDayIndex: 4,
			isFinished: false,
		});
	});

	it("detects finish and collapses replicated duplicate indexes", () => {
		expect(resolveChallengePosition(3, [3, 1, 2, 2])).toEqual({
			completedDays: 3,
			nextDayIndex: null,
			isFinished: true,
		});
		expect(() => resolveChallengePosition(3, [4])).toThrow(
			"outside the programme",
		);
	});
});
