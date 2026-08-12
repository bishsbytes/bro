import { authClient } from "@bro/auth-app";
import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { act, fireEvent, render } from "@testing-library/react-native";

const mockInitDeviceSettings = jest.fn();
const mockInitDb = jest.fn();
const mockRunMigrations = jest.fn();
const mockCloseDb = jest.fn();
const mockCloseDeviceSettingsDb = jest.fn();

jest.mock("@bro/database-app", () => ({
	initDeviceSettings: mockInitDeviceSettings,
	initDb: mockInitDb,
	runMigrations: mockRunMigrations,
	closeDb: mockCloseDb,
	closeDeviceSettingsDb: mockCloseDeviceSettingsDb,
	setOnboardingComplete: jest.fn(),
	setRemoteSessionMarker: jest.fn(),
}));

// The real auth provider is under test here too: a local-only startup must not
// mount the session hook, so the client is mocked rather than the package.
jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(() => ({
			data: null,
			isPending: false,
			error: null,
		})),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
	},
}));

jest.mock("expo-splash-screen", () => ({
	preventAutoHideAsync: jest.fn(async () => true),
	hideAsync: jest.fn(async () => true),
}));

// Stands in for the navigator so the guards themselves are observable: a screen
// renders only when the branch it sits under is permitted.
jest.mock("expo-router", () => {
	const { Text } = require("react-native");
	const Stack = ({ children }: { children?: React.ReactNode }) => children;
	Stack.Protected = ({
		guard,
		children,
	}: {
		guard: boolean;
		children?: React.ReactNode;
	}) => (guard ? children : null);
	Stack.Screen = ({ name }: { name: string }) => <Text>{`route:${name}`}</Text>;
	return { Stack, router: { push: jest.fn(), replace: jest.fn() } };
});

const RootLayout = require("./app/_layout")
	.default as typeof import("./app/_layout").default;

const mockedUseSession = (authClient as unknown as { useSession: jest.Mock })
	.useSession;

function settings(
	overrides: Partial<DeviceSettingsSnapshot> = {},
): DeviceSettingsSnapshot {
	return {
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
		...overrides,
	};
}

/** Renders the root layout and lets its async startup chain settle inside act. */
async function startApp() {
	const view = await render(<RootLayout />);
	await act(async () => undefined);
	return view;
}

describe("local-first app entry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockInitDb.mockResolvedValue({ handle: true });
		mockRunMigrations.mockResolvedValue({ applied: [] });
		mockCloseDb.mockResolvedValue(undefined);
		mockCloseDeviceSettingsDb.mockResolvedValue(undefined);
	});

	it("routes an incomplete install to onboarding, not to the app", async () => {
		mockInitDeviceSettings.mockResolvedValue(settings());

		const screen = await startApp();

		expect(await screen.findByText("route:onboarding")).toBeTruthy();
		expect(screen.queryByText("route:index")).toBeNull();
	});

	it("routes a completed install straight into the app", async () => {
		mockInitDeviceSettings.mockResolvedValue(
			settings({ onboardingComplete: true }),
		);

		const screen = await startApp();

		expect(await screen.findByText("route:index")).toBeTruthy();
		expect(screen.queryByText("route:onboarding")).toBeNull();
	});

	it("opens and migrates the active workspace's database file", async () => {
		mockInitDeviceSettings.mockResolvedValue(
			settings({
				activeWorkspace: {
					workspaceId: "workspace-2",
					databaseFileName: "bro-2.db",
					ownerUserId: "user-a",
				},
			}),
		);

		const screen = await startApp();
		await screen.findByText("route:onboarding");

		expect(mockInitDb).toHaveBeenCalledWith("bro-2.db");
		expect(mockRunMigrations).toHaveBeenCalledWith({ handle: true });
	});

	it("issues no session request and no network call for a local-only start", async () => {
		mockInitDeviceSettings.mockResolvedValue(
			settings({ onboardingComplete: true }),
		);

		const screen = await startApp();
		await screen.findByText("route:index");

		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("mounts the session hook only once a session has been stored", async () => {
		mockInitDeviceSettings.mockResolvedValue(
			settings({
				onboardingComplete: true,
				hasStoredRemoteSession: true,
				lastRemoteUserId: "user-a",
			}),
		);

		const screen = await startApp();
		await screen.findByText("route:index");

		expect(mockedUseSession).toHaveBeenCalled();
	});

	it("makes storage failure fatal but recoverable, and reopens cleanly on retry", async () => {
		mockInitDeviceSettings
			.mockRejectedValueOnce(new Error("disk unavailable"))
			.mockResolvedValueOnce(settings({ onboardingComplete: true }));

		const screen = await startApp();

		expect(
			await screen.findByText("Local storage is unavailable"),
		).toBeTruthy();
		expect(screen.getByText("disk unavailable")).toBeTruthy();
		expect(screen.queryByText("route:index")).toBeNull();

		await act(async () => {
			fireEvent.press(screen.getByText("Try again"));
		});

		expect(await screen.findByText("route:index")).toBeTruthy();
		// Both handles must be released, or the retry reopens against a half-known
		// schema rather than a clean one.
		expect(mockCloseDb).toHaveBeenCalledTimes(1);
		expect(mockCloseDeviceSettingsDb).toHaveBeenCalledTimes(1);
	});

	it("treats a failed migration as the same recoverable storage failure", async () => {
		mockInitDeviceSettings.mockResolvedValue(
			settings({ onboardingComplete: true }),
		);
		mockRunMigrations
			.mockRejectedValueOnce(new Error("migration 003 failed"))
			.mockResolvedValueOnce({ applied: [] });

		const screen = await startApp();

		expect(await screen.findByText("migration 003 failed")).toBeTruthy();

		await act(async () => {
			fireEvent.press(screen.getByText("Try again"));
		});

		expect(await screen.findByText("route:index")).toBeTruthy();
	});
});
