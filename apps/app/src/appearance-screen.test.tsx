import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { DeviceSettingsProvider } from "./providers/device-settings-provider";
import { AppearanceScreen } from "./screens/settings/appearance-screen";

const mockSetAppearance = jest.fn();

jest.mock("@bro/database-app", () => ({
	setAppearance: (...args: unknown[]) => mockSetAppearance(...args),
	setOnboardingComplete: jest.fn(),
	setRemoteSessionMarker: jest.fn(),
}));

const settings: DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	themeMode: "dark",
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

describe("appearance screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("persists explicit appearance and can return to System", async () => {
		const view = await render(
			<DeviceSettingsProvider initialSettings={settings}>
				<AppearanceScreen />
			</DeviceSettingsProvider>,
		);

		expect(view.getByLabelText("Dark theme").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);
		expect(view.queryByLabelText("Ice accent")).toBeNull();

		await fireEvent.press(view.getByLabelText("Light theme"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("light"),
		);
		expect(view.getByLabelText("Light theme").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);

		await fireEvent.press(view.getByLabelText("System theme"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("system"),
		);
		expect(
			view.getByLabelText("System theme").props.accessibilityState,
		).toEqual(expect.objectContaining({ selected: true }));
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
