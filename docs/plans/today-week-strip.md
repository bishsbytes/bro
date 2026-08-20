# Today week strip implementation plan

## Status

**Implemented, 20 August 2026.** Follows the information-architecture review of the tab structure. This is the first IA change from that review — the highest-leverage one — and is deliberately scoped to the Today tab only. The wider tab rebalance (Insights merge, Life made stateful, Drinks/Food promotion) is not this plan. The finished interaction incorporates hands-on feedback: a rightward swipe moves into the past, and the compact Today header shows the visible month.

## Outcome

Today gains a week strip pinned under the header: seven day cells per page, the current week shown first, with a rightward swipe moving through previous weeks. Each cell carries two indicators — whether a check-in was logged, and how the day's scheduled habits went. Tapping a past day switches the screen in place to that day: a read-only summary of what was logged, habit cards with backfill allowed, and a link into the full editing surface at `/history/[localDay]`. Tapping today returns to the live check-in state.

The step is successful when three things hold: a user can see at a glance which days this week they checked in; they can tap yesterday and mark a habit done there, and the strip's ring updates; and a late tracker sync that lifts yesterday's steps over a metric habit's target flips that day's indicator without anyone touching anything — the derived-completion model made visible.

## Non-goals

- **No month calendar grid.** The header's calendar icon and the `/history` list stay as the deep-past surface. A month grid is the natural follow-up once the strip proves the per-day summary query; it reuses the same indicators.
- **No strip on Drinks or Food.** Both already have `[localDay]` routes; generalising the strip to them is a later step once the component has settled.
- **No global selected-day state.** The selection lives in the Today screen and dies when you leave it. A cross-tab "viewing Tuesday" mode makes every other screen ambiguous.
- **No mood encoding in the strip.** A permanently visible red dot on a bad day reads as judgement. Flo colour-codes because cycle phases are neutral facts; mood scores are not. The strip encodes *presence* (did you check in) and *adherence* (habits), never valence.
- **No future days.** There is nothing to predict. Forward paging is capped at the current week; future days within it render disabled.
- **No check-in backfill.** `CheckInStore.save` stamps `observedAt` from the clock, and backdating a subjective score is a data-honesty question (an invented `observedAt` on a real `localDay`) that deserves its own decision. Past days without a check-in say so; they do not offer the form. Sign-off item below.
- **No schema change, no migration.** Every read is over existing rows; the one new repository method is a ranged `SELECT`.

## Current baseline

Verified against source, not the wiki:

- [calendar.ts](../../packages/domain/src/calendar.ts) has `localDayOf`, `shiftLocalDay` (UTC arithmetic, DST-safe), `isoWeekdayForLocalDay` (Monday is zero, matching the cadence bitmasks), `previousLocalDay`. No `weekStartOf` yet.
- `HabitsStore.loadToday(localDay = this.today())` ([habits-store.ts](../../apps/app/src/habits/habits-store.ts)) already answers "how did habits go on this day" for any day: manual completion from stored rows, metric completion derived through `metricDayValues` → `resolveMetricDay`, streaks via `deriveHabitStreak`. `toggleManual(habitId, localDay)` and `completeChallengeDay(enrolmentId, dayIndex, localDay)` are day-parameterised. The store takes injectable `now`/`timeZone`/`locale`.
- `CheckInStore.loadToday(date = this.now())` is today-only by design; `save` stamps capture time.
- `HistoryStore.loadDay(localDay)` + `assembleHistoryDay` build the full day view; [history-day-screen.tsx](../../apps/app/src/screens/history/history-day-screen.tsx) (383 lines) is the existing edit surface for past days. `HistoryStore.loadHistory()` loads `listAll()` of five tables — fine for the history list, the wrong cost shape for the strip.
- Ranged queries: `ObservationRepository.listByMetricAndDayRange(metricSlug, from, through)` and `DayNoteRepository.listBetweenDays` exist. `HabitCompletionRepository` has `listByDay`/`listByHabit`/`listAll` but no day range.
- The tab shell ([(tabs)/_layout.tsx](../../apps/app/src/app/(tabs)/_layout.tsx)) renders `AppHeader` above the `Tabs` navigator; the Today header carries the history icon. Tabs are `lazy` and stay mounted.
- Tests live flat in `apps/app/src` as `*.test.ts(x)`: real-SQLite store tests, pure-logic tests in the packages, and interaction flow tests. Domain and logic packages have their own suites.

## Decisions locked for this plan

- **Week start is a user preference; storage stays Monday-anchored.** The cadence bitmasks (`isoWeekdayForLocalDay`, Monday is bit zero), streak math, and every stored row are untouched — week start is presentation only, deciding where a strip page begins and the order day pickers render their seven days. The preference is stored as a row in `unit_preferences` under the reserved dimension `week_start` (values `monday` | `sunday` | `saturday`): it replicates when sync arrives like every other display preference, the latest-per-dimension resolver already gives it its semantics, and no migration is needed. The units store filters it out of measurement-unit resolution by the reserved name; if a second non-unit display preference ever appears, that is the moment to introduce a proper `app_preferences` KV table and migrate this one row. Default: probe `Intl.Locale` `getWeekInfo` behind a feature check (Hermes's Intl coverage is partial, so never assume it) and fall back to Monday. Surfaced on the Units settings screen, which this renames to "Units & format" in copy only.
- **Selected day is Today-screen state, and `null` means "live today".** The screen holds `selectedDay: string | null`; `null` resolves to `localDayOf(now)` at render, so a session left open across midnight follows the clock instead of pinning yesterday. An explicit selection — including explicitly tapping today's cell — stores the string and survives rollover until the user moves it or the screen refocuses onto a stale day (refocus with a selection equal to a day that used to be today reverts to `null`).
- **Two indicators per cell, both derived, neither stored.** Check-in presence: at least one `mood` observation on the day. Habit adherence: `completedCount / scheduledCount` over habits scheduled that day, rendered as none / partial / complete (a thin ring: empty, half-tone, full). Days before the first habit's `addedAt` simply have `scheduledCount === 0` and show no ring. No new tables; the strip is a view over the same rows Today and History already read.
- **Habit adherence reuses `HabitsStore`'s machinery, exposed as a range.** The metric-habit derivation (`metricDayValues`, `isMetricHabitComplete`, `isHabitScheduled`) is private to the store today. A new `loadAdherenceRange(fromLocalDay, throughLocalDay)` walks each active habit once across the window — the resolver functions are already built per-range, so this is composition, not new derivation logic. Duplicating that logic in a separate strip store would create the standing disagreement the derived model exists to prevent.
- **Check-in presence comes from a matching `CheckInStore` range method**, `loadCheckInDays(fromLocalDay, throughLocalDay): Promise<Set<string>>`, one call to `listByMetricAndDayRange("mood", …)`. The home screen composes both into the indicator map — it already composes these two stores.
- **Past-day view is in-place, read-mostly, with habit backfill.** Selecting a past day renders: the day's check-ins, factors, measurements, and notes as a summary (via `HistoryStore.loadDay`); the day's scheduled habit cards (via `HabitsStore.loadToday(localDay)`) with `toggleManual` live, so forgetting to tap yesterday is a two-tap fix; and an "Edit this day" push to `/history/[localDay]` for everything else — the existing 383-line edit surface is reused, not duplicated inline.
- **Challenge steps stay today-only.** Programmes advance by completion, not calendar (step 6's decision), so "the next step" has no meaning on a past day — offering it there would invite backdating a sequence whose whole model is "stamp the day it actually happened, when it happens". A user who did the step yesterday and forgot can complete it today; the step-6 model already tolerates the one-day drift. Sign-off item.
- **The strip fetches summaries per visible window, cached by day.** The home screen keeps a `Map<localDay, DayIndicator>`; the strip reports its visible week range, the screen fetches any missing days (one adherence-range call, one check-in-days call), and the cache is invalidated for the affected day on every `save`, `toggleManual`, and `completeChallengeDay` — plus wholesale on screen focus, which is when late health imports become visible. No listener machinery; focus-refresh is the existing pattern on every screen.
- **Backward paging is lazy and unbounded.** Start with the current week plus seven previous; extend on end-reached. No "first day of data" precomputation — empty weeks render empty, which is itself information.

## New surface area

### Domain (`packages/domain`)

```ts
export type WeekStartDay = "monday" | "saturday" | "sunday";

/** The week start containing this local day, for the given anchor. */
export function weekStartOf(localDay: string, weekStart: WeekStartDay): string;
// shiftLocalDay(localDay, -((isoWeekdayForLocalDay(localDay) - offsetOf(weekStart) + 7) % 7))
```

### Logic (`packages/logic`)

```ts
/** "Today", "Yesterday", or a locale-formatted weekday-and-date label. */
export function formatLocalDayLabel(localDay: string, todayLocalDay: string, locale?: string): string;
```

This also retires the raw `YYYY-MM-DD` strings on the history list and day screens — a standing paper cut this step collects while it is in the area.

### Database (`packages/database/app`)

`HabitCompletionRepository.listBetweenDays(fromLocalDay, throughLocalDay)` — same shape as `DayNoteRepository.listBetweenDays`. No migration.

### Stores (`apps/app/src`)

```ts
// units/unit-settings-store.ts
loadWeekStart(): Promise<WeekStartDay>;   // resolved row, else Intl probe, else "monday"
setWeekStart(day: WeekStartDay): Promise<void>;

// habits/habits-store.ts
export type HabitAdherenceSummaryDay = {
  localDay: string;
  scheduledCount: number;
  completedCount: number;
};
loadAdherenceRange(fromLocalDay: string, throughLocalDay: string): Promise<HabitAdherenceSummaryDay[]>;

// check-in/check-in-store.ts
loadCheckInDays(fromLocalDay: string, throughLocalDay: string): Promise<Set<string>>;
```

### Component (`apps/app/src/components/week-strip.tsx`)

```ts
export type WeekStripDayIndicator = {
  hasCheckIn: boolean;
  habitsScheduled: number;
  habitsCompleted: number;
};

export type WeekStripProps = {
  todayLocalDay: string;
  selectedDay: string; // resolved by the screen; never null here
  weekStart: WeekStartDay;
  indicators: ReadonlyMap<string, WeekStripDayIndicator>;
  onSelectDay: (localDay: string) => void;
  onVisibleRangeChange: (fromLocalDay: string, throughLocalDay: string) => void;
};
```

Internals: a horizontal, `pagingEnabled` FlatList whose items are whole weeks (arrays of seven local days built from `weekStartOf` + `shiftLocalDay`), fixed-width via `getItemLayout`, ordered current-week-first with `inverted` so the initial position needs no scroll-to-index and a rightward swipe pages into the past. Each cell: short weekday label, day number, check-in fill, adherence ring, all from theme tokens. Future days in the current week render dimmed and non-pressable. `onEndReached` extends the week list backward.

Accessibility: each cell is `accessibilityRole="button"`, `accessibilityState={{ selected, disabled }}`, with a composed label — "Monday 18 August, check-in logged, 2 of 3 habits done" — built from `formatLocalDayLabel` and the indicator. The strip itself gets `accessibilityLabel="Week of …"` per page.

### Screen integration (`apps/app/src/screens/home/home-screen.tsx`)

The strip renders above the existing `<Screen scroll>` inside a column, so it stays pinned while content scrolls. When the resolved selected day is today, the screen renders exactly what it renders now. When it is a past day, it renders a new `PastDaySection`: `formatLocalDayLabel` heading, day summary from `HistoryStore.loadDay`, habit cards from `HabitsStore.loadToday(localDay)` with the existing toggle wiring, and the "Edit this day" push. The compact header centers the visible month, with history and account actions balancing its sides.

## Delivery slices

Each slice lands green on its own; the strip is invisible until slice 4.

1. **Primitives.** `weekStartOf` in domain with tests across a DST boundary, a year boundary, and all three anchors; `formatLocalDayLabel` in logic with locale and today/yesterday cases.
   Alongside: the `week_start` preference — reserved-dimension handling in the units store (excluded from measurement resolution, with a test proving units still resolve), `loadWeekStart`/`setWeekStart`, the Intl feature-probe default, and the picker row on the Units screen. The strip consumes it in slice 4; the habit and reminder day pickers reorder in slice 5.
2. **Data.** `listBetweenDays` on the completion repository (real-SQLite test, boundary days inclusive); `loadAdherenceRange` on `HabitsStore` — tests must cover a manual habit, a metric habit whose completion flips when a backdated daily metric row is inserted (the healing case), cadence masks (unscheduled days contribute `scheduledCount` 0), and `addedAt` clamping; `loadCheckInDays` on `CheckInStore`.
3. **Component.** `week-strip.tsx` with interaction tests: renders a week, selection callback, disabled future days, indicator states, accessibility labels, paging extends backward.
4. **Screen.** Home-screen integration: selected-day state and rollover rule, indicator cache and its invalidation on save/toggle, `PastDaySection` with habit backfill. Flow tests: tap yesterday → summary appears and check-in form does not; toggle a habit on yesterday → ring updates; save a check-in today → today's dot fills; injected `now` crossing midnight reverts a stale implicit selection.
5. **Polish.** Apply `formatLocalDayLabel` to the history list and history day screen headings; reorder the habit-cadence and reminder day pickers by the week-start preference (labels only — the bitmask values they write are unchanged). Verify the whole with `pnpm biome check .` and the affected `nx` test/typecheck targets (`app`, `domain`, `logic`, `database-app`) — nothing else runs them.

## Sign-off items

- Week-start preference lives in `unit_preferences` under a reserved `week_start` dimension (vs. a new `app_preferences` table and its migration now).
- The offered anchors are Monday, Sunday, Saturday; the default is Intl-probed with a Monday fallback.
- Check-in backfill stays out; past days without a check-in show summary state only. If it comes later, it needs the `observedAt`-vs-`localDay` honesty decision made first.
- Challenge steps remain today-only from the strip.
- Adherence ring semantics: none/partial/complete, with no ring on `scheduledCount === 0` days.
- Whether the strip's arrival demotes the header history icon to a month-grid entry point in the follow-up step, retiring the flat list.
