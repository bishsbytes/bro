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
	},
}));

const mockedAuthClient = authClient as unknown as {
	useSession: jest.Mock;
	signIn: { email: jest.Mock };
	signUp: { email: jest.Mock };
	signOut: jest.Mock;
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

		// Phase 2 keys workspace ownership off this id, so it must not lag a render
		// behind or fall back to whichever account was recorded last.
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
});
