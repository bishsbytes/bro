import { createContext, type ReactNode, useMemo } from "react";
import { authClient } from "../client";

type SessionState = ReturnType<typeof authClient.useSession>;

export type AuthContextValue = {
	session: SessionState["data"];
	isPending: SessionState["isPending"];
	error: SessionState["error"];
	user: NonNullable<SessionState["data"]>["user"] | null;
	isSignedIn: boolean;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (name: string, email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
	undefined,
);

/**
 * Makes session state and the auth actions available to the tree, so screens
 * talk to this context instead of reaching for authClient directly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
	const { data: session, isPending, error } = authClient.useSession();

	const value = useMemo<AuthContextValue>(
		() => ({
			session,
			isPending,
			error,
			user: session?.user ?? null,
			isSignedIn: session != null,
			signIn: async (email, password) => {
				const { error: signInError } = await authClient.signIn.email({
					email,
					password,
				});

				if (signInError) {
					throw new Error(signInError.message ?? "Could not sign in.");
				}
			},
			signUp: async (name, email, password) => {
				const { error: signUpError } = await authClient.signUp.email({
					name,
					email,
					password,
				});

				if (signUpError) {
					throw new Error(signUpError.message ?? "Could not sign up.");
				}
			},
			signOut: async () => {
				const { error: signOutError } = await authClient.signOut();

				if (signOutError) {
					throw new Error(signOutError.message ?? "Could not sign out.");
				}
			},
		}),
		[session, isPending, error],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
