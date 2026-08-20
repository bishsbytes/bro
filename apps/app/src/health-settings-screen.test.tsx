import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { HealthSettingsSnapshot } from "./health/health-settings-store";
import { HealthSettingsScreen } from "./screens/settings/health-settings-screen";
import { SettingsScreen } from "./screens/settings/settings-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: mockPush, replace: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

const disconnected: HealthSettingsSnapshot = {
	availability: { available: true, platform: "health_connect" },
	platform: "health_connect",
	platformLabel: "Health Connect",
	connected: false,
	metrics: [
		{
			metricSlug: "sleep_duration",
			label: "Sleep",
			connected: false,
			lastImportedAt: null,
		},
	],
};

const connected: HealthSettingsSnapshot = {
	...disconnected,
	connected: true,
	metrics: [
		{
			metricSlug: "sleep_duration",
			label: "Sleep",
			connected: true,
			lastImportedAt: Date.parse("2026-08-16T12:00:00.000Z"),
		},
	],
};

describe("health settings", () => {
	it("connects, refreshes, opens platform settings, and disconnects", async () => {
		const store = {
			load: jest.fn(async () => disconnected),
			connect: jest.fn(async () => connected),
			refresh: jest.fn(async () => connected),
			disconnect: jest.fn(async () => disconnected),
			openSettings: jest.fn(async () => undefined),
		};
		const view = await render(<HealthSettingsScreen store={store} />);

		await fireEvent.press(await view.findByText("Connect Health Connect"));
		await waitFor(() => expect(store.connect).toHaveBeenCalledTimes(1));
		expect(view.getByText("Connected data")).toBeTruthy();
		expect(view.getByText("Sleep")).toBeTruthy();

		await fireEvent.press(view.getByText("Refresh health data"));
		await waitFor(() => expect(store.refresh).toHaveBeenCalledTimes(1));
		await fireEvent.press(view.getByText("Manage access in Health Connect"));
		await waitFor(() => expect(store.openSettings).toHaveBeenCalledTimes(1));
		await fireEvent.press(view.getByText("Disconnect Health Connect"));
		await waitFor(() => expect(store.disconnect).toHaveBeenCalledTimes(1));
		expect(view.getByText("Connect Health Connect")).toBeTruthy();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("keeps Settings to configuration when the platform is unsupported", async () => {
		const view = await render(
			<SettingsScreen
				healthAvailability={async () => ({
					available: false,
					platform: null,
					reason: "Unavailable in this runtime.",
				})}
			/>,
		);
		await waitFor(() => expect(view.getByText("Units & format")).toBeTruthy());
		expect(view.queryByText("Health data")).toBeNull();
		expect(view.queryByText("Life areas")).toBeNull();
		expect(view.queryByText("Habits")).toBeNull();
		expect(view.getByText("Reminders")).toBeTruthy();
	});

	it("allows a stale connection to be disconnected while the platform is unavailable", async () => {
		const unavailable: HealthSettingsSnapshot = {
			...connected,
			availability: {
				available: false,
				platform: "health_connect",
				reason: "Health Connect needs an update.",
			},
		};
		const store = {
			load: jest.fn(async () => unavailable),
			connect: jest.fn(async () => connected),
			refresh: jest.fn(async () => connected),
			disconnect: jest.fn(async () => disconnected),
			openSettings: jest.fn(async () => undefined),
		};
		const view = await render(<HealthSettingsScreen store={store} />);

		expect(
			await view.findByText("Health Connect needs an update."),
		).toBeTruthy();
		expect(view.getByText("Manage access in Health Connect")).toBeTruthy();
		await fireEvent.press(view.getByText("Disconnect Health Connect"));
		await waitFor(() => expect(store.disconnect).toHaveBeenCalledTimes(1));
	});
});
