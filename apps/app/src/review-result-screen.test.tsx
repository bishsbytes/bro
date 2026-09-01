import { render } from "@testing-library/react-native";
import type { ReviewResult } from "./review/review-store";
import { ReviewResultScreen } from "./screens/review/review-result-screen";

jest.mock("expo-router", () => ({
	router: { push: jest.fn(), replace: jest.fn() },
}));

const result = {
	assessment: {
		id: "review-1",
		completedAt: Date.parse("2026-08-20T12:00:00Z"),
	},
	scores: [
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
	],
	previousAssessment: null,
	previousScores: [],
	comparisons: [],
} as unknown as ReviewResult;

describe("review result screen", () => {
	it("keeps the focus label beside the title without shifting the score", async () => {
		const screen = await render(
			<ReviewResultScreen
				assessmentId="review-1"
				store={{ loadResult: jest.fn(async () => result) }}
			/>,
		);

		const label = await screen.findByText("Health & fitness");
		const score = screen.getByText("9/10");
		const focus = screen.getByText("Focus");

		expect(focus.parent).toBe(label.parent);
		expect(label.parent?.parent).toBe(score.parent);
	});
});
