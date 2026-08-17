import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import TabLayout from "./app/(tabs)/_layout";

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

	it("owns one stable header above attached, eagerly mounted tab scenes", async () => {
		const screen = await render(<TabLayout />);

		expect(screen.getByText("Today")).toBeTruthy();
		expect(mockTabsOptions).toHaveBeenCalledWith(
			expect.objectContaining({ lazy: false }),
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

		mockPathname = "/history";
		await screen.rerender(<TabLayout />);

		expect(screen.getByText("History")).toBeTruthy();
		expect(screen.queryByText("Today")).toBeNull();
	});

	it("keeps the last tab header mounted behind root-stack transitions", async () => {
		const screen = await render(<TabLayout />);

		mockPathname = "/account";
		mockSegments = ["account"];
		await screen.rerender(<TabLayout />);

		expect(screen.getByText("Today")).toBeTruthy();

		mockPathname = "/history/2026-08-14";
		mockSegments = ["(tabs)", "history", "[localDay]"];
		await screen.rerender(<TabLayout />);

		expect(screen.queryByText("Today")).toBeNull();
	});
});
