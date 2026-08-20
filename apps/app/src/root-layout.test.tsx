import { authClient } from "@bro/auth-app";
import type { DeviceSettingsSnapshot } from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";

const mockReadDeviceSettings = jest.fn();
const mockInitDb = jest.fn();
const mockInitLocalDb = jest.fn();
const mockRunMigrations = jest.fn();
const mockRunLocalMigrations = jest.fn();
const mockCloseDb = jest.fn();
const mockCloseLocalDb = jest.fn();
const mockCloseDeviceSettings = jest.fn();

jest.mock("@bro/database-app", () => ({
	readDeviceSettings: () => mockReadDeviceSettings(),
	initDb: (...args: unknown[]) => mockInitDb(...args),
	initLocalDb: (...args: unknown[]) => mockInitLocalDb(...args),
	runMigrations: (...args: unknown[]) => mockRunMigrations(...args),
	runLocalMigrations: (...args: unknown[]) => mockRunLocalMigrations(...args),
	closeDb: () => mockCloseDb(),
	closeLocalDb: () => mockCloseLocalDb(),
	closeDeviceSettings: () => mockCloseDeviceSettings(),
	setOnboardingComplete: jest.fn(),
	setRemoteSessionMarker: jest.fn(),
}));

jest.mock("./check-in/check-in-store", () => ({
	createCheckInStore: () => ({
		loadToday: async () => ({
			localDay: "2026-08-14",
			entries: [],
			selectedFactorSlugs: [],
			availableFactors: [],
			availableMeasurements: [],
			loggedMeasurements: [],
			inputLocale: "en-GB",
			note: "",
		}),
		loadCheckInDays: async () => new Set(),
		save: jest.fn(),
	}),
}));

jest.mock("./history/history-store", () => ({
	createHistoryStore: () => ({
		loadHistory: async () => [],
		loadDay: jest.fn(),
	}),
}));

jest.mock("./units/unit-settings-store", () => ({
	...jest.requireActual("./units/unit-settings-store"),
	createUnitSettingsStore: () => ({ loadWeekStart: async () => "monday" }),
}));

jest.mock("./habits/habits-store", () => ({
	createHabitsStore: () => ({
		loadToday: async () => ({
			localDay: "2026-08-14",
			hasHabits: false,
			habits: [],
			challenges: [],
		}),
		loadAdherenceRange: async () => [],
		toggleManual: jest.fn(),
		completeChallengeDay: jest.fn(),
	}),
}));

jest.mock("./review/review-store", () => ({
	createReviewStore: () => ({
		loadLatestWheel: async () => null,
		loadOverview: async () => ({ sittings: [], goals: [] }),
	}),
}));

jest.mock("./trends/trends-store", () => ({
	createTrendsStore: () => ({
		load: async (period: number) => ({
			period,
			fromLocalDay: "2026-08-08",
			throughLocalDay: "2026-08-14",
			metrics: [],
		}),
	}),
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

const mockedUseSession = (authClient as unknown as { useSession: jest.Mock })
	.useSession;

const baseSettings: DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

/** Boots the real app tree, then lets the async startup chain settle. */
async function startApp(overrides: Partial<DeviceSettingsSnapshot> = {}) {
	mockReadDeviceSettings.mockReturnValue({ ...baseSettings, ...overrides });
	const view = await renderRouter("src/app", { initialUrl: "/" });
	await act(async () => undefined);
	return view;
}

describe("startup", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedUseSession.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
		mockInitDb.mockResolvedValue({ handle: true });
		mockInitLocalDb.mockResolvedValue({ localHandle: true });
		mockRunMigrations.mockResolvedValue({ applied: [] });
		mockRunLocalMigrations.mockResolvedValue({ applied: [] });
		mockCloseDb.mockResolvedValue(undefined);
		mockCloseLocalDb.mockResolvedValue(undefined);
	});

	it("opens and migrates the product database before showing the app", async () => {
		const view = await startApp();

		expect(mockInitDb).toHaveBeenCalledWith();
		expect(mockRunMigrations).toHaveBeenCalledWith({ handle: true });
		expect(mockInitLocalDb).toHaveBeenCalledWith();
		expect(mockRunLocalMigrations).toHaveBeenCalledWith({ localHandle: true });
		expect(await view.findByText("How are you?")).toBeTruthy();
	});

	it("issues no session request and no network call for a local-only start", async () => {
		await startApp();

		expect(mockedUseSession).not.toHaveBeenCalled();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("mounts the session hook only once a session has been stored", async () => {
		await startApp({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		expect(mockedUseSession).toHaveBeenCalled();
	});

	it("makes storage failure fatal but recoverable, and reopens cleanly on retry", async () => {
		mockReadDeviceSettings
			.mockImplementationOnce(() => {
				throw new Error("disk unavailable");
			})
			.mockReturnValue(baseSettings);
		const view = await renderRouter("src/app", { initialUrl: "/" });
		await act(async () => undefined);

		expect(view.getByText("Local storage is unavailable")).toBeTruthy();
		expect(view.getByText("disk unavailable")).toBeTruthy();
		expect(view.queryByText("How are you?")).toBeNull();

		await fireEvent.press(view.getByText("Try again"));

		expect(await view.findByText("How are you?")).toBeTruthy();
		// Both handles must be released, or the retry reopens against a half-known
		// schema rather than a clean one.
		expect(mockCloseDb).toHaveBeenCalledTimes(1);
		expect(mockCloseLocalDb).toHaveBeenCalledTimes(1);
		expect(mockCloseDeviceSettings).toHaveBeenCalledTimes(1);
	});

	it("treats a failed migration as the same recoverable storage failure", async () => {
		mockRunMigrations
			.mockRejectedValueOnce(new Error("migration 003 failed"))
			.mockResolvedValue({ applied: [] });

		const view = await startApp();

		expect(view.getByText("migration 003 failed")).toBeTruthy();

		await fireEvent.press(view.getByText("Try again"));

		expect(await view.findByText("How are you?")).toBeTruthy();
	});

	it("never lets an auth failure reach the startup screen", async () => {
		mockedUseSession.mockReturnValue({
			data: null,
			isPending: false,
			error: { status: 500, message: "auth is down" },
			refetch: jest.fn(),
		});

		const view = await startApp({
			hasStoredRemoteSession: true,
			lastRemoteUserId: "user-a",
		});

		expect(view.queryByText("Local storage is unavailable")).toBeNull();
		expect(await view.findByText("How are you?")).toBeTruthy();
	});
});
