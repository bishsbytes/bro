# Offline-first onboarding, identity, app protection, and premium plan

## Status

Active implementation plan, revised after review against the current codebase. Phase 1 is implemented in code, with its native-device acceptance pass still pending. Sync architecture, anonymous identity, local data and multiple accounts, and the consent model are settled — see [Decisions taken](#decisions-taken). [Platform backup](#platform-backup) is the one storage decision still open, and it is not yet implemented.

## Goals

- A new user can complete onboarding and use the core app without registering or having a network connection.
- An existing user can sign in from onboarding or later from within the app.
- Nothing about a user exists on **our** servers until they choose to create an account. There is no silent guest identity. This claim is scoped to our API and database; the store/purchase provider and any consented analytics provider are separate, and must be described separately rather than folded into it.
- Every server-backed capability sits behind the same line: **local features need nothing; server features need an account and an entitlement.**
- A user can later create or link an account without losing local work. An account unlocks account-backed features; **multi-device sync and remote backup are premium**, so registration alone must not be described as protecting the user's data.
- Premium access is independent of account registration on the device where it was purchased. Cross-device and cross-platform entitlement requires an account; that is a deliberate reason to register, not a limitation to conceal.
- Users can optionally protect access to the app with device biometrics or device credentials.
- Local SQLite remains the source of truth for offline-capable product data. The API's Postgres database remains authoritative for identity. These two authorities never merge.

## Non-goals

- Requiring an account to launch or use the core app.
- Treating a Better Auth session as the identity of the local database.
- Treating premium status as an authentication role.
- Storing biometric data in the app.
- Adding SQLCipher in the first delivery unless the product's data sensitivity requires encryption at rest immediately.
- Writing an application-level sync protocol. Sync is libSQL's job (see [Sync architecture](#sync-architecture-native-turso-per-user-database-api-minted-tokens)); the two are alternatives, not layers.
- Provisioning remote storage for any user who has not explicitly asked for it.
- Creating a server-side identity for a user who has not registered.

## Architectural decisions

### Separate the four state axes

The app must model these independently:

1. **Local state:** whether onboarding is complete and the local database is open.
2. **Remote identity:** unavailable or registered.
3. **App protection:** disabled, locked, or unlocked.
4. **Entitlements:** unknown, or the set of currently active capabilities.

No single `isSignedIn` flag should control app entry, local data access, or premium access.

Server-backed capabilities need a further condition beyond these four: **consent**. Entitlement establishes that a user *may* use a server feature; it never establishes that they want their data to leave the device. Sync is the first capability where those come apart — see [Sync is opt-in](#sync-is-opt-in).

### Sync architecture: native Turso, per-user database, API-minted tokens

**Decided.** Sync is libSQL's, not the application's. Each syncing user owns one remote Turso database, and the local `bro.db` is an embedded replica of it. The app never holds a long-lived Turso credential: the API mints a database-scoped token after validating the Better Auth session *and* the user's entitlement.

Phase 1 removed the earlier `connection.ts` scaffolding that read `EXPO_PUBLIC_TURSO_SYNC_URL` and `EXPO_PUBLIC_TURSO_AUTH_TOKEN`. Those values would have been bundled at build time and identical across every install, causing every device to replicate into one shared database.

**What this buys.** Writes on a replica forward to the primary and are serialized there, so conflict resolution is last-writer-wins at the write level and is not the application's problem. Tombstones, per-domain conflict policy, idempotency rules, and an upload queue all cease to exist as work items. This is the main reason to prefer native sync over an application-level protocol.

**What it costs.** Per-user database provisioning, a token lifecycle, and a one-time adoption step for devices that already hold local data. Those are detailed under [Sync delivery](#sync-delivery).

#### Who gets sync

The token endpoint checks three independent conditions, each doing a different job:

1. **Registered** — the technical prerequisite. A database needs a stable owner, and an authenticated principal is the only thing the API can safely attribute one to.
2. **Premium** — the commercial gate, verified **server-side**. This bounds the number of Turso databases to paying users, which is the real cost and abuse control.
3. **Opted in** — the consent gate. See below.

The API must never mint a token from a client-asserted entitlement. That makes server-side entitlement verification (store webhook or receipt validation) a hard dependency of sync rather than the optional extra it appears to be in the premium section — see [Phase 4](#phase-4-premium-and-server-verified-entitlement).

#### Sync is opt-in

Sync is **off by default and stays off until the user turns it on**, even for a registered premium user. Entitlement says a user *may* sync; it does not say they want their data on someone else's server. For a wellbeing app holding personal, health-adjacent records, defaulting that on — or shipping it as an opt-*out* — is the wrong posture and would undercut the local-first promise the rest of this plan makes.

Consequences that shape the implementation:

- **Provisioning is triggered by opt-in, not by purchase.** No Turso database is created when a user subscribes. It is created the first time they enable sync. A premium user who never opts in has no remote database, and the API has nothing about them beyond their account.
- **Opt-in is the consent moment.** It must state plainly what leaves the device, where it is stored, and how to remove it. It is not a settings toggle buried in a list.
- **Opting out deletes the remote database.** Revocation alone is not what a privacy-motivated user means by "stop syncing" — they mean "and take my data off your servers." This is deliberately different from [lapse](#when-premium-lapses), where the database is retained through a grace window because the user did not ask for removal. Opt-out is destructive, confirmed, and immediate; local data is never touched.
- **Account deletion deletes the remote database too,** by the same reasoning.
- **The switch is per account, since the database is.** Adoption stays a per-device confirmation, because it is the device's local data being copied up — so a user signing in on a second device still gets an explicit "copy this device's data into your synced account?" step rather than silent absorption.

The opt-in state is stored server-side, because the server enforces it, and mirrored locally for UI. A local mirror that disagrees with the server must lose.

#### When premium lapses

- Revoke the token. Sync stops; the local replica keeps working as a fully functional offline database. This is consistent with local being the source of truth, and it is the behaviour to describe in the UI.
- Retain the remote database for a defined grace window so resubscribing resumes rather than re-adopts.
- Delete after the window, with prior warning. The window length and the warning schedule are open decisions.
- Never delete local data as part of lapse handling.

### Storage ownership

Two stores, distinguished by whether their contents may ever leave the device.

**Device-local. Never synchronised, never replicated, scoped to this install:**

| Data | Storage | Notes |
| --- | --- | --- |
| `installationId` | Device-local settings store | Random UUID identifying this install; meaningless if copied to another device. Not a credential. |
| Onboarding completion | Device-local settings store | Must be readable offline before any other decision. |
| `appLockEnabled`, lock timeout | Device-local settings store | A lock preference is a property of the device, not the user. |
| `syncGenerationId` | Device-local settings store | Added in Phase 5. See [Sync generations](#sync-generations). |
| `hasStoredRemoteSession`, `lastRemoteUserId` | Device-local settings store | Lets startup skip all session work for a user who has never registered. `lastRemoteUserId` is not a claim on the data — see [Local data and multiple accounts](#local-data-and-multiple-accounts). |
| Better Auth cookies/session cache | Expo SecureStore | Already provided by the Better Auth Expo client. |
| Optional SQLCipher key | Expo SecureStore | Only if database encryption is introduced. |

The device-local settings store must be a distinct store from product data — a separate, never-replicated SQLite file or a key-value store such as MMKV. Anything placed in `bro.db` replicates once the user is syncing, so onboarding state and lock preferences would leak across their devices and `installationId` would stop identifying an install.

**Product and remote data:**

| Data | Storage | Notes |
| --- | --- | --- |
| Product data | Local SQLite (`bro.db`) | Source of truth for offline operation. Becomes an embedded replica of the user's Turso database only after they opt in to sync. |
| Per-user Turso database | Turso, provisioned by the API | Created on opt-in, not on purchase. Deleted on opt-out or account deletion; retained through a grace window after lapse, then reaped. |
| Turso database token | Held in memory for the open handle; refreshed from the API | Short-lived and database-scoped. Never bundled, never a build-time value. |
| `user.id` → Turso database mapping, sync opt-in state | Server Postgres | Provisioning and consent record; the server enforces both. |
| Better Auth user, account, and session records | Server Postgres | Remote identity only; authoritative for identity. |
| Purchase customer identity and receipt state | Purchase SDK/store | Must support purchasing without an app account. |
| Cached entitlement projection | Purchase SDK cache, optionally projected locally | Used for offline feature gating; never a freely writable source of truth. |

The app never receives or stores raw fingerprint or facial data. The operating system returns only an authentication result.

### Platform backup

**Open, and not yet implemented.** Both databases currently sit inside the platform's default backup scope, which no one chose:

- Android — `context.filesDir/SQLite/`, inside Auto Backup's `file` domain, with `android:allowBackup="true"` in the committed prebuild manifest.
- iOS — `documentDirectory/SQLite/`, inside the iCloud-backed app container.

So both files are backed up today and restored onto a new device.

**`bro-device.db` must be excluded.** This is not a judgement call:

- `installationId` is defined to identify *this install*. Restore it and it identifies two.
- In Phase 5, a restored `syncGenerationId` on a device that never adopted is exactly the stale-generation state [Sync generations](#sync-generations) exists to detect. Platform backup would manufacture it.
- Nothing in the file is worth preserving — onboarding completion and a lock preference cost seconds to redo.

**`bro.db` is a product decision.** Excluding it makes the privacy copy literally true, since Apple can read a standard iCloud Backup without Advanced Data Protection enabled; Android encrypts client-side with the device PIN, so Google cannot. Keeping it is the free tier's only protection against a lost phone, because sync is premium — and withholding that to drive upgrades is its own kind of dark pattern. **Current lean: keep `bro.db` backed up and amend the copy.** [Screen 2](#screen-2--where-your-data-lives) must then stop saying "and nowhere else" and name platform backup explicitly; "we never have it" stays true either way, since the claim is scoped to our servers.

Implementation notes for whoever picks this up:

- Android is min SDK 24 / target 36, so the install base straddles API 31 and needs **both** `dataExtractionRules` (31+) and `fullBackupContent` (24–30).
- iOS has no Info.plist switch for a subdirectory. `openDatabaseAsync` accepts a directory argument, so the file can be relocated, but setting `NSURLIsExcludedFromBackupKey` needs native code.
- WAL leaves `-wal` and `-shm` sidecars. Exclusion rules must name them, or a partial database is backed up.
- Both platforms need a native rebuild, so fold this into the prebuild regeneration [Phase 3](#phase-3-optional-app-protection) already requires.

### Local identity lifecycle

- Create `installationId` in the device-local settings store during first startup, before or alongside product-database initialization.
- Keep it stable across sign-in, sign-up, and sign-out.
- Treat uninstall/reinstall as a new install unless restored by an explicitly supported platform backup mechanism. See [Platform backup](#platform-backup), which decides what may be restored at all.
- Never use an email address or a fixed string as an installation, purchase, or sync identifier.

### Local data and multiple accounts

**One product database per device, owned by no account.**

- **No account claims the local database.** There is no owner field, no per-account file, no registry, and no user-facing concept of workspaces. `installationId` identifies the install; the product database is simply `bro.db`.
- **Sign-out does not close, switch, or hide local data.** The account is optional and buys nothing at the free tier, so a user signing out — often just to fix a login problem — must not watch their notes disappear. Signing out ends a session; it is not a data operation.
- **`lastRemoteUserId` records which account is signed in,** and nothing more. It exists so startup can skip session work, not to gate data access.
- **What protects the user at the sync boundary is the adoption confirmation itself.** It must describe the data concretely — "copy 143 notes from this device into your account?", ideally with a date range — because a count is what stops someone mid-mistake. See [Adoption](#2-adoption-promoting-a-local-only-database-to-a-replica).

### Why no per-account ownership

Two successive revisions of this plan tracked ownership: first per-account workspace files (a registry of `workspaceId`, `databaseFileName`, and `ownerUserId` selected by an `activeWorkspaceId`, with sign-out closing the owned file), then a single `ownerUserId` checked at adoption. Both were removed. The reasoning is recorded here because it is the kind of decision that gets silently reintroduced.

**Against the registry:**

- **Nothing merges silently.** Adoption is explicit and confirmed per device ([Sync is opt-in](#sync-is-opt-in)). The registry was a second lock on a door that already has one.
- **The population is thin.** Shared phones are rare for this product, which leaves one person with two accounts — the same person, so their notes reaching their own second account is not a breach.
- **The cost sat in one rule.** Requiring sign-out to close the owned file is what forced retained-plus-current files, which forced `databaseFileName`, `activeWorkspaceId`, and a multi-row registry. Removing that rule collapsed the whole structure.
- **It interacted badly with platform backup.** A restore bringing back an account-owned file without the settings that catalogue it leaves an orphaned database the app can neither open nor delete. See [Platform backup](#platform-backup).

**Against the remaining `ownerUserId`:**

- **It guards an exposure already accepted.** Without the registry, a second account signing in reads every local note on screen. Blocking the *upload* while the data sits in that person's hands is a dialog, not a protection. If the read exposure is acceptable, the upload exposure is strictly less bad.
- **No affordable write path makes it fire correctly.** Setting it on sign-in compares an account against itself at adoption and never triggers. Setting it on first write after sign-in misses anyone who adopts without writing, and mis-attributes everything written before any sign-in — the common path here. The version that works is per-record `createdByUserId`, which is a different and much larger feature.
- **It duplicates a field that works.** `lastRemoteUserId` already answers "which account is on this device", with a real writer and test coverage.
- **A permanently null field is worse than no field,** because it reads as a safeguard. Whoever meets it in Phase 5 either trusts a check that never fires or loses an afternoon working out why.

What this gives up, stated plainly: two people genuinely sharing one device see each other's notes, and either can upload them. That is the same trade every note-taking app with an optional account makes, and the [app lock](#optional-biometricdevice-credential-app-lock) addresses it better than a data model can.

Revisit if a real shared-device use case appears, or if the product needs per-record authorship for its own sake — shared or multi-author entries. Either would justify `createdByUserId` on records, which is the correct shape and not what `ownerUserId` was.

### Sync generations

Unrelated to multiple accounts: this concerns a single user with more than one device.

A user opts out, the remote database is deleted, and a second device is offline throughout and never learns. Later the user opts back in and a new database is created. The offline device reconnects, obtains a *valid* token for the new database, and its adoption logic — seeing local rows absent from the remote — copies the deleted data back up. The vector is the retained replica plus a legitimately-issued token, not a stale credential, so revoking tokens does not prevent it.

The guard is a server-issued, immutable `syncGenerationId`, recorded by both the account and each replica:

- Every opt-in mints a new generation and a uniquely named database. Generations are never reused, so a device holding a dead one is always detectable.
- Tokens are scoped to a generation. A token for a retired generation authorises nothing.
- A replica whose generation does not match the account's current one cannot sync. It must go through fresh adoption, with the same explicit confirmation as any other adoption, or be discarded.
- Adoption records the generation it adopted into. Re-running adoption against a different generation is a new adoption, not a resume.

This is a Phase 5 concern and does not appear in the Phase 1 settings schema.

#### Distinguish four destructive operations

These are routinely conflated and have different semantics:

| Operation | Local data | Remote database | Account |
| --- | --- | --- | --- |
| Sign out | Untouched and still open — signing out is not a data operation | Untouched | Untouched |
| Turn sync off | Untouched | **Deleted**, generation retired | Untouched |
| Delete local data | **Deleted** on this device | Untouched | Untouched |
| Delete account | Untouched on device | **Deleted** | **Deleted** |

Each needs its own confirmation copy stating exactly which column it affects. "Delete local data" on a syncing device is the most easily misunderstood: it removes this device's copy while the remote database and other devices are unaffected, and the next sync may simply bring the data back. Say so before the user taps it.

### Remote identity lifecycle

```ts
type RemoteIdentity =
	| { kind: "unavailable" }
	| { kind: "registered"; userId: string };
```

There is deliberately no third state. An earlier draft of this plan gave unregistered users a Better Auth anonymous session; it was removed because nothing needed it. Local features require no server identity, sync requires a registered one, and telemetry uses `installationId` — which is better suited to the job anyway, since it survives session expiry. Adding the anonymous plugin later costs roughly what adding it now would, so nothing is foreclosed. See [If server features for unregistered users appear](#if-server-features-for-unregistered-users-appear).

- `unavailable` includes offline startup, server errors, and no established session. It is the normal, expected state for most users, not a degraded one.
- Startup performs no session work for a user who has never registered. This needs a durable local marker to implement, because `unavailable` alone cannot distinguish "never had a session" from "session expired": a provider that calls `useSession()` unconditionally on mount issues a request either way.
  - Set `hasStoredRemoteSession` on successful sign-in or sign-up; clear it on sign-out and account deletion.
  - Mount the session hook only when the marker is set. **The marker must gate a child that owns the hook, not the provider's own component type.** Swapping the provider between two component types remounts the entire tree beneath it on every sign-in and sign-out, discarding navigation state and any screen state mid-flow — including the sign-out result the user is meant to read.
  - Record the user id returned by sign-in and sign-up directly, rather than waiting for the session hook to report it. The device must record which account is signed in without lagging a render behind or falling back to whichever account was recorded last.
  - The marker is a hint, not a source of truth. If it disagrees with SecureStore — after a keychain wipe, a restore onto a new device, or an interrupted sign-out — the cost is one wasted request, after which the marker is corrected. Do not build reconciliation machinery for it.
  - Clear it when the server answers with no session or an explicit 401, and only then. Any other error is a failed request — offline startup above all — and must leave the marker alone.
- Signing out leaves the user in the app with their local data open; it does not route to a mandatory sign-in screen, erase local data, or hide it.
- Signing out must succeed offline. Clear the local session unconditionally and treat server-side revocation as best-effort.
- **Spike resolved in Phase 1.** In the installed `@better-auth/expo@1.6.27`, `signOut()` clears the SecureStore cookie, cached session, and in-memory session atom from the request-initialization hook, before the network request runs. Phase 1 pins that dependency behavior with a contract test and clears `hasStoredRemoteSession` before calling it. No internal storage keys or client atoms are touched by application code. If revocation cannot reach the server, the discarded device credential remains signed out while the server-side session expires naturally.

#### If server features for unregistered users appear

The decision to omit anonymous identity rests on one condition: no server-side capability is offered to users without an account. Planned AI features do not violate it, because they sit behind an account-gated trial — a server call needs an authenticated principal, and neither `installationId` nor a purchase-SDK anonymous ID is one. An app-granted trial in particular has nothing durable to key to without an account, so registration is what makes it implementable rather than friction added on top.

Revisit this only if a server-backed capability is genuinely to be offered to unregistered users. At that point Better Auth's anonymous plugin is the right tool, and the work is the same as it would have been.

## User journeys

### First launch

1. Initialize and migrate the local database.
2. Read device-local settings, creating this install's identity on first launch.
3. Show the welcome/onboarding screens if onboarding is incomplete.
4. On the final screen offer:
   - **Start using the app** as the primary action.
   - **I already have an account** as the secondary action.
5. Explain that no account is required and that the app works entirely on this device. Do not promise that an account backs the data up — under this plan it does not; premium does. Name what an account actually gives at the free tier. Draft wording in [Onboarding copy](#onboarding-copy-placeholder).
6. On continue, persist onboarding completion and enter the main app immediately. No network call is made, and none is pending.

### Onboarding copy (placeholder)

**Status: placeholder, written from assumptions.** The privacy and account lines are derived from decisions this plan has already taken and should survive review. Anything describing what the app *does* is bracketed, because no product domains exist yet — `packages/database/app/src/schema.ts` is still empty. Replace the brackets, then re-read the whole thing for tone.

Assumed tiers, to be confirmed:

- **No account, free, forever:** all core [tracking/check-in] features, unlimited, on this device.
- **A free account on its own unlocks nothing.** It is a prerequisite for paid server features, not a feature.
- **Premium:** AI features and sync/backup across devices.

#### Screen 1 — Welcome

> **bro**
>
> [One line on what the app helps with.]
>
> No account. No sign-up. Nothing to fill in first.

#### Screen 2 — Where your data lives

> **Your data stays on your phone**
>
> Everything you write is stored on this device and nowhere else. We can't read it, because we never have it.
>
> Works offline, on a plane, in a tunnel, with no signal at all.

#### Screen 3 — Get started

> **[Feature summary line.]**
>
> Free, no account needed, for as long as you want.
>
> *Later, if you want your notes on more than one device, or [AI feature], you can add an account and upgrade. Up to you — the app works fully without either.*
>
> **[ Start using the app ]**
> [ I already have an account ]

#### Rules this copy is enforcing

- Never say an account "keeps your data safe", "backs it up", or "protects" it. Under this plan a free account does none of those things, and sync — which does — is premium and opt-in.
- Never imply data is uploaded by default. It isn't, at any tier, until the user opts in.
- "Your data stays on your phone" is true of our servers and must not be quietly falsified later by analytics or the purchase SDK. If either ships, this screen changes.
- Sign-up is not offered on the final screen. Only sign-**in**, for people who already have an account. There is nothing to sign up *for* yet.
- The upgrade path is mentioned once, in passing, in the secondary voice. Onboarding is not the place to sell.

### Returning local-only user

1. Initialize local state.
2. Apply the optional app-protection gate.
3. Open the main app regardless of auth-server availability.
4. For a registered user, refresh identity and entitlements in the background. For everyone else there is nothing to refresh.

### Existing user sign-in

- Sign-in is available from onboarding and from the in-app Account area.
- Local data remains intact while signing in. Signing in alone changes nothing about local storage.
- If the user is entitled and has sync enabled on their account, offer [adoption](#2-adoption-promoting-a-local-only-database-to-a-replica) as a separate, visible, confirmed step — never silently as part of sign-in. This device's local data is about to be copied to a server; that needs an explicit yes.
- Authentication errors remain within the account flow and do not become application startup errors.

### Create an account later

- Present account creation contextually, for benefits the free tier actually delivers. Backup and cross-device sync belong in the premium prompt, not the registration prompt.
- Registration provisions nothing and begins no sync. It creates an account and stops there.
- Do not make premium purchase or continued premium access conditional on completing registration — but note that **sync specifically requires registration, entitlement, and opt-in together**. Say so plainly at the point of purchase, so someone buying without an account is not surprised by what they did and did not get.

### Sign out

- End the registered Better Auth session.
- Switch purchase identity according to the selected purchase provider's documented identity rules.
- Stop sync and close the replica. Retain the file; do not delete it.
- **Leave local data open and untouched.** The user keeps working exactly as before, minus the account. Nothing is re-scoped, hidden, or marked as belonging to the account that just left.
- Deletion of local data remains a separate destructive action with its own confirmation.

### Turn sync on, and off again

- **On:** an explicit, informed opt-in that states what leaves the device and where it goes. Mints a new `syncGenerationId`, provisions a uniquely named database for it, then runs adoption for this device.
- **Off:** stops sync on every device, **deletes the remote database**, and retires the generation. Confirm it as the destructive action it is, and be explicit that local data on this device is untouched while other devices keep only what they already hold.
- Both directions must be reachable from the Account area, and the current state must be legible at a glance — a user should never have to guess whether their data is on a server.
- Turning sync back on mints a **new** generation. Any device still holding a replica from the retired generation cannot sync it: the mismatch is detected, and that device must adopt afresh with an explicit confirmation, or discard. Without this, a device that was offline across the whole opt-out/re-opt-in cycle would silently repopulate the new database with data the user believed deleted.

## Navigation and startup model

Replace auth-protected root navigation with local-onboarding and app-protection decisions:

```text
native splash
  -> device-local settings load
  -> product database initialization/migrations
       |- failure -> local storage unavailable screen (the only fatal state)
  -> optional biometric/device-credential gate
  -> onboarding routes, if incomplete
  -> main app routes, if complete

remote auth + entitlement refresh
  -> runs independently after minimum local startup
  -> failure produces recoverable in-app state, not a fatal startup screen
```

Local storage failure is the one genuinely fatal startup condition, and it needs a designed state rather than an incidental one. `runMigrations` throws on the first failing migration by design, and it does not close the handle, so a clean retry requires `closeDb()` or an app reload — the screen must offer one of those rather than leaving the app wedged against a half-known schema. Auth and entitlement failures must never reach this branch.

Sign-in and sign-up become account routes or modals accessible from onboarding and the main application. The main app route must not be protected by `isSignedIn`.

## Better Auth work

### Server

The server side of Better Auth needs no new plugins. Email/password and the Expo plugin already cover what this plan requires. What it does need:

- Account deletion that also deletes the user's Turso database and provisioning record, not only the Postgres rows.
- A server-side entitlement record, reconciled to `user.id` — see [Entitlement before registration](#entitlement-before-registration), which is why "keyed to `user.id`" is not sufficient on its own.
- The sync opt-in flag and current `syncGenerationId`, stored alongside the provisioning record and enforced on every token request.

### Client

- Replace `isSignedIn` with explicit `RemoteIdentity` state in the auth provider.
- Preserve the existing SecureStore-backed session/cookie storage.
- Do not fail startup when session retrieval fails, and gate the session hook behind `hasStoredRemoteSession` so a never-registered user issues no request at all.
- Make `signOut` local-first: clear the stored session even when the server call rejects, and surface revocation failure as informational rather than as a thrown error. The mechanism for clearing it is unresolved — see the spike in Phase 1.

This is a smaller change than the original plan assumed. With no anonymous identity to establish, retry, or de-duplicate, the client's remote-identity work reduces to "restore a session if one exists, otherwise do nothing".

## Local data

Add a device-local settings domain, in its own never-synchronised store, with at least:

- `installationId`
- `onboardingComplete`
- `appLockEnabled`
- app-lock timeout preference
- a stored version, so values can be reshaped later

Key-value, not relational: these are flat scalars, and a schema with DDL and migrations would be ceremony without a table to justify it. Reads are synchronous so that app entry does not gate on I/O.

This separation is load-bearing under native sync, not merely tidy: everything in `bro.db` replicates, so onboarding state and lock preferences placed there would propagate to the user's other devices and `installationId` would stop identifying an install.

Product records still use client-generated stable UUIDs, and still need `createdAt`/`updatedAt` semantics — both remain useful for adoption-time reconciliation and for user-facing history. Tombstones, per-domain conflict policy, and idempotency rules are **not** required: libSQL serializes writes at the primary.

## Sync delivery

Three pieces of work, in dependency order. None of them is a research problem, but the second is the one most likely to be discovered late.

### 1. Provisioning and tokens

- The API gains a Turso Platform credential as a server secret, and a mapping from Better Auth `user.id` to the user's database name and opt-in state.
- On first qualifying request (registered **and** server-verified premium **and** opted in), create the database and return a database-scoped token. Opt-in is what triggers creation; entitlement alone never does.
- Opt-out deletes the database and clears the mapping. Account deletion does the same.
- Tokens are short-lived relative to the subscription, not to the session. Mint with a TTL long enough that refresh is a startup/foreground concern rather than a mid-interaction one.
- Revocation on lapse, and reaping after the grace window, are server-side jobs.
- Provisioning failure is never fatal to the app. The user stays local-only and the failure is surfaced in the Account area.

### 2. Adoption: promoting a local-only database to a replica

An embedded replica bootstraps from the remote's replication log. A `bro.db` that has been accumulating local-only rows **cannot be reopened with `libSQLOptions` and expected to push them** — its rows are not in that stream and its file shares no history with the new remote database. The same is true of a second device that already holds local data.

Adoption is therefore an explicit, one-time operation:

1. Obtain the token and the remote database URL.
2. Open a **new** replica file, distinct from the existing local database.
3. Copy the existing rows into it, where they forward to the primary.
4. Verify, then retire the old file — retained, not deleted, until the next successful launch.
5. Record adoption in device-local settings so it never runs twice.

This is where merge policy actually lives, and it is much smaller than an ongoing sync protocol: a device adopting an empty remote database copies everything, and a device adopting a populated one (second device, or resubscribe after the grace window) needs a defined rule for records present on both sides. Default to preserving both; prompt only where preservation is impossible.

The step must be interruptible and restartable — it will run on a mobile device, mid-adoption, over a network that drops.

### 3. Connection lifecycle

`libSQLOptions` accepts `url` and `authToken` **at open time only**; expo-sqlite 56 exposes no way to refresh a token on a live handle. Token rotation therefore means closing and reopening the database. Today `connection.ts` memoizes one handle for the process lifetime, `closeDb` is documented as test-only, and a close during an in-flight open is explicitly unsupported.

So this needs real work:

- A supported reopen path — quiesce readers, close, reopen with the new token.
- Refresh on startup and on foreground, ahead of expiry, never mid-interaction if avoidable.
- Expired or rejected tokens degrade to local-only operation with a retry. Sync failure must never surface as a startup error or block a write.
- `syncLibSQL()` needs an actual schedule (foreground, post-write debounce, connectivity regained) — today nothing calls it.

### Schema migrations across devices

`__app_migrations` replicates along with everything else, so a migration applied on one device is visible to the others *after a pull*. That is weaker than it first appears, and two problems remain.

**Concurrent application.** Two devices can each apply migration N before either sees the other's marker row. Both forward their DDL to the primary, where the writes serialize — so the loser hits either an "already exists" error on the DDL or a primary-key conflict on the marker insert. `runMigrations` throws on the first failure, which turns a benign race into a failed startup. Resolve by:

- Deciding first whether DDL may originate from a replica at all, or whether schema changes are applied only to the primary out of band. This is the prior question and it changes everything below.
- If replicas may migrate: make migrations conflict-tolerant end to end — `CREATE TABLE IF NOT EXISTS` and equivalents, marker insert with `ON CONFLICT DO NOTHING` — and re-check applied state after a pull before deciding anything failed.
- Defining whether sync pauses for the duration of a migration.
- Defining recovery for the halfway states: schema change replicated but marker absent, or marker present but the change not yet pulled.

**Version skew.** An older app version encountering a newer remote schema is the separate problem the forced-update path addresses. Migrations are effectively irreversible once replicated, so the minimum-schema check must ship before multi-device sync is enabled for anyone. Staged mobile rollouts mean both versions will be live simultaneously; the plan should state how long backward compatibility is maintained rather than discovering it from crash reports.

## Optional biometric/device-credential app lock

### First delivery: UI privacy gate

- Use `expo-local-authentication`.
- Offer opt-in only when supported authentication is enrolled.
- Request strong biometrics on Android where appropriate.
- Permit device PIN/passcode fallback by default.
- Lock on cold launch and after a configurable background interval.
- Include a **Lock now** action.
- Obscure sensitive app content while backgrounded/app-switcher snapshots are taken.
- Treat cancellation as remaining locked, not as an auth sign-out.
- Test Face ID using native development/release builds, not Expo Go.

The UI gate protects against casual access on an unlocked device. It does not encrypt the SQLite file.

### Optional later delivery: encrypted SQLite

**Verify feasibility before planning this at all.** expo-sqlite 56's `SQLiteOpenOptions` exposes no encryption-key option, and `libSQLOptions` accepts only `url`, `authToken`, and `remoteOnly`. Encryption at rest and embedded replicas may be mutually exclusive on this stack. Confirm against a real build before committing to a phase; if they are exclusive, the choice is between encryption and sync, and sync is the one users are paying for.

Adopt SQLCipher only after confirming that, plus the recovery and operational requirements. If adopted:

- Enable SQLCipher through the Expo SQLite config plugin/native build.
- Generate a random database key; never derive it directly from a PIN or biometric.
- Store the key in SecureStore with an appropriate device-only accessibility policy.
- Decide whether retrieving the key itself requires OS authentication or whether the app-level prompt gates use of an in-memory key.
- Define behavior for biometric enrollment changes, lost keys, device migration, backups, and recovery before shipping.
- Ensure background sync does not unexpectedly trigger an interactive prompt.
- Plan migration of existing plaintext databases and verify the migration is atomic and recoverable.

Do not place the Better Auth session behind per-read biometric authentication because background refresh and sync need non-interactive access.

## Premium entitlements

Introduce an entitlement interface that is independent of auth:

```ts
type EntitlementState = {
	/**
	 * `unknown` is a real state, not an absence: a fresh reinstall offline, or
	 * before the first successful verification. Gates must not treat it as
	 * `free`, or a paying user gets downgraded by a failed network call.
	 */
	status: "unknown" | "free" | "premium";
	source: "store" | "promotion" | "account" | null;
	verifiedAt: string | null;
};
```

- Feature gates consume the entitlement provider, never `isSignedIn`.
- Define the `unknown` presentation explicitly: which gates fail open, which fail closed, and what the user is told while verification is pending.
- Configure the purchase SDK without requiring an app account, so an unregistered user can still purchase.
- Use store/purchase-SDK verified state as the authority for **client-side** feature gates.
- Maintain a **server-side** entitlement record, fed by store webhooks or receipt validation, as the authority for anything the server grants — Turso provisioning above all. A client claim of premium must never mint a database token. This is not optional under this plan; sync depends on it.
- Support cached entitlement access while offline, subject to the product's expiry/grace policy.
- Always provide **Restore purchases**.
- When a user registers or signs in, identify/alias them using the Better Auth user ID according to the provider's merge/transfer rules.
- Specify sign-out, account switching, reinstall, refunds, billing retry, grace period, and cross-platform behavior before implementation.
- Say plainly in the UI that entitlement follows the store account on this platform, and that using premium on another platform requires signing in. This is the clearest account-creation prompt the product has; do not bury it.

RevenueCat is the current recommended candidate, but provider selection remains a product/engineering decision. If chosen, test its anonymous-to-identified alias and transfer behavior explicitly rather than assuming every identity pair merges. Note that its anonymous app-user ID is an attribution key, not a credential — it identifies a purchase, and must never be treated as authentication for a server call.

### Entitlement before registration

Purchasing without an account and keying server-side entitlement to `user.id` are in direct tension: at the moment the store webhook fires for an unregistered purchaser, there is no `user.id` to key it to. The webhook carries a provider customer identity — for RevenueCat, an anonymous app-user ID. Left unaddressed, someone who buys premium and *then* registers can be premium on the device while the server considers them free, which makes them permanently ineligible for sync.

The server model needs:

- **The provider customer/transaction identity as the original owner** of the entitlement record. It is the only identity that exists at purchase time.
- **A durable mapping from provider identity to `user.id`**, written when the user registers or signs in and the client identifies them to the provider.
- **Idempotent webhook processing**, since the same transaction will be seen more than once, and reconciliation of any entitlement received before the mapping existed.
- **A server-side pull as backstop.** On registration and on sign-in, the API asks the provider directly for the user's entitlement rather than waiting to be told. Providers do alias anonymous IDs on identify and subsequent webhooks normally carry the resolved ID — but "normally" is not a guarantee, and a webhook-only design fails silently into "the user paid and cannot sync". Pull, then trust the webhook for updates.
- **Explicit transfer rules** for the case where a store account's purchase is claimed by a second app user, which providers expose as a configurable behaviour rather than a fixed one.
- **A defined transient state** for "the client shows premium but the server has not yet associated it". Local premium features should work; sync should wait, and say it is waiting rather than appearing broken.

### Capability-level entitlements

`status` above is a placeholder for a single premium tier, and that will not survive contact with the roadmap. AI features cost per call; sync costs per user per month. They plausibly belong to different tiers, and a trial very plausibly grants one without the other — granting AI during a trial while withholding sync avoids provisioning a Turso database for every trial start, which is otherwise the common case rather than the edge case.

Model entitlements as a set of active capabilities rather than a boolean, keeping `unknown` as a distinct state. This is much cheaper to design in now than to unpick from feature gates later.

Open: does the trial grant AI only, or AI and sync? And is it store-granted (card up front, store-enforced eligibility) or app-granted (no card, keyed to the account)? Both answers change this section and the trial's abuse profile; neither blocks Phase 1.

## Delivery phases

### Shared prerequisites

Three pieces of work are assumed by later phases and exist in neither the workspace nor the phase list. Schedule all of them explicitly rather than discovering them mid-phase.

**Designs to settle before the phase that needs them.** Three, each of which shapes a schema or an API that is expensive to change afterwards:

1. [Local data and multiple accounts](#local-data-and-multiple-accounts) — settled: no ownership is tracked, and the adoption confirmation carries the weight instead. Nothing is needed in the Phase 1 schema. [Sync generations](#sync-generations) add one key in Phase 5 and need no decision now.
2. [Entitlement before registration](#entitlement-before-registration) — before Phase 4.
3. Sync opt-in, generation, and provisioning records on the server — before Phase 5.

**Test harness.** Phase 1 adds the `@bro/app:test` Nx target using `jest-expo` and Testing Library. It includes dependency-contract coverage for Better Auth's pre-request sign-out clearing, local-only session-hook gating, database-open retry, and onboarding entry without a network request.

**Native build.** `expo-local-authentication` (Phase 3) and the purchase SDK (Phase 4) both require a custom development client, and `apps/app/android/` is a committed prebuild that must be regenerated when either is added. That is one infrastructure task arriving twice, in consecutive phases. Doing it once, when the first of the two lands, is cheaper than doing it twice — and note that neither phase can be verified in Expo Go.

### Phase 1: Local-first app entry

- **Spike: offline sign-out — resolved.** Better Auth clears its SecureStore cookies, cached session, and in-memory session atom before the request; retain a contract test around that behavior and treat server revocation failure as informational.
- Remove `EXPO_PUBLIC_TURSO_SYNC_URL` / `EXPO_PUBLIC_TURSO_AUTH_TOKEN` from `connection.ts`. The replica is reintroduced in Phase 5 with API-minted tokens; leaving a build-time credential path in place until then is an accident waiting to be shipped.
- Add the device-local settings store and its APIs, in a separate file from `bro.db`.
- Add welcome/onboarding routes and persistence.
- Refactor root navigation so local onboarding—not authentication—controls app entry.
- Move sign-in/sign-up into optional account flows.
- Make auth loading/errors non-fatal to app startup, and give local storage failure its own recoverable screen.
- Gate the session hook behind `hasStoredRemoteSession`.
- Make sign-out work offline, per the spike's finding.
- Stand up the test harness described above.

**Exit criteria:** A clean install in airplane mode can complete onboarding, relaunch, and use the core app without seeing an account requirement, and issues no request to our backend while doing so. Sign-out succeeds with no network. Auth failure never reaches a startup screen; storage failure always does, with a retry path. Covered by automated tests, not only by hand.

**Implementation status:** The Phase 1 code and automated harness are complete. The remaining release gate is the native Android/iOS acceptance pass covering fresh install, cold relaunch, airplane-mode sign-out, and storage retry on a real SQLite handle.

### Phase 2: Optional accounts

- Implement in-app Account settings, with sign-in, sign-up, and sign-out as optional flows reachable from the main app.
- Implement account deletion, including everything the server holds.
- Implement the four destructive operations as distinct actions with distinct confirmation copy.

Reconciliation of *product* data is not in this phase. Under native sync it happens at adoption, which cannot occur before a user is entitled and opted in — see Phase 5.

**Exit criteria:** Registering, signing in, signing out, and switching accounts never destroy, hide, or implicitly re-scope local product data, and none of them is required to use the app.

### Phase 3: Optional app protection

- Add the local-authentication dependency and native configuration.
- Add privacy settings, lock state, background timeout, and app-switcher protection.
- Add device credential fallback and failure handling.

**Exit criteria:** The app can be locked without an account or network, and biometric cancellation/failure cannot corrupt data or sign the user out.

### Phase 4: Premium and server-verified entitlement

- Select the purchase/entitlement provider.
- Implement capability-level entitlements and feature gates, including the `unknown` state.
- Support purchase without an app account, cached offline access, restore, and later account identification.
- Implement **server-side** entitlement verification: idempotent webhooks, the provider-identity-to-`user.id` mapping, reconciliation on registration, and the server-side pull backstop. Phase 5 cannot start without this; it is the authority that decides who may be provisioned a database.

**Exit criteria:** A user can purchase and use premium without registering, restore supported purchases, and later create an account without losing the entitlement — and the server knows they are entitled without being told by the client, including when they purchased before the account existed.

### Phase 5: Turso sync

- Build the sync opt-in and opt-out UI, with the consent copy, before the machinery behind it — it is the feature's front door, not a setting bolted on afterwards.
- Provision per-user databases from the API, gated on registered **and** server-verified entitlement **and** opt-in; store the `user.id` → database, generation, and opt-in state.
- Implement generations: a new one per opt-in, tokens scoped to it, replicas recording theirs, mismatches refused and routed to fresh adoption.
- Implement opt-out and account deletion as genuine remote deletion, not revocation.
- Mint, refresh, and revoke database-scoped tokens; implement lapse revocation and post-grace reaping.
- Rebuild `connection.ts` around a token-bearing open, a supported reopen path, and degradation to local-only when a token is expired or refused.
- Implement adoption: new replica file, copy, verify, retire, record — interruptible, restartable, and explicitly confirmed per device. The confirmation must state how much data is about to leave the device — a record count, and a date range where meaningful — rather than asking an abstract question.
- Schedule `syncLibSQL()` on foreground, post-write debounce, and connectivity regained.
- Add the minimum-schema check and forced-update path before multi-device sync is enabled for anyone.

**Exit criteria:** Adoption states how much data it is about to upload, and the user can decline. An entitled user who has not opted in has no remote database and no server-side product data. A user who opts in sees their data on a second device. Opting out removes the remote database and leaves local data intact. A device offline across an entire opt-out/re-opt-in cycle cannot repopulate the new database. A lapsed user keeps working locally with sync stopped; adoption interrupted mid-copy resumes without duplication or loss; an expired token never produces a startup error or a blocked write.

### Phase 6: Optional encryption at rest

- **First, verify that encryption and embedded replicas can coexist on expo-sqlite 56.** If they cannot, this phase is a choice against sync and should be reconsidered rather than sequenced.
- Complete the SQLCipher threat-model and recovery decision.
- Implement key management and plaintext-to-encrypted migration if approved.
- Validate native builds, backups, biometric changes, and failure recovery.

**Exit criteria:** The database cannot be read at rest without the protected key, and documented recovery/failure paths have been tested.

## Acceptance test matrix

At minimum, cover:

- Fresh install online and offline.
- Onboarding continue versus existing-user sign-in.
- Relaunch before and after onboarding completion.
- Auth API unavailable, slow, or returning an error — including at startup, where it must be invisible.
- A local-only user causes no auth, API, sync, or product-data request to our backend at any point. Purchase-provider and consented-telemetry traffic are out of scope for this assertion and are documented separately.
- Local-only user signs into an existing account with data on both sides.
- **Account A signs out, account B signs in on the same device.** B sees the device's local data, and adoption offers to upload it — the accepted trade. What must hold is that adoption says plainly how many records it is about to send, so the choice is informed.
- A signs out and back in, and finds their data untouched and still open throughout.
- Sign-out with no network available, including when remote revocation never succeeds.
- Each of the four destructive operations affects only its own column of the table above.
- Account deletion removes the Turso database and provisioning record, not only the Postgres rows.
- App is backgrounded briefly and beyond the lock timeout.
- No biometric hardware, no enrollment, changed enrollment, cancellation, failure, and OS lockout.
- Premium purchase while unregistered, and while registered.
- Premium access offline after prior verification.
- Restore after reinstall and on another device where the store/provider supports it.
- Refund, expiry, grace period, account switch, and identity merge/transfer edge cases.
- Database migration failure leaves recoverable data and offers a retry or reload path.
- Premium gate behaviour while entitlement status is `unknown`.
- Token endpoint refuses an unauthenticated caller, a free registered user, an entitled user who has not opted in, and a client-asserted entitlement claim.
- Entitled user who never opts in: no database is ever created.
- Opt-out deletes the remote database, leaves local data intact, and stops sync on a second device.
- Opt-in, opt-out, then opt-in again.
- **A second device stays offline across the whole opt-out and re-opt-in cycle, then reconnects.** Its stale-generation replica must not repopulate the new database.
- Purchase while unregistered, then register: the server converges on the entitlement, and sync becomes available without manual intervention.
- Webhook arriving before registration, after registration, and twice for the same transaction.
- Adoption of a local-only database into an empty remote database, and into a populated one.
- Adoption interrupted mid-copy, then resumed; adoption attempted twice.
- Two devices writing the same record while both online, and while one is offline.
- Two devices applying the same migration before either has pulled the other's marker.
- Token expiring in the foreground, and while backgrounded.
- Premium lapse: sync stops, local data survives, resubscribe within the grace window resumes.
- Older app version opening a database migrated by a newer one.

## Observability and privacy

- Record identity state transitions and sync outcomes without logging session tokens, passwords, emails, database keys, Turso tokens or database URLs, or biometric details.
- Track adoption as a funnel — started, copied, verified, retired — since a silent failure there loses user data.
- Use `installationId` as the pseudonymous telemetry identifier and document its lifecycle. It is not a server identity and must not become one by accident.
- Track entitlement source and refresh outcome without trusting analytics as authorization.
- Provide clear user-facing explanations of local-only storage, what sync sends and where, account benefits, purchase restoration, and deletion behavior.
- Make the current sync state visible in the Account area at all times. A user should never have to infer whether their data is on a server.

## Decisions taken

- **Sync is native Turso**, one database per syncing user, replicas on device. No application-level sync protocol.
- **Tokens are minted by the API**, database-scoped and short-lived. No build-time credentials.
- **Sync requires registration, server-verified entitlement, and explicit opt-in** — three separate conditions. Registration is the technical prerequisite, entitlement the commercial gate, opt-in the consent gate.
- **Sync is off by default and provisions nothing until opted in.** Opting out deletes the remote database.
- **On lapse:** revoke the token, keep working locally, retain the remote database through a grace window, then reap.
- **No anonymous identity.** Unregistered users have no server-side presence at all. AI features sit behind an account-gated trial, so nothing needs one.
- **One product database per device, owned by no account.** No ownership is tracked; the explicit adoption confirmation, which names how much data is about to be uploaded, is the protection. Sign-out changes no data and hides nothing.
- **Every opt-in mints a new sync generation.** Retired generations are never reused, so a device holding stale data is always detectable. This is about one user with several devices, not about several users.

## Open decisions

### Phase 1 decisions — resolved

1. **Which exact features are core, account-backed, and premium?** Everything downstream — what onboarding promises, what registration is worth at the free tier, what premium gates — depends on this. Sharpened by the sync and AI decisions: registration now buys the user access to server features rather than safety for their data, so the free tier needs a defensible answer that stands on local value alone. **Provisionally unblocked** by the assumptions in [Onboarding copy](#onboarding-copy-placeholder); confirm or correct them before the onboarding screens ship.
2. **Local data and multiple accounts.** Resolved: no per-account ownership is tracked at all. Per-account workspace files and a single `ownerUserId` were both considered and rejected — see [Why no per-account ownership](#why-no-per-account-ownership). The adoption confirmation, describing the data by count, is what protects the user.

### Resolve before Phase 3

3. Is app protection premium, free, or always available due to its privacy role? Given the privacy posture the rest of this plan takes, gating a lock behind payment would sit oddly.
4. What background timeout options should be offered?
5. Is device passcode fallback mandatory, optional, or disallowed for the product's threat model?

### Resolve before Phase 4

6. Which purchase provider and product types will be used? This decision also pulls in the native-build work described under [Shared prerequisites](#shared-prerequisites).
7. **Does the trial grant AI only, or AI and sync?** AI-only avoids provisioning a database for every trial start.
8. **Store-granted or app-granted trial?** Store-granted means a card up front and store-enforced eligibility; app-granted means no card but needs server-side trial state keyed to the account.
9. **Purchase transfer rules** when one store account's purchase is claimed by a second app user — providers expose this as a configurable behaviour, and the default may not be the one you want.
10. What entitlement grace/expiry policy applies while offline, and how is `unknown` presented?

### Resolve before Phase 5

11. **How long is the post-lapse grace window,** and when is the user warned before reaping?
12. **Adoption merge rule** when a device with local data adopts a populated remote database — which records survive, and what is shown to the user.
13. **Turso topology:** database-per-user in one group, or another arrangement. Check the account's database-count and group limits against realistic paid-user numbers before Phase 5 rather than after.
14. **Token TTL and refresh cadence,** given that rotation requires closing and reopening the database.
15. **Is per-device sync participation needed,** or is the per-account switch plus per-device adoption confirmation enough? Start with the latter; add the former only if a real use case appears.
16. **May schema migrations originate from a replica,** or are they applied to the primary out of band? This is the prior question for everything in [Schema migrations across devices](#schema-migrations-across-devices).
17. **How long is backward compatibility maintained** across a staged rollout, given both versions will be live at once?

### Resolve before Phase 6

18. Can encryption at rest and embedded replicas coexist on this stack at all? If not, is encryption worth giving up sync?
19. If yes: is SQLite encryption required, and what recovery guarantee is acceptable for offline-only users?

## Phase 1 delivered slice

Phase 1 now contains:

1. A resolved offline sign-out spike and retained Better Auth dependency-contract test.
2. An `@bro/app:test` Nx target using `jest-expo` and Testing Library.
3. A local-only product database connection with no build-time Turso credential path.
4. `bro-device.db`, separate from `bro.db`, holding installation, onboarding, app-lock, and remote-session-hint state as key-value pairs read synchronously.
5. Onboarding routes with **Start using the app** and **I already have an account**.
6. Navigation independent of auth-server state, with a retryable local-storage failure as the only fatal branch.
7. Offline-capable sign-out that clears the app-owned marker first, treats remote revocation as best-effort, and reports the outcome on a screen the marker flip does not remount.
8. Automated coverage of the startup and identity paths:
   - Root-layout routing — onboarding versus main app, the product database being opened and migrated, the storage-failure screen, and a retry that releases both handles before reopening. Migration failure lands on the same recoverable screen.
   - Local-only startup mounts no session hook and issues no request; a stored marker mounts it.
   - The app tree survives the marker flipping in both directions, and sign-out's result reaches the user whether or not revocation succeeded.
   - Sign-in records the returned user id on the device.
   - Onboarding persists completion, offers sign-in but not sign-up, makes no backend request, and never claims an account backs the user's data up.
   - Device settings run against a real SQLite engine and real files, covering first-run identity minting exactly once, every setting round-tripping through storage, cleared values being removed rather than stringified, forward-version refusal, and identity surviving a cold relaunch.
   - Database opening can retry after failure and refuses a concurrent open of a different database file.
   - Better Auth's pre-request sign-out clearing, pinned as a dependency contract.

Before calling the phase release-ready, complete the native Android/iOS acceptance pass for fresh install, cold relaunch, airplane-mode sign-out, and storage retry.

### Two spikes before committing

Both are places where the plan assumes library behaviour rather than proving it. Neither is large; both are expensive to discover late.

**Offline sign-out — resolved in Phase 1.** Better Auth's Expo client clears the stored cookie, cached session, and in-memory atom during request initialization, before it attempts server revocation. The application uses that supported `signOut()` action, clears its own session marker first, and preserves a dependency-contract test so an upstream behavior change fails visibly.

**Adoption**, ahead of Phase 5 and out of phase order. It is the only step whose feasibility rests on libSQL replica semantics rather than on application code: an embedded replica bootstraps from the remote's replication log, so promoting a populated local-only file is not obviously supported. A throwaway spike — open a replica, copy rows from a local-only file, confirm they reach the primary — de-risks the entire premium proposition for a day's work. Finding out in Phase 5 would be expensive.
