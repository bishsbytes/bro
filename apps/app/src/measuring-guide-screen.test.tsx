import { fireEvent, render } from "@testing-library/react-native";
import { MeasuringGuideScreen } from "./screens/body/measuring-guide-screen";

jest.mock("react-native-safe-area-context", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

describe("Measuring guide", () => {
	it("offers every tape site, whether or not it is tracked", async () => {
		const view = await render(<MeasuringGuideScreen />);

		for (const site of ["Neck", "Chest", "Bicep", "Waist", "Hip", "Thigh"]) {
			expect(view.getByLabelText(`${site}, how to measure`)).toBeTruthy();
		}
	});

	it("answers where the tape goes for the site the user taps", async () => {
		const view = await render(<MeasuringGuideScreen />);

		expect(
			view.getByText(
				"Around the navel, standing normally, at the end of a normal breath out. Do not hold it in.",
			),
		).toBeTruthy();

		await fireEvent.press(view.getByLabelText("Neck, how to measure"));

		expect(
			view.getByText(
				"Just below the Adam's apple, with the tape sloping slightly down at the front.",
			),
		).toBeTruthy();
		expect(
			view.getByLabelText("Neck, how to measure").props.accessibilityState,
		).toMatchObject({ selected: true });
	});

	it("carries no readings, so nothing personal is pinned to the drawing", async () => {
		const view = await render(<MeasuringGuideScreen />);

		expect(view.queryByTestId("gauge-marker")).toBeNull();
		expect(view.queryByText("Since last time")).toBeNull();
	});

	it("opens on the tape site that linked to the guide", async () => {
		const view = await render(<MeasuringGuideScreen initialSite="neck" />);

		expect(
			view.getByLabelText("Neck, how to measure").props.accessibilityState,
		).toMatchObject({ selected: true });
		expect(
			view.getByText(
				"Just below the Adam's apple, with the tape sloping slightly down at the front.",
			),
		).toBeTruthy();
	});
});
