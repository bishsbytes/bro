# Wellness review follow-up

The implementation adds separate export choices for sensitive categories and prose,
restore into an empty local record, durable new-note drafts, coordinated SQLite
transactions, explicit confirmation of absent tags, and missing-data handling for
insights. Charts offer touch exploration, adjustable accessibility actions, and a
text list of readings. Recent records are visible before pattern eligibility;
onboarding explains that accounts do not provide sync or backup. History opens
with 30 recorded days, with an option to load older days. CI checks formatting,
types, lint, and tests.

## Product validation still requiring people and devices

These are validation tasks, not completed research. Recruit five to eight men
with varied ages, accessibility needs, and experience of wellness tracking. Use
fictional entries; do not ask participants to disclose personal health histories.
Ask each participant to:

1. Complete a first check-in, leave some optional fields blank, and explain what
   the app knows about their day.
2. Select an activity, confirm the day's tags, and explain the difference between
   an absent activity and an unanswered question.
3. Interpret a recent mood record, a gap in the chart, and a usual range. Check
   whether they mistake any of these for a diagnosis, target, or causal claim.
4. Write a note, leave the composer, return, and recover the draft.
5. Produce an export without prose, explain what it contains, and restore a full
   export on an empty test installation.
6. Find human support and explain that the current link is UK-specific and opens
   the NHS website.

Record completion without help, time, points of confusion, and the participant's
own explanation. Prioritize repeated misunderstandings about missing data,
privacy, and recovery before adding more tracking options. Retention and benefit
need a longer voluntary pilot; this implementation does not establish efficacy.

## Device release checks

- [ ] iOS back swipe and Android hardware back preserve a draft; explicit discard
  clears it. Force-stop and reopen while composing, including offline.
- [ ] Export, cancel the file picker, restore, and try a malformed file on each
  supported platform. Confirm existing records cannot be overwritten.
- [ ] VoiceOver and TalkBack can select chart days and read missing values and
  units. Test large text, small screens, horizontal scrubbing within vertical
  scrolling, and reduced motion.
- [ ] Concurrent health import and manual entry preserve both successful writes;
  interrupted imports remain recoverable.
- [ ] Test a multi-year fixture on a lower-end Android device. Insight and trend
  windows and the history list are bounded. Body goal calculations still need
  historical readings; profile before replacing those with summaries, preserving
  goal start values and sparse historical measurements.
- [x] Run the API account-deletion integration tests with Docker available. All
  16 API tests passed after granting the test process Docker socket access.

## Human-support content

The app links to the NHS's own mental-health support page and identifies its UK
scope. A custom crisis flow still needs clinician-approved wording under
`design/DESIGN.md`. The link does not constitute clinical review or international
support coverage. Obtain that review and choose supported regions before adding
local crisis instructions or automated escalation.
