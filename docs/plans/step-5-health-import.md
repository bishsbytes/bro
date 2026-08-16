# Step 5: Health import implementation plan

## Status

**In progress, 16 August 2026.** Slice 1's storage core is implemented: migration 005 and deterministic daily rollups, the independent `bro-local.db` manifest, repositories, startup migration, and two-store deletion. Native backup exclusion remains with the native/prebuild work. Sign-off gates before their slices complete: canonical units and local-day attribution for the imported metrics (slice 2); the v1 metric set, precedence rule, backfill depth, and raw retention window (slice 2); the platform library verification on real builds (slice 3 entry); and the connect-screen copy plus store-compliance strings (slice 3). Written to be corrected — the store split and pipeline shape follow the product plan; the field-level specifics are a starting position.

This is the delivery plan for [sequencing step 5 of the product domains plan](product-domains-and-data.md#sequencing): health-tracker import — the first objective signal, the third store, and the step that makes the [three-store split](product-domains-and-data.md#three-stores-not-two) real. It is the biggest accelerator of time-to-first-insight the roadmap has: backfill on connect means the correlation pool is part-full on the day mood logging starts. It is also the step sync must not land before, or the raw-versus-rolled-up boundary gets retrofitted under a running replica. It consumes step 4's hand-off whole: canonical units already decided for mass, length, and fraction; the `dimension` concept typed into the registry; aggregation `"last"` proven; and a Body view ready to show imported series beside user-entered ones.

## Outcome

A user connects Apple Health or Health Connect once, grants what they choose, and the app imports their recent history — sleep, steps, resting heart rate, and weight — offline from any backend of ours, into series that render beside everything they typed by hand. Trends can answer "how did I sleep the week my energy dipped" from data the user never logged. A weigh-in from a smart scale lands in the same weight series the Body view charts, in the user's preferred unit, without a duplicate and without moving anything they entered. Disconnecting stops imports; deleting local data removes every imported row. No request to our backend, ever — the import is a conversation between the app and the phone's own health platform.

The step is successful when a fresh connect on a phone with months of platform history produces, within one foreground session, daily sleep/steps/heart-rate/weight series that survive a re-import unchanged (idempotence), survive a second device computing the same days (deterministic ids), and survive the user's phone losing the raw samples (rollups in `bro.db` are the record).

## Non-goals

- **No workouts, no HRV.** Workouts are not scalars — they get real tables when a journey needs them. HRV is one registry entry and one mapping when it earns a screen; nothing here blocks it.
- **No intraday detail on any screen** ([open decision 14](product-domains-and-data.md#open-decisions) answered "not yet"). The insight layer reads days. Raw samples exist to be rolled up and re-rolled up, not rendered; any future intraday journey is device-local by design and must be planned knowing it.
- **No background sync.** Import runs on launch, foreground, connect, and explicit refresh. Background execution is unreliable on both platforms and nothing downstream may depend on it — this is the product plan's standing rule, not a deferral.
- **No goals on sleep or steps.** "Ten thousand steps" is a habit, and habits are step 6. Goals on resting heart rate ride the existing machinery because it lives in the Body view; goals on activity metrics arrive with the domain that gives them structure.
- **No user entry for imported-only metrics.** Sleep, steps, and resting heart rate ship `userEnterable: false` — they never appear in the check-in, exactly as step 4's non-goal promised for RHR.
- **No precedence UI.** The read side picks per the locked rule below; both rows are kept and provenance is visible. A manual "prefer this source" override is additive later if reality demands it.
- **No sync, no replication.** `daily_metrics` is designed for sync (deterministic ids, last-writer-wins) but Phase 5 remains orthogonal and later.
- **No web support for import.** The gateway reports unavailability and every import surface hides; the step-3 web shims keep the rest of the app runnable in a browser.
- **No new food or energy decisions.** Kilocalories versus kilojoules still waits for food logging.

## Current baseline

- Migrations 001–004 shipped and proven on real prior-step database files; `PRODUCT_TABLE_NAMES` drives migration verification and delete-local-data from one record.
- `observations` carries `source` and `sourceRecordId` since migration 001 — the import provenance fields have been waiting four steps.
- The registry has four kinds; `measurement` carries `dimension`, and step 4's guarded invariants prove per-kind surface isolation in both directions. The units module in `apps/app/src/units/` owns parse/convert/format with exact factors, and `unit_preferences` resolves latest-per-dimension with locale fallback.
- Aggregation `"last"` is in production in trend math; trends render registry-driven series; the Body view shows measurement history, goals, and sparklines in the preferred unit.
- Export format v3 with committed v1/v2/v3 fixtures; sensitive exclusion covers registry entries, observations, tracked rows, assessment items, and goals by slug.
- One database file exists (`bro.db`, via `connection.ts`); `bro-device.db` duties are met by the key-value device-settings store; there is no `bro-local.db` and no second migration manifest.
- The committed `apps/app/android/` prebuild was regenerated once (step 2, `expo-notifications`); iOS builds via EAS/CNG with no committed `ios/`. This machine builds Android locally and iOS only through EAS.
- Steps 1 and 2 still carry pending physical-device acceptance checklists — this step's dev-client builds are the natural moment to run them.
- `uuid-v7.ts` exists; there is no UUIDv5 helper.

## Decisions locked for this step

- **Canonical units — the sign-off items, per [open decision 5](product-domains-and-data.md#open-decisions)'s per-metric rule.** Sleep duration in **seconds** (dimension `time`); steps as a **count** (dimension `count`, integers); resting heart rate in **beats per minute** (dimension `rate_bpm`). None of the three needs a unit preference at v1: sleep formats as a compound `7 h 42 m` always, steps as a plain count, heart rate as `bpm` — like `%`, they are display formattings of their dimensions. Weight and body fat imports convert at the boundary into the step-4 canonicals (kilograms, fraction-of-one); the import boundary is a conversion into a known target, which is what step 4 existed to guarantee.
- **The v1 metric set is four slugs**: `sleep_duration` and `steps` (new, imported-only), `resting_heart_rate` (new, the step-4 deferral arriving as promised), and `weight` (existing — imports join the user's series). `body_fat` imports too where the platform holds it, at zero marginal cost. New entries are kind `measurement` with `userEnterable: false`; the check-in measurements surface filters on `userEnterable`, and the invariant that imported-only metrics never appear in any entry surface is guarded like `wheel:*`.
- **Sensitivity:** `resting_heart_rate` ships `sensitive: true` (physiological data, consistent with step 4's body metrics); `sleep_duration` and `steps` ship `sensitive: false` — the product plan's own line is that steps and libido do not deserve the same treatment. Sign-off item.
- **Three stores, as designed.** Raw samples and connection state land in a new **`bro-local.db`** — never syncs, never backed up, explicitly disposable. Daily rollups land in **`daily_metrics` in `bro.db`** (migration 005) and are what every downstream surface reads. The rollup is computed as part of import, in the same pass, never on a schedule.
- **`daily_metrics` ids are UUIDv5 over `(metricSlug, localDay, source)`** with a fixed app namespace — deterministic by construction, so two devices importing the same platform data write the same row and the duplicate compute is an idempotent last-writer-wins update. A unique index on the natural key is safe here: it collapses the same fact, not two facts.
- **Per-metric rollup rules live in the registry**, reusing the `aggregation` field ([open decision 13](product-domains-and-data.md#open-decisions)): `sum` (new) for `steps` and `sleep_duration`, `mean` for `resting_heart_rate`, `last` for `weight` and `body_fat`. One rule per metric drives both the import rollup and any trend math that ever needs it.
- **A sleep that crosses midnight belongs to the day it ended** — the wake day, which is the day the user asks "how did I sleep" about. Local-day attribution otherwise follows the sample's start in the device's zone at import time. Sign-off item alongside the canonical units.
- **Incremental import uses the platform's change API, never a timestamp** — HealthKit anchored queries, Health Connect changes API — with the anchor/token stored per `(platform, metricSlug)` in `bro-local.db`. Each batch applies additions and deletions, then **recomputes the rollup for every `localDay` the batch touched**, so late-arriving watch syncs and source-app deletions both converge.
- **Import is idempotent, keyed on `(source, sourceRecordId)`** with a unique index in `bro-local.db` — the second safe unique constraint, same rule.
- **Backfill on connect: 365 days** ([open decision 12](product-domains-and-data.md#open-decisions)'s depth). Rollups cost a few rows per day, so depth is nearly free where it matters; the raw window is bounded separately. **Raw retention: a trailing 90 days**, pruned on every import — enough to re-roll-up if an aggregation rule changes, while the platform stays the archive. Both numbers are sign-off items.
- **Precedence when user and tracker disagree on a day** (open decision 12's rule, as the product plan proposes): **imported wins at read for these objectively measured metrics; the user's row is never deleted and provenance is visible** — the day view shows where a number came from. All four v1 metrics are objective; subjective metrics have no import path, so "user wins for subjective" is vacuously true until step 8 tests it. The resolved-day rule is one pure function — merge the day's observation aggregate with the day's `daily_metrics` rows, pick by declared precedence — and every surface calls it rather than owning the choice.
- **Import triggers: connect (with backfill), app launch, app foregrounding, and an explicit refresh affordance on the connect screen.** Nothing else. Each run is: pull changes per granted metric, upsert raw, recompute touched days' rollups, prune, advance tokens — one transaction per store, tokens advanced only after the rollup write commits, so a killed app re-imports rather than losing a batch.
- **Both platforms ship behind one gateway interface; Health Connect is verified first.** The pipeline — mapping, rollup, precedence, storage — is pure TypeScript shared across platforms; each platform contributes a thin gateway (authorize, read granted set, fetch changes). Android verifies locally on this machine's toolchain against the committed prebuild; HealthKit rides an EAS dev-client build. **Candidate libraries (`react-native-health-connect`, `@kingstinct/react-native-healthkit`) must be verified against RN 0.85 with `newArchEnabled` on real builds before slice 3 commits to them** — the product plan's own gate. If HealthKit verification fails, iOS ships as an explicit fast-follow behind the same gateway with no schema change. A unified third-party wrapper was considered and rejected: the engine's non-negotiable is the platforms' change/anchor APIs with deletions, and a lowest-common-denominator health abstraction that hides the token breaks the pipeline's core mechanism — universality lives in our gateway interface, not in a dependency. If a candidate library fails verification outright, the recorded fallback is a minimal in-repo Expo Modules native module exposing only the gateway's calls for that platform — a contingency, never the plan.
- **The prebuild regeneration is its own commit**, step 2's precedent. Whether Phase 3's `expo-local-authentication` rides along is the umbrella plan's batching call — this plan neither requires nor blocks it, but the dev-client builds this step forces are the moment to clear steps 1 and 2's carried device checklists.
- **Store compliance is part of the step, not an afterthought:** the iOS `NSHealthShareUsageDescription` string, the Health Connect privacy-policy declaration and Play console health-apps declaration, and the honest sentence on the privacy screen. Copy sign-off before the native build, like step 2's notification copy.
- **Connections are per-install by definition** — authorization is between this install and this phone's platform. Disconnecting deletes the connection rows and stops imports; it does not delete imported data (that is what delete-local-data is for) and cannot revoke the OS-level grant (the copy points at platform settings, honestly).
- **Delete local data clears both files**: every `PRODUCT_TABLE_NAMES` table in `bro.db` (which `daily_metrics` joins) and every table in a new `LOCAL_TABLE_NAMES` in `bro-local.db`, each store in its own transaction. The unchanged copy's promise — "removes everything" — now spans two files.
- **`bro-local.db` is excluded from platform backup from day one**: Android Auto Backup exclusion rules in the committed prebuild, `NSURLIsExcludedFromBackupKey` on iOS. Disposable means disposable.
- **Export bumps to format v4**, adding a `dailyMetrics` section — the export stores what `bro.db` stores, and raw samples are explicitly not part of a user's durable record. Sensitive exclusion covers `dailyMetrics` rows by slug. v1–v3 fixtures keep parsing.

## Schema

Migration 005 in `bro.db`, standing conventions (`IF NOT EXISTS`, epoch-ms timestamps; the id is UUIDv5, not v7 — determinism is the point):

```sql
CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY,            -- UUIDv5 over (metric_slug, local_day, source)
  metric_slug TEXT NOT NULL,
  local_day TEXT NOT NULL,        -- YYYY-MM-DD
  value REAL NOT NULL,            -- canonical units, aggregated per the registry rule
  source TEXT NOT NULL,           -- 'healthkit' | 'health_connect' | future
  computed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_natural
  ON daily_metrics (metric_slug, local_day, source);
```

`bro-local.db`, new file, own manifest, migration L001:

```sql
CREATE TABLE IF NOT EXISTS health_connections (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,         -- 'healthkit' | 'health_connect'
  metric_slug TEXT NOT NULL,
  change_token TEXT,              -- platform anchor/changes token; null before first import
  connected_at INTEGER NOT NULL,
  last_imported_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_samples (
  id TEXT PRIMARY KEY,
  metric_slug TEXT NOT NULL,
  value REAL NOT NULL,            -- canonical units, converted at the boundary
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  local_day TEXT NOT NULL,        -- attribution rule applied at import
  source TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  imported_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_samples_identity
  ON raw_samples (source, source_record_id);
CREATE INDEX IF NOT EXISTS idx_raw_samples_metric_day
  ON raw_samples (metric_slug, local_day);
```

## User journeys and copy contract

### Connect

`settings/health`, the child-route precedent: what will be imported and why, one connect action per available platform, the OS grant sheet, then a visible backfill ("Importing your history…") that survives being backgrounded because the next foreground resumes it. Granted metrics listed with their last-imported time and a refresh affordance. All copy — including the OS usage strings, which ship in the binary — is signed off before the native build.

### See it beside what you typed

Sleep, steps, and heart-rate series appear in Trends once data exists — connection is the opt-in; no overlay row needed. Imported weight lands in the existing Body series: the chart, latest value, and any active goal read the resolved series, in the preferred unit, exactly as if the user had typed it. Resting heart rate joins the Body view read-only — history and trend, no entry field. The history day view labels imported values with their source; a day where a smart scale and a typed entry disagree shows both, resolved per the precedence rule.

### Disconnect, and delete

Disconnect stops imports and clears tokens; copy states plainly that already-imported data stays and that the OS grant is revoked in the platform's own settings. Delete local data keeps its reserved copy and now empties both files; re-connecting later is a fresh backfill.

## Delivery slices

### Slice 1: The third store and migration 005

1. `bro-local.db`: connection factory, its own migration manifest and migrator run, backup exclusion on both platforms, `LOCAL_TABLE_NAMES`, and real-SQLite migration tests (fresh file; re-run no-op).
2. Migration 005: `daily_metrics` plus the UUIDv5 helper (fixed namespace, exhaustive determinism tests); `PRODUCT_TABLE_NAMES` gains the table; fresh and step-4 database files prove the migration path; delete-local-data extended across both stores with sentinel rows.
3. Repositories per the recipe: `DailyMetricRepository` (deterministic upsert, list-by-metric), `HealthConnectionRepository`, `RawSampleRepository` (idempotent upsert, delete-by-source-record, prune).

### Slice 2: Registry, mapping, and rollup math — the sign-off gate

1. Registry entries for `sleep_duration`, `steps`, `resting_heart_rate` (`userEnterable: false`); dimensions `time`, `count`, `rate_bpm` with display formatting (compound `h m`, count, `bpm`) in the units module; aggregation `"sum"`. Regression tests: check-in, scored, factor, and assessment surfaces provably ignore imported-only metrics; `wheel:*`-style invariants.
2. Pure import math in `apps/app/src/health/`: platform-sample → canonical mapping (unit conversion at the boundary), local-day attribution including the sleep-crosses-midnight rule and DST days, per-metric rollup (`sum`/`mean`/`last`), touched-day recompute over additions and deletions, and the resolved-day precedence merge. No database, no React, exhaustively tested.
3. **Sign-off gate: canonical units, attribution rule, v1 metric set, sensitivity flags, precedence, backfill depth, and retention window.**

### Slice 3: Gateways, the import engine, and the native build

1. Library verification spike on real builds (Android local, iOS EAS dev-client) against RN 0.85 `newArchEnabled` — the slice's entry gate, its result recorded in this document.
2. The platform gateway interface and both implementations; the import engine (connect/backfill, changes-since-token, transactional apply-and-rollup, token advance after commit, prune); triggers on launch, foreground, connect, refresh. Web and unsupported platforms report unavailability.
3. Prebuild regeneration as its own commit; usage strings and store declarations; steps 1 and 2's carried physical-device checklists scheduled onto these builds.

### Slice 4: Read-side merge and surfaces

1. The resolved-series function wired into Trends (imported series appear per granted metric), the Body view (imported weight/body-fat merged into existing series; resting heart rate added read-only), and goal progress — a goal against weight reads the resolved series in either direction.
2. `settings/health` connect screen, both themes, token parity; provenance labels in the history day view.
3. Isolation regressions: a user with no connection sees today's app unchanged, byte for byte.

### Slice 5: Export v4, acceptance, and the hand-off

1. Export format v4 with `dailyMetrics`, new fixture, v1–v3 fixtures still parsing, sensitive exclusion covering the new section.
2. The automated acceptance matrix below; physical-device import checks on both platforms.
3. Product plan updates (step 5 status; open decisions 11–14 resolved; the shared-prerequisites count) and the step 6 hand-off.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Stores and migrations | `packages/database/app/src/schema.ts`, new `local-schema.ts`, `product-tables.ts`, new `local-tables.ts`, `connection.ts`, new local manifest under `src/migrations/`, new `uuid-v5.ts` |
| Repositories | New `daily-metric-repository.ts`, `health-connection-repository.ts`, `raw-sample-repository.ts` |
| Import pipeline | New `apps/app/src/health/` — gateway interface, platform gateways, mapping, rollup, engine, resolved-series merge |
| Registry and units | `apps/app/src/content/metric-registry.ts`; `apps/app/src/units/` (time/count/rate formatting) |
| Routes and screens | `(tabs)/settings/health`; `trends-screen`/`trends-store`; `body-store` and Body screens; history day view provenance |
| Native | `apps/app/app.json` plugins, regenerated `android/` prebuild, EAS iOS config, usage strings |
| Export | `apps/app/src/export/check-in-export.ts`, new v4 fixture |
| Tests | `@bro/app:test`, real-SQLite suites for both stores, pure-math suites in `src/health/` |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migrations | Migration 005 applies on fresh and step-4 files; `bro-local.db` L001 applies fresh; re-runs are no-ops. |
| Idempotent import | The same platform batch applied twice → identical rows in both stores; `(source, sourceRecordId)` dedupes. |
| Deterministic rollup ids | The same `(metricSlug, localDay, source)` always yields the same UUIDv5; a recompute updates in place, never duplicates. |
| Rollup rules | Steps sum; sleep sums across a midnight-crossing session onto the wake day; RHR means; weight takes the day's last; deletions recompute touched days, including to removal. |
| Canonical conversion | A platform sample in pounds/minutes/percent lands canonical; renders through the step-4 preference machinery unchanged. |
| Precedence | A day with a typed weight and a scale import shows the import, keeps both rows, labels provenance; no-import days show the typed value. |
| Isolation | Imported-only metrics never appear in check-in, scored, factor, or assessment surfaces; a user with no connection sees no import UI beyond the settings entry. |
| Token discipline | A failed apply leaves the token unadvanced; the retry converges to the same state. |
| Pruning | Samples older than the window are pruned; rollups for pruned days remain and still render. |
| Backfill | Connect on a seeded platform fixture yields 365 days of rollups and the trends render them. |
| Export v4 | `dailyMetrics` present; sensitive exclusion drops `resting_heart_rate` rows; v1–v3 fixtures parse; v4 round-trips. |
| Delete local data | Both stores emptied in their own transactions; tokens gone; steps 1–4 guarantees hold. |
| No backend request | Connect, backfill, import, render, disconnect — none. |

## Native acceptance checklist

Automated coverage runs against gateway fakes; these need real devices and real platform data, plus steps 1 and 2's carried checklists on the same builds:

- Grant, partial grant, and deny flows on both platforms; re-open after granting in platform settings heals without a code path.
- A real backfill on an account with months of history: duration, UI responsiveness, and a killed-app resume.
- A source-app deletion (delete a workout's sleep in the source) disappearing here after the next import.
- Day-boundary and timezone-change attribution on device.
- Backup exclusion verified (Android `adb backup` inspection / iOS file attributes).

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command. Device builds: Android dev-client locally; iOS via EAS.

## Exit criteria

- A connected user's sleep, steps, heart-rate, and weight history renders beside their typed data, canonical in storage, preferred-unit at render, with provenance visible and precedence honoured.
- Import is idempotent, incremental via platform change tokens, deletion-aware, and recomputes exactly the touched days.
- `bro-local.db` exists, is excluded from backup, prunes to its window, and its loss costs a re-import — proven by deleting it under test and re-importing to identical rollups.
- `daily_metrics` rows are deterministic-id, naturally keyed, and in the export (v4, prior fixtures parsing).
- Delete local data spans both stores; disconnect stops imports honestly.
- The check-in and every non-import surface are provably unchanged for a user who never connects.
- Store-compliance strings and connect copy signed off before the native build; library verification recorded.
- Automated suites, typecheck, and lint green; the native checklist run on both platforms.

## Step 6 hand-off

Habits and challenges (step 6) get: objective daily series (`steps`, `sleep_duration`) a habit target can read without new import work; the resolved-day merge as the one function habit completion checks should call; and the registry's `aggregation` field carrying `sum`, which habit math ("10,000 steps") reuses. What step 6 must decide before its first write: whether a habit's completion is derived from a metric series or logged explicitly (the product plan models `habitCompletions` as logged), and the challenge content vocabulary against the step 3 area slugs. Reminders' kind-less table waits for habit nudges as designed. Sync (Phase 5) may now land whenever entitlement is ready — the three-store boundary it must respect exists after this step; its first decisions are the `unit_preferences` set-versus-insert merge semantics recorded in step 4's status and the second-device reminder question recorded in step 2.
