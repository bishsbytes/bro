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
	themeMode: "system",
	accentHue: 235,
	accentChroma: 0.055,
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

		expect(
			view.getByLabelText("System theme").props.accessibilityState,
		).toEqual(expect.objectContaining({ selected: true }));
		expect(
			view.getByLabelText("Harbour accent").props.accessibilityState,
		).toEqual(expect.objectContaining({ selected: true }));

		await fireEvent.press(view.getByLabelText("Dark theme"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("dark", 235, 0.055),
		);
		expect(view.getByLabelText("Dark theme").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);

		await fireEvent.press(view.getByLabelText("Moss accent"));
		await waitFor(() =>
			expect(mockSetAppearance).toHaveBeenLastCalledWith("dark", 145, 0.055),
		);
		expect(view.getByLabelText("Moss accent").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
