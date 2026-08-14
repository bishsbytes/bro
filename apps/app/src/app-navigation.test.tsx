import { authClient } from "@bro/auth-app";
import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";

const mockReadDeviceSettings = jest.fn();
const mockSetOnboardingComplete = jest.fn();
const mockInitDb = jest.fn(async () => ({ handle: true }));
const mockCloseDb = jest.fn(async () => undefined);
const mockCloseDeviceSettings = jest.fn();

jest.mock("@bro/database-app", () => ({
	readDeviceSettings: () => mockReadDeviceSettings(),
	initDb: () => mockInitDb(),
	runMigrations: jest.fn(async () => ({ applied: [] })),
	closeDb: () => mockCloseDb(),
	closeDeviceSettings: () => mockCloseDeviceSettings(),
	setOnboardingComplete: (complete: boolean) =>
		mockSetOnboardingComplete(complete),
	setRemoteSessionMarker: jest.fn(),
}));

jest.mock("./check-in/check-in-store", () => ({
	createCheckInStore: () => ({
		loadToday: async () => ({
			localDay: "2026-08-14",
			entries: [],
			selectedFactorSlugs: [],
			availableFactors: [],
			note: "",
		}),
		save: jest.fn(),
	}),
}));

const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signIn: { email: jest.Mock };
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

jest.mock("../../../packages/auth/app/src/client", () => ({
	assertRemoteAuthConfigured: jest.fn(),
	authClient: {
		useSession: jest.fn(() => ({
			data: null,
			isPending: false,
			error: null,
			refetch: jest.fn(),
		})),
		signIn: { email: jest.fn() },
		signUp: { email: jest.fn() },
		signOut: jest.fn(),
		deleteUser: jest.fn(),
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
	await fireEvent.press(view.getByText(label));
}

describe("app entry", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
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
		expect(await view.findByText("How are you?")).toBeTruthy();
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
		expect(await view.findByText("How are you?")).toBeTruthy();
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

		await press(view, "Account");
		expect(router.getPathname()).toBe("/account");
		expect(view.getByText("Using bro without an account")).toBeTruthy();
		// Opening Account without a stored session is still a local-only act.
		expect(mockedAuthClient.useSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();

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

	it("switches from account A to B without closing or replacing local data", async () => {
		const refetch = jest.fn();
		let sessionState: {
			data: {
				user: { id: string; name: string; email: string };
				session: { id: string };
			} | null;
			isPending: boolean;
			error: null;
			refetch: jest.Mock;
		} = {
			data: {
				user: { id: "user-a", name: "Ada", email: "ada@example.com" },
				session: { id: "session-user-a" },
			},
			isPending: false,
			error: null,
			refetch,
		};
		mockedAuthClient.useSession.mockImplementation(() => sessionState);
		mockedAuthClient.signOut.mockImplementation(async () => {
			sessionState = {
				data: null,
				isPending: false,
				error: null,
				refetch,
			};
			return { data: {}, error: null };
		});
		mockedAuthClient.signIn.email.mockImplementation(async () => {
			const user = { id: "user-b", name: "Bea", email: "bea@example.com" };
			sessionState = {
				data: { user, session: { id: "session-user-b" } },
				isPending: false,
				error: null,
				refetch,
			};
			return { data: { user }, error: null };
		});

		const { router, view } = await launch({
			onboardingComplete: true,
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		await press(view, "Account");
		expect(await view.findByText("ada@example.com")).toBeTruthy();
		await press(view, "Sign out");
		await press(view, "Sign out");
		expect(view.getByText("Using bro without an account")).toBeTruthy();

		await press(view, "Sign in");
		await fireEvent.changeText(
			view.getByPlaceholderText("Email"),
			"bea@example.com",
		);
		await fireEvent.changeText(
			view.getByPlaceholderText("Password"),
			"password",
		);
		await press(view, "Sign in");

		expect(router.getPathname()).toBe("/account");
		expect(await view.findByText("bea@example.com")).toBeTruthy();
		expect(mockInitDb).toHaveBeenCalledTimes(1);
		expect(mockCloseDb).not.toHaveBeenCalled();

		// Returning from a sign-in entered here dismisses back onto Account
		// rather than stacking a second copy of it under the first.
		await press(view, "Back");
		expect(router.getPathname()).toBe("/");
	});

	it("deletes the account without closing local data or re-running onboarding", async () => {
		const refetch = jest.fn();
		let sessionState: {
			data: {
				user: { id: string; name: string; email: string };
				session: { id: string };
			} | null;
			isPending: boolean;
			error: null;
			refetch: jest.Mock;
		} = {
			data: {
				user: { id: "user-a", name: "Ada", email: "ada@example.com" },
				session: { id: "session-user-a" },
			},
			isPending: false,
			error: null,
			refetch,
		};
		mockedAuthClient.useSession.mockImplementation(() => sessionState);
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: { success: true, message: "User deleted" },
			error: null,
		});
		mockedAuthClient.signOut.mockImplementation(async () => {
			sessionState = { data: null, isPending: false, error: null, refetch };
			return { data: {}, error: null };
		});

		const { router, view } = await launch({
			onboardingComplete: true,
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		await press(view, "Account");
		expect(await view.findByText("ada@example.com")).toBeTruthy();

		await press(view, "Delete account");
		await fireEvent.changeText(
			view.getByPlaceholderText("Current password"),
			"password",
		);
		await press(view, "Delete account");

		expect(
			await view.findByText(
				"Your account was deleted. Data on this device is still here.",
			),
		).toBeTruthy();
		expect(view.getByText("Using bro without an account")).toBeTruthy();

		// Deleting the account is a server operation. The device keeps its
		// database handle, its onboarding state, and its installation identity.
		expect(mockInitDb).toHaveBeenCalledTimes(1);
		expect(mockCloseDb).not.toHaveBeenCalled();
		expect(mockCloseDeviceSettings).not.toHaveBeenCalled();
		expect(mockSetOnboardingComplete).not.toHaveBeenCalled();
		expect(mockReadDeviceSettings).toHaveBeenCalledTimes(1);
		expect(router.getPathname()).toBe("/account");

		await press(view, "Back");
		expect(router.getPathname()).toBe("/");
		expect(await view.findByText("How are you?")).toBeTruthy();
	});
});
