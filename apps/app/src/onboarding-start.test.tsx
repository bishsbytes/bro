import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

const mockSetOnboardingComplete = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { replace: mockReplace, push: mockPush },
}));

// The real provider is exercised; only the storage write below it is faked, so
// this covers the persistence call the route actually makes.
jest.mock("@bro/database-app", () => ({
	setOnboardingComplete: mockSetOnboardingComplete,
	setRemoteSessionMarker: jest.fn(),
}));

const { DeviceSettingsProvider } =
	require("./providers/device-settings-provider") as typeof import("./providers/device-settings-provider");
const StartRoute = require("./app/onboarding/start")
	.default as typeof import("./app/onboarding/start").default;

const initialSettings: DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: false,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
	activeWorkspace: {
		workspaceId: "workspace-1",
		databaseFileName: "bro.db",
		ownerUserId: null,
	},
};

describe("local-only onboarding", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSetOnboardingComplete.mockResolvedValue(undefined);
	});

	it("persists completion and enters the app with no network request", async () => {
		const screen = await render(
			<DeviceSettingsProvider initialSettings={initialSettings}>
				<StartRoute />
			</DeviceSettingsProvider>,
		);

		await act(async () => {
			fireEvent.press(screen.getByText("Start using the app"));
		});

		await waitFor(() =>
			expect(mockSetOnboardingComplete).toHaveBeenCalledWith(true),
		);
		expect(mockReplace).toHaveBeenCalledWith("/");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("offers sign-in but never sign-up, since there is nothing to sign up for yet", async () => {
		const screen = await render(
			<DeviceSettingsProvider initialSettings={initialSettings}>
				<StartRoute />
			</DeviceSettingsProvider>,
		);

		await act(async () => {
			fireEvent.press(screen.getByText("I already have an account"));
		});

		expect(mockPush).toHaveBeenCalledWith("/sign-in");
		expect(screen.queryByText(/sign up/i)).toBeNull();
		expect(mockSetOnboardingComplete).not.toHaveBeenCalled();
	});

	it("does not claim an account backs the user's data up", async () => {
		const screen = await render(
			<DeviceSettingsProvider initialSettings={initialSettings}>
				<StartRoute />
			</DeviceSettingsProvider>,
		);

		// Sync is premium and opt-in, so onboarding must not imply an account
		// protects anything. See the copy rules in the Phase 1 plan.
		expect(
			screen.queryByText(/back(s|ed)? ?up|backup|keeps your data safe/i),
		).toBeNull();
	});
});
