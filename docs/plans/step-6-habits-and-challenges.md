# Step 6: Habits and challenges implementation plan

## Status

**Complete, 17 August 2026.** Migration 006, repositories, catalogues, derived completion and streak math, Today and settings surfaces, challenge enrolment/progress/finish flows, History integration, delete-local-data coverage, and export format v5 are delivered. The signed-off semantics below are implemented and covered by real-SQLite, pure-domain, and interaction tests. No native work or prebuild was required.

This is the delivery plan for [sequencing step 6 of the product domains plan](product-domains-and-data.md#sequencing): habits and challenges — the first structured-programme domain, and the first thing that gives a user a reason to open the app on a day they feel fine. It consumes the [step 5 hand-off](step-5-health-import.md#step-6-hand-off) whole: objective daily series (`steps`, `sleep_duration`) a habit target can read without new import work; the resolved-day merge as the one function completion checks call; and the registry's `aggregation` field already carrying `sum`. It also collects two promissory notes from earlier steps: step 3 shipped the authored challenge catalogue as read-only content and deferred enrolment and progress to here, and step 2 left the `reminders` table deliberately kind-less until habit nudges were designed.

## Outcome

A user picks a habit — ten thousand steps, seven hours of sleep, an alcohol-free day — from a shipped catalogue or writes their own, and Today shows where they stand on it: metric habits fill up as the day's data arrives, manual habits complete on a tap, and a streak accumulates over the days the habit is actually scheduled for. A user enrols in a challenge they were already shown at review time, sees today's step on Today, marks it done, and watches the programme advance to completion — the one journey in the product with a defined end. Everything works offline, with no account and no backend request; every new row lives in `bro.db` and will replicate when sync arrives.

The step is successful when both loops close: a metric habit whose completion flips retroactively when a late watch sync lifts yesterday over the target (derived truth, healing itself), and a challenge enrolled from the review flow that is completed day by day from Today and ends with a visible finish.

## Non-goals

- **No habit reminders.** The `reminders` table stays kind-less one more step. Habit nudges are real product work — per-habit times, quiet failure when a habit is already complete, interaction with cadence — and bolting them on here would be the second hard thing. The migration is one nullable column on a tiny table when the nudge is designed; the existing daily check-in reminder carries the open-the-app job meanwhile.
- **No quantified tags.** `alcohol_intake` and the `quantifies` relation ([product plan](product-domains-and-data.md#the-shape-of-the-data)) stay future. V1 negative habits are explicit manual completions — an "alcohol-free day" is a deliberate tap, never inferred from the absence of an `alcohol` tag row, because absence means "didn't log", not "didn't drink".
- **No dual-writes between habits and tags.** Completing the `training` habit does not write a `training` tag observation, and tapping the tag does not complete the habit. One tap, one row. Whether habit adherence joins the correlation pool — and how — is step 7's decision, recorded in the hand-off.
- **No custom challenges.** Custom *habits* ship (the overlay pattern demands them); challenges are authored programmes with day-by-day text, and a user-authored "challenge" is a habit with an end date. If demand appears, it is a content-tooling question, not a schema one.
- **No premium gating.** The umbrella plan gates "the challenge library beyond a starter set" behind premium, but entitlement machinery is Phase 4 and insight (step 7) is its natural introduction. The full catalogue ships free at this step; templates are in-binary content, so tagging a premium tier later is a code change, not a migration.
- **No social anything.** [Open decision 15](product-domains-and-data.md#open-decisions) is answered below, deliberately.
- **No streak gimmicks.** No freezes, repairs, or grace tokens. A streak is evidence, and the derived model already heals the one honest case (late-arriving data) for free.
- **No new metrics, no check-in changes.** Habit completions are not observations; the check-in and every step 1–5 surface are provably unchanged for a user with no habits.

## Current baseline

- Migrations 001–005 shipped and proven on real prior-step files; `PRODUCT_TABLE_NAMES` drives migration verification and delete-local-data from one record; the multi-migration path is five-times proven.
- The challenge catalogue exists ([challenge-catalogue.ts](../../packages/domain/src/content/challenge-catalogue.ts)): thirteen templates, one per `wheel:*` area, each a 3-day intro with day titles and actions, typed `challenge:<slug>` and tagged `areaSlug` — read-only by design, "a person can read one and follow it by hand". The review flow renders them at `review/challenge/[slug]`.
- The resolved-day merge from step 5 is the single function that answers "what was this metric's value on this local day" across user and imported provenance; Trends, Body, and goal progress already call it.
- The registry carries `aggregation` (`sum`, `mean`, `last`, `presence`) per metric; `steps` and `sleep_duration` are durable daily series with 365-day backfill on connect.
- `goals` proved the derived-progress pattern: stored target, progress computed by reading the series, never stored.
- `reminders.days_of_week` established the days-of-week bitmask convention this plan reuses for cadence.
- `uuid-v7.ts` serves user-originated rows; UUIDv5 exists but is for deterministic computed facts, which nothing here is.
- Export format v4 with committed v1–v4 fixtures; sensitive exclusion by slug covers registry entries, observations, tracked rows, assessment items, goals, and daily metrics.
- Steps 1, 2, and 5 carry pending physical-device checklists; this step forces no build and adds nothing to them.

## Decisions locked for this step

- **The step 5 hand-off question — derived or logged completion — is answered per habit kind.** A habit is `manual` or `metric`. **Manual habits store a completion row per tap; metric habits derive completion at read** by comparing the resolved-day series against the habit's target — the `goals` rule again: derived, never stored, or it disagrees with the series it came from. A watch sync at 11pm that lifts the day to 10,012 steps must flip that day complete retroactively, and cannot if a completion row froze the answer at 9pm. `habit_completions` therefore contains rows only for manual habits, and the product plan's sketch (completions as logged) holds for exactly the kind where logging is the fact.
- **Habits follow catalogue, overlay, snapshot.** The authored catalogue (`habit:*` slugs) ships in the binary: label, kind, linked metric, direction, default target, default cadence, area tag, sensitivity. The `habits` table is the overlay *and* the snapshot: creating a habit copies kind, `metricSlug`, `direction`, `targetValue`, and cadence onto the row, so a later catalogue retune of the default target never rewrites anyone's active habit or their history. Custom habits are namespaced `habit:custom:<uuid>` and are always `manual` — a custom metric habit needs a metric picker over series the user can reason about, and that surface is not worth its cost at v1.
- **Cadence is a days-of-week bitmask, step 2's convention.** Daily is all seven bits. Scheduled days count toward streaks and adherence; unscheduled days neither require nor break anything. "No alcohol on weeknights" is the manual `alcohol-free` habit with a Monday–Friday mask.
- **Direction mirrors `goals`:** `at_least` or `at_most` against the day's resolved value. The v1 catalogue ships only `at_least` entries (steps, sleep); the type carries both because the column exists in `goals` and diverging the vocabularies would be a standing tax. Sign-off item.
- **A scheduled day with no data on a metric habit is not done.** The alternative — treating missing data as a gap that pauses the streak — makes a disconnected tracker an eternal streak, which is vibes, not evidence. Late imports heal honest cases retroactively because completion is derived; a genuinely missing day stays honest. Sign-off item.
- **Streaks are derived, in one pure function**: walk scheduled days backward from today, count completions (stored for manual, derived for metric); an incomplete *today* does not break the streak until the day ends. No stored streak, ever.
- **Challenge programmes advance by completion, not by calendar** — a deliberate deviation from the product plan's sketch (`endsOn`, `dayIndex` against dates). Today's step is the first uncompleted day; missing a day pauses the programme rather than failing or skipping it, and completing day 4 stamps the local day it actually happened. Nothing stores `endsOn`; the finish is `completedAt`, set when the last day completes. A calendar-strict challenge ("a dry month") is representable later as a flag on the template; the v1 catalogue's programmes are sequences of actions, and an action does not expire because life happened. Sign-off item.
- **Enrolment snapshots what was shown, and only that**: template `title`, `durationDays`, and `areaSlug` onto the enrolment row. The programme text stays in the binary and is re-read by slug at render — copying day text into `bro.db` is exactly the content-replication the product plan forbids — and if a future release retires a slug, the snapshot still renders the historical card. Every slug resolver already handles "not in the catalogue".
- **One active enrolment per challenge slug; re-enrolment is a new row.** Completing or abandoning closes the enrolment (`completedAt` / `abandonedAt`, mutually exclusive); history keeps every run. No hard cap on concurrent different challenges — the review flow's up-to-three focus selection is the natural governor, and a cap would be policy without a reason.
- **Open decision 15 is answered: solo, always.** No `createdByUserId`, no sharing, no leaderboard, and no schema accommodation for one. A social layer, if the product ever wants it, is a separate server-side feature over the same authored templates — opt-in, account-required, and additive — not a retrofit of these replicating tables. Recorded in the product plan as resolved.
- **Unique indexes, per the standing safety rule:** `habit_completions (habit_id, local_day)` and `challenge_progress (enrolment_id, day_index)` both collapse the same fact, so both are safe. Enrolments get no unique index — two runs of the same challenge are two facts.
- **Sensitivity rides the catalogue.** A habit is sensitive if its catalogue entry says so (the sobriety-area habits ship `sensitive: true`, consistent with step 3 marking the area itself sensitive), if its linked metric is sensitive, or if it is custom (we cannot know what a custom habit names, so custom rows are excluded from export's sensitive-included set by default — the cautious side of the step 4 precedent). Challenge enrolments inherit sensitivity from their template's area. Sign-off item.
- **The v1 habit catalogue is generous, per the product plan's own argument** — every authored habit is one more that suggestions can later attach to. Candidate set, for sign-off alongside its copy: `habit:steps-10k` (metric `steps`, at least 10,000, daily), `habit:sleep-7h` (metric `sleep_duration`, at least 25,200 s, daily), `habit:alcohol-free` (manual, weekday default), `habit:training` (manual, 3× week default), `habit:outdoors` (manual, daily), `habit:reading` (manual, daily), `habit:meditation` (manual, daily), `habit:call-someone` (manual, weekly, `wheel:friends`), `habit:date-night` (manual, weekly, `wheel:partner`), `habit:tidy-reset` (manual, weekly, `wheel:environment`), plus one each for the remaining default-on areas so no area is bare. Defaults are suggestions; every one is editable at creation.
- **The challenge catalogue keeps its thirteen 3-day starters and gains one flagship**: a 30-day programme for `wheel:health` — the "thirty-day strength block" shape the product plan names — to prove the enrolment machinery on a programme long enough to be paused, resumed, and finished across weeks. Content sign-off item.
- **Export bumps to format v5**, adding `habits`, `habitCompletions`, `challengeEnrolments`, and `challengeProgress` sections. Sensitive exclusion applies per the sensitivity decision. v1–v4 fixtures keep parsing.
- **Delete local data grows by four tables** in `PRODUCT_TABLE_NAMES`, same transaction, same reserved copy — "removes everything" stays true.
- **Ids are UUIDv7** — every row here is a user-originated fact, not a computed one; nothing needs step 5's determinism.

## Schema

Migration 006 in `bro.db`, standing conventions (`IF NOT EXISTS`, epoch-ms timestamps, client-generated UUIDv7):

```sql
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,             -- 'habit:steps-10k' | 'habit:custom:<uuid>'
  custom_label TEXT,              -- user's label; null = catalogue label at render
  kind TEXT NOT NULL,             -- 'manual' | 'metric', snapshotted from catalogue
  metric_slug TEXT,               -- null for manual habits
  direction TEXT,                 -- 'at_least' | 'at_most'; null for manual
  target_value REAL,              -- canonical units; null for manual
  days_of_week INTEGER NOT NULL,  -- bitmask, reminders convention
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  removed_at INTEGER,             -- soft-removed keeps history renderable
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  local_day TEXT NOT NULL,        -- YYYY-MM-DD, computed where written
  completed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_completions_natural
  ON habit_completions (habit_id, local_day);

CREATE TABLE IF NOT EXISTS challenge_enrolments (
  id TEXT PRIMARY KEY,
  challenge_slug TEXT NOT NULL,
  title TEXT NOT NULL,            -- snapshot of what was shown
  duration_days INTEGER NOT NULL, -- snapshot
  area_slug TEXT NOT NULL,        -- snapshot
  started_on TEXT NOT NULL,       -- local day of enrolment
  completed_at INTEGER,
  abandoned_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  id TEXT PRIMARY KEY,
  enrolment_id TEXT NOT NULL,
  day_index INTEGER NOT NULL,     -- 1-based programme day
  local_day TEXT NOT NULL,        -- the day it was actually done
  completed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_progress_natural
  ON challenge_progress (enrolment_id, day_index);
```

`removed_at` on `habits` follows the `tracked_metrics` precedent: removing a habit ends it without orphaning its completions; delete-local-data remains the only hard delete.

## User journeys and copy contract

### Pick a habit

`settings/habits` (child-route precedent) and an entry point from Today's empty state: the catalogue grouped by life area, respecting the user's area overlay (a disabled area's habits sit under "More"), plus "Add your own". Creating from the catalogue pre-fills target and cadence, both editable before save. Active habits reorder, relabel, edit cadence and target, and remove — the step 3 settings pattern.

### See where you stand

Today gains a habits block for scheduled habits: metric habits show live progress ("7,432 / 10,000 steps") read from the resolved series; manual habits are a tap, and a second tap within the day undoes (deletes the row — hard deletes, no tombstones). Each shows its current streak once it is more than zero. On days a habit is not scheduled, it does not appear. A user with no habits sees Today unchanged except the entry point.

### Run a challenge

The review flow's challenge screen — currently read-only — gains **Start this challenge**. Enrolled challenges surface on Today as a card: programme day, title, action, mark done. Completing the final day is the finish moment: a completion state naming what was done, and (per the product plan) the natural future slot for a review prompt or premium offer — this step ships only the finish state. Abandoning is available from the challenge detail, states plainly that the run's history is kept, and offers re-enrolment later.

### Look back

The history day view lists that day's manual completions and any challenge steps done, alongside the existing observations and notes. Habit adherence over time as a rendered surface waits for step 7's insight work; the streak on Today is this step's only aggregate display.

## Delivery slices

### Slice 1: Migration 006 and repositories

1. Migration 006; `PRODUCT_TABLE_NAMES` gains four tables; fresh and step-5 database files prove the path; delete-local-data extended with sentinel rows.
2. Repositories per the recipe: `HabitRepository`, `HabitCompletionRepository` (idempotent complete/uncomplete on the natural key), `ChallengeEnrolmentRepository` (single-active-per-slug enforced in the repository), `ChallengeProgressRepository`.
3. Real-SQLite suites for all four; migration re-run is a no-op.

### Slice 2: Catalogue and pure domain math — the sign-off gate

1. The authored habit catalogue with types, area tags, defaults, and sensitivity; the flagship 30-day challenge; catalogue invariant tests (slugs stable and namespaced, metric habits reference registry metrics that exist and are objective, sensitive flags consistent with area sensitivity).
2. Pure domain math in `packages/logic/src/habits/`: scheduled-day expansion from a bitmask, derived metric completion over resolved-day values, streak walk with the today rule, challenge position (first uncompleted day) and finish detection. No database, no React, exhaustively tested — including DST days and the midnight boundary.
3. **Sign-off gate: completion semantics per kind, no-data rule, direction set, cadence model, programme-advance rule, sensitivity mapping, and both catalogues' contents and copy.**

### Slice 3: Stores and surfaces

1. `habits-store` and enrolment state over the repositories and resolved-series read; Today's habits block and challenge card; tap/undo; streaks.
2. `settings/habits` (create, edit, reorder, remove, custom habits); **Start this challenge** on the existing challenge screen; challenge detail with progress, abandon, and finish states; both themes, token parity.
3. History day view additions; isolation regressions — no habits and no enrolments means every prior surface is byte-for-byte unchanged.

### Slice 4: Export v5, acceptance, and the hand-off

1. Export format v5 with the four sections, new fixture, v1–v4 fixtures still parsing, sensitive exclusion per the locked decision.
2. The automated acceptance matrix below.
3. Product plan updates (step 6 status; open decision 15 resolved; the challenges-social answer recorded) and the step 7 hand-off.

**Delivered 17 August 2026.** Export v5 retains parent rows for every included completion/progress row, excludes catalogue-sensitive, metric-sensitive, custom-habit, and sensitive-area challenge data on request, and preserves v1–v4 parsing. The acceptance matrix is covered across migration, repository, pure-domain, store, export, deletion, navigation, and surface suites. The product plan now records challenges as solo-only and marks step 6 complete.

## Expected touchpoints

| Area | Existing or planned files |
| --- | --- |
| Schema and migration | `packages/database/app/src/schema.ts`, `product-tables.ts`, `migrations/manifest.ts`, generated SQL |
| Repositories | New `habit-repository.ts`, `habit-completion-repository.ts`, `challenge-enrolment-repository.ts`, `challenge-progress-repository.ts` |
| Catalogue | `packages/domain/src/content/habit-catalogue.ts` (new), `challenge-catalogue.ts` (flagship template) |
| Domain math | New `packages/logic/src/habits/` — cadence, derived completion, streaks, challenge position |
| Routes and screens | Today (`home-screen`), `(tabs)/settings/habits`, `review/challenge/[slug]` (enrol), challenge detail, history day view |
| Export | `packages/logic/src/export/check-in-export.ts`, new v5 fixture |
| Tests | `@bro/app:test` — real-SQLite repository suites, pure-math suites, flow tests |

## Automated acceptance matrix

| Case | Expected result |
| --- | --- |
| Migrations | Migration 006 applies on fresh and step-5 files; re-runs are no-ops. |
| Manual completion | Tap writes one row; the natural key dedupes a double tap; undo deletes; the streak reflects both. |
| Derived completion | A metric habit's day flips complete when the resolved series crosses the target — including retroactively, when a late import updates yesterday; no completion row is ever written for a metric habit. |
| No-data rule | A scheduled day with no resolved value is not complete; a later import for that day heals the streak. |
| Cadence | Unscheduled days neither require completion nor break streaks; the weekday-mask habit ignores weekends. |
| Streaks | Derived only; incomplete today does not break until the day ends; DST and midnight boundaries attribute correctly. |
| Snapshot | Retuning a catalogue default target changes no existing habit row; a retired challenge slug still renders enrolment history from the snapshot. |
| Challenge advance | Today's step is the first uncompleted day; a missed calendar day pauses rather than skips; completing the last day sets `completedAt`; abandonment closes the run and permits re-enrolment as a new row. |
| Single active enrolment | A second enrolment on an open slug is rejected; after completion or abandonment it succeeds. |
| Isolation | No habits, no enrolments → check-in, Trends, Body, History, and settings surfaces provably unchanged. |
| Export v5 | Four sections present; sensitive exclusion drops sobriety-tagged and custom rows; v1–v4 fixtures parse; v5 round-trips. |
| Delete local data | All four tables emptied in the same transaction; steps 1–5 guarantees hold. |
| No backend request | Create, complete, enrol, progress, finish, export — none. |

## Verification commands

```bash
pnpm nx run @bro/database-app:db:generate
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app @bro/database-app --skipNxCache
```

Preserve the complete output of a failing command. No device builds are forced by this step; steps 1, 2, and 5's carried physical checklists remain external.

## Exit criteria

- A metric habit and a manual habit both show truthful state on Today, streaks derive correctly across cadence and late data, and nothing is ever stored that a series could contradict.
- A challenge enrols from the review flow, advances by completion from Today, survives missed days, finishes, and its history survives catalogue drift via snapshots.
- Custom habits work end to end and are export-excluded as sensitive by default.
- Export v5 ships with prior fixtures parsing; delete-local-data spans the four new tables.
- Every prior surface is provably unchanged for a user who adopts nothing from this step.
- Both catalogues' contents and copy signed off before Slice 3; automated suites, typecheck, and lint green.

## Step 7 hand-off

Insight (step 7) gets: the first behavioural adherence data — manual completions as stored rows, metric adherence derivable from the same resolved-day function it will already be reading — and the finished-challenge moment as the roadmap's designated premium introduction point. What step 7 must decide before its first correlation: whether habit adherence joins the correlation pool as a first-class signal (and if so, how derived metric-habit adherence is represented beside stored manual completions), the minimum-data gates for showing an insight at all, and the premium boundary (umbrella decision: which insights are free teasers and which are gated). Step 7's adherence data should also answer a cadence question this step deferred: the days-of-week mask cannot express "N times a week", so a flexible-frequency habit like `habit:training` (Mon/Wed/Fri default) breaks its streak on a missed scheduled day even when the week's volume was hit — a streak that contradicts what happened, by this plan's own evidence standard. If masked training-style habits show that pattern (scheduled-day streak breaks while weekly completion counts hold), add a weekly-count cadence then as an additive kind — `cadence_kind` plus `weekly_target` beside the existing mask, week-based streak math as its own pure function — rather than retrofitting it on intuition now; it forces new answers on week boundaries, streak currency (weeks vs days), Today's card states, and the nudge design, so it must be a designed thing, not a column. The reminders table is still kind-less; if step 7's review-cadence prompt or a habit nudge finally designs the notification, that is the one cheap migration this plan has now deferred twice, on purpose. Sync (Phase 5) remains orthogonal; nothing here adds to its decisions beyond four more ordinary replicating tables.
