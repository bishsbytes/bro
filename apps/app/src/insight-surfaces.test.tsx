import { INSIGHT_CATALOGUE } from "@bro/domain/insight-catalogue";
import type { ShownInsight } from "@bro/logic";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { InsightSnapshot } from "./insight/insight-store";
import { InsightDetailScreen } from "./screens/insights/insight-detail-screen";
import { InsightsScreen } from "./screens/insights/insights-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		...jest.requireActual("react-native-safe-area-context"),
		SafeAreaView: ({
			edges = [],
			...props
		}: {
			edges?: readonly string[];
			children?: React.ReactNode;
		}) =>
			React.createElement(View, {
				...props,
				testID: `safe-area-${edges.join("-")}`,
			}),
	};
});

const pair = INSIGHT_CATALOGUE[0];
const shown: ShownInsight = {
	kind: "shown",
	pair,
	fromLocalDay: "2026-05-21",
	throughLocalDay: "2026-08-18",
	trueArm: { mean: 2.1, count: 11 },
	falseArm: { mean: 3.4, count: 11 },
	effect: -1.3,
	direction: "lower",
};

const trends = {
	load: jest.fn(async () => ({
		period: 7 as const,
		fromLocalDay: "2026-08-12",
		throughLocalDay: "2026-08-18",
		metrics: [],
	})),
};

describe("insight surfaces", () => {
	beforeEach(() => jest.clearAllMocks());

	it("renders arithmetic not-yet progress", async () => {
		const snapshot: InsightSnapshot = {
			state: "not-yet",
			throughLocalDay: "2026-08-18",
			shown: [],
			evaluations: [],
			teaser: {
				watchedCount: 16,
				nearest: {
					kind: "not-yet",
					pair,
					gate: "true-arm-days",
					remaining: 6,
					unit: "days",
					outputDayCount: 20,
					trueCount: 1,
					falseCount: 19,
				},
			},
		};
		const screen = await render(
			<InsightsScreen
				store={trends}
				insightStore={{ load: jest.fn(async () => snapshot) }}
			/>,
		);

		expect(await screen.findByText("Watching 16 patterns")).toBeTruthy();
		expect(
			screen.getByText(
				"The closest needs 6 more days matching “Days after drinking”.",
			),
		).toBeTruthy();
		// Reached from the journal header, not a tab: nothing else reserves the
		// bottom inset, so this screen has to.
		expect(screen.getByTestId("safe-area-bottom")).toBeTruthy();
	});

	it("promises generic check-ins only for the output-days gate", async () => {
		const snapshot: InsightSnapshot = {
			state: "not-yet",
			throughLocalDay: "2026-08-18",
			shown: [],
			evaluations: [],
			teaser: {
				watchedCount: 16,
				nearest: {
					kind: "not-yet",
					pair,
					gate: "output-days",
					remaining: 6,
					unit: "days",
					outputDayCount: 14,
					trueCount: 4,
					falseCount: 10,
				},
			},
		};
		const screen = await render(
			<InsightsScreen
				store={trends}
				insightStore={{ load: jest.fn(async () => snapshot) }}
			/>,
		);

		expect(
			await screen.findByText("The closest needs 6 more days of check-ins."),
		).toBeTruthy();
	});

	it("opens a shown comparison and renders both evidence arms", async () => {
		const snapshot: InsightSnapshot = {
			state: "shown",
			throughLocalDay: "2026-08-18",
			shown: [shown],
			evaluations: [shown],
			teaser: { watchedCount: 1, nearest: null },
		};
		const insights = await render(
			<InsightsScreen
				store={trends}
				insightStore={{ load: jest.fn(async () => snapshot) }}
			/>,
		);
		const card = await insights.findByLabelText(/^Open insight:/);
		expect(card.props.accessibilityLabel).toContain("11 days");
		await fireEvent.press(card);
		expect(mockPush).toHaveBeenCalledWith(
			expect.stringContaining("insight%3Aalcohol-energy-lag1"),
		);

		const detail = await render(
			<InsightDetailScreen
				id={pair.id}
				store={{ loadDetail: jest.fn(async () => shown) }}
			/>,
		);
		expect(await detail.findByText("2.1")).toBeTruthy();
		expect(detail.getByText("3.4")).toBeTruthy();
		expect(detail.getAllByText("11 days")).toHaveLength(2);
		expect(
			detail.getByText(/does not show that one thing caused/),
		).toBeTruthy();
	});

	it("reloads the full trend list for a new period and opens history", async () => {
		const snapshot: InsightSnapshot = {
			state: "empty",
			throughLocalDay: "2026-08-18",
			shown: [],
			evaluations: [],
			teaser: { watchedCount: 16, nearest: null },
		};
		const screen = await render(
			<InsightsScreen
				store={trends}
				insightStore={{ load: jest.fn(async () => snapshot) }}
			/>,
		);

		await screen.findByText("Your patterns start with check-ins");
		await fireEvent.press(screen.getByText("30 days"));
		await waitFor(() => expect(trends.load).toHaveBeenLastCalledWith(30));

		await fireEvent.press(screen.getByLabelText("Open history"));
		expect(mockPush).toHaveBeenLastCalledWith("/history");
	});
});
