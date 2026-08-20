import { AuthProvider, authClient } from "@bro/auth-app";
import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { fireEvent, render } from "@testing-library/react-native";
import {
	DeviceSettingsProvider,
	useDeviceSettings,
} from "./providers/device-settings-provider";
import { AccountScreen } from "./screens/settings/account-screen";

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { back: mockBack, push: mockPush, replace: jest.fn() },
}));

jest.mock("@bro/database-app", () => ({
	setOnboardingComplete: jest.fn(),
	setRemoteSessionMarker: jest.fn(),
}));

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
		deleteUser: jest.fn(),
	},
}));

const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

const localSettings: DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	themeMode: "system",
	accentColor: "neutral",
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

function WiredAccount() {
	const { settings, markRemoteSessionStored, clearRemoteSession } =
		useDeviceSettings();

	return (
		<AuthProvider
			hasStoredRemoteSession={settings.hasStoredRemoteSession}
			onRemoteSessionStored={markRemoteSessionStored}
			onRemoteSessionCleared={clearRemoteSession}
		>
			<AccountScreen />
		</AuthProvider>
	);
}

async function renderAccount(overrides: Partial<DeviceSettingsSnapshot> = {}) {
	return await render(
		<DeviceSettingsProvider
			initialSettings={{ ...localSettings, ...overrides }}
		>
			<WiredAccount />
		</DeviceSettingsProvider>,
	);
}

function registeredSession() {
	return {
		data: {
			user: { id: "user-a", name: "Ada", email: "ada@example.com" },
			session: { id: "session-a" },
		},
		isPending: false,
		error: null,
		refetch: jest.fn().mockResolvedValue(undefined),
	};
}

describe("AccountScreen", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("shows optional account actions without mounting the session hook", async () => {
		const screen = await renderAccount();

		expect(screen.getByText("Using bro without an account")).toBeTruthy();
		expect(screen.getByText("Sign in")).toBeTruthy();
		expect(screen.getByText("Create an account")).toBeTruthy();
		expect(mockedAuthClient.useSession).not.toHaveBeenCalled();
	});

	it("presents a transient refresh failure without pretending to sign out", async () => {
		const refetch = jest.fn().mockResolvedValue(undefined);
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: { status: 500, message: "offline" },
			refetch,
		});
		const screen = await renderAccount({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		expect(
			await screen.findByText("Account temporarily unavailable"),
		).toBeTruthy();
		expect(screen.queryByText("Sign in")).toBeNull();

		await fireEvent.press(screen.getByText("Try again"));
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("signs out locally, preserves the screen, and explains failed revocation", async () => {
		mockedAuthClient.useSession.mockReturnValue(registeredSession());
		mockedAuthClient.signOut.mockResolvedValue({
			data: null,
			error: { message: "Network request failed" },
		});
		const screen = await renderAccount({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		expect(await screen.findByText("ada@example.com")).toBeTruthy();
		await fireEvent.press(screen.getByText("Sign out"));
		expect(screen.getByText("Sign out on this device?")).toBeTruthy();

		await fireEvent.press(screen.getByText("Sign out"));

		expect(
			await screen.findByText(
				"Signed out on this device. The server could not be reached.",
			),
		).toBeTruthy();
		expect(screen.getByText("Using bro without an account")).toBeTruthy();
	});

	it("keeps the account and confirmation open when the password is rejected", async () => {
		mockedAuthClient.useSession.mockReturnValue(registeredSession());
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: null,
			error: { message: "Invalid password" },
		});
		const screen = await renderAccount({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		await fireEvent.press(await screen.findByText("Delete account"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Current password"),
			"bad",
		);

		await fireEvent.press(screen.getByText("Delete account"));

		expect(await screen.findByText("Invalid password")).toBeTruthy();
		expect(screen.getByText("Delete your account?")).toBeTruthy();
		expect(mockedAuthClient.signOut).not.toHaveBeenCalled();
	});

	it("deletes the remote account while keeping the device in local-only mode", async () => {
		mockedAuthClient.useSession.mockReturnValue(registeredSession());
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: { success: true, message: "User deleted" },
			error: null,
		});
		mockedAuthClient.signOut.mockResolvedValue({ data: {}, error: null });
		const screen = await renderAccount({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		await fireEvent.press(await screen.findByText("Delete account"));
		await fireEvent.changeText(
			screen.getByPlaceholderText("Current password"),
			"password",
		);

		await fireEvent.press(screen.getByText("Delete account"));

		expect(
			await screen.findByText(
				"Your account was deleted. Data on this device is still here.",
			),
		).toBeTruthy();
		expect(screen.getByText("Using bro without an account")).toBeTruthy();
	});
});
