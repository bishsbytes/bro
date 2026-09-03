import { render } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
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

	it("lets native stack headers inset and collapse over scrolling pages", async () => {
		const view = await render(
			<StackScreen scroll>
				<Text>Stack content</Text>
			</StackScreen>,
		);

		let ancestor = view.getByText("Stack content").parent;
		while (
			ancestor &&
			ancestor.props.contentInsetAdjustmentBehavior !== "automatic"
		) {
			ancestor = ancestor.parent;
		}
		expect(ancestor?.props.contentInsetAdjustmentBehavior).toBe("automatic");
	});

	it("protects both edges when no navigator chrome is present", async () => {
		const view = await render(
			<FullScreen>
				<Text>Fullscreen content</Text>
			</FullScreen>,
		);

		expect(view.getByTestId("safe-area-top-bottom")).toBeTruthy();
	});

	it("centres content vertically without collapsing control width", async () => {
		const view = await render(
			<Screen centered>
				<Text>Centered content</Text>
			</Screen>,
		);
		const content = view.getByText("Centered content").parent;

		expect(StyleSheet.flatten(content?.props.style)).toMatchObject({
			alignItems: "stretch",
			justifyContent: "center",
		});
	});

	it("keeps padded content close to the header", async () => {
		const view = await render(
			<Screen padded>
				<Text>Page content</Text>
			</Screen>,
		);
		const content = view.getByText("Page content").parent;

		expect(StyleSheet.flatten(content?.props.style)).toMatchObject({
			paddingHorizontal: 16,
			paddingTop: 16,
			paddingBottom: 32,
		});
	});

	it("constrains the safe-area boundary so web content scrolls inside it", async () => {
		const view = await render(
			<Screen scroll>
				<Text>Scrollable content</Text>
			</Screen>,
		);

		expect(
			StyleSheet.flatten(view.getByTestId("safe-area-").props.style),
		).toMatchObject({
			flex: 1,
			minHeight: 0,
		});
	});
});
