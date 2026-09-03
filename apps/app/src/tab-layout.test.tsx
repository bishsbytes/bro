import { localDayOf } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { StyleSheet as NativeStyleSheet } from "react-native";
import TabLayout from "./app/(tabs)/_layout";
import { monthHeaderLabel } from "./components/today-header-month-context";
import * as themeModule from "./theme/unistyles";

let mockThemeOverride: unknown;
const mockSafeAreaInsets = {
	top: 24,
	right: 0,
	bottom: 24,
	left: 0,
};

jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => mockSafeAreaInsets,
}));

jest.mock("./theme/unistyles", () => {
	const actual = jest.requireActual("./theme/unistyles");
	return {
		...actual,
		useUnistyles: () =>
			mockThemeOverride
				? { theme: mockThemeOverride, rt: {} }
				: actual.useUnistyles(),
	};
});

const mockTabsOptions = jest.fn();
const mockTabsProps = jest.fn();
const mockTabsListeners = jest.fn();
let mockPathname = "/";
let mockSegments = ["(tabs)"];

jest.mock("@bro/auth-app", () => ({
	useAuth: () => ({ user: null }),
}));

jest.mock("expo-router", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Tabs = Object.assign(
		({
			children,
			detachInactiveScreens,
			screenListeners,
			screenOptions,
		}: {
			children: ReactNode;
			detachInactiveScreens: boolean;
			screenListeners: unknown;
			screenOptions: Record<string, unknown>;
		}) => {
			mockTabsProps({ detachInactiveScreens });
			mockTabsListeners(screenListeners);
			mockTabsOptions(screenOptions);
			return React.createElement(React.Fragment, null, children);
		},
		{ Screen: () => null },
	);

	return {
		router: { push: jest.fn() },
		Tabs,
		usePathname: () => mockPathname,
		useSegments: () => mockSegments,
	};
});

describe("TabLayout", () => {
	beforeEach(() => {
		mockPathname = "/";
		mockSegments = ["(tabs)"];
		mockThemeOverride = undefined;
		jest.clearAllMocks();
	});

	it("owns one stable header above lazy, retained tab scenes", async () => {
		const screen = await render(<TabLayout />);
		const currentMonth = monthHeaderLabel(localDayOf(new Date()));

		expect(screen.getByText(currentMonth)).toBeTruthy();
		expect(mockTabsOptions).toHaveBeenCalledWith(
			expect.objectContaining({ lazy: true }),
		);
		expect(mockTabsProps).toHaveBeenCalledWith({
			detachInactiveScreens: false,
		});
		const screenOptions = mockTabsOptions.mock.calls[0]?.[0] as {
			tabBarStyle: Record<string, unknown>;
			tabBarItemStyle?: Record<string, unknown>;
		};
		// The custom label is taller than React Navigation's 49-point default.
		// Keep a 56-point content area above the full device inset.
		expect(screenOptions.tabBarStyle.height).toBe(80);
		expect(screenOptions.tabBarStyle.boxShadow).toBe("none");
		expect(screenOptions.tabBarStyle).not.toHaveProperty("shadowOpacity");
		expect(screenOptions.tabBarStyle).not.toHaveProperty("paddingTop");
		expect(screenOptions.tabBarItemStyle).toBeUndefined();

		mockPathname = "/intake";
		await screen.rerender(<TabLayout />);

		expect(screen.getByText("Intake")).toBeTruthy();
		expect(screen.queryByText(currentMonth)).toBeNull();
	});

	it("opens quick logging from the journal and sends each choice to a focused screen", async () => {
		const screen = await render(<TabLayout />);
		const { router } = jest.requireMock("expo-router") as {
			router: { push: jest.Mock };
		};

		await fireEvent.press(screen.getByLabelText("Log"));
		expect(screen.getByText("What would you like to log?")).toBeTruthy();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByLabelText("Food"));

		expect(router.push).toHaveBeenCalledWith("/intake/log?kind=food");
	});

	it("keeps the shared quick-log FAB on the Body overview", async () => {
		mockPathname = "/body";
		const screen = await render(<TabLayout />);

		expect(screen.getByLabelText("Log")).toBeTruthy();

		mockPathname = "/life";
		await screen.rerender(<TabLayout />);
		expect(screen.queryByLabelText("Log")).toBeNull();
	});

	it("ticks only when the selected bottom tab changes", async () => {
		await render(<TabLayout />);
		const listeners = mockTabsListeners.mock.calls[0]?.[0] as (input: {
			route: { name: string };
		}) => { tabPress: () => void };

		listeners({ route: { name: "index" } }).tabPress();
		expect(Haptics.selectionAsync).not.toHaveBeenCalled();

		listeners({ route: { name: "intake" } }).tabPress();
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
	});

	it("keeps the complete last tab header mounted behind root-stack transitions", async () => {
		const screen = await render(<TabLayout />);
		const currentMonth = monthHeaderLabel(localDayOf(new Date()));

		mockPathname = "/settings";
		mockSegments = ["settings"];
		await screen.rerender(<TabLayout />);

		const retainedMonth = screen.getByText(currentMonth);
		expect(retainedMonth).toBeTruthy();
		expect(
			NativeStyleSheet.flatten(retainedMonth.parent?.props.style).pointerEvents,
		).toBe("none");
		expect(screen.getByTestId("history-header-icon")).toBeTruthy();

		mockPathname = "/body/weight";
		mockSegments = ["(tabs)", "body", "[slug]"];
		await screen.rerender(<TabLayout />);

		expect(screen.queryByText(currentMonth)).toBeNull();
	});

	it("keeps header icons and active tabs neutral", async () => {
		const themed = {
			...themeModule.lightTheme,
			colors: {
				...themeModule.lightTheme.colors,
				text: "neutral-chrome",
				brand: "accent-colour",
			},
		} as unknown as typeof themeModule.lightTheme;
		mockThemeOverride = themed;

		const screen = await render(<TabLayout />);
		const screenOptions = mockTabsOptions.mock.calls[0]?.[0] as {
			tabBarActiveTintColor: string;
		};
		const insightsIcon = screen.getByTestId("insights-header-icon");
		const historyIcon = screen.getByTestId("history-header-icon");
		const settingsIcon = screen.getByTestId("settings-header-icon");

		expect(screenOptions.tabBarActiveTintColor).toBe("neutral-chrome");
		expect(insightsIcon.props.children.props.color).toBe("neutral-chrome");
		expect(historyIcon.props.children.props.color).toBe("neutral-chrome");
		expect(settingsIcon.props.children.props.color).toBe("neutral-chrome");
	});

	it("reaches insights and history from the journal header alone", async () => {
		const screen = await render(<TabLayout />);
		const { router } = jest.requireMock("expo-router") as {
			router: { push: jest.Mock };
		};

		await fireEvent.press(screen.getByLabelText("Open insights"));
		expect(router.push).toHaveBeenLastCalledWith("/insights");
		await fireEvent.press(screen.getByLabelText("Open history"));
		expect(router.push).toHaveBeenLastCalledWith("/history");

		// Neither belongs to a tab any more, so no other tab may offer them.
		mockPathname = "/intake";
		await screen.rerender(<TabLayout />);
		expect(screen.queryByLabelText("Open insights")).toBeNull();
		expect(screen.queryByLabelText("Open history")).toBeNull();
	});
});
