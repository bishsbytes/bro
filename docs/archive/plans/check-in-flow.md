# Check-in flow

## Status

**Landed, 24 August 2026.** Replaces the inline check-in form on Today with a
stepped flow at `/check-in`. Supersedes the check-in journey and the "three
taps plus save with no intermediate screens" contract recorded in
[step-1-check-in.md](step-1-check-in.md#check-in), which was written when the
check-in was Mood and Energy alone.

**Amended by [morning-evening-check-ins.md](morning-evening-check-ins.md).**
The flow below is unchanged in shape — one prompt at a time, buffered, written
in one transaction — but it now answers a named sitting: `/check-in?slot=…`,
asking the scores that sitting is configured for. Today's mood-faces card and
its "check in again" affordance are replaced by one card per sitting.

## The problem

Today rendered the check-in as a live form inside the feed. Choosing a mood
mounted every enabled optional score at once — with all four configurables
(`energy`, `motivation`, `productivity`, `libido`) that is four more scales,
a hint, and a save button appearing in one frame, pushing habits, challenges,
tags and the note down the page while the user's thumb is still where they
tapped. Nothing scrolled to meet them, so the next prompt was frequently below
the fold.

Two smaller faults travelled with it. One screen carried three different
commitment models — the check-in needed an explicit save, tags saved on tap,
the note had a save of its own — in one card language. And editing an entry
re-moded the form card at the top of the screen, out of sight of the entry
whose Edit was pressed.

## Outcome

Today reads the day; the check-in is answered on its own screen.

- Today's check-in card is the five mood faces plus a line naming the last
  check-in. It never changes height in response to a tap.
- Tapping a face opens `/check-in?mood=N`, which holds that answer and opens on
  the next prompt. Each remaining score gets its own card, centred, one scale
  at a time, advancing on tap. Skipping leaves the metric out.
- The last answer lands on a confirmation naming everything recorded. No save
  button exists anywhere in the flow.
- Editing pushes `/check-in?entry=<id>`, seeded with that entry's scores.

## Decisions

- **The flow spreads the prompts, not the write.** Every answer is buffered and
  committed in one `saveCheckIn` when the flow reaches its end — the
  one-transaction-per-check-in property from step 1 is unchanged, and the
  integration test still asserts it. Instant-saving each step would have been
  simpler on screen and would have turned one check-in into five transactions.
- **Leaving early still saves.** Close, Finish, and an unmount all commit what
  has been answered; only the explicit paths can report a failure, and the
  unmount commit is the net under a swipe back.
- **A revisit rewrites, never appends.** After a save the flow holds the entry
  it created — found by diffing the day's entry ids, since `saveCheckIn`
  returns the day rather than the row — so "Change an answer" edits that
  check-in instead of adding a second one to the day.
- **Scores only.** Tags and the note are day-level (`saveDayTags` /
  `saveDayNote`) and stay on Today. A second check-in must not re-ask what
  happened today.
- **Mood cannot be skipped**, matching `CHECK_IN_METRIC_SLUGS`: it is the one
  score that marks a day as checked in.

## Touchpoints

| Area | Files |
| --- | --- |
| Flow screen | `apps/app/src/screens/check-in/check-in-screen.tsx` |
| Route | `apps/app/src/app/check-in.tsx`, registered in `app/_layout.tsx` |
| Shared presentation | `apps/app/src/check-in/check-in-presentation.ts` (mood faces, metric labels, the one-line score summary Today, the flow, and history all render) |
| Today | `apps/app/src/screens/home/home-screen.tsx` — form state, `commitCheckIn`, and the edit mode removed |
| Tests | `apps/app/src/check-in-screen.test.tsx` (new), `check-in-flow.test.tsx`, `home-screen.test.tsx` |

## Verification

```bash
pnpm nx run @bro/app:test --skipNxCache
pnpm nx run-many -t typecheck lint -p @bro/app --skipNxCache
pnpm biome check .
```

All green on 24 August 2026 (58 suites, 256 tests).

## Still open

- Native acceptance on a device: the fifteen-second cold-open-to-saved target
  from step 1 now spans a screen transition and has only been reasoned about,
  not measured.
- Android hardware back leaves the flow through the unmount commit, so a
  failure there is silent. If that proves to matter, the commit wants a visible
  retry on Today rather than a louder flow.
- Whether the confirmation card earns its tap, or should auto-dismiss once the
  last score is answered.
