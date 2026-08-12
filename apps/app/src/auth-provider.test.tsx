import {
	type AuthContextValue,
	AuthProvider,
	authClient,
	useAuth,
} from "@bro/auth-app";
import { act, render } from "@testing-library/react-native";
import { useEffect, useRef } from "react";

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
	signIn: { email: jest.Mock };
	signUp: { email: jest.Mock };
	signOut: jest.Mock;
	deleteUser: jest.Mock;
};

function Probe({ onValue }: { onValue: (value: AuthContextValue) => void }) {
	const value = useAuth();

	useEffect(() => {
		onValue(value);
	}, [onValue, value]);

	return null;
}

describe("AuthProvider local-first behavior", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("does not mount the remote session hook for a local-only user", async () => {
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession={false}
				onRemoteSessionStored={jest.fn()}
				onRemoteSessionCleared={jest.fn()}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		expect(mockedAuthClient.useSession).not.toHaveBeenCalled();
		expect(value?.remoteIdentity).toEqual({ kind: "unavailable" });
	});

	it("completes local sign-out when server revocation fails", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
		});
		mockedAuthClient.signOut.mockResolvedValue({
			data: null,
			error: { message: "Network unavailable" },
		});
		const clearRemoteSession = jest.fn().mockResolvedValue(undefined);
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={clearRemoteSession}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		let result: { remoteRevocationPending: boolean } | undefined;
		await act(async () => {
			result = await value?.signOut();
		});

		expect(clearRemoteSession).toHaveBeenCalled();
		expect(mockedAuthClient.signOut).toHaveBeenCalled();
		expect(clearRemoteSession.mock.invocationCallOrder[0]).toBeLessThan(
			mockedAuthClient.signOut.mock.invocationCallOrder[0],
		);
		expect(result).toEqual({ remoteRevocationPending: true });
	});

	it("keeps the app tree mounted when the session marker flips", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});
		const lifecycle: string[] = [];

		function Child() {
			const id = useRef(lifecycle.length);
			useEffect(() => {
				lifecycle.push(`mount:${id.current}`);
				return () => {
					lifecycle.push(`unmount:${id.current}`);
				};
			}, []);
			return null;
		}

		const props = {
			onRemoteSessionStored: jest.fn().mockResolvedValue(undefined),
			onRemoteSessionCleared: jest.fn().mockResolvedValue(undefined),
		};
		const child = <Child />;
		const screen = await render(
			<AuthProvider hasStoredRemoteSession={false} {...props}>
				{child}
			</AuthProvider>,
		);

		await screen.rerender(
			<AuthProvider hasStoredRemoteSession {...props}>
				{child}
			</AuthProvider>,
		);
		await screen.rerender(
			<AuthProvider hasStoredRemoteSession={false} {...props}>
				{child}
			</AuthProvider>,
		);

		// Signing in and out must not remount the navigator and every screen under
		// it, which is what swapping the provider's component type would do.
		expect(lifecycle).toEqual(["mount:0"]);
	});

	it("records the signed-in user id rather than deferring to the session hook", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});
		mockedAuthClient.signIn.email.mockResolvedValue({
			data: { user: { id: "user-b" } },
			error: null,
		});
		const onRemoteSessionStored = jest.fn().mockResolvedValue(undefined);
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession={false}
				onRemoteSessionStored={onRemoteSessionStored}
				onRemoteSessionCleared={jest.fn().mockResolvedValue(undefined)}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		await act(async () => {
			await value?.signIn("b@example.com", "password");
		});

		// The device records which account is signed in, so it must not lag a
		// render behind or fall back to whichever account was recorded last.
		expect(onRemoteSessionStored).toHaveBeenCalledWith("user-b");
	});

	it("completes local sign-out when the auth request rejects", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: null,
		});
		mockedAuthClient.signOut.mockRejectedValue(new Error("offline"));
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={jest.fn().mockResolvedValue(undefined)}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		let result: { remoteRevocationPending: boolean } | undefined;
		await act(async () => {
			result = await value?.signOut();
		});

		expect(result).toEqual({ remoteRevocationPending: true });
	});

	it("retries remote identity through the marker-owned session hook", async () => {
		const refetch = jest.fn().mockResolvedValue(undefined);
		mockedAuthClient.useSession.mockReturnValue({
			data: null,
			isPending: false,
			error: { message: "offline" },
			refetch,
		});
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={jest.fn().mockResolvedValue(undefined)}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		await act(async () => {
			await value?.refreshRemoteIdentity();
		});

		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("deletes on the server, clears Better Auth locally, then clears the marker", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: { success: true, message: "User deleted" },
			error: null,
		});
		mockedAuthClient.signOut.mockResolvedValue({ data: {}, error: null });
		const clearRemoteSession = jest.fn().mockResolvedValue(undefined);
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={clearRemoteSession}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		await act(async () => {
			await value?.deleteAccount("password");
		});

		expect(mockedAuthClient.deleteUser).toHaveBeenCalledWith({
			password: "password",
		});
		expect(
			mockedAuthClient.deleteUser.mock.invocationCallOrder[0],
		).toBeLessThan(mockedAuthClient.signOut.mock.invocationCallOrder[0]);
		expect(mockedAuthClient.signOut.mock.invocationCallOrder[0]).toBeLessThan(
			clearRemoteSession.mock.invocationCallOrder[0],
		);
	});

	it("preserves the marker when server-side account deletion fails", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: null,
			error: { message: "Invalid password" },
		});
		const clearRemoteSession = jest.fn().mockResolvedValue(undefined);
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={clearRemoteSession}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		await expect(
			act(async () => {
				await value?.deleteAccount("wrong password");
			}),
		).rejects.toThrow("Invalid password");
		expect(mockedAuthClient.signOut).not.toHaveBeenCalled();
		expect(clearRemoteSession).not.toHaveBeenCalled();
	});

	it("preserves the marker when the account deletion request cannot reach the server", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
		mockedAuthClient.deleteUser.mockRejectedValue(new Error("Network offline"));
		const clearRemoteSession = jest.fn().mockResolvedValue(undefined);
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={clearRemoteSession}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		await expect(
			act(async () => {
				await value?.deleteAccount("password");
			}),
		).rejects.toThrow("Network offline");
		expect(mockedAuthClient.signOut).not.toHaveBeenCalled();
		expect(clearRemoteSession).not.toHaveBeenCalled();
	});

	it("still reports success when the marker cannot be cleared after deletion", async () => {
		mockedAuthClient.useSession.mockReturnValue({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
			refetch: jest.fn(),
		});
		mockedAuthClient.deleteUser.mockResolvedValue({
			data: { success: true, message: "User deleted" },
			error: null,
		});
		mockedAuthClient.signOut.mockResolvedValue({ data: {}, error: null });
		let value: AuthContextValue | undefined;

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={jest.fn().mockResolvedValue(undefined)}
				onRemoteSessionCleared={jest
					.fn()
					.mockRejectedValue(new Error("settings store unavailable"))}
			>
				<Probe onValue={(next) => (value = next)} />
			</AuthProvider>,
		);

		// The account is gone by this point, so surfacing a device-local write
		// failure as a failed deletion would tell the user the opposite of what
		// happened. The stale marker costs one request next launch.
		await act(async () => {
			await expect(value?.deleteAccount("password")).resolves.toBeUndefined();
		});
	});
});

/**
 * The marker decides whether the next launch does any session work at all, and
 * Account's "temporarily unavailable" state depends on the same distinction:
 * a resolved absence means signed out, any other failure means try again.
 */
describe("stored-session marker reconciliation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	async function mountWithSession(state: {
		data: unknown;
		isPending: boolean;
		error: unknown;
	}) {
		mockedAuthClient.useSession.mockReturnValue({
			...state,
			refetch: jest.fn(),
		});
		const onRemoteSessionStored = jest.fn().mockResolvedValue(undefined);
		const onRemoteSessionCleared = jest.fn().mockResolvedValue(undefined);

		await render(
			<AuthProvider
				hasStoredRemoteSession
				onRemoteSessionStored={onRemoteSessionStored}
				onRemoteSessionCleared={onRemoteSessionCleared}
			>
				<Probe onValue={() => undefined} />
			</AuthProvider>,
		);

		return { onRemoteSessionStored, onRemoteSessionCleared };
	}

	it("clears the marker when the server resolves with no session", async () => {
		const { onRemoteSessionCleared } = await mountWithSession({
			data: null,
			isPending: false,
			error: null,
		});

		expect(onRemoteSessionCleared).toHaveBeenCalled();
	});

	it("clears the marker when the session is explicitly rejected", async () => {
		const { onRemoteSessionCleared } = await mountWithSession({
			data: null,
			isPending: false,
			error: {
				status: 401,
				statusText: "UNAUTHORIZED",
				message: "Unauthorized",
			},
		});

		expect(onRemoteSessionCleared).toHaveBeenCalled();
	});

	it("keeps the marker when the session request simply failed", async () => {
		// Offline startup above all: this is a failed request, not proof that the
		// session is gone, so the device must stay registered and retry later.
		const { onRemoteSessionCleared } = await mountWithSession({
			data: null,
			isPending: false,
			error: { status: 500, message: "Network request failed" },
		});

		expect(onRemoteSessionCleared).not.toHaveBeenCalled();
	});

	it("waits for the request to settle before touching the marker", async () => {
		const { onRemoteSessionStored, onRemoteSessionCleared } =
			await mountWithSession({ data: null, isPending: true, error: null });

		expect(onRemoteSessionCleared).not.toHaveBeenCalled();
		expect(onRemoteSessionStored).not.toHaveBeenCalled();
	});

	it("records the user id the session hook reports", async () => {
		const { onRemoteSessionStored } = await mountWithSession({
			data: {
				user: { id: "user-a", name: "A", email: "a@example.com" },
				session: { id: "session-a" },
			},
			isPending: false,
			error: null,
		});

		expect(onRemoteSessionStored).toHaveBeenCalledWith("user-a");
	});
});
