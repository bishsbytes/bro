# Step 1: Check-in implementation plan

## Status

Code-complete through slices 1–6 on 14 August 2026, with automated acceptance green. The remaining exit item is the native Android/iOS acceptance pass listed in slice 6: airplane-mode relaunch, near-midnight entry, both colour schemes, and the fifteen-second timing require physical devices and are not claimed by Jest. This is the delivery plan for [sequencing step 1 of the product domains plan](product-domains-and-data.md#sequencing): the check-in domain — mood, energy, and the factor panel — plus day notes, the first per-metric trend view, delete local data, and the export serialisation design.

Umbrella [Phase 1](offline-first-identity-onboarding-premium.md#phase-1-local-first-app-entry) is complete and [Phase 2](phase-2-optional-accounts.md) is code-complete; this step assumes both and requires neither Phase 3 nor any native dependency.

## Outcome

A user who finishes onboarding can check in — tap mood, tap energy, tap the factors that apply, optionally write a note — in under fifteen seconds, see today and past days on a timeline, and see a mood and energy trend after a week. The first product tables exist in `bro.db`, carried there by the first real migration. Delete local data works, with the reserved copy from Phase 2. The export format is designed and implemented as a tested serialiser, without UI.

The step is successful when the daily loop is real: log, relaunch, see it back. Everything in it works offline, with no account, and issues no backend request.

## Non-goals

- **No assessments, goals, habits, challenges, imports, insight, or food.** Later steps; the schema must not anticipate them beyond what the observation spine already provides.
- **No correlation.** Trends are single-metric arithmetic. The factor "genuine no" rule is recorded in the product plan for step 7; nothing here computes it.
- **No custom metrics or factors.** Overlay support ships as enable/disable/reorder of the authored set (product [open decision 8](product-domains-and-data.md#open-decisions): the cheap three first). Slug namespacing and "not in the catalogue" handling are still built now, so custom items later cost no migration.
- **No reminders.** Step 2, and the first native dependency.
- **No `bro-local.db`.** The third store arrives with health import in step 5. Delete local data at this step clears product tables in `bro.db` only, written so a second store can join the same transaction pattern later.
- **No sync interaction.** But every table, id, and index follows the [conventions](product-domains-and-data.md#conventions-to-lock-in-now) so Phase 5 can replicate them unchanged.

## Current baseline

- `packages/database/app/src/schema.ts` is empty by design; `src/migrations/manifest.ts` is `[]`, so `runMigrations` has never applied DDL on a device.
- `BaseRepository` exists with `all`/`first`/`run`/`transaction` and a written recipe in `src/repositories/README.md`: Drizzle authors schema and generates migrations; runtime SQL is hand-written per domain.
- Routes are `index` (placeholder home), `account`, `sign-in`, `sign-up`, and onboarding. `HomeScreen` holds only the account entry point after Phase 2.
- `@bro/app:test` runs the real router over `src/app`; device-settings tests run against real SQLite files. Phase 2 left one deliberate placeholder: local-data continuity is asserted structurally (the `bro.db` handle survives identity transitions) *"until the first product table exists"* — this step converts that to sentinel rows.
- Phase 2 reserved the delete-local-data confirmation copy and deferred the control until a product domain gave it meaning. That condition is now met.

## Decisions locked for this step

These implement decisions the product plan has already taken; the rationale lives there.

- **Scale: 5 points** for mood and energy, bounds snapshotted per observation as `scaleMin`/`scaleMax` (1 and 5). Null for factors.
- **Several check-ins per day are allowed.** No unique index on `(metricSlug, localDay)` — two offline devices logging the same day must both survive. The day view shows every entry; the trend aggregates per the registry rule (mean for mood and energy).
- **Factors write value 1 on tap; untapping the same day hard-deletes the row.** Untapped is unrecorded, never 0.
- **The registry is a typed TypeScript module in the app**, not data: slug, label, kind (`scored` | `factor`), scale bounds, category, aggregation rule, `sensitive`, `userEnterable`, deprecation status. The v1 set: `mood` and `energy` (scored, 1–5), and a factor vocabulary of roughly a dozen (alcohol, caffeine, training, late screen, poor sleep environment, stress, social, outdoors, travel, illness, junk food, sex — draft; the shipped list is product [open decision 7](product-domains-and-data.md#open-decisions) and needs sign-off before the panel is built). No v1 metric is `sensitive`, but the flag exists and one code path (export) already honours it, so the pattern is set.
- **`trackedMetrics` materialises lazily.** No rows means "registry defaults". Rows are written only when the user deviates (disable, reorder). This avoids two devices each seeding defaults into a future synced database, and it is why "make it yours" costs nothing at rest.
- **Ids are UUIDv7** (small local generator; `expo-crypto` provides randomness). Timestamps are epoch-ms UTC with `localDay` and `tzOffsetMinutes` stored, never derived. `tzOffsetMinutes` follows the JavaScript `getTimezoneOffset()` convention (local + offset = UTC; UTC+2 stores −120) — see the [product conventions](product-domains-and-data.md#conventions-to-lock-in-now).
- **Migration 001 is conflict-tolerant end to end**: `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` in the shipped SQL (drizzle-kit's generated output is adjusted before committing — the generated file is the artefact, the generator is not sacred), and the migrator's marker insert uses `ON CONFLICT DO NOTHING`. The umbrella plan is explicit that retrofitting tolerance into migration 001 is impossible once it has run on a device.
- **Deletes are hard deletes**, including check-in edits from the day view.
- **Delete local data is `DELETE FROM` each product table in one transaction — never file deletion**, preserving `__app_migrations`, exactly per the [product plan](product-domains-and-data.md#delete-local-data). Uses Phase 2's reserved copy verbatim.

## Schema

Three tables, matching the product plan's shapes:

```sql
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  metric_slug TEXT NOT NULL,
  value REAL NOT NULL,
  scale_min REAL,
  scale_max REAL,
  observed_at INTEGER NOT NULL,
  local_day TEXT NOT NULL,
  tz_offset_minutes INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_record_id TEXT,
  assessment_id TEXT,          -- null until step 3; adding it now avoids the plan's most expensive operation later
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_observations_metric_day ON observations (metric_slug, local_day);
CREATE INDEX IF NOT EXISTS idx_observations_day ON observations (local_day);

CREATE TABLE IF NOT EXISTS day_notes (
  id TEXT PRIMARY KEY,
  local_day TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_day_notes_day ON day_notes (local_day);

CREATE TABLE IF NOT EXISTS tracked_metrics (
  id TEXT PRIMARY KEY,
  metric_slug TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at INTEGER,
  removed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

`assessment_id` is the one deliberate forward column: step 3 links wheel responses to sittings through it, and adding a column later is a migration across live devices while a null column today is free. No other future domain gets this treatment — the observation spine is the anticipation.

No unique index on `day_notes.local_day` or on `observations (metric_slug, local_day)`: both would collapse distinct facts under sync. One-per-day for notes is UI-enforced; the read path renders duplicates rather than hiding them.

## User journeys and copy contract

### Check-in

Home (`/`) becomes the today screen. Its primary state is the check-in: five mood faces, five energy levels, the factor panel grouped by category, an optional note field, one save action. After saving, today shows what was logged with an edit affordance. Multiple check-ins in a day append; the day view lists them all. The note field is always prefilled with the day's current note, so saving with the field emptied deletes that note — the field shows exactly what will be stored.

Two deliberate simplifications on the write/read path, to revisit when sync (Phase 5) can produce rows this device did not write: the today screen presents mood/energy as index-paired entries and does not render an unpaired scored row (the day view does, as `unpairedScored`); and saving a check-in reconciles the day's factor rows against the panel, which collapses duplicate same-slug factor rows for that day into one. Both preserve the per-day semantics; neither loses a fact a screen was showing.

Timing is a requirement, not an aspiration: from cold app open to saved check-in in under fifteen seconds on a mid-range device, and the automated tests assert the flow is three taps plus save with no intermediate screens.

### Look back

A history route: a list of days, newest first, each showing logged values, tapped factors, and the note. A day view allows editing — change a value, untap a factor, edit or delete the note, delete an entry. Provenance is trivially `user` for everything at this step, but the day view reads it from the row, not from an assumption.

### Trends

A trends route: mood and energy over the last 7 and 30 days, aggregated by the registry rule, gaps shown as gaps rather than interpolated. Free, per the tier table. The empty state states plainly how many days until the line means anything.

### Delete local data

In a settings context reachable from home (a minimal settings route is acceptable): the Phase 2 reserved copy — **"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere."** — with a typed-word or two-step confirmation, then `DELETE FROM` all three tables in one transaction. Device settings, onboarding state, and account session are untouched. The screen reports completion and returns to an empty today.

### Export (design only)

A versioned JSON format: metadata (format version, exported-at, app version), observations, day notes, tracked-metric overlay. Values canonical, slugs raw, labels resolved at read time by the importer — observation records snapshot no label because the catalogue data needed to interpret them ships in the file's registry section. `sensitive` metrics are included by default in a user's own export but the serialiser accepts an exclusion flag, establishing the code path decision 10 needs. Implemented as a pure function with tests; no share-sheet UI this step.

Version 1 is UTF-8 JSON with a trailing newline and this top-level shape:

```ts
{
  metadata: { formatVersion: 1, exportedAt: string, appVersion: string },
  registry: { metrics: MetricDefinition[] },
  observations: Observation[],
  dayNotes: DayNote[],
  trackedMetrics: TrackedMetric[],
}
```

`exportedAt` is ISO 8601 UTC. Rows retain database ids, timestamps, provenance, local-day/timezone fields, and scale snapshots. `tzOffsetMinutes` carries the stored value unchanged, which uses the JavaScript `getTimezoneOffset()` sign convention (UTC+2 → −120, the inverse of ISO 8601); format v1 importers must read it that way. Arrays have deterministic chronological/catalogue ordering so equivalent input produces a stable file. Sensitive exclusion removes known-sensitive registry definitions, observations, and tracked-metric overlay rows; day notes remain because the option is metric-specific, and unknown slugs remain because an older binary cannot safely classify them as sensitive or non-sensitive. The export UI must make that limitation explicit when it ships.

## Delivery slices

### Slice 1: Schema, migration 001, and the migrator's first real run

1. Add the three tables to `schema.ts`, run `db:generate`, adjust the generated SQL to `IF NOT EXISTS` form, and commit the SQL plus regenerated manifest.
2. Verify the migrator inserts markers with `ON CONFLICT DO NOTHING` and re-running `runMigrations` against an already-migrated file is a no-op; extend it if Phase 1's implementation predates the convention.
3. Real-SQLite tests: fresh file migrates; migrated file re-migrates cleanly; a device that already ran 001 and receives 001 again (simulating the replicated-marker race) neither fails nor duplicates.
4. Convert Phase 2's structural local-data assertions to sentinel rows: seed an observation and a note through the repositories, then assert sign-in, sign-out, account switch, and account deletion leave them readable.

### Slice 2: Registry and repositories

1. Add `apps/app/src/content/metric-registry.ts`: types, the v1 metrics and factors, categories, and lookup helpers that return a typed "unknown slug" result rather than throwing — the "not in the catalogue" path exists from the first resolver, per the product plan.
2. Registry invariant tests: slugs unique and permanent-format, scored metrics have sane bounds, factors have categories, aggregation rules total.
3. Add `ObservationRepository`, `DayNoteRepository`, and `TrackedMetricsRepository` per the repository recipe: create/edit/delete observation; observations by day and by metric-and-range; upsert-by-day note semantics in the repository method (not a unique index); overlay read that overlays stored rows onto registry defaults.
4. A UUIDv7 helper with tests (monotonicity within a millisecond is not required; time-ordering to the millisecond is).
5. Repository tests against real SQLite files, mirroring the device-settings suite: round-trips, day boundaries with non-UTC offsets (a 23:30 check-in belongs to the `localDay` where it was written), factor untap deleting the row, edits bumping `updatedAt`.

### Slice 3: Check-in and today

1. Replace the placeholder home content with the today screen: check-in entry, today's logged state, links to history, trends, and settings. Account entry point remains.
2. Build the check-in flow: mood, energy, factor panel from the registry filtered through `TrackedMetricsRepository`, note field writing through `DayNoteRepository`.
3. Writes are wrapped in one transaction per save.
4. Router tests: onboarding completion lands on today; a full check-in persists across a simulated relaunch; saving issues no backend request; a second check-in the same day appends.
5. Styling uses only `src/theme/unistyles.ts` tokens; add scale/face tokens to both themes if needed (token-parity test covers them).

### Slice 4: History, day view, and trends

1. History list and day view with edit and delete, hard deletes throughout.
2. Day view renders an observation whose slug the registry does not know by showing the raw slug and value — asserted in a test, because under sync a newer app version will eventually write slugs this binary has never heard of.
3. Trends screen for mood and energy, 7 and 30 days, registry-rule aggregation, explicit not-enough-data state.
4. Trend math is a pure, unit-tested function over repository rows; the screen contains no arithmetic.

### Slice 5: Delete local data

1. Settings route with the delete-local-data action, Phase 2's reserved copy, and a two-step confirmation.
2. One transaction deleting from all product tables; `__app_migrations`, `bro-device.db`, and session state untouched — asserted through the real router with the account signed in: after deletion the user is still signed in, still onboarded, and today is empty.
3. The action's implementation enumerates product tables from one shared list that migration 001 also owns, so a later table cannot be forgotten by the delete path.

### Slice 6: Export serialiser, acceptance, and documentation

1. The export serialiser and format tests: golden-file shape, version field, sensitive-exclusion flag, empty-database export.
2. Update the product plan (step 1 status) and the umbrella plan's Phase 2 note about the deferred delete-local-data control.
3. Extend the repositories README's example to point at a real repository instead of the hypothetical.
4. Native Android/iOS acceptance pass:
   - full check-in, kill, relaunch, data present — in airplane mode throughout;
   - factor untap same-day and next-day edit;
   - day-boundary check-in near midnight in a non-UTC timezone;
   - delete local data with a signed-in account: data gone, session and onboarding intact;
   - both colour schemes;
   - the fifteen-second timing on a real device.

**Implementation status:** serializer, golden/empty/sensitive tests, and documentation are complete. The native checklist above remains pending on physical Android and iOS devices.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migrations | `packages/database/app/src/schema.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts`, `src/migrator.ts` |
| Repositories | New `observation-repository.ts`, `day-note-repository.ts`, `tracked-metrics-repository.ts` under `src/repositories/`, exported from `src/index.ts` |
| Registry | New `apps/app/src/content/metric-registry.ts` |
| Routes | `apps/app/src/app/index.tsx` (today), new `history`, `trends`, `settings` routes; `_layout.tsx` |
| Screens | New check-in, today, history, day, trends, settings screens under `apps/app/src/screens/` |
| Export | New serialiser module in the app or `@bro/database-app`, tests beside it |
| Theme | `apps/app/src/theme/unistyles.ts` for any new tokens |
| Tests | Extends `@bro/app:test`; real-SQLite repository and migration suites in `@bro/database-app` |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Fresh install, onboarding, first check-in | Saved offline; no backend request; visible after relaunch. |
| Migration 001 on a fresh and an already-migrated file | Applies once; re-run is a no-op; marker race does not fail startup. |
| Two check-ins same day | Both stored; day view shows both; trend uses the registry aggregation. |
| Factor tap and same-day untap | Row written, then hard-deleted; no zero-value rows ever. |
| Scale snapshot | Every scored observation carries `scaleMin`/`scaleMax`; factors carry null. |
| Day boundary, non-UTC offset | `localDay` matches where the user was, not UTC. |
| Note upsert | One note per day through the UI path; a manufactured duplicate renders as two, hiding nothing. |
| Unknown slug in history | Renders raw slug and value; no crash, no silent omission. |
| Overlay defaults | Empty `tracked_metrics` yields the registry default panel; disabling a factor persists and survives relaunch. |
| Delete local data while signed in | Product rows gone; migrations table, device settings, session, onboarding intact. |
| Sentinel continuity | Seeded product rows survive sign-in, sign-out, account switch, and account deletion. |
| Export | Golden-file match; version present; exclusion flag honoured; empty export valid. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command.

## Exit criteria

- The daily loop works end to end, offline, with no account: check in, relaunch, see it back, see a trend after seven days of data.
- Migration 001 has run on real devices via the real migrator, is provably idempotent, and matches the conflict-tolerance convention exactly — this is the last chance to get migration 001 right.
- Every stored row follows the conventions: UUIDv7 ids, epoch-ms timestamps, `localDay` + `tzOffsetMinutes`, snapshot columns populated, hard deletes.
- Phase 2's structural continuity assertions are sentinel-row assertions.
- Delete local data ships with the reserved copy and touches nothing but product tables.
- The export format is documented and its serialiser tested.
- Registry sign-off obtained for the shipped factor vocabulary (product open decision 7) before the panel is user-visible.
- Automated suites, typecheck, lint, and the native acceptance pass succeed.

## Step 2 hand-off

Reminders (step 2) can rely on: a today screen to deep-link into, a check-in that can be completed in one visit, and `bro.db` product tables whose presence or absence for a given `localDay` is cheap to query — which is exactly what a "did they check in today?" notification decision needs. The first prebuild regeneration arrives with step 2's notification dependency; nothing in step 1 requires one.
