import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

/**
 * Must match `scheme` in apps/app/app.json, and the server's trustedOrigins in
 * @bro/auth-api. Declared here rather than imported so the app never pulls in
 * the server package.
 */
const APP_SCHEME = "app";

const configuredBaseURL = process.env.EXPO_PUBLIC_API_URL;

// Constructing the client must never make local-only app startup depend on
// remote configuration. Account actions report the missing setting when used.
const baseURL = configuredBaseURL ?? "http://127.0.0.1";

export function assertRemoteAuthConfigured(): void {
	if (!configuredBaseURL) {
		throw new Error(
			"Account access is unavailable because EXPO_PUBLIC_API_URL is not set.",
		);
	}
}

export const authClient = createAuthClient({
	baseURL,
	plugins: [
		// @better-auth/expo 1.6.27 types getActions against a BetterFetch whose
		// generics don't line up with BetterAuthClientPlugin, even on identical
		// better-auth/@better-fetch versions. Structurally compatible at runtime.
		// Suppressed rather than cast so the plugin's real type still feeds
		// session inference. Remove once upstream fixes the declaration.
		// @ts-expect-error upstream declaration mismatch
		expoClient({
			scheme: APP_SCHEME,
			storagePrefix: "bro",
			// Sessions and cookies are held in the OS keychain/keystore.
			storage: SecureStore,
		}),
	],
});

export type Session = typeof authClient.$Infer.Session;
