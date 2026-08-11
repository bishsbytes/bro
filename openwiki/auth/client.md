---
type: library
title: Mobile authentication client
description: Better Auth Expo client and React context that persist sessions securely and present typed sign-in, sign-up, sign-out, and session state to mobile screens.
tags: [authentication, expo, client]
---

# Mobile authentication client

`packages/auth/app/src/client.ts` creates `authClient` with `EXPO_PUBLIC_API_URL`, the Expo client plugin, scheme `app`, storage prefix `bro`, and `expo-secure-store`. It throws during module initialization when the API URL is missing. The server package is intentionally not imported, preserving the React Native boundary; `Session` is inferred from the client instance.

`AuthProvider` calls `authClient.useSession()` and publishes `AuthContextValue`: nullable session/user, pending and error state, `isSignedIn`, and async `signIn`, `signUp`, and `signOut` actions. Each action forwards to Better Auth's email API and throws a readable error when the response contains an error. `use-auth.ts` is the screen-facing hook and `index.ts` exports the provider and hook.

Session state flows from the remote API while credentials are stored through the OS keychain/keystore. `App` mounts the provider only after [mobile database startup](../database/mobile.md), but the auth state itself is not stored in that database. The `app` scheme must match `apps/app/app.json` and [server auth options](server.md).

## Extension and validation

Screens should consume `useAuth`; do not duplicate `authClient` calls. Adding a client plugin requires the matching server plugin and may require updating the generated schema. The current `@ts-expect-error` around `expoClient` documents an upstream declaration mismatch and should be removed only when the dependency types are compatible.

Validate with `pnpm exec nx run-many -t typecheck` and the Expo app start command. No dedicated auth-client tests are tracked; the provider action surface and app conditional rendering are the focused seams for future tests.
