import { authClient } from "@bro/auth-app";
import type * as DatabaseApp from "@bro/database-app";
import { act, fireEvent, renderRouter } from "expo-router/testing-library";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
const mockSetRemoteSessionMarker = jest.fn();

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

const settings: DatabaseApp.DeviceSettingsSnapshot = {
	installationId: "install-1",
	onboardingComplete: true,
	appLockEnabled: false,
	appLockTimeoutSeconds: null,
	themeMode: "system",
	accentColor: "neutral",
	hasStoredRemoteSession: false,
	lastRemoteUserId: null,
};

jest.mock("@bro/database-app", () => {
	const actual = jest.requireActual("@bro/database-app");
	return {
		...actual,
		readDeviceSettings: () => settings,
		setOnboardingComplete: jest.fn(),
		setRemoteSessionMarker: (...args: unknown[]) =>
			mockSetRemoteSessionMarker(...args),
		closeDeviceSettings: jest.fn(),
	};
});

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

jest.mock("expo-splash-screen", () => ({
	preventAutoHideAsync: jest.fn(async () => true),
	hideAsync: jest.fn(async () => true),
}));

const databaseApp: typeof DatabaseApp = jest.requireActual("@bro/database-app");
const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signIn: { email: jest.Mock };
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

async function press(
	view: Awaited<ReturnType<typeof renderRouter>>,
	label: string,
) {
	await fireEvent.press(view.getByText(label));
}

describe("product data continuity across optional identity", () => {
	afterAll(async () => {
		await databaseApp.closeDb();
		mockSqlite.cleanup();
	});

	it("keeps sentinel rows through sign-in, sign-out, account switch, and deletion", async () => {
		const db = await databaseApp.initDb();
		await databaseApp.runMigrations(db);
		const observations = new databaseApp.ObservationRepository(db, {
			now: () => 1_000,
			createId: () => "sentinel-observation",
		});
		const notes = new databaseApp.DayNoteRepository(db, {
			now: () => 1_000,
			createId: () => "sentinel-note",
		});
		await observations.create({
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: 1_786_723_200_000,
			localDay: "2026-08-14",
			tzOffsetMinutes: 0,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});
		await notes.create("2026-08-14", "Still local");

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
			data: null,
			isPending: false,
			error: null,
			refetch,
		};
		mockedAuthClient.useSession.mockImplementation(() => sessionState);
		mockedAuthClient.signIn.email.mockImplementation(
			async ({ email }: { email: string }) => {
				const id = email.startsWith("ada") ? "user-a" : "user-b";
				const user = { id, name: id === "user-a" ? "Ada" : "Bea", email };
				sessionState = {
					data: { user, session: { id: `session-${id}` } },
					isPending: false,
					error: null,
					refetch,
				};
				return { data: { user }, error: null };
			},
		);
		mockedAuthClient.signOut.mockImplementation(async () => {
			sessionState = {
				data: null,
				isPending: false,
				error: null,
				refetch,
			};
			return { data: {}, error: null };
		});
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: { success: true, message: "User deleted" },
			error: null,
		});

		const router = renderRouter("src/app", { initialUrl: "/" });
		const view = await router;
		await act(async () => undefined);

		async function expectSentinels() {
			await expect(
				observations.findById("sentinel-observation"),
			).resolves.toMatchObject({ metricSlug: "mood", value: 4 });
			await expect(notes.listByDay("2026-08-14")).resolves.toMatchObject([
				{ id: "sentinel-note", body: "Still local" },
			]);
		}

		await fireEvent.press(view.getByLabelText("Settings"));
		await press(view, "Sign in");
		await fireEvent.changeText(
			view.getByPlaceholderText("Email"),
			"ada@example.com",
		);
		await fireEvent.changeText(
			view.getByPlaceholderText("Password"),
			"password",
		);
		await press(view, "Sign in");
		expect(await view.findByText("ada@example.com")).toBeTruthy();
		await expectSentinels();

		await press(view, "Sign out");
		await press(view, "Sign out");
		expect(view.getByText("Using bro without an account")).toBeTruthy();
		await expectSentinels();

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
		expect(await view.findByText("bea@example.com")).toBeTruthy();
		await expectSentinels();

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
		await expectSentinels();

		// Product data and disposable health-import state live in separate files.
		expect(mockSqlite.openDatabaseAsync).toHaveBeenCalledTimes(2);
		expect(mockSetRemoteSessionMarker).toHaveBeenCalled();
	});
});
