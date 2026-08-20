import { localDayOf } from "@bro/domain";
import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import TabLayout from "./app/(tabs)/_layout";
import { monthHeaderLabel } from "./components/today-header-month-context";

const mockTabsOptions = jest.fn();
const mockTabsProps = jest.fn();
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
			screenOptions,
		}: {
			children: ReactNode;
			detachInactiveScreens: boolean;
			screenOptions: Record<string, unknown>;
		}) => {
			mockTabsProps({ detachInactiveScreens });
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
		// React Navigation owns both the device inset and the internal item spacing.
		// Overriding either makes the bar overlap or compress on Android devices.
		expect(screenOptions.tabBarStyle).not.toHaveProperty("height");
		expect(screenOptions.tabBarStyle).not.toHaveProperty("paddingTop");
		expect(screenOptions.tabBarItemStyle).toBeUndefined();

		mockPathname = "/log";
		await screen.rerender(<TabLayout />);

		expect(screen.getByText("Log")).toBeTruthy();
		expect(screen.queryByText(currentMonth)).toBeNull();
	});

	it("keeps the last tab header mounted behind root-stack transitions", async () => {
		const screen = await render(<TabLayout />);
		const currentMonth = monthHeaderLabel(localDayOf(new Date()));

		mockPathname = "/account";
		mockSegments = ["account"];
		await screen.rerender(<TabLayout />);

		expect(screen.getByText(currentMonth)).toBeTruthy();

		mockPathname = "/body/weight";
		mockSegments = ["(tabs)", "body", "[slug]"];
		await screen.rerender(<TabLayout />);

		expect(screen.queryByText(currentMonth)).toBeNull();
	});
});
