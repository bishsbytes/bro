# Information-architecture rebalance

## Status

**Direction accepted, 20 August 2026.** The record of the IA review of the tab structure, kept so the findings outlive the conversation that produced them. The open decision below is **resolved: option A, job-based tabs.** Delivery is planned in two docs: [today-week-strip.md](today-week-strip.md) for item 1, and [tab-rebalance.md](tab-rebalance.md) for items 2–5. Option A's tab set was later rebalanced again — see [intake-body-split.md](intake-body-split.md) — without disturbing the findings here.

## The findings

Four tabs — Today / Body / Mind / Life ([(tabs)/_layout.tsx](../../../apps/app/src/app/(tabs)/_layout.tsx)) — with History behind a header icon and Trends, Drinks, Food, Review, Challenges, and habit management in stacks outside the tab bar. The problems, ranked:

1. **Today has no sense of time.** No temporal navigation on the core screen; history is a flat list of raw `YYYY-MM-DD` strings. For a product whose unit of value is patterns over days, days are never visible as a sequence. *Addressed by the week strip plan.*
2. **Life is a link farm.** [life-screen.tsx](../../../apps/app/src/screens/life/life-screen.tsx) is three static cards, two routing into `/settings/*`. A tab showing no state teaches users to skip it.
3. **High-frequency logging is buried; configuration is prominent.** Drinks and Food — logged multiple times a day — are two taps deep behind Body. Habit *management* lives under `/settings/habits`, framing a core feature as configuration. Settings has become a junk drawer of product features (habits, reminders, life-areas, drinks/food config).
4. **Mind overlaps Today and fragments the insight story.** Mind's first card routes back to `/`; insights, mood/energy charts, Trends, and History are four fragments of one job — "show me what my data says."

## The open decision everything hung on — resolved: option A

**Keep Body/Mind/Life as the tab metaphor, or move to job-based tabs.** The metaphor is elegant and matches the domain plan's framing, but it splits one job across two tabs: mood/energy charts (Mind) and weight/sleep charts (Body) are both "trends", and the insight engine's whole point is correlating *across* that boundary — the IA separates what the product's value proposition joins.

- **Option A — job-based:** Today · Log (drinks, food, measurements) · Insights (Mind + Trends + insight feed + history entry) · Life (wheel inline, habit management, goals).
- **Option B — keep the brand metaphor:** minimum viable fixes only — Life made stateful, check-in CTA off Mind, Drinks/Food quick-log surfaced on Today, Trends linked more prominently from both Body and Mind.

Option A is the recommendation from the review, and was accepted on 20 August 2026. Option B is recorded for the road not taken: it would have cost a standing tax (every cross-domain surface must pick a side) rather than a one-time migration.

## The backlog, in proposed order

1. **Today week strip** — planned and sequenced first ([today-week-strip.md](today-week-strip.md)). Ships value regardless of the tab decision and carries the `week_start` preference and date-formatting groundwork with it.
2. **Life made stateful.** Survives both options, so it need not wait on the decision. The wheel renders inline (the chart component exists — [wheel-chart.tsx](../../../apps/app/src/components/wheel-chart.tsx)), habit management and life-areas move here from Settings (routes move; screens are reused), and the tab shows real state: current focus areas, last review age, active habits count. Also collects the small fix from the review: the "Take stock" card on Today only shows before the first check-in ([home-screen.tsx](../../../apps/app/src/screens/home/home-screen.tsx)), so the most engaged users never see the review prompt — periodic review needs a periodic trigger (e.g. a card when the last sitting is over a month old), which naturally lives with this work.
3. **The tab decision, then the Insights merge.** One tab answering "what does my data say": the Mind screen's insight feed and mood/energy charts, the standalone Trends screen, and a proper entry into history (the month grid the week-strip plan names as follow-up). This is mostly consolidation of existing screens, not new capability.
4. **Logging promotion.** Under option A, Body becomes Log and Drinks/Food are its primary content rather than cards behind it; under option B, Today gains quick-log actions instead. Either way the Drinks/Food `[localDay]` screens are candidates for the generalised week strip.
5. **Settings slimming falls out of 2–4** — habits, life-areas move; drinks/food/health config, units, reminders, export, privacy remain, which is what a settings screen should hold.

## Non-goals of this doc

- No delivery detail. Slices, tests, and store changes belong to each item's own plan, written against the code as it stands when the item starts.
- No commitment to dates or to all five items. Items 3–5 should be re-litigated against real usage once the strip and a stateful Life have shipped — the review's ranking is an argument, not data.
