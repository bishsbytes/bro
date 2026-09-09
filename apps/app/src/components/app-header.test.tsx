import { fireEvent, render } from "@testing-library/react-native";
import { createContext, useContext } from "react";
import { StyleSheet as NativeStyleSheet, Text } from "react-native";
import * as Unistyles from "../theme/unistyles";
import { darkTheme, lightTheme } from "../theme/unistyles";
import { AppHeader } from "./app-header";

jest.mock("../theme/unistyles", () => ({
	__esModule: true,
	...jest.requireActual("../theme/unistyles"),
}));

describe("AppHeader", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([false, true])(
		"updates the safe-area background without remounting (stacked: %s)",
		async (stacked) => {
			// The library's Jest mock has no theme subscription. Model that boundary
			// with context while keeping the header element and its props unchanged.
			const ThemeContext = createContext(lightTheme);
			const initialUnistyles = Unistyles.useUnistyles();
			jest
				.spyOn(Unistyles, "useUnistyles")
				.mockImplementation(function useMockUnistyles() {
					return { ...initialUnistyles, theme: useContext(ThemeContext) };
				});
			const header = <AppHeader title="Journal" stacked={stacked} />;
			const screen = await render(
				<ThemeContext.Provider value={lightTheme}>
					{header}
				</ThemeContext.Provider>,
			);
			const title = screen.getByRole("header");

			for (const theme of [lightTheme, darkTheme, lightTheme]) {
				await screen.rerender(
					<ThemeContext.Provider value={theme}>{header}</ThemeContext.Provider>,
				);
				expect(
					NativeStyleSheet.flatten(screen.root?.props.style).backgroundColor,
				).toBe(theme.colors.background);
				expect(screen.getByRole("header")).toBe(title);
			}
		},
	);

	it("renders a title and actions and opens Settings from the avatar", async () => {
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

	it("shows a settings avatar without depending on account identity", async () => {
		const screen = await render(<AppHeader title="History" />);

		expect(screen.getByLabelText("Settings")).toBeTruthy();
		expect(screen.getByTestId("settings-avatar-icon")).toBeTruthy();
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
