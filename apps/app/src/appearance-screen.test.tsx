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
	accentHue: 212,
	accentChroma: 0.12,
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

describe("appearance screen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("previews and persists theme and accent choices immediately", async () => {
		const view = await render(
			<DeviceSettingsProvider initialSettings={settings}>
				<AppearanceScreen />
			</DeviceSettingsProvider>,
		);

		expect(view.getByLabelText("Dark theme").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);
		expect(view.getByLabelText("Ice accent").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);

		await fireEvent.press(view.getByLabelText("Light theme"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("light", 212, 0.12),
		);
		expect(view.getByLabelText("Light theme").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);

		await fireEvent.press(view.getByLabelText("Lichen accent"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("light", 140, 0.12),
		);
		expect(
			view.getByLabelText("Lichen accent").props.accessibilityState,
		).toEqual(expect.objectContaining({ selected: true }));
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
