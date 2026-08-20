import type { Observation } from "@bro/database-app";
import { render } from "@testing-library/react-native";
import type { HistoryDay } from "./history/history-store";
import { HistoryDayScreen } from "./screens/history/history-day-screen";

function userWeight(): Observation {
	return {
		id: "manual-weight",
		metricSlug: "weight",
		value: 80,
		scaleMin: null,
		scaleMax: null,
		observedAt: Date.parse("2026-08-16T08:00:00.000Z"),
		localDay: "2026-08-16",
		tzOffsetMinutes: 0,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		createdAt: 1,
		updatedAt: 1,
	};
}

describe("history measurement provenance", () => {
	it("shows retained manual data beside the selected tracker value", async () => {
		const manual = userWeight();
		const day: HistoryDay = {
			localDay: "2026-08-16",
			checkIns: [],
			unpairedScored: [],
			factors: [],
			assessments: [],
			measurements: [
				{
					id: manual.id,
					metricSlug: "weight",
					label: "Weight",
					value: 80,
					formattedValue: "80.0 kg",
					source: "user",
					selected: false,
					observation: manual,
					changeFromPreviousDay: null,
				},
				{
					id: "tracker-weight",
					metricSlug: "weight",
					label: "Weight",
					value: 79,
					formattedValue: "79.0 kg",
					source: "health_connect",
					selected: true,
					observation: null,
					changeFromPreviousDay: null,
				},
			],
			unknown: [],
			notes: [],
			habitCompletions: [],
			challengeSteps: [],
		};
		const store = {
			loadDay: jest.fn(async () => day),
			updateCheckIn: jest.fn(),
			deleteCheckIn: jest.fn(),
			deleteObservation: jest.fn(),
			updateNote: jest.fn(),
			deleteNote: jest.fn(),
		};
		const view = await render(
			<HistoryDayScreen localDay="2026-08-16" store={store} />,
		);

		expect(await view.findByText("Weight: 80.0 kg")).toBeTruthy();
		expect(view.getByText("Source: You")).toBeTruthy();
		expect(view.getByText("Weight: 79.0 kg")).toBeTruthy();
		expect(
			view.getByText("Source: Health Connect · Used for daily value"),
		).toBeTruthy();
		expect(view.getAllByText("Delete")).toHaveLength(1);
	});
});
