import { localDayOf } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Platform, StyleSheet as NativeStyleSheet } from "react-native";
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
const nativeTabBarContentHeight = Platform.select({
	android: 80,
	ios: 49,
	default: 56,
});

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

const mockNativeTabsProps = jest.fn();
const mockNativeTabsListeners = jest.fn();
const mockTabIconProps = jest.fn();
let mockPathname = "/";
let mockSegments = ["(tabs)"];

jest.mock("@bro/auth-app", () => ({
	useAuth: () => ({ user: null }),
}));

jest.mock("expo-router", () => {
	return {
		router: { push: jest.fn() },
		usePathname: () => mockPathname,
		useSegments: () => mockSegments,
	};
});

jest.mock("expo-router/unstable-native-tabs", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Trigger = Object.assign(
		({ children }: { children: ReactNode }) =>
			React.createElement(React.Fragment, null, children),
		{
			Icon: (props: unknown) => {
				mockTabIconProps(props);
				return null;
			},
			Label: ({ children }: { children: ReactNode }) =>
				React.createElement(Text, null, children),
		},
	);
	const NativeTabs = Object.assign(
		({
			children,
			screenListeners,
			...props
		}: {
			children: ReactNode;
			screenListeners: unknown;
		}) => {
			mockNativeTabsProps(props);
			mockNativeTabsListeners(screenListeners);
			return React.createElement(React.Fragment, null, children);
		},
		{ Trigger },
	);

	return { NativeTabs };
});

describe("TabLayout", () => {
	beforeEach(() => {
		mockPathname = "/";
		mockSegments = ["(tabs)"];
		mockThemeOverride = undefined;
		jest.clearAllMocks();
	});

	it("owns one stable header above native glass tabs", async () => {
		const screen = await render(<TabLayout />);
		const currentMonth = monthHeaderLabel(localDayOf(new Date()));

		expect(screen.getByText(currentMonth)).toBeTruthy();
		// The month owns the page title; Journal remains only as the tab label.
		expect(screen.getAllByText("Journal")).toHaveLength(1);
		expect(screen.queryByLabelText("Settings")).toBeNull();
		const insightsSurface = NativeStyleSheet.flatten(
			screen.getByTestId("insights-header-icon").parent?.props.style,
		);
		expect(insightsSurface).toMatchObject({
			width: 34,
			height: 34,
			borderRadius: 11,
			backgroundColor: themeModule.lightTheme.colors.surface2,
		});
		expect(
			NativeStyleSheet.flatten(
				screen.getByLabelText("Open insights").props.style,
			),
		).toMatchObject({ width: 34, height: 34 });
		expect(
			NativeStyleSheet.flatten(screen.getByLabelText("Log").props.style),
		).toMatchObject({
			position: "absolute",
			bottom:
				nativeTabBarContentHeight + mockSafeAreaInsets.bottom +
				16,
			width: 56,
			height: 56,
			borderRadius: 14,
			backgroundColor: themeModule.lightTheme.colors.accent,
		});
		expect(mockNativeTabsProps).toHaveBeenCalledWith(
			expect.objectContaining({
				backgroundColor: themeModule.lightTheme.colors.glass,
				blurEffect: "systemUltraThinMaterialLight",
				minimizeBehavior: "onScrollDown",
				// Android's `auto` labels only the selected tab once there are four.
				labelVisibilityMode: "labeled",
			}),
		);

		mockPathname = "/intake";
		await screen.rerender(<TabLayout />);

		expect(screen.getAllByText("Intake")).toHaveLength(2);
		expect(screen.queryByText(currentMonth)).toBeNull();
		expect(
			NativeStyleSheet.flatten(screen.getByLabelText("Log").props.style),
		).toMatchObject({ width: 56, height: 56 });
		expect(
			NativeStyleSheet.flatten(screen.getByLabelText("Settings").props.style),
		).toMatchObject({ width: 34, height: 34 });
		expect(
			NativeStyleSheet.flatten(
				screen.getByTestId("settings-header-icon").parent?.props.style,
			),
		).toMatchObject({
			width: 34,
			height: 34,
			borderRadius: 11,
			backgroundColor: themeModule.lightTheme.colors.surface2,
		});
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

	it("keeps quick log in the Body and Intake title bars", async () => {
		mockPathname = "/body";
		const screen = await render(<TabLayout />);

		expect(screen.getByLabelText("Log")).toBeTruthy();

		mockPathname = "/intake";
		await screen.rerender(<TabLayout />);
		expect(screen.getByLabelText("Log")).toBeTruthy();

		mockPathname = "/life";
		await screen.rerender(<TabLayout />);
		expect(screen.queryByLabelText("Log")).toBeNull();
	});

	it("ticks only when the selected bottom tab changes", async () => {
		await render(<TabLayout />);
		const listeners = mockNativeTabsListeners.mock.calls[0]?.[0] as (input: {
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
		expect(screen.getByLabelText("Open history")).toBeTruthy();

		mockPathname = "/body/weight";
		mockSegments = ["(tabs)", "body", "[slug]"];
		await screen.rerender(<TabLayout />);

		expect(screen.queryByText(currentMonth)).toBeNull();
	});

	it("keeps chrome quiet and reserves accent for the selected tab", async () => {
		const themed = {
			...themeModule.lightTheme,
			colors: {
				...themeModule.lightTheme.colors,
				ink2: "#345678",
				accent: "#12ABCD",
				accentDeep: "#004466",
				tabRipple: "#00446638",
			},
		} as unknown as typeof themeModule.lightTheme;
		mockThemeOverride = themed;

		const screen = await render(<TabLayout />);
		const nativeOptions = mockNativeTabsProps.mock.calls[0]?.[0] as {
			iconColor: { default: string; selected: string };
			indicatorColor: string;
			rippleColor: string;
		};
		const insightsIcon = screen.getByTestId("insights-header-icon");

		expect(nativeOptions.iconColor).toEqual({
			default: "#345678",
			selected: "#12ABCD",
		});
		// The ripple carries the indicator's colour, so a press fades into the
		// indicator rather than flashing the host theme's own attribute first.
		expect(nativeOptions.indicatorColor).toBe("#004466");
		expect(nativeOptions.rippleColor).toBe("#00446638");
		expect(insightsIcon.props.children.props.color).toBe("#345678");

		mockPathname = "/intake";
		await screen.rerender(<TabLayout />);
		const settingsIcon = screen.getByTestId("settings-header-icon");
		expect(settingsIcon.props.children.props.color).toBe("#345678");
	});

	it("names a platform symbol for every tab icon", async () => {
		await render(<TabLayout />);

		// The native bar rasterises its icons, so anything it cannot turn into a
		// UIImage/drawable - a React element in `src`, say - vanishes in silence.
		const icons = mockTabIconProps.mock.calls.map(
			([props]) => props as { sf?: unknown; md?: unknown; src?: unknown },
		);

		expect(icons).toHaveLength(4);
		for (const icon of icons) {
			expect(icon.sf).toBeTruthy();
			expect(icon.md).toBeTruthy();
			expect(icon.src).toBeUndefined();
		}
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
