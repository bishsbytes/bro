# Step 3: Wheel of life and goals implementation plan

## Status

Proposed, 15 August 2026. No code has been written. Blocked on one product sign-off before slice 2: the shipped area vocabulary and the wheel scale below resolve [open decision 7](product-domains-and-data.md#open-decisions), and retro-tagging authored content later is exactly the cost that decision exists to avoid. Step 2's physical-device acceptance runs in parallel and neither blocks nor is blocked by this step — step 3 carries **no native dependency and no prebuild**.

This is the delivery plan for [sequencing step 3 of the product domains plan](product-domains-and-data.md#sequencing): the assessments domain — the wheel of life over the existing observation spine — plus goals and the authored starter challenge set that keeps a focus selection from dead-ending. It consumes what the [step 2 hand-off](step-2-reminders.md#step-3-hand-off) promised: a proven multi-migration path for migration 003, the `assessment_id` column already waiting on `observations`, the settings child-route precedent, and the registry's typed catalogue pattern to extend to life areas.

## Outcome

A user can take stock: rate satisfaction across the areas of their life on a single sitting, see the shape, compare it against the previous sitting, and pick the areas to work on. Each focus area offers a next move — a numeric goal, or one authored starter challenge to read — so the selection produces direction rather than a lonely chart. Scores are ordinary observations, so each area is a trend line for free and joins the future correlation pool. Everything works offline, with no account, and issues no backend request; all new rows live in `bro.db` and will replicate when sync arrives.

The step is successful when the review loop closes twice: a first sitting that ends in a chosen focus and a set goal, and a second sitting a month later that shows what moved.

## Non-goals

- **No validated instruments.** PHQ-9/GAD-7 arrive per product [open decisions 21–23](product-domains-and-data.md#open-decisions) once the review habit exists. But the template type carries the `locked` flag from day one — it is cheaper to build before overlay code assumes customisation applies universally, and at this step it costs one boolean nobody sets.
- **No desired scores.** Current score plus an explicit focus selection, per the product plan's recommendation (open decision 9). Desired scores later are another slug per item and no migration.
- **No custom areas.** V1 customisation is the cheap three — relabel, reorder, disable (open decision 8). Slugs are namespaced (`wheel:career`) and every resolver already handles "not in the catalogue" from step 1, so user-created areas later cost no migration.
- **No review-cadence reminder.** The "take stock monthly" prompt is the first real use of reminders beyond the daily nudge, but the `reminders` table deliberately has no `kind` column; adding one is a cheap migration when the prompt is designed, and anticipating it now is the speculation steps 1 and 2 refused.
- **No challenge enrolment or progress.** The starter set ships as authored, read-only content tagged to the area vocabulary. The tables (`challengeEnrolments`, `challengeProgress`) are step 6's; a template here is something to read and follow by hand, not something the app tracks yet.
- **No new store, no native dependency, no prebuild.** Pure TypeScript and SQL over what exists.

## Current baseline

- Migration 002 shipped and the multi-migration path is proven on a real step-1 database file; migration 003 follows a walked road.
- `observations` already carries a nullable `assessment_id` (indexed queries not needed — sittings are read by id, trends by the existing day/metric indexes).
- The metric registry (`apps/app/src/content/metric-registry.ts`) is a typed authored catalogue with `kind: "scored" | "factor"`, per-kind scale bounds, sensitivity, deprecation, and a proven "unknown slug" resolution path.
- `tracked_metrics` is the overlay pattern in production: `metricSlug`, `position`, `addedAt`/`removedAt`, driving the check-in panel through the registry.
- The settings stack has a child-route precedent (`settings/reminders`); shared components (Card, SectionHeader, EmptyState, Button, FormField, Screen) and the unistyles theme with a token-parity test cover both colour schemes.
- Export serialisation v1 covers observations, day notes, and tracked metrics with a committed fixture.
- Delete local data clears every table in `PRODUCT_TABLE_NAMES` in one transaction.

## Decisions locked for this step

- **The proposed area vocabulary — the sign-off item.** Twelve authored areas, eight active by default; the same slugs tag challenge templates now and forever. Generosity is deliberate: nothing authored can attach to an area a user invents, so every area we ship is one that can carry content later. Default-off areas exist precisely for the people they matter to — enabling one is a tap, not a custom item.

  | Slug | Default label | Default |
  | --- | --- | --- |
  | `wheel:career` | Work & career | on |
  | `wheel:money` | Money & finances | on |
  | `wheel:health` | Health & fitness | on |
  | `wheel:partner` | Partner & love | on |
  | `wheel:family` | Family | on |
  | `wheel:friends` | Friends & social | on |
  | `wheel:growth` | Learning & growth | on |
  | `wheel:fun` | Fun & recreation | on |
  | `wheel:purpose` | Purpose & direction | off |
  | `wheel:fatherhood` | Fatherhood | off |
  | `wheel:faith` | Faith & spirituality | off |
  | `wheel:sobriety` | Sobriety & recovery | off |

  The factor half of open decision 7 was settled de facto by step 1's shipped factor set; this table settles the area half. Labels are copy and need the same sign-off discipline as step 2's notification text.
- **Wheel items score 1–10.** A sitting is a deliberate, seated act, not the fifteen-second loop, and the wheel's value is its shape — ten points give the shape resolution five would flatten. Bounds are snapshotted per observation row like every scored metric, so this stays renormalisable, not sacred.
- **Wheel items are registry metrics of a new kind `"assessment"`.** Scale 1–10, aggregation `mean`, `userEnterable: false` — enterable only through a sitting, never the check-in. Every surface that reads the registry filters by kind; the check-in panel ignoring assessment metrics is a guarded, tested invariant, not an accident.
- **The overlay is `tracked_metrics`, reused.** Active areas, order, and relabels are rows with `wheel:*` slugs in the table that already does this job for the check-in panel — the catalogue-overlay pattern solved once, the same way everywhere, as the product plan demands. Migration 003 adds one nullable `custom_label` column, which gives factors and scored metrics relabelling for free the day a screen offers it.
- **The sitting is transactional and whole.** One transaction writes the `assessments` row and its N observation rows (`assessmentId` set, `source: 'user'`, bounds 1–10, `localDay`/`tzOffsetMinutes` per convention). Abandoning mid-flow writes nothing; there is no draft state. `completed_at` is nullable to match the product schema but v1 always writes it.
- **The snapshot is written at save, from what was displayed.** `items` stores slug, label as rendered (custom label if set), and position; `focus_item_slugs` stores the user's selection. A later relabel — theirs or ours — must not rewrite what a past sitting appears to say. `template_version` covers our edits; the snapshot covers everything.
- **Goals attach to metric slugs, not to sittings.** `direction`, canonical `target_value`, optional `target_date`; progress is derived by querying observations, never stored. At this step the useful targets are wheel-area scores ("Partner & love to 7 by December"); step 4's body metrics reuse the table unchanged, which is the point of shipping it now.
- **Starter challenges are authored content in the binary.** A typed `challenge-catalogue.ts` — slug, title, area tag from the vocabulary above, duration, day-by-day copy — versioned with the release, referenced by slug, one template per default-on area at minimum. No table, no migration; a copy edit is a release, not a migration.
- **`assessments` and `goals` join `PRODUCT_TABLE_NAMES`**, so migration verification and delete-local-data inherit them by construction.
- **Routes: a `review` stack outside the tabs**, pushed over them — `/review` (overview and history of sittings), `/review/new` (the sitting flow), `/review/[id]` (result and comparison). Entry points: a "Take stock" invitation on today's empty state, and an entry on the trends screen. The tab bar stays at four; a fifth tab is a shell decision this step does not take.
- **Area customisation lives at `settings/life-areas`**, following the reminders child-route precedent: reorder, enable/disable, relabel. Overlay state only; nothing historical moves.
- **Export bumps to format v2**, adding `assessments` and `goals` sections beside the existing three. The version exists exactly for this; a new fixture is committed and the v1 fixture keeps parsing.

## Schema

Migration 003, three statements under the standing conventions (`IF NOT EXISTS`, UUIDv7 ids, epoch-ms timestamps):

```sql
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  template_slug TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  items TEXT NOT NULL,            -- JSON snapshot: [{slug, label, position}] as displayed
  focus_item_slugs TEXT NOT NULL, -- JSON array of slugs
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  metric_slug TEXT NOT NULL,
  direction TEXT NOT NULL,        -- 'increase' | 'decrease'
  target_value REAL NOT NULL,
  target_date TEXT,               -- localDay, nullable
  started_at INTEGER NOT NULL,
  achieved_at INTEGER,
  abandoned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE tracked_metrics ADD COLUMN custom_label TEXT;
```

No new indexes: sittings are a handful of rows a year read in full; goals likewise. No unique constraints — two offline devices completing a sitting the same day are two real sittings, per the standing rule. The JSON columns are snapshots, not relational data; nothing joins on them.

## User journeys and copy contract

### Take stock

From today's empty state or trends: rate each active area 1–10, one screen, reorderable order respected. Finishing shows the wheel, then asks for focus: pick up to three areas to work on. Saving is one transaction; backing out saves nothing. **A fresh install has no sitting and is invited, never gated** — onboarding's "nothing to fill in first" promise holds.

### Compare

A second sitting renders against the previous one: same shape, two outlines, per-area delta. The comparison honours each sitting's own snapshot — a renamed area shows its name as it was.

### Choose what happens next

Each focus area on the result screen offers its next move: set a goal (target score, optional date), or read the starter challenge tagged to that area. A custom-labelled area still resolves content through its slug; an area with no authored challenge shows the goal path only.

### Make it yours

`settings/life-areas`: reorder, switch off "Career" the year it does not apply, relabel it "Business" the year it does, switch on Fatherhood. Overlay only; history keeps its snapshots.

### Delete local data

Unchanged copy; the action now also clears `assessments` and `goals` via the shared table list. Notification cancel behaviour is untouched.

## Delivery slices

### Slice 1: Migration 003 and the repositories

1. `assessments` and `goals` into `schema.ts` and `PRODUCT_TABLE_NAMES`; `custom_label` onto `tracked_metrics`; `db:generate`, adjust to conflict-tolerant form, commit SQL and manifest.
2. Real-SQLite migration tests: fresh file applies 001–003; a step-2 file applies only 003; re-run is a no-op; the `ALTER TABLE` is tolerant of re-application (guard or documented behaviour, proven by test).
3. `AssessmentRepository` (create-with-observations in one transaction, list, findById) and `GoalRepository` (create, achieve, abandon, list) per the recipe; `TrackedMetricsRepository` gains relabel. Delete-local-data test extended with sentinel rows for both new tables.

### Slice 2: Catalogue, vocabulary, and the registry extension

1. Area catalogue and wheel template in the typed authored pattern: the twelve areas, `templateVersion`, the `locked` flag (false for the wheel), tests pinning slug permanence.
2. Registry kind `"assessment"`: 1–10 bounds, excluded from check-in surfaces — regression tests that the factor panel and scored panel ignore `wheel:*` rows in `tracked_metrics`.
3. Overlay resolution for areas: active set, order, `custom_label` precedence, unknown-slug tolerance. **Vocabulary and label sign-off gates the end of this slice.**

### Slice 3: The sitting flow

1. `/review/new`: rate active areas in overlay order, back out safely, save transactionally — assessment row, N observations with `assessmentId`, snapshot from what was displayed.
2. `/review` overview (history of sittings, empty state inviting the first) and `/review/[id]` result: the wheel rendered from the snapshot, focus areas marked.
3. Comparison against the previous completed sitting, snapshot-faithful. Router tests: sitting → relaunch → still listed; abandon → nothing written; whole flow issues no backend request.

### Slice 4: Focus, goals, and starter content

1. Focus selection (up to three) on completion; stored on the sitting.
2. Goal creation from a focus area; goal states (active, achieved, abandoned); derived progress against the observation series shown on `/review`.
3. `challenge-catalogue.ts` with one authored template per default-on area; read-only template screen reachable from a focus area. Copy sign-off rides the vocabulary sign-off.
4. Today's empty state gains the "Take stock" invitation; trends gains the entry point.

### Slice 5: Make it yours, export, acceptance

1. `settings/life-areas`: reorder, enable/disable, relabel; token parity holds for any new tokens; both themes.
2. Export format v2: assessments and goals sections, new fixture, v1 fixture still parses.
3. Full automated acceptance matrix below; update the product plan (step 3 status, open decisions 7–9 resolved) and record the step 4 hand-off.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, `drizzle/*.sql`, `src/migrations/manifest.ts` |
| Repositories | New `assessment-repository.ts`, `goal-repository.ts`; `tracked-metrics-repository.ts` (relabel); exported from `src/index.ts` |
| Catalogue | `apps/app/src/content/` — area catalogue, wheel template, `challenge-catalogue.ts`; `metric-registry.ts` (assessment kind) |
| Routes and screens | New `apps/app/src/app/review/` stack; `(tabs)/settings/life-areas`; today empty state; trends entry point; screens under `src/screens/` |
| Export | `apps/app/src/export/check-in-export.ts`, new v2 fixture |
| Theme | `apps/app/src/theme/unistyles.ts` if the wheel rendering needs tokens |
| Tests | Extends `@bro/app:test` and the real-SQLite migration suites |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migration 003 on fresh and step-2 files | Fresh applies all three; step-2 device applies only 003; re-runs are no-ops. |
| Transactional sitting | One transaction writes the assessment and its observations; abandoning writes zero rows. |
| Snapshot integrity | Relabel after a sitting; the historical sitting renders its stored labels, the new sitting the new one. |
| Overlay | Disabled area absent from a new sitting; order respected; relabel round-trips. |
| Check-in isolation | `wheel:*` rows in `tracked_metrics` never appear in the check-in panels. |
| Comparison | Second sitting shows per-area delta against the first, from snapshots. |
| Focus and goals | Focus selection persists; goal create/achieve/abandon round-trips; progress derived, never stored. |
| Starter content | Each default-on area resolves an authored template; custom-labelled and unknown areas degrade to the goal path. |
| Unknown slug from the future | A `wheel:*` observation with an unknown slug renders raw in history and is excluded from new sittings. |
| Export v2 | New sections present; v1 fixture still parses; round-trip test on v2 fixture. |
| Delete local data | Assessment and goal rows gone; steps 1–2 guarantees still hold. |
| No backend request | The entire review, goal, and catalogue flow issues none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command. No device work is required by this step; the physical checklist it inherits is step 2's, which proceeds independently.

## Exit criteria

- A first sitting saves atomically, survives relaunch, and a second sitting renders a snapshot-faithful comparison — offline, no account, no backend request.
- The area vocabulary, labels, wheel scale, and starter-template copy are signed off before slice 2 completes; the vocabulary tags are the same slugs challenge content will use in step 6.
- Migration 003 follows the conflict-tolerance convention, including the first `ALTER TABLE`, proven on a real step-2 database file.
- Relabel, reorder, and disable never alter a stored sitting; the check-in panel is provably unaffected by area overlay rows.
- Focus areas lead somewhere: a goal or an authored template, never a dead end on a default-on area.
- Export v2 ships with fixtures; delete local data covers the new tables.
- Automated suites, typecheck, and lint are green.

## Step 4 hand-off

Body metrics and unit preferences (step 4) get: the `goals` table already shipped and waiting for weight targets, migration 004 over a now twice-proven multi-migration path, and the `settings/life-areas` precedent for a units screen. What step 4 must decide before its first write is [open decision 5](product-domains-and-data.md#open-decisions) — canonical units per dimension — because a stored value in an unknown unit is the one mistake this schema cannot absorb. Nothing in step 4 needs a prebuild; the next native work is health import (step 5) batched with Phase 3.
