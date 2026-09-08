import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReviewResult } from "./review/review-store";
import { ReviewResultScreen } from "./screens/review/review-result-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn(), replace: jest.fn() },
}));

const scores = [
	{
		slug: "wheel:health",
		label: "Health & fitness",
		position: 0,
		value: 9,
		focused: true,
	},
	{
		slug: "wheel:partner",
		label: "Partner & love",
		position: 1,
		value: 4,
		focused: false,
	},
];

const result = {
	assessment: {
		id: "review-1",
		completedAt: Date.parse("2026-08-20T12:00:00Z"),
	},
	scores,
	isLatest: true,
	previousAssessment: null,
	previousScores: [],
	comparisons: [],
} as unknown as ReviewResult;

const earlier = {
	...result,
	assessment: {
		id: "review-2",
		completedAt: Date.parse("2026-06-01T12:00:00Z"),
	},
	isLatest: false,
	previousAssessment: {
		id: "review-0",
		completedAt: Date.parse("2026-03-01T12:00:00Z"),
	},
	previousScores: scores,
	comparisons: [
		{
			slug: "wheel:health",
			label: "Health & fitness",
			previousLabel: "Health",
			currentValue: 9,
			previousValue: 6,
			delta: 3,
		},
	],
} as unknown as ReviewResult;

describe("review result screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("reads every area as a named value beside the wheel", async () => {
		const screen = await render(
			<ReviewResultScreen
				assessmentId="review-1"
				store={{ loadResult: jest.fn(async () => result) }}
			/>,
		);

		expect(await screen.findByText("Your latest review.")).toBeTruthy();
		expect(screen.getByLabelText("Health & fitness, 9 of 10")).toBeTruthy();
		expect(screen.getByLabelText("Partner & love, 4 of 10")).toBeTruthy();
		// The focus label sits with its area's name, not with the score.
		expect(screen.getByText("Focus").parent).toBe(
			screen.getAllByText("Health & fitness")[0]?.parent,
		);
		expect(
			screen.getByText(
				"This is your first snapshot. Your next review will show what moved.",
			),
		).toBeTruthy();
	});

	it("names an older review and offers the one before it", async () => {
		const screen = await render(
			<ReviewResultScreen
				assessmentId="review-2"
				store={{ loadResult: jest.fn(async () => earlier) }}
			/>,
		);

		expect(await screen.findByText("This review.")).toBeTruthy();
		expect(screen.getByText("+3 from 6")).toBeTruthy();
		expect(screen.getByText("Previously “Health”")).toBeTruthy();

		await fireEvent.press(screen.getByLabelText("View previous review"));
		expect(router.push).toHaveBeenCalledWith({
			pathname: "/review/[id]",
			params: { id: "review-0" },
		});
	});
});
