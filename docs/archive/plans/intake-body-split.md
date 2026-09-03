# Intake / Body split, and Insights out of the tab bar

## Status

**Landed, 2 September 2026.** Supersedes the tab set resolved in [tab-rebalance.md](tab-rebalance.md): **Journal · Intake · Body · Life**, with Insights promoted to the Journal header. Still four tabs; the change is what each one is *for*, not how many there are.

## Why

Two things were wrong with Today · Log · Insights · Life once it was in the hand:

- **Log was two mental models stapled together.** "What I put in my body today" (food, drinks) is transactional and happens several times a day. "What my body currently is" (measurements, goals, 30-day trend charts) is a state you check once a day at most. They had different rhythms and different UI shapes — day-summary rows versus metric cards with charts — sharing one scroll for no reason beyond both being things you type in.
- **Nicotine had no home in any tab.** [nicotine-logging.md](nicotine-logging.md) shipped the stream reachable only through the quick-log FAB and its own `/nicotine` stack. Nothing in the tab bar led to it. A tab that means *anything you take in* gives it an obvious place and, unlike a tab named for a substance, has room for the substance after it.

Insights lost its tab in the same pass. It is a read/browse destination visited periodically, not a daily action, and the natural moment to wonder *what do my patterns look like?* is while looking at the journal. It did not earn a permanent quarter of the tab bar.

## What landed

- **`(tabs)/intake.tsx`** — [intake-screen.tsx](../../../apps/app/src/screens/intake/intake-screen.tsx), the consumption half of the old log screen: the shared energy total, then a summary row per stream (Food, Drinks, and Smoking & vaping) reading each store's existing `loadToday()`. No new queries.
- **`(tabs)/body.tsx`** — [body-screen.tsx](../../../apps/app/src/screens/body/body-screen.tsx), the measurement half moved across unchanged: tracked cards with entry fields and trends, untracked toggles below. `body-metric-screen`'s "Back to Body" now replaces to `/body`, which finally means what it says.
- **Insights became a stack** at `app/insights/` (index + the existing `[id]` detail), reached from a chart icon in the Journal header's leading slot. The calendar icon for History moved to the header's `actions` slot beside Settings.
- **Copy** followed the structure: the `log` catalogue split into a new `intake` namespace and a measurements block on `body`.

## Decisions

- **The smoking row is conditional, like the FAB action.** `SubstanceStore.isTracked()` gates it, and the day is not even read when the stream is off. Eating and drinking are universal; smoking is not, and a standing smoking row in every man's tab bar is the product having a view about the man holding the phone. Same reasoning as the quick-log sheet, same rule.
- **"Intake" over "Log".** Once measurements left, "Log" named the act rather than the contents, and the act is no longer distinguishing — you also log a check-in, a habit, a journal note. The tab is named for what is in it.
- **History kept a header icon rather than moving into a screen.** It is the archive of journal days and belongs adjacent to the journal. Three icons on that header is the cost; burying the only route to History in Settings was the alternative.
- **`/body` as a tab route alongside `app/body/[slug]`** repeats the coexistence pattern the previous plan proved with `(tabs)/body/index.tsx`. Typed routes confirm both paths resolve.
- **No redirects for the renamed paths**, on the finding recorded in [tab-rebalance.md](tab-rebalance.md#non-goals): reminders carry no route payloads and nothing deep-links in.

## Known trade-off

Insights is the payoff for all the logging, and a header icon gets a fraction of a tab's attention. The intended compensation is an insight teaser on the Journal feed itself — `renderInsightTeaserProgress` already exists in `@bro/logic` — with the header icon as the "see all" path. Not in this change. If patterns engagement drops and the teaser does not recover it, the demotion is the thing to reconsider.

## Follow-ups

- Insight teaser card on the Journal feed (above).
- Body trends currently live on Insights alongside the pattern feed; they arguably belong on the Body tab, which would slim Insights to patterns alone and make the header-icon demotion more proportionate.
- The quick-log sheet still draws the nicotine action with the `drink` icon.
- Insights still ends with a History row, from when it was the tab that owned the entry into history. It is now redundant — Insights and History sit side by side in the same header — and is a candidate for deletion once the header pairing has been used in anger.
