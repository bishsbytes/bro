import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

/**
 * Must match `scheme` in apps/app/app.json, and the server's trustedOrigins in
 * @bro/auth-api. Declared here rather than imported so the app never pulls in
 * the server package.
 */
const APP_SCHEME = "app";

const baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
	throw new Error(
		"EXPO_PUBLIC_API_URL is not set. Copy apps/app/.env.example to apps/app/.env.",
	);
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
