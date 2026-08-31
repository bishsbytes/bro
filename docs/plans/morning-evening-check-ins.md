# Morning and evening check-ins

## Status

**Landed, 31 August 2026.** Replaces the unlimited-check-ins-per-day model
with two named daily sittings — morning and evening — each anchored on Mood,
with the optional scores configurable per sitting. Supersedes the *"several
check-ins per day are allowed"* contract in
[step-1-check-in.md](step-1-check-in.md) and amends the flow described in
[check-in-flow.md](check-in-flow.md); the sync rationale behind the old
contract is preserved (see Decisions).

## The problem

A check-in today is an unnamed event: any number per day, each one a Mood
observation plus whichever optional scores were answered, reconstructed by
grouping ([check-in-store.ts](../../apps/app/src/check-in/check-in-store.ts)).
That gives the day no shape — Today's card says "check in again" without ever
saying when checking in is done, the reminder planner can only suppress *all*
of today's reminders after *any* check-in
([reminder-planner.ts](../../packages/logic/src/reminders/reminder-planner.ts)),
and the daily mean the insight engine reads
([daily-signal.ts](../../packages/logic/src/insight/daily-signal.ts)) averages
whatever ad-hoc moments the user happened to log, so no two days are sampled
alike.

## Outcome

- The day has two check-in slots: **morning** and **evening**. Today shows one
  card per slot — not started, or done with its score summary and an edit
  affordance. The "review N check-ins" list and "check in again" prompt go.
- **Mood is the core of both sittings** and stays the completion anchor. The
  four configurable scores (`energy`, `motivation`, `productivity`, `libido`)
  are each assigned to morning, evening, or both — with registry defaults and
  a per-metric override in check-in settings.
- A second save into a filled slot **rewrites that sitting** (the edit path
  that already exists), never appends.
- Each reminder belongs to a slot, and completing the morning check-in
  silences only the morning reminder.
- Tags and the day note stay day-scoped and where they are on Today. Folding
  them into the evening flow is a recorded follow-up, not part of this change.

## Decisions

- **The slot is written, never inferred.** `slot` is recorded on every
  observation the sitting writes, set by which card the user tapped. Clock
  time only decides which card Today suggests first; a check-in at 12:30 is
  whatever the user said it was. This avoids every boundary/timezone/edit
  ambiguity a derived slot would carry.
- **One-per-slot is an application invariant, not a unique index.** The
  step-1 sync rule stands: two offline devices logging the same slot must both
  survive as rows. `saveCheckIn` upserts at the store level, and reads pick a
  deterministic canonical sitting per slot (latest `updatedAt`, then id) while
  the history day view continues to show every row it holds — nothing hidden.
- **Legacy rows keep `slot = NULL` and are not backfilled.** Guessing history
  from `observedAt` would manufacture facts. Old days render as they always
  have (a plain list); only new sittings get the two-slot presentation.
- **Mood in both slots keeps insights untouched at parity.** The daily signal
  already means same-day scored rows, so morning + evening mood becomes a mean
  of two fixed samples — better comparability across days, no engine change.
  `hasCompletedCheckIn` (any Mood today) keeps its meaning for the check-in-day
  denominators and the week strip; a new `completedCheckInSlots` helper serves
  the reminder planner. Slot-qualified insights (morning-vs-evening mood) are
  a follow-up the recorded slot makes possible, not part of this change.
- **Per-slot score assignment lives on the tracked-metrics overlay.** The
  registry gains a default slot per configurable metric; a nullable
  `check_in_slots` column on `tracked_metrics` overrides it
  (`morning` / `evening` / `both`, `NULL` = registry default). `removed_at`
  still switches a metric off entirely, exactly as today. Shipped defaults:
  `energy` and `motivation` morning, `productivity` and `libido` evening —
  each metric is then sampled once per day at a consistent time, which is the
  best shape for its trend.
- **Reminders get a `slot` column, backfilled once.** Existing reminders are
  assigned by their time (`minute_of_day < 720` → morning, else evening) by a
  hand-written data migration, which only ever fills a null so a replay cannot
  overwrite a choice; a wrong guess is a one-tap fix in the reminders screen,
  which now shows and edits the sitting. The planner takes the set of completed
  slots alongside the old `anyCheckInToday` boolean: a slotted reminder is
  dropped for today when its own sitting is done, and a slotless one keeps
  being silenced by any check-in.
- **The slot is optional on the write type, required on the read type.**
  `CreateObservation.slot` defaults to null so body measurements, habits,
  imports and wheel sittings never have to declare they have no sitting, while
  every reader still sees an explicit `CheckInSlot | null`. `update` does not
  touch the column at all: an edit rewrites a value, never which sitting it was
  answered in.

## What landed

Delivered as the slices below. Slices 2 and 4 merged in practice: reshaping
`TodayCheckIn` breaks the screens that read it, so the store and its screens
had to land together to keep the tree green.

### 1. Domain and database

- `CheckInSlot` type and `completedCheckInSlots` in
  [metric-registry.ts](../../packages/domain/src/content/metric-registry.ts);
  default slot on the four configurable scored metrics;
  `CHECK_IN_METRIC_SLUGS` / `hasCompletedCheckIn` unchanged.
- [schema.ts](../../packages/database/app/src/schema.ts): nullable `slot` on
  `observations`, nullable `check_in_slots` on `tracked_metrics`, nullable
  `slot` on `reminders`, regenerated into `0002_petite_zzzax`. The reminder
  backfill is a separate hand-written migration, `0003_backfill_reminder_slots`
  (drizzle's `generate --custom`), because drizzle only emits schema diffs and
  the alternative was hand-editing generated SQL.
- [records.ts](../../packages/mobile-model/src/records.ts): the three types
  gain their fields; repositories read/write them
  ([observation-repository](../../packages/database/app/src/repositories/observation-repository.ts),
  [tracked-metrics-repository](../../packages/database/app/src/repositories/tracked-metrics-repository.ts),
  [reminder-repository](../../packages/database/app/src/repositories/reminder-repository.ts)).
- `CHECK_IN_EXPORT_FORMAT_VERSION` bumps to 2 in
  [check-in-export.ts](../../packages/logic/src/export/check-in-export.ts) —
  the new fields flow through the existing raw-row serialisation.
- Tests: the backfill assigns by time, survives a replay, and leaves a slot the
  user has since chosen alone; repository round-trips of all three columns; a
  focused export round-trip covering a slotted, an unslotted, and a re-slotted
  row (the golden fixture keeps its own scope).

### 2. Check-in store

- [check-in-store.ts](../../apps/app/src/check-in/check-in-store.ts):
  `TodayCheckIn.entries` becomes `sittings: Record<CheckInSlot, CheckInEntry | null>`
  (canonical pick as decided above) plus `slotlessEntries` for the day's
  pre-slot check-ins; `saveCheckIn(slot, scores, entry?)` writes `slot` on
  every row and rewrites whatever already fills the slot;
  `availableOptionalScores` becomes one list per slot, resolved from the
  overlay + registry default. `loadCheckInDays` is untouched (any Mood still
  marks the day). The store validates score *values*, not which slot they
  arrived in — the sitting decides what is asked, not what may be stored, which
  is how a score disabled or re-slotted after the fact keeps its rows.
- Tests: one-transaction property survives; upsert-on-second-save; per-slot
  score resolution; duplicate slot rows from a simulated merge read as one
  canonical sitting while history still lists both.

### 3. Reminders

- [reminder-planner.ts](../../packages/logic/src/reminders/reminder-planner.ts):
  `todayHasCheckIn: boolean` → `completedSlots: ReadonlySet<CheckInSlot>` plus
  `anyCheckInToday: boolean` (the slotless rows still need the old signal); a
  slotted reminder is suppressed for today when its slot is complete; a
  legacy `NULL`-slot reminder keeps today's behaviour (suppressed by any
  check-in) so an unmigrated row never nags more than it used to.
- [reminder-materialiser.ts](../../apps/app/src/reminders/reminder-materialiser.ts)
  computes the completed-slot set from today's Mood observations;
  [reminder-store.ts](../../apps/app/src/reminders/reminder-store.ts) and the
  reminders screen present each reminder under its slot.
- Tests: planner per-slot suppression matrix; materialiser wiring.

### 4. Screens

- [home-screen.tsx](../../apps/app/src/screens/home/home-screen.tsx): two slot
  cards replace the mood-faces card, the last-check-in line, and the
  review/edit list. A card opens `/check-in?slot=morning|evening`; a done card
  shows `checkInScoreSummary` and reopens the flow as an edit. Tags and note
  sections unchanged.
- [check-in-screen.tsx](../../apps/app/src/screens/check-in/check-in-screen.tsx):
  takes the slot param, titles itself with it, builds its steps from the
  slot's scores; the commit-on-leave and revisit-rewrites semantics carry
  over unchanged.
- [history-store.ts](../../apps/app/src/history/history-store.ts) /
  [history-day-screen.tsx](../../apps/app/src/screens/history/history-day-screen.tsx):
  `HistoricalCheckIn` carries its slot, the day orders morning → evening →
  slotless, and each entry is labelled with its sitting (or as pre-dating
  them). `unpairedScored` handling stays.
- [week-strip.tsx](../../apps/app/src/components/week-strip.tsx) unchanged
  (`hasCheckIn` = any). A half-filled indicator for one-of-two slots is a
  follow-up.
- i18n: new `checkIn` slot strings; retire the "again/count/review" strings.

### 5. Settings

- [check-in-settings-store.ts](../../apps/app/src/check-in/check-in-settings-store.ts)
  and [check-in-settings-screen.tsx](../../apps/app/src/screens/settings/check-in-settings-screen.tsx):
  each optional score gains a Morning / Evening / Both control next to its
  enable toggle, writing the overlay column. Mood is shown as core to both
  and not configurable.

### 6. Documentation

- Supersession notes in [step-1-check-in.md](step-1-check-in.md) and
  [check-in-flow.md](check-in-flow.md) pointing here; this doc's status
  flips to landed.

## Follow-ups recorded, not planned

- Slot-qualified insight inputs (e.g. evening mood vs morning mood, tag →
  next-morning mood) once slotted data has accumulated.
- Folding tags and the day note into the evening flow as a reflection ritual.
- Week-strip half-state for one-of-two slots.
- Distinct morning framing ("intention") beyond scores — freeform prompt or
  habit priming — which would ride on the same slot model.

## Open questions

- Are the default slot assignments right (`energy`/`motivation` morning,
  `productivity`/`libido` evening)? Shipped as above and cheap to change at any
  time: the overlay override means no migration either way, and anyone who has
  re-slotted a prompt keeps their choice.
- Should a day with only one slot completed count as a streak/check-in day
  everywhere it does today? Shipped as yes (any Mood counts), keeping every
  existing denominator stable. Worth revisiting once there is data on how often
  only one sitting gets answered.
