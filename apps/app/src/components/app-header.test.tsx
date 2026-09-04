import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet, Text } from "react-native";
import { AppHeader } from "./app-header";

describe("AppHeader", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("renders a title and actions and opens Settings from the cog", async () => {
		const onSettingsPress = jest.fn();
		const screen = await render(
			<AppHeader
				title="Today"
				centerTitle
				leading={<Text>History</Text>}
				actions={<Text>Filter</Text>}
				onSettingsPress={onSettingsPress}
			/>,
		);

		expect(screen.getByText("Today")).toBeTruthy();
		expect(screen.getByText("History")).toBeTruthy();
		expect(screen.getByText("Filter")).toBeTruthy();
		expect(
			NativeStyleSheet.flatten(screen.getByText("Today").parent?.props.style)
				.pointerEvents,
		).toBe("none");

		await fireEvent.press(screen.getByLabelText("Settings"));
		expect(onSettingsPress).toHaveBeenCalledTimes(1);
	});

	it("shows a settings cog without depending on account identity", async () => {
		const screen = await render(<AppHeader title="History" />);

		expect(screen.getByLabelText("Settings")).toBeTruthy();
		expect(screen.getByTestId("settings-header-icon")).toBeTruthy();
	});

	it("renders a compact date context above the title as one accessible target", async () => {
		const onOpenHistory = jest.fn();
		const screen = await render(
			<AppHeader
				title="Journal"
				eyebrow="September"
				eyebrowAccessibilityLabel="Open history"
				onEyebrowPress={onOpenHistory}
				showSettings={false}
			/>,
		);

		expect(screen.getByText("September")).toBeTruthy();
		expect(screen.getByText("Journal")).toBeTruthy();
		await fireEvent.press(screen.getByLabelText("Open history"));
		expect(onOpenHistory).toHaveBeenCalledTimes(1);
	});
});
