import { KILOGRAMS_PER_POUND } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import type { BodyOverview } from "./body/body-store";
import { i18n } from "./i18n";
import { BodyScreen } from "./screens/body/body-screen";

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

function weightOverview(tracked: boolean): BodyOverview {
	return {
		inputLocale: "en-GB",
		metrics: [
			{
				metricSlug: "weight",
				label: "Weight",
				dimension: "mass",
				displayUnit: "st",
				userEnterable: true,
				editablePresentation: {
					metricSlug: "weight",
					label: "Weight",
					dimension: "mass",
					displayUnit: "st",
				},
				tracked,
				visible: true,
				hasImportedData: false,
				position: 0,
				latest: null,
				latestFormatted: null,
				series: { observedDayCount: 0 },
				activeGoal: null,
			},
		],
	} as unknown as BodyOverview;
}

const emptyOverview = { metrics: [], inputLocale: "en-GB" } as BodyOverview;

describe("Body screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("records a tracked measurement in canonical units", async () => {
		const recordMeasurement = jest.fn(async () => weightOverview(true));
		const screen = await render(
			<BodyScreen
				store={{
					loadOverview: jest.fn(async () => weightOverview(true)),
					setTracked: jest.fn(),
					recordMeasurement,
				}}
			/>,
		);

		await fireEvent.changeText(
			await screen.findByLabelText("Weight (stones)"),
			"12",
		);
		await fireEvent.changeText(screen.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(screen.getByLabelText("Log Weight"));

		expect(recordMeasurement).toHaveBeenCalledWith(
			"weight",
			172 * KILOGRAMS_PER_POUND,
		);
		expect(screen.getByLabelText("Weight (stones)").props.value).toBe("");
	});

	it("shows a field error and writes nothing for unparseable input", async () => {
		i18n.addResourceBundle(
			"en",
			"validation",
			{ measurement: { invalid: "Use a translated measurement value." } },
			true,
			true,
		);
		const recordMeasurement = jest.fn(async () => weightOverview(true));
		try {
			const screen = await render(
				<BodyScreen
					store={{
						loadOverview: jest.fn(async () => weightOverview(true)),
						setTracked: jest.fn(),
						recordMeasurement,
					}}
				/>,
			);

			await fireEvent.changeText(
				await screen.findByLabelText("Weight (stones)"),
				"heavy",
			);
			await fireEvent.press(screen.getByLabelText("Log Weight"));

			expect(recordMeasurement).not.toHaveBeenCalled();
			expect(
				screen.getByText("Use a translated measurement value."),
			).toBeTruthy();
		} finally {
			i18n.addResourceBundle(
				"en",
				"validation",
				{ measurement: { invalid: "Enter a valid measurement." } },
				true,
				true,
			);
		}
	});

	it("offers entry only once a measurement is tracked", async () => {
		const screen = await render(
			<BodyScreen
				store={{
					loadOverview: jest.fn(async () => weightOverview(false)),
					setTracked: jest.fn(),
					recordMeasurement: jest.fn(),
				}}
			/>,
		);

		expect(await screen.findByLabelText("Track Weight")).toBeTruthy();
		expect(screen.queryByLabelText("Weight (stones)")).toBeNull();
		expect(screen.queryByLabelText("Log Weight")).toBeNull();
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await render(
			<BodyScreen
				store={{
					loadOverview: jest.fn(async () => emptyOverview),
					setTracked: jest.fn(),
					recordMeasurement: jest.fn(),
				}}
			/>,
		);

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
