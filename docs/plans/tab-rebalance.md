# Tab rebalance implementation plan

## Status

**Draft, 20 August 2026.** The delivery plan for items 2–5 of [ia-rebalance.md](ia-rebalance.md), planned against the resolved direction: **job-based tabs — Today · Log · Insights · Life.** The [week strip](today-week-strip.md) is a separate plan and lands first; the only overlap between the two is a handful of link paths on the home screen, noted where they occur.

## Outcome

The tab bar answers the four questions a returning user actually has. *How am I doing today?* — Today, unchanged by this plan beyond link paths. *I need to log something* — Log, where Drinks, Food, and body measurements lead with today's numbers instead of hiding behind static cards. *What is my data telling me?* — Insights, one screen holding the insight feed, all trend charts, and the way into history, replacing the Mind tab and the standalone Trends screen. *Is my life pointed the right way?* — Life, which stops being three navigation cards and shows the wheel, focus areas, goals, and habit state directly, with habit and life-area management promoted out of Settings.

The step is successful when: no tab's primary action routes to another tab; every daily-loop surface (check-in, drinks, food, habits) is at most one tap from the tab bar; Settings holds only configuration; and a user who checks in daily gets prompted to review their wheel when the last sitting is stale — not only when they have never checked in at all.

## Non-goals

- **No month calendar grid.** Insights links to `/history` as it exists; the grid remains the week-strip follow-up.
- **No quick-log sheet on Today.** That was the option-B mitigation; option A puts logging one tap away on Log instead. If usage shows Today still wants it, that is a later, evidence-backed addition.
- **No store or schema changes beyond the two named** (`loadLatestWheel` on the review store; a staleness rule in logic). Everything else is screens, routes, and copy over existing stores.
- **No changes to Drinks/Food/measurement screens themselves.** They are re-homed and summarised, not redesigned.
- **No dismissal persistence for the take-stock prompt.** The staleness rule alone decides visibility; if the card annoys in practice, a dismissed-at marker in device settings is a small later addition. Sign-off item.
- **No legacy route redirects.** Verified: reminder notifications carry no route payloads, and nothing external deep-links into the app, so renamed paths break no one.

## Current baseline

Verified against source:

- Tabs are `index` (Today), `body/index`, `mind`, `life` in [(tabs)/_layout.tsx](../../apps/app/src/app/(tabs)/_layout.tsx), with `TAB_TITLES` keyed by pathname driving the shared `AppHeader`. The `(tabs)/body/index.tsx` + `app/body/[slug].tsx` split proves the pattern of a tab route coexisting with same-named stack routes — the Insights tab reuses it (`(tabs)/insights` alongside the existing `app/insights/[id].tsx`).
- Every internal reference to a moved route, from grep, excluding tests: `router.replace("/body")` in [body-metric-screen.tsx](../../apps/app/src/screens/body/body-metric-screen.tsx); `/settings/habits` pushes in home-screen (×2), life-screen, review-result-screen, settings-screen, and habits-screen's own detail push; `/settings/life-areas` in life-screen and settings-screen; `/trends` only in mind-screen, which this plan retires. Test files touching these routes: app-navigation, root-layout, tab-layout, history-flow, drinks-flow, body-flow, food-flow, habits-surfaces, review-flow.
- `trends-screen.tsx` already renders the full merged chart list (scored, body, consumption metrics) with a period picker — the Insights tab's chart half exists; the screen's four "destination cards" are the link-farm pattern this plan removes.
- `mind-screen.tsx` holds the insight feed rendering (empty / not-yet teaser / shown list via `InsightStore.load`) plus a mood/energy-only chart duplicate of Trends and a check-in CTA routing to `/`.
- `ReviewStore` ([review-store.ts](../../apps/app/src/review/review-store.ts)) has `loadOverview()` (sittings + goal progress) and `loadResult(id)` (scores, previous scores, comparisons) — everything the inline wheel needs except a "latest completed sitting" convenience. [WheelChart](../../apps/app/src/components/wheel-chart.tsx) takes `scores`/`previousScores` and is already used by the review result screen.
- `DrinksStore.loadToday()` / food's equivalent return `ConsumptionDaySnapshot` with per-metric summaries (`metrics: ConsumptionMetricSummary[]`) — the Log tab's summary rows read these; no new queries.
- The "Take stock" card on Today renders only when `!formOpen && today.entries.length === 0` ([home-screen.tsx](../../apps/app/src/screens/home/home-screen.tsx)) — the inverted trigger the review flagged.
- `HabitsStore.loadSettings()` backs the management screen at `/settings/habits` with detail at `/settings/habits/[id]`; screens are route-agnostic components, so re-homing is file moves plus path updates.

## Decisions locked for this plan

- **Tab routes are renamed, not aliased.** `(tabs)/body/` becomes `(tabs)/log.tsx`, `(tabs)/mind.tsx` becomes `(tabs)/insights.tsx`, `(tabs)/life.tsx` stays. `TAB_TITLES` follows. The body *metric detail* keeps its `/body/[slug]` path — "body" is still the right name for what those screens show; only the tab is re-jobbed.
- **Management routes move to the top level:** `/settings/habits` → `/habits` (+ `/habits/[id]`), `/settings/life-areas` → `/life-areas`. The screen components move from `screens/settings/` to `screens/habits/` and `screens/life/` respectively — they are product surfaces, and the file location should stop saying otherwise. Settings loses both rows.
- **Log leads with today's numbers.** Section order: Drinks (today's metric summaries from the existing snapshot, one tap to `/drinks`), Food (same, to `/food`), then the tracked-measurement cards and untracked toggles exactly as the current body-screen renders them. The static "Open Drinks"/"Open Food" description cards are replaced by live summary rows — the difference between a signpost and a dashboard.
- **Insights is the union of Mind and Trends, minus the duplicates.** Top to bottom: the insight feed (empty/teaser/list, unchanged rendering), the period picker and full chart list from Trends (the mood/energy-only section dies — those charts appear in the full list), and a History entry. Mind's check-in CTA dies with the tab: Today is one tap away on the tab bar, and a tab whose top action routes to another tab was finding 4 of the review. Trends' destination cards die too — Log and Life are tabs now. The `/trends` route and both old screens are deleted, not stranded.
- **Life renders state, not signposts.** Top to bottom: the latest wheel inline (`WheelChart` with previous-sitting overlay), focus areas and goal progress (from `loadOverview`), a habits summary row (active count and today's completion, from `HabitsStore.loadToday`) linking to `/habits`, and the take-stock CTA. Life-areas management links from the wheel section. Empty state: no completed sitting yet → the current "take stock of the bigger picture" framing becomes Life's hero rather than a card on Today.
- **`loadLatestWheel()` joins the review store**: latest *completed* sitting resolved through the existing `loadResult` assembly, `null` when none. No new SQL — composition over `listAll` filtering the store already does.
- **The take-stock trigger becomes a staleness rule, in logic:** `isWheelReviewDue(latestCompletedAt: number | null, now: number): boolean` — true when no completed sitting exists or the latest is over 35 days old (a month with grace, so a monthly reviewer isn't nagged on day 30). Today's card renders on this rule instead of `entries.length === 0`; Life renders its CTA prominence on the same rule. One rule, two surfaces, no stored state. The 35-day threshold is a sign-off item.
- **Icons:** Today keeps `wb-sunny`, Log takes `edit-note` (an act of recording, not a "+" that implies a composer), Insights takes `insights` (MaterialIcons has it), Life keeps `explore`. Sign-off item — cheap to change, but they should be chosen once.

## Delivery slices

Each slice lands green and shippable; the tab bar changes name only when its new content is ready.

1. **Route moves, no visual change.** `/settings/habits` → `/habits`, `/settings/life-areas` → `/life-areas`; screen files move out of `screens/settings/`; all six push-sites and the settings rows update to the new paths (settings keeps its rows this slice — they leave in slice 4). Home-screen's two links are the week-strip overlap: if the strip has landed, this is a two-line path edit on the merged file. Update the route-touching tests. *(Small; de-risks everything after it.)*
2. **Insights tab.** New `screens/insights/insights-screen.tsx` composing the insight feed and the Trends chart list + period picker; `(tabs)/mind.tsx` replaced by `(tabs)/insights.tsx`; `TAB_TITLES` and icon updated; `/trends` route, trends-screen, and mind-screen deleted. Flow tests: feed states render, period switch reloads, history entry navigates, `/insights/[id]` still opens from the feed.
3. **Log tab.** `screens/log/log-screen.tsx` from the body-screen: drinks/food summary sections (metric summaries from each `loadToday`), measurement cards unchanged below; `(tabs)/body/` replaced by `(tabs)/log.tsx`; `body-metric-screen`'s `router.replace("/body")` becomes `/log`; `TAB_TITLES` and icon updated. Flow tests: summaries render today's totals, taps land on `/drinks`, `/food`, `/body/[slug]`.
4. **Life stateful + take-stock trigger.** `loadLatestWheel` on the review store (tested: none / one / several sittings, abandoned sittings skipped); `isWheelReviewDue` in logic (tested at the boundary); life-screen rework (wheel inline, goals, habits summary, CTAs); Today's stock card re-conditioned on the staleness rule; settings drops the two moved rows. Flow tests: fresh install shows Life's empty hero and Today's prompt; a recent sitting hides both prompts; a 36-day-old sitting shows both; habit summary reflects a toggle.
5. **Sweep.** Copy pass over tab titles and eyebrows for the new vocabulary; delete dead exports; `pnpm biome check .` and the `app`, `logic` `nx` test/typecheck targets — nothing else runs them.

## Sign-off items

- Tab icons (`edit-note`, `insights`) and the name "Log" itself (vs "Track").
- The 35-day staleness threshold for the take-stock prompt, and the absence of a dismissal mechanism in v1.
- Body metric details keeping `/body/[slug]` paths under a tab now named Log.
- Mind's check-in CTA is deleted rather than moved — Today's tab-bar adjacency is the replacement.
- Settings retains drinks/food *configuration* rows (they are configuration); only habits and life-areas move.
