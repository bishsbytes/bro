# Phase 2: Optional accounts implementation plan

## Status

Implemented in code with automated coverage on 12 August 2026, and revised the same day after a review against this plan — see [Review follow-ups](#review-follow-ups). The focused native Android/iOS acceptance pass in Slice 5 remains before Phase 2 is complete.

This is the delivery plan for [Phase 2 in the umbrella offline-first plan](offline-first-identity-onboarding-premium.md#phase-2-optional-accounts). The umbrella plan remains authoritative for the product and privacy decisions; this document turns that phase into reviewable slices against the current workspace.

## Outcome

A local-only user can open an Account area and choose to register or sign in. A registered user can inspect their account, sign out, delete the account, or switch to another account without closing, deleting, hiding, renaming, or assigning ownership to `bro.db`.

The phase is successful when account state is visibly optional and every identity transition leaves local product data available. Account deletion removes everything the server holds for that account at the time this phase ships, while deliberately preserving the device's product database.

## Non-goals

- Product-data reconciliation, adoption, remote backup, or sync. Those begin in Phase 5 after entitlement and explicit consent.
- Purchase identity changes. The purchase provider is selected in Phase 4; its sign-out/account-switch rules are added then.
- Password reset, email verification, profile editing, social sign-in, or account linking. They need mail/provider and product decisions that are not required by the Phase 2 exit criteria.
- Per-account database files, an owner field, workspaces, or record re-scoping.
- Shipping controls for capabilities that do not exist. In particular, **Turn sync off** is not rendered until Phase 5.
- A generic settings framework or component library. The Account area should use the existing Expo Router and Unistyles patterns.

## Current baseline

Phase 1 already provides most of the identity plumbing:

- `@bro/auth-app` exposes `RemoteIdentity`, sign-in, sign-up, and local-first sign-out.
- `hasStoredRemoteSession` gates the Better Auth session hook, so a local-only user performs no auth request.
- Successful sign-in and sign-up write `hasStoredRemoteSession` and `lastRemoteUserId` immediately.
- Sign-out clears the device marker before best-effort remote revocation and leaves the app tree mounted.
- `/sign-in` and `/sign-up` exist and are reachable from the placeholder home screen.
- `bro-device.db` and `bro.db` are separate, and no product tables exist yet.
- `@bro/app:test` covers the router, startup, session marker, and offline sign-out. The API now has Vitest targets, including Testcontainers-backed account-deletion coverage.
- Better Auth 1.6.27 contains the `deleteUser` client action and server route, but the route is disabled until `user.deleteUser.enabled` is set.

Phase 2 should extend these seams, not replace them.

## Decisions locked for this phase

### The Account area is never an app-entry gate

Add an `/account` route reachable from the main app. It presents remote identity inside the already-running local app; it never protects `/`, controls onboarding, or participates in product-database startup.

Opening `/account` while signed out must not issue a backend request. Only submitting sign-in/sign-up or restoring a marker-backed session may contact Better Auth.

### Account presentation has four UI states

`RemoteIdentity` remains the two-state domain type from the umbrella plan. The Account screen combines it with the stored-session marker and the existing pending/error state to avoid presenting an offline registered user as a new user.

| Device/session state | Account presentation |
| --- | --- |
| Marker absent | Local-only: show **Sign in** and **Create an account**. |
| Marker present, request pending | Show an in-place account loading state; the rest of the app remains usable. |
| Marker present, registered session returned | Show name/email, **Sign out**, and **Delete account**. |
| Marker present, transient/offline error | Say the account could not be refreshed, keep local use available, and offer retry plus local-first sign-out. Do not offer a second sign-in over the stored credential. |

A resolved no-session response or explicit 401 continues to clear the marker and becomes the local-only state. Other failures preserve the marker.

Expose a provider-level retry backed by `useSession().refetch()` so Account owns a real retry action without importing `authClient` directly. The session hook remains unmounted when the marker is absent.

### Account switching is an explicit two-step journey

There is no direct **Switch account** mutation. The supported flow is:

1. Sign out of account A.
2. Remain in the local app with `bro.db` still open.
3. Choose **Sign in** and authenticate as account B.

This makes the boundary visible and reuses the tested local-first sign-out behavior. `lastRemoteUserId` records B after sign-in; it does not select, rename, close, or own a database.

### Account deletion requires the password and a network

Enable Better Auth's built-in account deletion and call it through `@bro/auth-app` as `deleteAccount(password)`. Although Better Auth permits a fresh session in place of a password, Phase 2 always asks an email/password user to re-enter the password. This gives one consistent confirmation rule and does not depend on the session's age.

Deletion ordering is load-bearing:

1. Submit `authClient.deleteUser({ password })`.
2. If the server rejects the password, the request fails, or deletion otherwise fails, preserve the session marker and remain on the confirmation screen. Local data is untouched.
3. After server success, invoke Better Auth's public `signOut()` action to eagerly clear the Expo client's persisted cookie, cached session, and in-memory session atom. The account is already gone, so its remote-revocation result is irrelevant.
4. Clear `hasStoredRemoteSession` and `lastRemoteUserId`.
5. Return to the Account screen in its local-only state and show a completion notice.

The deletion response expires the server cookie, but the installed Expo plugin's supported eager local-clearing path is `signOut()`. Reuse the existing sign-out dependency-contract test and add provider ordering coverage, so an upstream change cannot silently leave a deleted account cached locally. Application code must not reach into Better Auth's internal SecureStore keys or atoms.

At Phase 2, the only server-owned user data is in Better Auth's Postgres tables. User deletion removes the user and their credential accounts and sessions. Before Phase 5 provisions Turso databases, the deletion path must gain a server-side cleanup hook whose failure prevents the auth row from being deleted; Phase 2 records that extension point but does not add a no-op Turso abstraction.

### The four destructive-operation contracts are staged by capability

The umbrella plan's four operations remain distinct, but Phase 2 must not expose fake controls:

| Operation | Phase 2 delivery | Contract |
| --- | --- | --- |
| Sign out | Implement in Account. | End the local/remote session; keep local data, remote data, and account. Works offline. |
| Turn sync off | Copy and behavior reserved for Phase 5; no Phase 2 control. | Keep local data and account; delete the remote database and retire its generation. |
| Delete local data | Defer the action until the first product domain gives it meaningful data and recovery behavior; no empty-database button. | Delete only this device's product data; preserve device settings, session, account, and remote data. |
| Delete account | Implement in Account. | Delete server account data; keep this device's product data open and available. Requires network and password confirmation. |

This is a sequencing correction to the umbrella phase summary, not a semantics change. The confirmation copy below is the contract future phases must preserve.

## User journeys and copy contract

Copy can be refined for tone during implementation, but it must continue to state the affected storage explicitly.

### Local-only account screen

- Heading: **Account**
- State: **Using bro without an account**
- Supporting copy: creating or signing into an account does not move or back up data on this device.
- Actions: **Sign in** and **Create an account**.

### Registered account screen

- Show the current name and email from the Better Auth session.
- Do not claim that registration backs up, protects, owns, or synchronises local data.
- Show **Sign out** as a normal account action and **Delete account** in a visually separated danger section.

### Sign-out confirmation

- Title: **Sign out on this device?**
- Body: **Your data on this device will stay here and remain available. This does not delete your account.**
- Confirm: **Sign out**
- On offline revocation failure: retain the existing informational result that the device is signed out but the server could not be reached.

### Account-deletion confirmation

- Title: **Delete your account?**
- Body: **This permanently deletes your account and everything we hold for it. Your data on this device will stay here.**
- Require the current password.
- Confirm: **Delete account**
- Keep the action disabled while submitting and keep errors inside the confirmation screen.

### Reserved future copy

- Delete local data: **This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.** Phase 5 adds the warning that sync may restore it.
- Turn sync off: **This stops sync on every device and deletes your synced data from our servers. Data already stored on each device stays there. Your account is not deleted.**

## Delivery slices

### Slice 1: Server deletion and its test boundary

1. Add `user.deleteUser.enabled: true` to the shared Better Auth options. This option does not add a plugin or change the generated auth schema.
2. Add Vitest and an `@bro/api:test` target using `vitest run`.
3. Run deletion integration tests against a PostgreSQL Testcontainer owned by the suite. Each run starts a fresh database, applies the real migrations, and stops the container in teardown; it never reads `DATABASE_URL` or requires a manually managed test service.
4. Exercise Better Auth through Hono's `app.request(...)`, not by calling adapter internals:
   - register and obtain a session;
   - wrong-password deletion fails and leaves user/account/session rows;
   - correct-password deletion succeeds;
   - the deleted session cannot be restored;
   - user, credential account, and sessions are gone.
5. Keep the future external-data cleanup requirement beside the deletion configuration so Phase 5 cannot add provisioning without extending this path.

`createApp` currently closes over the production `env` and auth singleton. Refactor it to accept an injected auth handler/config for tests while preserving the production default in `main.ts`. This keeps tests off real ports and real production credentials.

### Slice 2: Client identity actions

1. Extend `AuthContextValue` with:
   - `refreshRemoteIdentity(): Promise<void>`;
   - `deleteAccount(password: string): Promise<void>`.
2. Carry `refetch` from the marker-owned session bridge into the provider without mounting the bridge for a local-only user.
3. Implement deletion with the server-first ordering above and clear the device marker only on success.
4. Remove the stale comment claiming Phase 2 assigns workspace ownership. Replace it with the settled meaning of `lastRemoteUserId`: a session hint only.
5. Add provider tests for retry, successful deletion, wrong password, network failure, marker ordering, and preservation of the provider/app tree.
6. Pin deletion's `deleteUser` → public `signOut` → marker ordering in provider tests, retaining the existing Better Auth Expo sign-out dependency-contract test for cookie/cache/session clearing without accessing internal keys from application code.

### Slice 3: Account routes and screens

1. Add an `/account` route to the root stack and link to it from the placeholder home screen.
2. Move account presentation and sign-out out of `HomeScreen` into an `AccountScreen`. The home screen should only show the entry point and any product-domain content.
3. Reuse `/sign-in` and `/sign-up`; after success, replace the route with `/account` when entered from the main app. The onboarding sign-in journey continues to complete onboarding and replace with `/`.
4. Add sign-out confirmation and deletion confirmation. A route or modal is acceptable, but the password and error state must survive session-marker changes and cannot be nested under an auth-protected navigator.
5. Render the four Account states from the table above, including offline retry and local-first sign-out.
6. Use only theme tokens from `src/theme/unistyles.ts`; add tokens there if danger-state colours are missing from either theme.

### Slice 4: Cross-account and local-data invariants

1. Add a router-level A → sign out → B test through the real `src/app` routes.
2. While `bro.db` has no product schema, assert through the real router that identity transitions neither close nor replace its handle. Replace this structural assertion with a seeded sentinel-row assertion when the first product table exists; do not invent a placeholder ownership schema for this phase.
3. Assert the database handle is not closed or replaced by sign-in, sign-up, sign-out, account deletion, or marker reconciliation.
4. Assert `installationId` and onboarding state survive all account actions.
5. Assert account deletion leaves `bro.db` open, while removing the marker and returning the Account UI to local-only.
6. Assert a local-only Account visit performs no auth/API request.

### Slice 5: Acceptance and documentation

1. Update the umbrella plan's Phase 2 implementation status and delivered slice.
2. Document the test-database setup and Account development journey in the README.
3. Run the automated verification listed below.
4. Complete a focused Android/iOS pass:
   - local-only Account screen while offline;
   - sign-up and sign-in;
   - cold relaunch with a stored session;
   - relaunch offline with a stored session;
   - offline sign-out;
   - account A → account B;
   - wrong-password deletion;
   - successful account deletion with local data still visible;
   - light and dark appearance.

Phase 2 adds no native dependency and should not require a prebuild regeneration.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Better Auth server | `packages/auth/api/src/options.ts`, plus server-deletion tests. |
| API test seam | `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`, `apps/api/package.json`, and API integration-test support. |
| Auth client/provider | `packages/auth/app/src/hooks/auth-provider.tsx` and its public exports. |
| Account UI | New `apps/app/src/app/account.tsx` and Account/confirmation screens under `apps/app/src/screens/`; existing sign-in/sign-up routes gain origin-aware success navigation. |
| Main navigation | `apps/app/src/app/_layout.tsx` and the placeholder `HomeScreen` entry point. |
| App coverage | Existing auth-provider, router, navigation, home, device-settings, and Better Auth contract test suites, with focused Account additions. |
| Documentation | This plan, the umbrella plan, and README test/development instructions. |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Local-only launch and Account visit | App and Account open; no backend request occurs. |
| Sign-up | Marker stores the returned user id; local database is unchanged. |
| Sign-in | Marker stores the returned user id; local database is unchanged. |
| Auth refresh offline | App remains usable; marker remains; Account shows retry/sign-out rather than a new sign-in. |
| Sign-out online | Session and marker clear; local database remains open. |
| Sign-out offline | Local session and marker clear; informational notice appears; local database remains open. |
| A → sign out → B | B is shown as current; the same sentinel local data remains visible. |
| Delete account with wrong password | Error stays in the flow; account, session, marker, and local data remain. |
| Delete account with network failure | Same as wrong password; retry is possible. |
| Delete account successfully | Server auth rows and local session state disappear; local database and device settings remain. |
| Session resolves absent/401 | Marker clears. |
| Session refresh has another error | Marker remains. |

## Review follow-ups

Applied after reviewing the implementation against this plan. Recorded because each one is a rule a later phase could undo without noticing.

- **Deletion no longer reports failure for an account that is gone.** `deleteAccount` cleared the device marker outside a guard, so a settings-store write failing *after* the server had deleted the account surfaced as "could not delete the account", on a confirmation screen, with the marker still set. It now warns and reports success, matching how sign-out already treated the same call. The stale marker costs one session request next launch, which the 401 clears.
- **The marker rules are now tested, and pinned to the dependency.** Slices 2 and 4 assumed the Phase 1 bridge, but nothing asserted the rule this phase's "temporarily unavailable" state depends on: resolved absence and 401 clear the marker, everything else preserves it. Both are covered directly, and a contract test pins Better Auth's side of it — a 401 arrives with `status`, a resolved absence with no error, and an unreachable server as a *settled* error with no status. That last one matters twice over: if the hook never settled, Account would spin instead of offering retry.
- **Slice 4.3's deletion assertion was missing.** Account deletion was only exercised where the database module is mocked away, so "the handle survives every identity transition" rested on sign-out and sign-in alone. Deletion now runs through the real router with the same assertions, plus onboarding state and the settings store being left alone.
- **Returning from an account flow no longer stacks a second `/account`.** Sign-in and sign-up replaced with `/account` while an `/account` was already below them in the stack, so Back from Account landed on Account. Both routes now dismiss back onto it through a shared helper, with a router-level regression test.
- **The Account screen respects the safe area.** It is the app's first top-anchored screen; every other screen is vertically centred, so nothing had needed insets before.
- **`onDanger` joins the theme.** The destructive button painted its label with `colors.background`, which happens to read correctly in both themes but is an unnamed pairing the token-parity test cannot protect.
- **API test packaging.** `tsconfig.spec.json` keeps the integration test out of the production build's type program, mirroring `@bro/app`; `vitest.config.ts` states the container's hook budget rather than relying on defaults; and the five Slice 1.4 checks are five tests, so one failure no longer hides the rest.

## Verification commands

Run through Nx using the workspace package manager:

```bash
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run @bro/api:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/api @bro/auth-app @bro/auth-api @bro/database-app @bro/database-api --skipNxCache
pnpm nx run @bro/api:build --skipNxCache
```

Preserve the complete output of a failing command. The Postgres integration target must obtain its connection URL only from its Testcontainer and must never fall back to `DATABASE_URL`.

## Exit criteria

Phase 2 is complete when all of the following are true:

- Account settings are reachable from the running local app and never gate app entry.
- A user can register, sign in, sign out online or offline, delete their account, and sign into another account.
- Account deletion requires a password, removes every server record currently held for that user, and clears local session state only after server success.
- Every identity journey leaves `bro.db`, `installationId`, onboarding state, and local product data intact and available.
- A stored-session network failure is presented as an in-account recoverable state, not as signed-out state or a startup failure.
- Sign out and delete account use distinct confirmation copy that states exactly what happens to local data and the account.
- No sync or empty product-data deletion control is shipped before its underlying capability exists.
- Client/router tests, server deletion integration tests, typecheck, lint, API build, and the focused Android/iOS acceptance pass succeed.

## Phase 3 hand-off

Phase 3 can rely on Account being an ordinary in-app route and on identity transitions never remounting the root navigator. App protection remains independent: locking the app cannot sign the user out, and being signed out cannot disable or bypass the lock.
