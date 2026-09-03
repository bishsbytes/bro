# Step 2: Reminders implementation plan

## Status

Implementation complete, 14 August 2026; native acceptance pending. Migration 002, the reminder repository, rolling planner and notification materialiser, settings UI, permission flow, notification-response routing, automated coverage, `expo-notifications`, and the first Android prebuild regeneration are complete. Tests, typecheck, and lint are green. Notification and reminders-screen copy — including the 24-hour text time field in place of a native picker — was signed off on 15 August 2026, closing that exit criterion. The same day closed three automated-coverage gaps: cancel-all is now asserted to run after the delete-local-data transaction, a router test proves a created reminder survives a simulated relaunch, and the planner's fall-back (duplicated wall time) case is tested alongside spring-forward. The physical Android/iOS acceptance checklist below — including step 1's carried checklist — still requires development-client builds on devices. A local Android merged-manifest check was attempted but this machine has no Android SDK; Expo's installed library manifest supplies `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`, while the committed prebuild contains the configured `reminders` default channel and no exact-alarm permission.

This is the delivery plan for [sequencing step 2 of the product domains plan](product-domains-and-data.md#sequencing): the reminders domain — a daily check-in nudge whose schedule survives a phone change but whose OS notifications belong to the install. It assumes [step 1](step-1-check-in.md) code-complete (it is) and carries the product's **first native dependency and first prebuild regeneration**, which also makes it the natural moment to run step 1's still-pending physical-device acceptance checklist: one dev-client build serves both. The [app shell and shared components plan](app-shell-and-components.md) is complete: slice 4 below builds the reminders UI from the shared components inside the settings tab's stack, not from scratch.

## Outcome

A user can create one or more reminders — pick days of the week and a time — and their phone nudges them to check in at that time, offline, with no account, and with no request to any backend. Tapping the notification opens today with the check-in ready. A day on which the user has already checked in does not nudge them — the "did they check in today?" decision the [step 1 hand-off](step-1-check-in.md#step-2-hand-off) promised is cheap is now consumed. The schedule lives in `bro.db` and will replicate when sync arrives; nothing install-specific is written anywhere that replicates.

The step is successful when the daily loop closes from the outside: set a reminder, put the phone down, get nudged, tap, check in — and when a completed check-in silences that day's nudge.

## Non-goals

- **No push or remote notifications.** Everything is a locally scheduled OS notification. No token, no server, no new carve-out in the "no backend request" acceptance rule.
- **No `bro-local.db`.** The product plan's [storage ownership table](product-domains-and-data.md#storage-ownership) assigns "scheduled notification ids, permission state" to `bro-local.db`, written on the assumption those ids must be persisted. This plan removes the need instead: notification identifiers are **deterministic** (derived from reminder id and local day), so re-materialisation is idempotent without a stored mapping, and permission state is read live from the OS, which is its only truthful source. Nothing in this step persists install-local state at all, so the third store still arrives with health import in step 5. If a later domain genuinely needs stored per-install identifiers, `bro-local.db` remains their home.
- **No reminders for anything but the check-in.** Habits (step 6) may want reminders; the table does not anticipate them — no `kind` or target column. A nullable column later is one cheap migration on a tiny table; a speculative column now is the anticipation step 1 explicitly refused elsewhere.
- **No snooze, quiet hours, or per-reminder custom text.** The notification copy is fixed and authored.
- **No logged values in notification content, ever.** The notification says *that* it is time to check in, never *what* was logged. This honours the `sensitive` notification path from product [open decision 10](product-domains-and-data.md#open-decisions) by construction rather than by filtering.
- **No multi-device semantics.** The product plan's open question — should a second device fire the same reminders? — stays open and stays recorded there. Sync does not exist yet; the split chosen here (schedule replicates, notifications re-materialise per install) makes "every device nudges" the default Phase 5 inherits, and Phase 5 must revisit it deliberately.
- **No exact alarms on Android.** A check-in nudge is drift-tolerant; a few minutes late is fine. Requesting `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` invites Play review scrutiny for no user benefit.

## Current baseline

- `packages/database/app/src/schema.ts` holds the three step-1 tables; `migrations/manifest.ts` has exactly migration 001; `product-tables.ts` is the single shared list that migration verification and `delete-local-product-data.ts` both derive from — a fourth table joins all three by touching one record.
- The repository recipe is proven three times over (`observation-repository.ts`, `day-note-repository.ts`, `tracked-metrics-repository.ts`); `ObservationRepository` can already answer "any observation for this `localDay`?" cheaply via `idx_observations_day`.
- `apps/app/src/check-in/check-in-store.ts` owns the transactional `save` — the single choke point where "the user just checked in" is known and today's nudge can be cancelled. Reconciliation recognises that state from the day's paired mood and energy observations; unrelated observations must not suppress the nudge.
- Routes are `index` (today), `history` (+ day view), `trends`, `settings`, `account`, and auth/onboarding. `app/(tabs)/settings/index.tsx` and `settings-screen.tsx` currently hold only delete-local-data; reminders becomes the screen's second section or, preferably, a child route in the existing settings stack.
- `apps/app/app.json` lists no notification plugin; `apps/app/android/` is a committed prebuild that has never been regenerated; there is no committed `ios/` (iOS builds via EAS/CNG per `eas.json`). `expo-notifications` is not installed anywhere in the workspace.
- The `@bro/app:test` suite runs the real router with jest-expo; nothing yet mocks a native notifications module.
- Step 1's native acceptance checklist (airplane-mode relaunch, day boundary, colour schemes, fifteen-second timing) is still pending physical devices.

## Decisions locked for this step

- **The schedule is rows in `bro.db`**, arriving by migration 002 under the same conventions as 001: `CREATE TABLE IF NOT EXISTS` in the shipped SQL, marker insert `ON CONFLICT DO NOTHING`, UUIDv7 ids, epoch-ms `createdAt`/`updatedAt`.
- **Reminder time is local wall clock**: `minuteOfDay` (0–1439) plus a `daysOfWeek` bitmask. No timezone is stored on the schedule because a reminder is not an event — someone who sets 21:00 wants 21:00 wherever they wake up, so travel and DST re-materialise rather than convert. The bitmask convention (bit 0 = Monday … bit 6 = Sunday, ISO week order) lives in one typed helper module with exhaustive tests; nothing else touches raw bits.
- **Several reminders are allowed** — it is a table, and the UI is a list with add, edit, enable/disable, and delete. Disabling keeps the row (`enabled = 0`); deleting hard-deletes, per the standing convention.
- **Notifications are materialised as a rolling window of one-shot, date-triggered notifications**, not OS-repeating triggers, because a repeating trigger cannot skip today once the user has checked in. The planner computes every fire time in the next **14 days** from the enabled schedule, drops occurrences already past and **drops today's occurrences only when paired mood and energy observations prove a completed check-in for today's `localDay`**, and the materialiser reconciles the OS's scheduled set against that plan. Window size is bounded by iOS's 64-pending-notification cap: the planner caps total planned notifications at 56, shrinking the horizon rather than dropping nearest-first occurrences.
- **The stated cost of the rolling window, accepted deliberately:** a user who does not open the app for 14 days stops being nudged. Re-materialisation runs on every app launch and foregrounding, so any visit — even without a check-in — extends the window. A "we miss you" escalation is a product decision for later, not a hidden extra notification now.
- **Notification identifiers are deterministic**: `checkin-reminder:<reminderId>:<localDay>`. Scheduling the same plan twice is a no-op by construction; cancellation enumerates the OS's scheduled set and removes anything bearing the prefix that the plan no longer contains. No mapping table, no store.
- **Re-materialisation triggers**: app launch, app foregrounding, reminder create/edit/enable/disable/delete, check-in save (cancels today's remaining nudges), and delete local data (which empties the schedule and must cancel everything).
- **Permission is requested at first enable, never at onboarding.** The system prompt appears when the user creates or enables their first reminder — the moment the request explains itself. Denial leaves the schedule rows intact and the screen honest: reminders shown as set-but-silenced, with copy pointing at system settings. Permission state is queried from the OS on focus, never cached, so a user who grants it in system settings is healed on next open without a code path.
- **`reminders` joins `PRODUCT_TABLE_NAMES`**, so migration verification and delete-local-data pick it up from the shared list. Delete local data additionally cancels all scheduled check-in notifications after the transaction commits — the one side effect the transaction cannot carry, sequenced after it so a failed delete never half-silences.
- **The native dependency is `expo-notifications`**, added to `apps/app/app.json` plugins, with one Android channel (`reminders`, default importance) created at startup and `POST_NOTIFICATIONS` handled by the permission flow on Android 13+. The committed `apps/app/android/` prebuild is regenerated once. Whether Phase 3's `expo-local-authentication` rides along in the same regeneration is the umbrella plan's batching call — this plan neither requires nor blocks it, but the regeneration should be a distinct commit so the batching decision stays legible.
- **Tapping the notification lands on today** (`/`). The response handler routes through the same navigation the router tests exercise; cold-start taps must land after onboarding/protection gates, not around them.
- **Notification copy is authored and fixed**: working draft — title **"bro"**, body **"Take a moment to check in."** — needs sign-off before the native build, alongside the reminders-screen copy. Small surface, but it is the product's first outbound sentence.

## Schema

One table, matching the product plan's "days, times, on or off":

```sql
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  minute_of_day INTEGER NOT NULL,
  days_of_week INTEGER NOT NULL,
  enabled INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

No index: the table is a handful of rows read in full. No unique index on `(minute_of_day, days_of_week)` — two offline devices creating the same 21:00 reminder are distinct facts that both survive; the UI may collapse exact duplicates on display, mirroring the step-1 duplicate-note stance. `enabled` is the one soft state in the product so far, and it is state, not a soft delete: a disabled reminder is a kept preference.

## User journeys and copy contract

### Set a reminder

Settings gains a **Reminders** entry (child route `settings/reminders` or a section — child route preferred; the settings screen stays a menu). Empty state offers one action: add a reminder, defaulting to every day at 20:00, editable before save. Creating or enabling the first reminder triggers the system permission prompt. The list shows each reminder as its days and time with an enable switch. **No reminder exists until the user creates one** — a fresh install nudges nobody.

### Be nudged

At the scheduled local time the phone shows the authored notification. Tapping it opens the app on today with the check-in ready. If the user checked in earlier that day, no notification fires for the rest of that day. The notification never contains logged data.

### Permission denied

The reminders screen shows the schedule with a plain banner: notifications are off for bro in system settings, and reminders will stay silent until that changes. Nothing is deleted, nothing re-prompts on a loop; the OS is re-checked whenever the screen gains focus.

### Delete local data

Unchanged copy from step 1; the action now also clears `reminders` (via the shared table list) and cancels every scheduled notification. After deletion: still signed in, still onboarded, today empty, notification tray future empty.

## Delivery slices

### Slice 1: Migration 002 and the repository

1. Add `reminders` to `schema.ts` and `PRODUCT_TABLE_NAMES`, run `db:generate`, adjust to `IF NOT EXISTS` form, commit SQL plus manifest — migration 002 exercises the multi-migration path (001 applied, 002 pending) for the first time.
2. Real-SQLite migration tests: fresh file applies 001+002; a step-1 device applies only 002; re-run is a no-op.
3. `ReminderRepository` per the recipe: list, create, update, set-enabled, delete. Tests: round-trips, `updatedAt` bumps, hard delete.
4. Delete-local-data test extended: a seeded reminder row is gone after deletion, alongside the step-1 sentinels.

### Slice 2: The planner — pure and exhaustively tested

1. `packages/logic/src/reminders/reminder-planner.ts`: `(reminders, now, todayLocalDay, todayHasCheckIn) → PlannedNotification[]` — fire times in the next 14 days, past and checked-in-today occurrences dropped, 56-notification cap by horizon shrink, deterministic ids, deterministic ordering.
2. Day-bitmask helpers with exhaustive tests (ISO order, round-trip with a `Date`'s local day-of-week).
3. Planner tests: DST spring-forward (a 02:30 reminder on the missing day), day boundary in non-UTC offsets, cap behaviour with many reminders, the checked-in-today drop, disabled reminders excluded.

### Slice 3: The materialiser and its triggers

1. Add `expo-notifications`; a thin `notification-gateway.ts` wrapping schedule/cancel/get-all/permissions so exactly one module touches the native API — and one place to verify SDK 56's actual signatures (custom `identifier` on schedule, date trigger shape, channel creation) against the docs rather than memory.
2. `reminder-materialiser.ts`: read repository → plan → diff against the OS's scheduled set by identifier prefix → schedule the missing, cancel the stale. Idempotent by construction; asserted by running it twice in tests.
3. Wire the triggers: root-layout launch and `AppState` foreground, `check-in-store.save` success, every repository mutation via the reminders screen, and delete-local-data (cancel-all after commit).
4. Jest coverage with a mocked gateway: save-day suppression end to end (check in → today's planned notification cancelled, tomorrow's kept), permission-denied materialisation is a silent no-op that touches nothing.

### Slice 4: Reminders UI

1. `settings/reminders` route and screen: list, add/edit (day toggles, time picker), enable switch, delete; permission prompt on first enable; denied-state banner; theme tokens only, both themes (token-parity test covers additions).
2. Router tests: create a reminder → relaunch → still listed; disable → materialiser called with it excluded; entire flow issues no backend request.
3. Settings screen gains the entry point above delete-local-data.

### Slice 5: Native integration and the prebuild

1. `app.json`: `expo-notifications` plugin, Android channel config; regenerate `apps/app/android/` as its own commit; verify `POST_NOTIFICATIONS` lands in the manifest.
2. Notification-response handling: warm tap and cold-start tap both land on today through the router's gates.
3. Build the dev client (this step cannot be verified in Expo Go); confirm the jest suite is unaffected by the native module's presence.

### Slice 6: Acceptance and documentation

1. Native acceptance pass, both platforms:
   - reminder fires at the set local time with the app killed;
   - tap opens today, cold and warm;
   - check in before the reminder time → no nudge that day; next day fires;
   - permission denied → silent, schedule intact; grant in system settings → heals on next open;
   - timezone change re-materialises to new wall clock;
   - delete local data → tray stays empty ever after;
   - both colour schemes.
2. **Run step 1's pending native checklist in the same session** — airplane-mode relaunch, near-midnight entry, colour schemes, fifteen-second timing — and mark both plans.
3. Update the product plan (step 2 status in sequencing; note the resolved storage-ownership deviation for notification ids) and the umbrella plan's prebuild note (first regeneration done, batching outcome recorded).

**Implementation status:** all code, generated migration/native artefacts, automated acceptance, and documentation are complete. Device-only notification delivery, killed-app timing, OS permission recovery, timezone-change behaviour, and the shared step 1 physical checklist remain pending. The first regeneration carried notifications only; Phase 3's local-authentication dependency was not batched into this product step. **Recorded deviation:** the regeneration's manifest change landed inside the main feature commit rather than the distinct commit the exit criteria call for; history was not rewritten, so the batching outcome is recorded here instead of being legible from the commit log.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts` |
| Repository | New `reminder-repository.ts` under `src/repositories/`, exported from `src/index.ts` |
| Planner and materialiser | Planner and day-bitmask helpers in `packages/logic/src/reminders/`; materialiser and notification gateway in `apps/app/src/reminders/` |
| Save hook | `apps/app/src/check-in/check-in-store.ts` |
| Delete hook | `packages/database/app/src/delete-local-product-data.ts` call site in `settings-screen.tsx` |
| Routes and screens | `apps/app/src/app/(tabs)/settings/` (menu + `reminders`), new reminders screen under `src/screens/`, root `_layout.tsx` (launch trigger, response handler) |
| Native config | `apps/app/app.json`, regenerated `apps/app/android/`, `package.json` (`expo-notifications`) |
| Theme | `apps/app/src/theme/unistyles.ts` if new tokens are needed |
| Tests | Extends `@bro/app:test` and the `@bro/database-app` real-SQLite suites |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration 002 on a step-1 file and a fresh file | Fresh applies both; step-1 device applies only 002; re-runs are no-ops. |
| Reminder round-trip | Create, edit, disable, delete persist across simulated relaunch. |
| Planner window | Exactly the next 14 days of enabled occurrences; past times excluded; deterministic ids and order. |
| Checked-in-today suppression | Today's occurrences absent when an observation exists for today's `localDay`; tomorrow's present. |
| Save hook | A check-in save triggers re-materialisation; today's scheduled notification is cancelled. |
| iOS cap | 5 daily reminders plan ≤ 56 notifications by horizon shrink, nearest occurrences kept. |
| DST and day boundary | Missing/duplicated wall-clock times resolve without crash or double-fire; non-UTC `localDay` used for suppression. |
| Idempotence | Running the materialiser twice schedules nothing new and cancels nothing live. |
| Permission denied | Materialisation is a no-op; schedule rows untouched; screen shows the banner. |
| Delete local data | Reminder rows gone, cancel-all invoked after commit; step-1 guarantees still hold. |
| No backend request | The entire reminders flow issues none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command. Native behaviour (fire timing, tap routing, permission states) is device-verified per slice 6; Expo Go cannot stand in.

## Exit criteria

- A reminder set on the device fires at the chosen local time with the app killed, offline, with no account, and tapping it lands on today.
- A day with a completed check-in does not nudge.
- Migration 002 follows the conflict-tolerance convention and the multi-migration path is proven on a real step-1 database file.
- The schedule survives relaunch and delete-local-data removes it and every scheduled notification; nothing install-specific is stored in any replicating table.
- Permission denial is survivable and self-healing; no notification ever contains logged data.
- Notification and screen copy signed off before the native build.
- The prebuild regeneration is committed separately, and the batching decision with Phase 3 is recorded either way.
- Automated suites, typecheck, lint, and the native acceptance pass — including step 1's outstanding checklist — succeed.

## Step 3 hand-off

The wheel of life (step 3) needs: migration 003 over a proven multi-migration path (this step proves it), the `assessment_id` column already waiting on `observations`, a settings surface that now has precedent for child routes, and the registry's typed catalogue pattern to extend to life areas — plus product [open decision 7](product-domains-and-data.md#open-decisions)'s area vocabulary, which step 3 cannot start without. Nothing in step 3 needs another prebuild; the dev-client workflow this step establishes is the one step 5 and Phase 3 will reuse.
