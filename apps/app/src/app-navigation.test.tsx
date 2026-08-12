import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";

const mockReadDeviceSettings = jest.fn();
const mockSetOnboardingComplete = jest.fn();

jest.mock("@bro/database-app", () => ({
	readDeviceSettings: () => mockReadDeviceSettings(),
	initDb: jest.fn(async () => ({ handle: true })),
	runMigrations: jest.fn(async () => ({ applied: [] })),
	closeDb: jest.fn(async () => undefined),
	closeDeviceSettings: jest.fn(),
	setOnboardingComplete: (complete: boolean) =>
		mockSetOnboardingComplete(complete),
	setRemoteSessionMarker: jest.fn(),
}));

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(() => ({ data: null, isPending: false, error: null })),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
	},
}));

jest.mock("expo-splash-screen", () => ({
	preventAutoHideAsync: jest.fn(async () => true),
	hideAsync: jest.fn(async () => true),
}));

const baseSettings: DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: false,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

/**
 * Boots the real router over the real `src/app` directory, so these assertions
 * cover the actual `Stack.Protected` guards rather than a stand-in for them.
 * The router helpers live on the returned handle; the queries come from
 * awaiting it, which is how this version of the testing library reports them.
 */
async function launch(overrides: Partial<DeviceSettingsSnapshot> = {}) {
	mockReadDeviceSettings.mockReturnValue({ ...baseSettings, ...overrides });
	const router = renderRouter("src/app", { initialUrl: "/" });
	const view = await router;
	// Let the startup chain settle: device settings, database open, migrations.
	await act(async () => undefined);
	return { router, view };
}

async function press(
	view: Awaited<ReturnType<typeof launch>>["view"],
	label: string,
) {
	await act(async () => {
		fireEvent.press(view.getByText(label));
	});
}

describe("app entry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("sends an unonboarded install to onboarding rather than the app", async () => {
		const { router, view } = await launch();

		expect(router.getPathname()).toBe("/onboarding");
		expect(
			view.getByText("No account. No sign-up. Nothing to fill in first."),
		).toBeTruthy();
	});

	it("sends an onboarded install straight into the app", async () => {
		const { router, view } = await launch({ onboardingComplete: true });

		expect(router.getPathname()).toBe("/");
		expect(view.getByText("Using bro without an account")).toBeTruthy();
	});

	it("walks onboarding through to the app without a backend request", async () => {
		const { router, view } = await launch();

		await press(view, "Continue");
		expect(router.getPathname()).toBe("/onboarding/privacy");
		expect(view.getByText("Your data stays on your phone")).toBeTruthy();

		await press(view, "Continue");
		expect(router.getPathname()).toBe("/onboarding/start");

		await press(view, "Start using the app");

		expect(mockSetOnboardingComplete).toHaveBeenCalledWith(true);
		expect(router.getPathname()).toBe("/");
		// The whole first run, end to end, touches nothing of ours over the network.
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("offers sign-in from onboarding, and never sign-up", async () => {
		const { router, view } = await launch();

		await press(view, "Continue");
		await press(view, "Continue");
		await press(view, "I already have an account");

		expect(router.getPathname()).toBe("/sign-in");
		// There is nothing to sign up for yet, so onboarding must not offer it.
		expect(view.queryByText("Need an account? Sign up")).toBeNull();
		expect(mockSetOnboardingComplete).not.toHaveBeenCalled();
	});

	it("keeps account routes reachable from the app, with sign-up offered there", async () => {
		const { router, view } = await launch({ onboardingComplete: true });

		await press(view, "Sign in");

		expect(router.getPathname()).toBe("/sign-in");
		expect(view.getByText("Need an account? Sign up")).toBeTruthy();
	});

	it("never claims an account backs the user's data up", async () => {
		const { view } = await launch();

		await press(view, "Continue");
		await press(view, "Continue");

		// Sync is premium and opt-in, so onboarding must not imply that an account
		// protects anything. See the copy rules in the Phase 1 plan.
		expect(
			view.queryByText(/back(s|ed)? ?up|backup|keeps your data safe/i),
		).toBeNull();
	});

	it("does not send a signed-out user back to onboarding", async () => {
		const { router } = await launch({
			onboardingComplete: true,
			hasStoredRemoteSession: false,
			lastRemoteUserId: null,
		});

		// Onboarding is completed state, not session state: the absence of an
		// account must never route anyone back through the welcome screens.
		expect(router.getPathname()).toBe("/");
	});
});
