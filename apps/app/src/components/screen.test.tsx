import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { FullScreen, Screen, StackScreen } from "./screen";

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

describe("Screen safe areas", () => {
	it("leaves tab screens to the tab navigator", async () => {
		const view = await render(
			<Screen>
				<Text>Tab content</Text>
			</Screen>,
		);

		expect(view.getByTestId("safe-area-")).toBeTruthy();
	});

	it("protects the bottom edge of a pushed stack screen", async () => {
		const view = await render(
			<StackScreen>
				<Text>Stack content</Text>
			</StackScreen>,
		);

		expect(view.getByTestId("safe-area-bottom")).toBeTruthy();
	});

	it("protects both edges when no navigator chrome is present", async () => {
		const view = await render(
			<FullScreen>
				<Text>Fullscreen content</Text>
			</FullScreen>,
		);

		expect(view.getByTestId("safe-area-top-bottom")).toBeTruthy();
	});
});
