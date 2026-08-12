# Product domains, journeys, and data stores

## Status

**Draft proposal, revised after the product direction was set.** bro is a daily health and performance tracker for men — the structural analogue of Flo, without a cycle to predict. The core loop is logging how you are; the value is what the app shows you back.

Written to be corrected. The domain list and store placements are the deliverable; the field-level specifics are a starting position. Answers [open decision 1](offline-first-identity-onboarding-premium.md#phase-1-decisions--resolved) of the [umbrella plan](offline-first-identity-onboarding-premium.md), and proposes six changes to it — see [What this changes upstream](#what-this-changes-upstream).

## What the product is

Six areas, roughly in the order they were named:

1. **Mood and energy** — the daily subjective signal, and the core loop.
2. **Health-tracker integration** — imported objective signal: sleep, steps, heart rate, HRV, workouts, weight.
3. **Habit change and challenges** — structured programmes, not just logging.
4. **Performance improvement, mental and physical** — the reason the rest exist.
5. **Food logging** — for weight and body composition goals.
6. **Periodic review** — wheel of life and values work, to decide *what* to improve before tracking whether it did.

### What "Flo, for men" implies structurally

Flo's engine is a physiological rhythm: log daily, predict the cycle, explain today in terms of where you are in it. There is no equivalent male cycle, so **the rhythm has to be discovered per user rather than assumed** — sleep debt, training load and recovery, weekday patterns, seasonal drift, the effect of alcohol two days later.

That single difference drives most of what follows:

- **The unit of value is correlation, not prediction from a known model.** "Your energy is 30% lower on days after fewer than six hours of sleep" is the product. It needs enough varied signal, over enough days, to be true rather than noise.
- **Breadth of signal matters more than depth of any one metric.** Which is why tracker import is not a nice-to-have — it is what makes the insight layer possible for a user who will not hand-log their sleep.
- **The schema must absorb new metrics without a migration**, because which signals matter is exactly what you do not know yet.

## What is already fixed

Unchanged constraints from the umbrella plan. Every proposal below sits inside them.

- **The shipped copy is a promise.** [Welcome](../../apps/app/src/app/onboarding/index.tsx): "A private place to check in with yourself." [Privacy](../../apps/app/src/app/onboarding/privacy.tsx): "Everything you write is stored on this device and nowhere else. We cannot read it, because we never have it." [Start](../../apps/app/src/app/onboarding/start.tsx): "your notes on more than one device."
- **Anything in `bro.db` replicates** once a user opts in to sync. Placing a domain is a privacy decision. See [Storage ownership](offline-first-identity-onboarding-premium.md#storage-ownership).
- **Client-generated UUIDs; `createdAt`/`updatedAt` on every record; no tombstones, no conflict policy** — libSQL serializes at the primary.
- **No per-account ownership.** See [Why no per-account ownership](offline-first-identity-onboarding-premium.md#why-no-per-account-ownership).
- One [repository](../../packages/database/app/src/repositories/README.md) per domain, hand-written parameterised SQL. Drizzle authors schema and generates migrations only.

## The shape of the data

This is the decision everything else follows from, so it comes before the domain list.

### Observations, not a wide daily row

Three candidate shapes:

| Shape | Cost |
| --- | --- |
| **Wide row per day** — `daily(day, mood, energy, sleepHours, steps, weight, …)` | Every new metric is a migration. Per-field provenance is impossible without doubling the columns. Dies the first time a tracker reports two sleep sessions in a day. |
| **Narrow time series** — one row per observed value | Queries become pivots; type safety lives in code, not the schema. |
| **Hybrid** — first-class tables for rich domains, narrow series for scalars | Two mental models, and a standing argument about which one a new metric belongs in. |

**Recommendation: the narrow time series is the spine.**

```ts
observations = {
  id,               // client-generated UUID
  metricSlug,       // 'mood' | 'energy' | 'sleep_duration' | 'weight' | …
  value,            // REAL — every metric is numeric; see below
  observedAt,       // epoch ms UTC
  localDay,         // 'YYYY-MM-DD' as computed where it was written
  tzOffsetMinutes,
  source,           // 'user' | 'healthkit' | 'health_connect' | …
  sourceRecordId,   // the platform sample id, null for user entries
  createdAt,
  updatedAt,
}
```

Three reasons this wins here specifically:

1. **It mirrors HealthKit and Health Connect.** Both are typed sample stores with a source, a unit, and a time range. Import becomes a field mapping rather than a translation.
2. **A new metric is a code change, not a migration.** Given that discovering which signals matter *is* the product, migrating the schema every time is the wrong cost curve — and under sync, migrations are the most expensive thing in the plan.
3. **Provenance is per-value, which it has to be.** Weight can come from the user on Monday and a smart scale on Tuesday. A wide row cannot say which.

**The metric registry is authored content, not data.** Slug, display name, dimension, scale bounds, aggregation rule, sensitivity, deprecation status, and whether a metric is user-enterable live in the binary and version with the app — the same argument that keeps prompt text out of the database. What the user does with that catalogue *is* data; see below.

**Free text is not an observation.** Notes attach to the day, not to a metric, so they get their own small table rather than a `value_text` column that is null on 99% of rows.

### Catalogue, overlay, snapshot

Every authored list in this product runs into the same requirement: **some users will want different items, or different wording, from the ones we ship.** Life areas most obviously — "Career" is wrong for someone who has not got one, and faith, sobriety, fatherhood or recovery matter enormously to some people and not at all to others — but the same is true of tracked metrics, factors, habits, and the tags on challenges.

Solving it once, the same way everywhere, is worth more than four bespoke answers:

1. **Catalogue — authored, in the binary.** Slugs, default labels, and whatever behaviour the app attaches to them. Versioned with the release. Never in a database, so a copy edit is not a migration.
2. **Overlay — the user's, in `bro.db`.** Which catalogue items are active, in what order, with an optional label of their own, plus any items they created themselves. This is data, it syncs, and it is what `trackedMetrics` already is.
3. **Snapshot — on the record, at the moment it is used.** Anything displayed alongside a value gets stored with it if the catalogue behind it can move.

**The third is the one that is easy to miss and expensive to add later.** A user renaming an area, or us rewording one, must not retroactively rewrite what every historical record appears to say. This is the rule already applied to nutrition on a food entry, and it is the same rule: *record what was shown, because the catalogue will move underneath it.*

**This is not a settings-screen nicety.** For a product whose pitch is that it is built for *you*, the catalogue overlay is a good part of how that is actually true — see the [Make it yours](#make-it-yours) journey.

**Custom items cost one guarantee, and it should be said out loud:** nothing we author can be attached to something we did not author. A user-invented life area or habit gets tracking, trends, and correlation, but no challenge, prompt, or suggestion can be tagged to it. That is an argument for shipping a generous catalogue rather than a minimal one, and for treating custom items as a fallback rather than the intended path.

**Namespace user-created slugs** — `wheel:custom:<uuid>` against `wheel:career` — so they can never collide with something we ship later, and write every slug resolver to handle "not in the catalogue" from the first one rather than after several call sites have assumed otherwise.

### Adding a metric later

The test of this shape is what it costs to add libido, soreness, alcohol, or anything else once the app is live on devices we do not control. It should be a registry entry and a line of UI:

```ts
{ slug: "libido", label: "Libido", scale: [1, 5], userEnterable: true, sensitive: true }
```

**No migration, and that is the point.** Storage, the repository, per-metric trends, and the correlation pool all work unchanged. A schema migration under replication is the most expensive operation in this plan — see [Schema migrations across devices](offline-first-identity-onboarding-premium.md#schema-migrations-across-devices) — so a design where the most frequent kind of change never migrates is worth the pivot queries it costs.

Three things it does cost:

**Which metrics a user actually sees.** The daily loop has to stay at fifteen seconds, so a growing registry cannot mean a growing check-in. What a user tracks is a stored preference:

```ts
trackedMetrics = { id, metricSlug, position, addedAt, removedAt, createdAt, updatedAt }
```

User-originated, so it lives in `bro.db` and replicates — someone who set up their check-in on a phone should not rebuild it on a tablet. Removing a metric stops prompting for it and hides nothing already recorded.

**Sensitivity, which is per metric and load-bearing.** Steps and libido do not deserve the same treatment in the app-switcher snapshot [Phase 3](offline-first-identity-onboarding-premium.md#phase-3-optional-app-protection) obscures, in a notification or widget, in what an AI payload includes by default, or in an export handed to a coach. The flag has to exist from the first metric, because the code paths that respect it are written long before the sensitive one arrives.

**Slugs are permanent, and the scale question recurs.** Once `libido` has been written to a device it exists forever; if it later splits into two metrics, the registry must still render the retired slug while no longer offering it. And each new metric re-asks the irreversible question from [open decision 1](#open-decisions) — its scale cannot be changed once history is scored on it.

Not everything fits: a multi-select is fine as one boolean observation per selected slug, but free text is a day note, not a metric.

### Units and measurement preferences

**Stored values are always canonical. The unit is a display concern and never reaches the database.** Kilograms, metres, millilitres, seconds, degrees Celsius, and one canonical energy unit. Everything else is a conversion at the edge — on entry, on display, and on import.

This is not tidiness. A series holding a mix of kilograms and pounds is unrecoverable once you can no longer tell which row is which, and it is the sort of bug that arrives quietly through an import mapping years after the decision.

**The registry declares a *dimension*, not a unit.** `weight` is mass; `sleep_duration` is time; `mood` is dimensionless. The unit a user sees is dimension plus preference, resolved at render.

**Preferences are per dimension, not one metric-versus-imperial switch.** The UK is the proof that a single toggle is wrong: the same person will want stones and pounds for body weight, kilometres for a run, and centimetres — or feet and inches — for height. Modelling it as one flag guarantees an argument with reality.

```ts
unitPreferences = { id, dimension, unit, createdAt, updatedAt }
```

- **Default from device locale on first run**, then never change silently. A user who switched to kilograms did so deliberately.
- **Compound units are a formatting problem, not a storage one.** `12 st 4 lb` and `5 ft 11 in` are parsed on entry and composed on display; nothing below the formatter knows they exist.
- **Convert at the import boundary too.** HealthKit and Health Connect return whatever unit was asked for; convert once in the mapping rather than storing what the platform happened to give.
- **Round for display only, never on write.** Rounding on storage makes repeated unit switches drift. Also watch implied precision: 80 kg rendered as 176.37 lb claims a measurement nobody made, so each dimension needs a sensible display resolution.
- **Goals store canonical targets** and inherit the display unit, so changing preference never moves a goal.

**Where it lives: `bro.db`, replicating** — it describes the person, not the handset, and someone who thinks in stones thinks in stones on their tablet too. Because storage is canonical, a device that disagreed would be cosmetically wrong for one render and never data-wrong, which is what makes this choice cheap and reversible: it can move to device-local later without touching a single stored value.

### Where a narrow table is the wrong answer

Food entries and workouts are not scalars — they carry a dozen correlated fields that are meaningless apart. Those get real tables. The test: *would you ever query this value on its own, across time?* Weight, yes. The fat content of a specific banana, no.

## Three stores, not two

**This is the significant architectural finding.** Health-tracker import does not fit either existing store, and forcing it into `bro.db` would be a mistake.

**Raw imported samples should not replicate. Daily rollups derived from them should.**

This is not a legal constraint. Storing a user's own health data on our own infrastructure, to deliver the app's own function, is not what App Store Review Guideline 5.1.3 restricts — that restriction is about *disclosure to third parties* and use for advertising or data mining. See [Where the promises break](#where-the-promises-break) for the place it does bite, which is AI rather than sync. The reasons here are engineering and cost:

- **Volume.** A watch writes heart-rate samples every few minutes, plus sleep stages, plus workout detail. Raw HealthKit history is orders of magnitude larger than everything the user types, and replicating it is bandwidth on a phone and money per user per month — for data the insight layer never reads at that granularity.
- **Sample identity across devices is unverified.** Whether a HealthKit sample carries a stable identifier on a second device needs checking. If it does not, two devices importing the same night produce two rows and no safe dedup key.
- **On iOS it is redundant.** HealthKit already syncs across a user's Apple devices, so replicating it is paying to do a job the platform does. **On Android it is not** — Health Connect is on-device and does not sync across phones; a new device repopulates only as the source apps (Fitbit, Garmin, Strava) push their own history back down. That asymmetry is real and argues against relying on the platform for continuity everywhere.

The rollup resolves the tension. The insight layer wants *sleep duration for Tuesday*, not four hundred heart-rate samples:

```ts
dailyMetrics = { id, metricSlug, localDay, value, source, computedAt, createdAt, updatedAt }
```

Small, stable, and naturally keyed on `(metricSlug, localDay, source)` — two devices computing the same day produce the same fact, so a collision at the primary is benign under the rule in [Conventions](#conventions-to-lock-in-now). It gives cross-device and post-phone-change continuity on both platforms, sidesteps sample-identity entirely, and costs a few rows a day instead of thousands.

So three stores, with the boundary at raw versus rolled-up rather than imported versus entered:

| File | Contents | Syncs | Backed up | Losing it costs |
| --- | --- | --- | --- | --- |
| `bro.db` | User-originated records, plus daily rollups | Yes, when opted in | Open — see below | Everything, if not synced |
| `bro-local.db` | Raw imported samples, food-database cache, derived caches | **Never** | **No** | A re-import, and rollups already hold the summary |
| `bro-device.db` | Settings key-values | Never | No | Seconds of setup |

The split pays for itself three ways: the replicated volume stays proportional to what the user actually did rather than to what their watch recorded, `bro-local.db` is explicitly disposable so it can be excluded from platform backup without argument, and a rebuild after corruption is a re-import rather than data loss.

**The cost, stated plainly:** raw sample detail is per-device. A user who changes phones keeps every daily figure the insight layer uses, but loses the underlying samples until the platform or the source apps repopulate them. If a journey ever needs intraday detail — a heart-rate trace on a workout screen — that journey is device-local, and should be designed knowing it.

## The domains

### 1. Check-in — mood and energy

The core loop. A daily subjective reading, written as observations with `source: 'user'`.

Mood and energy as **two separate metrics, not one**. They come apart constantly — flat but wired, calm but exhausted — and separating them is most of what makes the insight layer say anything a user could not have guessed.

**Open, and the most expensive field in the product:** the scale. Five points is fast to tap and coarse; ten is slower and gives correlation more to work with. Whatever ships, every historical record is scored on it and rescaling later is not reversible.

**Lives in `bro.db`.** Replicates.

### 2. Assessments — wheel of life, values, and periodic review

A structured self-assessment taken every so often: rate satisfaction across the areas of your life, see the shape, decide what to work on. Wheel of Life is the first instrument; values clarification is the obvious second.

**This is not a check-in, and modelling it as one loses what makes it useful.** Two differences:

- **Cadence.** Quarterly or monthly, not daily. It is a review, not a log.
- **The set is the unit of meaning.** A wheel is eight scores taken together at one sitting; the value is its shape, and the comparison against the last one. Eight independent time series cannot render a wheel, and grouping by timestamp breaks the moment somebody finishes it the next morning.

**The template is a catalogue, not a fixed form.** Life areas are personal — faith, sobriety, fatherhood, recovery, study — and the wording matters as much as the set. "Career" is wrong for someone who does not have one. So the shipped template is a starting point that the user edits, which makes this an instance of a pattern the whole product needs: see [Catalogue, overlay, snapshot](#catalogue-overlay-snapshot).

Three levels of customisation, and they are not equally expensive:

| Change | Cost |
| --- | --- |
| **Relabel** a shipped area — "Career" → "Work" | None. The slug is unchanged, so history, challenge tagging, and correlation all keep working. |
| **Reorder, or turn one off** | None. Overlay state; nothing historical moves. |
| **Add an area of their own** | Real, and worth stating: a custom area gets tracking, trends, and correlation, but no authored content can be tagged to it, so the guided programme has nothing to offer there. |

That last row is an argument for shipping a **broad** catalogue rather than a minimal one — every area we author is one more that can carry challenges and suggestions, and custom areas are a fallback rather than the intended path.

**The instance is the grouping, and it snapshots what was asked:**

```ts
assessments = {
  id, templateSlug, templateVersion,
  startedAt, completedAt,
  items,                   // snapshot: slug, label, position, as displayed
  focusItemSlugs,          // what the user chose to work on
  createdAt, updatedAt,
}
```

**The snapshot is not optional once labels are editable.** `templateVersion` covers changes we make; it cannot cover a user renaming "Career" to "Business", which would otherwise retroactively rewrite the label on every wheel they have ever taken and quietly falsify the comparison the feature exists to show. Storing the items as displayed is the same rule already applied to nutrition on a food entry, for the same reason: *the catalogue behind a record will move, so record what was shown.*

**The responses are observations**, with a nullable `assessmentId` linking them to their sitting. This is worth the extra column: a wheel score becomes a trend line and joins the correlation pool for free — *"your career satisfaction has fallen three quarters running, and it tracks your sleep"* is exactly the kind of thing this product exists to say — while the wheel still renders by grouping on `assessmentId`. The cost is that the registry grows to include assessment items and the column is null on almost every row, which is cheap.

**Slugs stay permanent, including custom ones.** A user-created area needs a slug that can never collide with one we ship later, so it is namespaced — `wheel:custom:<uuid>` against `wheel:career`. Anything resolving a slug must therefore handle "not in the catalogue" rather than assuming, which is the honest cost of customisation and is cheaper to write in from the start than to add once several call sites assume otherwise.

**Recommendation: capture the current score only, plus an explicit "work on this" selection.** Instruments often ask for a desired score as well, but the actionable output is which areas the user picked, not a second number they invented. Adding desired scores later is another slug per item and no migration.

**The connection to everything else is the actual point.** Focus areas are what make goals, habits, and challenges feel chosen rather than generic. Which means **challenge templates need an area tag drawn from the same vocabulary as the wheel's items** — decide that vocabulary once, now, because retro-tagging authored content later is tedious and easy to get half-right.

**Where this shape stops working:** a values card-sort fits, since ranks are numbers and a selection is a 0 or 1. An instrument needing free text, or an unordered multi-select with no natural score, does not — at that point responses earn their own table. That is the trigger to watch for; until then a second table would be structure without a reason.

**Onboarding tension, worth naming.** A wheel is the natural "tell us where you are" moment and would make day one feel personal. But onboarding promises *"No account. No sign-up. Nothing to fill in first."* So it belongs in the empty state as an invitation, never as a gate — and it is a strong candidate for what the empty state actually offers, since it gives a new user something to do that produces direction rather than a lonely first data point.

**Free tier.** Consistent with the rule that logging and your own history are never gated, the wheel and its comparisons stay free. Premium sits in the guided programme that follows from it.

**Lives in `bro.db`.** Replicates.

### 3. Day note — free text

The "notes" the copy already promises. One optional note per day, not per check-in — a day is what the user thinks in.

```ts
dayNotes = { id, localDay, body, createdAt, updatedAt }
```

**Not a column on a check-in.** With observations as the spine there is no row to hang it on, and the day is the better anchor regardless — people remember days, not entries.

**Lives in `bro.db`.** Replicates. This is the most sensitive free text in the product and the strongest argument in the encryption and backup decisions.

### 4. Reminders

A daily loop that nobody is reminded of is a loop that stops. This is small, but it is the difference between a tracker people use for a fortnight and one they use for a year, so it is a domain rather than a setting.

It is the one thing in the product with a foot in two stores, and splitting it is the point:

- **The schedule** — days, times, on or off — is a preference about the person. `bro.db`, replicating: someone who set up an evening nudge should not rebuild it on a new phone.
- **The scheduled OS notification identifiers and permission state** are properties of an install. A notification id from another device is noise. `bro-local.db`, never replicating.

Each device re-materialises its own OS notifications from the synced schedule after a pull. **Open:** should a second device fire the same reminders? Splitting it this way makes that the default, and a user with a phone and a tablet being nudged twice is the failure mode to check.

**Native work:** notification permissions are another native dependency and another prebuild, which is why the count in [What this changes upstream](#what-this-changes-upstream) is five.

### 5. Health-tracker connections and imports

**Connections** — which sources are authorised, what metric types were granted, the high-water mark per metric for incremental import. Device-local by definition: an authorisation is between this install and this phone's platform.

**Imported observations** — the same shape as domain 1, in `bro-local.db`, with `source` and `sourceRecordId` set. Rolled up into `dailyMetrics` in `bro.db` as part of import, rather than on a schedule — background execution is unreliable enough on both platforms that nothing should depend on it, which is what everything downstream reads. See [Three stores](#three-stores-not-two).

**Import must be idempotent**, keyed on `(source, sourceRecordId)`. A unique index here is *safe*, unlike the one warned against in [Conventions](#conventions-to-lock-in-now): it dedupes identical facts, and the losing write is a duplicate rather than a distinct entry. That distinction is the rule — a unique constraint that collapses the same fact is fine; one that collapses two real facts destroys data.

**Precedence when a metric has both a user value and an imported one for the same day:** propose imported wins for objectively measured metrics (weight from a scale, sleep from a watch), user wins for subjective ones, and never silently delete the loser — keep both rows and pick at read time, so the user can see where a number came from.

**Native work:** HealthKit and Health Connect both need native modules and a prebuild regeneration. That is now the *third* time that infrastructure task arrives, alongside `expo-local-authentication` in Phase 3 and the purchase SDK in Phase 4 — the umbrella plan's [shared prerequisites](offline-first-identity-onboarding-premium.md#shared-prerequisites) should say three, not two. Candidate libraries need verifying against RN 0.85 with `newArchEnabled` on a real build before being committed to a phase.

### 6. Body metrics and goals

Weight, body fat, waist, resting heart rate — all plain observations, either user-entered or imported. What is *not* an observation is the goal:

```ts
goals = { id, metricSlug, direction, targetValue, targetDate, startedAt, achievedAt, abandonedAt, createdAt, updatedAt }
```

Goals are user-originated and replicate. Progress is derived by querying observations between `startedAt` and now — never stored, or it disagrees with the series it came from.

### 7. Habits and challenges

Two distinct things that are easy to conflate:

- **Habits** are open-ended and repeating: no alcohol on weeknights, ten thousand steps, lights out by eleven. A definition plus a completion per day.
- **Challenges** are bounded programmes with a start, an end, and often a day-by-day structure: a thirty-day strength block, a dry month.

```ts
habits            = { id, slug|name, cadence, targetValue, activeFrom, activeUntil, … }
habitCompletions  = { id, habitId, localDay, value, completedAt, … }
challengeEnrolments = { id, challengeSlug, startedOn, endsOn, completedAt, abandonedAt, … }
challengeProgress   = { id, enrolmentId, dayIndex, completedAt, … }
```

**Challenge *templates* are authored content, not data** — bundled with the binary, versioned with it, referenced by slug. Storing the programme text in `bro.db` would replicate our own content into every paying user's database and make a copy edit a migration. Habits follow [catalogue, overlay, snapshot](#catalogue-overlay-snapshot) like everything else: we ship a starting set, the user renames, reorders, disables, and adds their own.

All the user-side tables live in `bro.db` and replicate. Streaks are derived.

**Open, and it changes the architecture rather than the schema:** are challenges ever social — shared, competitive, visible to anyone else? Everything in the umbrella plan assumes a single-user, no-anonymous-identity, local-first product. A leaderboard needs a server-side identity for every participant, which reopens [the anonymous-identity decision](offline-first-identity-onboarding-premium.md#remote-identity-lifecycle) and makes accounts non-optional for that feature. Solo is assumed throughout below.

### 8. Food logging

The largest domain, and the one with an external dependency.

```ts
foodEntries = {
  id, occurredAt, localDay, mealSlot,
  foodRef,                      // provider id, custom-food id, or null
  label,                        // what to display, snapshotted
  quantity, unit,
  kcal, proteinG, carbsG, fatG, // snapshotted at log time
  createdAt, updatedAt,
}
```

**Snapshot the nutrition onto the entry.** The food database will change entries, and providers disappear; a meal logged in 2026 has to still read correctly in 2029 without a network call. The `foodRef` is for re-lookup and editing, never for display.

**Custom foods and recipes** the user creates are user-originated: `bro.db`, replicating. **Looked-up foods** are a cache of someone else's database: `bro-local.db`, never replicating, rebuildable.

**The provider is a real problem for the free tier.** Food search means a network call, and the umbrella plan's [acceptance matrix](offline-first-identity-onboarding-premium.md#acceptance-test-matrix) currently asserts that *"a local-only user causes no auth, API, sync, or product-data request to our backend at any point"*, with store and analytics traffic carved out and documented separately. A food database becomes a **third carve-out**, and the options are not equivalent:

| Option | Consequence |
| --- | --- |
| Bundle a dataset | No network call, no privacy question, but a large binary and data that ages. Viable if scoped to a few thousand common foods. |
| Call the provider directly from the device | Keeps our servers out of it, but the user's food searches go to a third party, and the privacy screen has to say so. |
| Proxy through our API | We see the queries, it needs infrastructure, and it puts a server dependency in the free tier's critical path — the thing this whole plan is built to avoid. |

**Recommendation: bundle a core dataset, with direct third-party lookup for barcodes and the long tail, declared in the privacy copy.** Candidates worth evaluating on licence terms as much as coverage: Open Food Facts, USDA FoodData Central, and the commercial options.

Barcode scanning is another native dependency, and another prebuild.

### 9. Insight — derived, and the actual product

Correlations between inputs and outputs, computed on device from the observation series. **Never stored as truth.** If a computation becomes slow, cache it in an explicitly rebuildable table that nothing trusts — but a few thousand rows in SQLite will not be the bottleneck for a long time.

Two things to be careful with, because this is a health product:

- **Correlation is not causation, and the copy must not imply it is.** "Your energy tends to be lower after nights under six hours" is honest. "Sleep more to feel better" is medical advice.
- **Sample size gates the claim.** An insight from nine days is noise. Define the threshold before building the screen, not after someone screenshots a bad one.

### 10. AI reflection

Premium, and the highest-stakes domain in this document: what could be sent is no longer a mood note, it is mood, sleep, weight, food, and training. See [Where the promises break](#where-the-promises-break).

**Recommendation:** the user selects what is sent, per use; nothing retained server-side beyond the request; the reply stored locally against the day it concerns.

## Journeys

### The daily loop

Open, log mood and energy, done — under fifteen seconds, standing up. Everything else is secondary to this not being tedious, because nothing else works if the daily signal stops arriving.

### Connect a tracker

A one-time authorisation, then invisible. The screen has to be honest that data is read *from* the platform and stays on the device, since users have learned to assume the opposite.

### Take stock

The wheel, every month or quarter. Rate the areas, see the shape against last time, pick what to work on. The output is not the chart — it is the focus areas that make the next challenge or goal feel chosen.

Needs a prompt to exist at all, since nobody remembers to do this unprompted. That is the first real use of [reminders](#4-reminders) beyond the daily nudge.

### Make it yours

Rename an area, drop a metric that does not apply, add one that does, switch weight to stones. Not a settings screen so much as the thing that decides whether the app feels like it was built for this particular person — which is most of what "for men" has to mean in practice, since the alternative is a generic tracker with different colours.

Everything here is [catalogue overlay](#catalogue-overlay-snapshot) state, so it syncs and none of it touches recorded history.

### Look back

The timeline, and a day view. Under a metrics model this is also where provenance surfaces: a number should be able to say whether it came from the user or a watch.

### See what's affecting you

The insight surface. Gated on having enough varied data, which means the empty and not-yet states are the ones most users will see first and deserve real design.

### Run a challenge

Enrol, see today's step, mark it, see the streak. The one journey with a defined end, which makes completion a natural moment to ask for a review or offer premium.

### Log food

The highest-friction journey in the product and the one most likely to be abandoned. Search, barcode, recents, and repeat-yesterday all exist to reduce taps.

### Correct the record

Edit or delete an entry. **Hard deletes, no tombstones** — under sync a delete forwards to the primary as a write, and an offline device's later edit updates zero rows, so nothing resurrects. Imported observations are not editable; they are corrected in the source app and re-imported.

### Delete local data

The third of the [four destructive operations](offline-first-identity-onboarding-premium.md#distinguish-four-destructive-operations), unshippable until now. **`DELETE FROM` each product table in one transaction across both product stores — do not delete the files.** Dropping `bro.db` also drops `__app_migrations`, forcing a re-migration and leaving the replica inconsistent with its generation.

### Export

Still absent from every phase, and more clearly needed now: a health record spanning years, some of it imported, is exactly the data a user will one day want out — for a GP, a coach, or another app. Design the serialisation alongside the first schema.

## Storage ownership

| Data | Store | Replicates | Why |
| --- | --- | --- | --- |
| Check-in observations (mood, energy) | `bro.db` | Yes | User-originated; the core record. |
| Day notes | `bro.db` | Yes | The most sensitive text in the product. |
| Tracked-metric selection | `bro.db` | Yes | What a user chose to check in on; rebuilding it per device would be busywork. |
| Unit preferences, per dimension | `bro.db` | Yes | Describes the person, not the handset. Cosmetic only — stored values are canonical. |
| Assessments, their item snapshots and focus selections | `bro.db` | Yes | The sitting; responses live in `observations` alongside everything else. |
| Catalogue overlays — active items, order, custom labels, user-created items | `bro.db` | Yes | What the user made of the catalogue we ship. See [catalogue, overlay, snapshot](#catalogue-overlay-snapshot). |
| Catalogues — metrics, life areas, habits, challenge templates, prompts | App bundle | n/a | Authored by us, versioned with the release. A copy edit must never be a migration. |
| Reminder schedule | `bro.db` | Yes | A preference about the person; a new phone should not mean setting it up again. |
| Goals | `bro.db` | Yes | Intent, not measurement. |
| Habits, completions, challenge enrolments and progress | `bro.db` | Yes | User-originated. |
| Food entries, custom foods, recipes | `bro.db` | Yes | User-originated, nutrition snapshotted at log time. |
| AI replies | `bro.db` | Yes | Kept against the day they concern. |
| **Raw imported health samples** | **`bro-local.db`** | **No** | Orders of magnitude larger than anything typed, and never read at that granularity. Rebuildable by re-importing. |
| **Daily rollups** (`dailyMetrics`) | `bro.db` | Yes | What the insight layer actually consumes; small, stably keyed, and the only imported figures worth carrying to a new phone. |
| Food-database lookups | `bro-local.db` | No | A cache of a third party's data. |
| Derived insight caches | `bro-local.db` | No | Rebuildable from the series. |
| Tracker authorisations, granted types, import high-water marks | `bro-local.db` | No | A relationship between this install and this phone's platform. |
| Scheduled notification ids, permission state | `bro-local.db` | No | Identify OS objects on this install; meaningless anywhere else. |
| Draft entries, last-viewed day, UI state | `bro-device.db` | No | Per-install, and transient. |
| Streaks, trends, goal progress | Nowhere | n/a | Derived on read. |

## Proposed tiers

Flo's model is free tracking, paid interpretation. That transfers cleanly.

| Tier | Contents |
| --- | --- |
| **No account, free, forever** | Unlimited logging of everything — mood, energy, body metrics, habits, food. The wheel of life and its history. Full history everywhere. Tracker import. Basic per-metric trends. Export. |
| **A free account** | Nothing on its own. The prerequisite for paid server features. |
| **Premium** | **Cross-metric insight and correlation** — what affects what. AI reflection. The challenge library beyond a starter set. Multi-device sync and backup. |

The line to hold: **logging is never gated, and neither is your own history.** Capping entries or hiding past data makes the free tier a demo and falsifies onboarding. What is sold is interpretation — which is also the part that costs us something to build and keeps costing to improve.

**Where the line falls, precisely:** *this metric over time* is free, because it is arithmetic over data the user already has. *This metric against that one* is premium, because correlation is the thing being built and improved.

**Tracker import stays free deliberately.** It is the cheapest thing we can give away — the data is already on the phone, we pay nothing for it — and it is what makes premium insight good enough to be worth buying later.

## Where the promises break

Three claims now need attention, in ascending order of severity.

**1. "Stored on this device and nowhere else."** Platform backup already dents this. Sync is consented and premium, so it stays true for anyone who has not enabled it. Third-party food lookup is a new disclosure. The screen needs one honest rewrite covering all of it.

**2. "We cannot read it, because we never have it."** AI breaks this outright, and now with far more at stake: the data that could be sent is a health record, not a journal. This must be rewritten *before* AI ships, not after — "Nothing leaves this device unless you ask" is the shape of the honest version.

**3. Platform health-data terms — and they bite on AI, not on sync.** Guideline 5.1.3 restricts *disclosing* health data to third parties, and using it for advertising, marketing, or data mining beyond health management. Our own servers holding the user's own data to run our own features is not that. **A third-party model provider is.** If AI reflection posts HealthKit-derived values to an external inference API, that is exactly the third-party disclosure the guideline governs, and it makes three things load-bearing that would otherwise be paperwork:

- **Explicit permission** for that specific disclosure, distinct from the HealthKit read permission and from sync opt-in.
- **The provider's retention and training terms**, which become a compliance surface rather than a procurement detail.
- **A defensible purpose** — health management for this user — rather than anything resembling model improvement or analytics.

This does not block AI. It decides its shape: the user picks what is sent, consent is per use, and the provider contract has to say the data is not retained or trained on. Verify the current guideline wording before building it.

## Conventions to lock in now

- **`id`:** `TEXT PRIMARY KEY`, client-generated. Prefer UUIDv7 — time-ordered ids give locality on append-heavy series and make "most recent" cheap.
- **Timestamps:** `INTEGER` epoch milliseconds UTC, plus `localDay` and `tzOffsetMinutes`. Store the local day rather than deriving it, or the answer changes after travel and differs across devices.
- **Unique indexes:** safe when they collapse the *same* fact — `(source, sourceRecordId)` on imports. Never when they collapse *distinct* facts: a unique index on `(metricSlug, localDay)` would mean two offline devices logging the same day silently lose one entry at the primary. Enforce one-per-day in the UI, where it can be explained.
- **Deletes are hard deletes.** Justified above.
- **No `createdByUserId`** — but the challenge-social question above is exactly the thing that would change this, and retrofitting authorship after sync ships means a migration across live replicas. Answer "solo, always" deliberately or not at all.
- **Migrations conflict-tolerant from the first one:** `CREATE TABLE IF NOT EXISTS`, markers with `ON CONFLICT DO NOTHING`. Retrofitting migration 001 is impossible once it has run on a device.
- **Snapshot what was displayed** whenever the catalogue behind it can move — nutrition on a food entry, item labels on an assessment. Otherwise a later rename silently rewrites history.
- **Units are canonical in storage, converted at the edges**, with per-dimension display preferences. See [Units and measurement preferences](#units-and-measurement-preferences).

## What this changes upstream

Proposals for the [umbrella plan](offline-first-identity-onboarding-premium.md), not edits already made:

| Umbrella item | Proposed change |
| --- | --- |
| Open decision 3 — is app protection premium or free? | **Resolved: free.** The app holds a health record. Charging for the lock on it is indefensible. |
| [Platform backup](offline-first-identity-onboarding-premium.md#platform-backup) — current lean is to keep `bro.db` backed up | **Re-examine.** That lean was taken when the data was notes. Standard iCloud Backup is readable by Apple without Advanced Data Protection; this is now health data. `bro-local.db` is a clear exclude either way. |
| Phase 6 — encryption at rest, "optional later delivery" | **Escalate.** Given the data, this deserves a decision rather than a deferral — sharpened by the plan's own warning that encryption and embedded replicas may be mutually exclusive on expo-sqlite 56. That collision now matters a great deal more. |
| [Shared prerequisites](offline-first-identity-onboarding-premium.md#shared-prerequisites) — "one infrastructure task arriving twice" | **Five times:** app lock, purchase SDK, health integration, notifications, barcode scanning. Worth batching rather than regenerating the prebuild five times. |
| Acceptance matrix — "no request to our backend" | Add the food-database provider as a third documented carve-out beside store and analytics traffic. |
| Storage ownership | Add `bro-local.db` as a third store. |

## Open decisions

### Before the first domain

1. **The mood and energy scale** — points and labels. Irreversible across historical data.
2. **One check-in per day, or several?** Recommendation: several, enforced in UI.
3. **Is `observations` the spine, or a hybrid?** The recommendation above, confirmed or rejected.
4. **Does the check-in ship a fixed set of metrics, or a user-chosen one?** A fixed set is simpler for a first release; a chosen one is what keeps the daily loop short as the registry grows, and retrofitting it means migrating everyone's implied selection.
5. **Which canonical units,** and kilocalories or kilojoules for energy. Changing this after data exists means rewriting every stored value.
6. **Do unit preferences sync, or stay device-local?** Recommended syncing; safe either way, and movable later without touching data.
7. **The shared area vocabulary** for the wheel's items and challenge tags. Cheap now, tedious to retro-fit across authored content — and it wants to be generous, since nothing authored can attach to an area a user invented.
8. **How far does customisation go at v1?** Relabel, reorder and disable are nearly free and cover most of the need; user-created items cost the guarantee above. Shipping the cheap three first is defensible, provided slugs are namespaced from the start so the fourth can follow without a migration.
9. **Does the wheel capture a desired score as well as a current one?** Recommended not, in favour of an explicit focus selection.
10. **What does `sensitive: true` actually change** — snapshot obscuring, notification content, AI payload defaults, export. Cheap to honour from the first metric, expensive to add once several code paths ignore it.

### Before health integration

11. **Which platforms first** — HealthKit, Health Connect, or both together.
12. **Which metrics to import** at v1, and the precedence rule when user and tracker disagree.
13. **Which metrics get a daily rollup, and how is each aggregated** — sum for steps, mean for resting heart rate, total for sleep, last-of-day for weight. The rollup rule is per metric and belongs in the metric registry.
14. **Is intraday detail ever needed on a screen?** If so, that journey is device-local by design, since raw samples do not replicate.

### Before challenges

15. **Are challenges ever social?** The one answer here that changes the architecture rather than the schema.

### Before food logging

16. **Which food database, and bundled or remote?** Licence terms matter as much as coverage.
17. **Barcode scanning at v1?** Another native dependency.

### Before Phase 4

18. **What does AI reflection do, and what may leave the device to do it?** Now the sharpest question in the document — it is the one place health data is disclosed to a third party. See [Where the promises break](#where-the-promises-break).
19. **Which model provider, on what retention and training terms?** A compliance surface, not a procurement detail.
20. **Does the trial grant AI only, or AI and sync?** (umbrella decision 7.)

### Before the copy reaches more users

21. **Rewrite the privacy screen once, honestly** — platform backup now, third-party food lookup when it ships, AI before it launches.

## Sequencing

Each step adds exactly one hard thing.

1. **Check-in.** `observations`, the metric registry, a repository, three screens, and **delete local data** with its reserved copy. This is also the first real exercise of the migration pipeline — `migrations` is currently `[]`, so `runMigrations` has never carried DDL onto a device. Converts Phase 2's structural local-data assertions into seeded sentinel rows.
2. **Reminders.** Small, and the thing most likely to decide whether step 1 survives contact with real life. Carries the first native dependency, so it is worth pairing with whichever prebuild regeneration happens first.
3. **Wheel of life, and goals.** One grouping table over the same observation spine, and it earns its place early: it gives the empty state something to offer, and it produces the focus areas that make everything after it feel chosen rather than generic. Goals follow directly, since a focus area with no goal is a diagnosis with no treatment.
4. **Body metrics, and unit preferences.** The first dimensional metrics, so the first real test of canonical storage with per-dimension display. Cheap now; a mess to introduce after weights exist in an unknown unit.
5. **Health import.** The third store, native modules, the first prebuild regeneration — best folded in with Phase 3's, which needs one anyway.
6. **Habits and challenges.** Self-contained, tagged to the step 3 area vocabulary, and the first thing that gives a user a reason to open the app on a day they feel fine.
7. **Insight.** Needs 1–6 to have accumulated data worth correlating. Also the natural moment to introduce premium.
8. **Food logging.** Last, because it is the largest, carries the external dependency, and is the easiest to get wrong in a way users abandon.

Sync (Phase 5) is orthogonal and can land whenever entitlement is ready — but note it should not land before step 5, or the [three-store split](#three-stores-not-two) will be retrofitted under a running replica rather than designed in.
