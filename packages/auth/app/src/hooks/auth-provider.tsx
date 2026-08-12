import {
	createContext,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";
import { assertRemoteAuthConfigured, authClient } from "../client";

type SessionState = ReturnType<typeof authClient.useSession>;
type RemoteSessionState = Pick<SessionState, "data" | "isPending" | "error">;

/** The state a user with no stored session is in, and stays in. */
const NO_REMOTE_SESSION: RemoteSessionState = {
	data: null,
	isPending: false,
	error: null,
};

export type AuthContextValue = {
	session: SessionState["data"];
	isPending: SessionState["isPending"];
	error: SessionState["error"];
	user: NonNullable<SessionState["data"]>["user"] | null;
	remoteIdentity:
		| { kind: "unavailable" }
		| { kind: "registered"; userId: string };
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (name: string, email: string, password: string) => Promise<void>;
	signOut: () => Promise<{ remoteRevocationPending: boolean }>;
};

export type AuthProviderProps = {
	children: ReactNode;
	hasStoredRemoteSession: boolean;
	onRemoteSessionStored: (userId: string | null) => Promise<void>;
	onRemoteSessionCleared: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
	undefined,
);

/**
 * Makes session state and the auth actions available to the tree, so screens
 * talk to this context instead of reaching for authClient directly.
 */
export function AuthProvider({ children, ...props }: AuthProviderProps) {
	const [remoteSession, setRemoteSession] =
		useState<RemoteSessionState>(NO_REMOTE_SESSION);

	// Ignore anything a bridge left behind when the marker was last set, so a
	// signed-out user cannot briefly read the previous session.
	const value = useAuthValue(
		props.hasStoredRemoteSession ? remoteSession : NO_REMOTE_SESSION,
		props,
	);

	return (
		<AuthContext.Provider value={value}>
			{/*
			  The bridge is what mounts and unmounts as the marker flips, and it
			  renders nothing. Swapping this provider's own component type instead
			  would remount the entire app tree on every sign-in and sign-out,
			  discarding navigation and screen state mid-flow.
			*/}
			{props.hasStoredRemoteSession ? (
				<RemoteSessionBridge {...props} onSessionState={setRemoteSession} />
			) : null}
			{children}
		</AuthContext.Provider>
	);
}

type RemoteSessionBridgeProps = Omit<
	AuthProviderProps,
	"children" | "hasStoredRemoteSession"
> & {
	onSessionState: (state: RemoteSessionState) => void;
};

/**
 * Owns the session hook for a user who has one, so it is never mounted — and no
 * request is ever issued — for a user who has never registered.
 */
function RemoteSessionBridge({
	onRemoteSessionStored,
	onRemoteSessionCleared,
	onSessionState,
}: RemoteSessionBridgeProps) {
	const { data, isPending, error } = authClient.useSession();

	useEffect(() => {
		onSessionState({ data, isPending, error });
	}, [data, isPending, error, onSessionState]);

	useEffect(() => {
		if (isPending) {
			return;
		}

		if (data?.user.id) {
			void onRemoteSessionStored(data.user.id).catch(() =>
				console.warn("Could not update the remote session marker."),
			);
			return;
		}

		// A resolved request carrying no session, or an explicit 401, proves the
		// stored session is gone. Any other error is a failed request — offline
		// startup above all — and must leave the marker alone.
		const status = (error as { status?: number } | null)?.status;
		if (!error || status === 401) {
			void onRemoteSessionCleared().catch(() =>
				console.warn("Could not clear the remote session marker."),
			);
		}
	}, [data, error, isPending, onRemoteSessionCleared, onRemoteSessionStored]);

	return null;
}

function useAuthValue(
	sessionState: RemoteSessionState,
	{
		onRemoteSessionStored,
		onRemoteSessionCleared,
	}: Pick<
		AuthProviderProps,
		"onRemoteSessionStored" | "onRemoteSessionCleared"
	>,
): AuthContextValue {
	const { data: session, isPending, error } = sessionState;

	return useMemo<AuthContextValue>(
		() => ({
			session,
			isPending,
			error,
			user: session?.user ?? null,
			remoteIdentity: session
				? { kind: "registered", userId: session.user.id }
				: { kind: "unavailable" },
			signIn: async (email, password) => {
				assertRemoteAuthConfigured();
				const { data, error: signInError } = await authClient.signIn.email({
					email,
					password,
				});

				if (signInError) {
					throw new Error(signInError.message ?? "Could not sign in.");
				}

				// Record the account this device now belongs to. Phase 2 keys
				// workspace ownership off it, so it must not lag behind by a render.
				await onRemoteSessionStored(data?.user.id ?? null);
			},
			signUp: async (name, email, password) => {
				assertRemoteAuthConfigured();
				const { data, error: signUpError } = await authClient.signUp.email({
					name,
					email,
					password,
				});

				if (signUpError) {
					throw new Error(signUpError.message ?? "Could not sign up.");
				}

				await onRemoteSessionStored(data?.user.id ?? null);
			},
			signOut: async () => {
				// The device-local marker controls whether any session work runs next
				// launch, so clear it before attempting best-effort server revocation.
				try {
					await onRemoteSessionCleared();
				} catch {
					// Better Auth's own local clearing still makes this device signed out.
					console.warn("Could not clear the remote session marker.");
				}

				try {
					const { error: signOutError } = await authClient.signOut();
					return { remoteRevocationPending: signOutError != null };
				} catch {
					return { remoteRevocationPending: true };
				}
			},
		}),
		[session, isPending, error, onRemoteSessionCleared, onRemoteSessionStored],
	);
}
