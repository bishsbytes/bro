# Product

Bro is a private, offline-first health and performance journal for men. The
daily loop is to record how the day feels and what happened; the product's
value is the patterns it can show across subjective check-ins, body data,
habits, health imports, and intake.

An account is optional. The local journal remains usable without a network or
a remote session.

## Information architecture

The four tabs are organised by job:

| Tab | Owns |
| --- | --- |
| Journal | The selected day's check-ins, notes, habits, and route to history and insights |
| Intake | Food, drinks, nicotine, supplements, their daily totals, logging, library, and goals |
| Body | Measurements, imported health data, trends, and measurement goals |
| Life | Wheel-of-life reviews, focus areas, goals, habits, and challenges |

Settings contains configuration rather than product features: appearance,
check-in prompts, reminders, health connections, intake tracking, units, data,
and the optional account.

## Current capabilities

- Morning and evening check-ins, each anchored on mood and configurable with
  optional scores.
- Day notes, history, trends, and on-device derived insights.
- Wheel-of-life reviews, focus areas, goals, habits, and solo challenges.
- Manual body measurements plus HealthKit and Health Connect imports.
- A unified intake model for food, drinks, nicotine, supplements, and other
  consumables, with constituents, portions, recipes, daily totals, goals, and a
  local library.
- Anonymous Open Food Facts search. Saved and recent items remain usable
  offline; the API also exposes reference and barcode-number lookup for later
  client flows.
- Data export with sensitive data excluded by default, and transactional local
  product-data deletion.
- Optional email/password registration, sign-in, sign-out, account switching,
  and password-confirmed account deletion.

## Domain rules

### Observations and derived values

Subjective scores and measurements are narrow timestamped observations rather
than columns on one daily row. Imported raw samples are rolled up into daily
metrics. Trends, habit completion, goal progress, intake totals, and insights
are derived at read time rather than stored as a second truth.

### Catalogue, overlay, snapshot

Authored catalogues define stable product vocabulary. User choices and custom
content form an overlay. Logged and reviewed records snapshot the wording and
values needed to preserve history, so a later catalogue or provider change
does not rewrite the past.

### Intake

A consumable describes a reusable thing and its composition. An intake event
records what was taken and snapshots its constituent amounts. Food, drinks,
nicotine, and supplements use this one model; presentation varies by kind, but
totals project from the same event stream.

### Privacy and tone

The app does not infer that missing data means a positive outcome. It presents
evidence and estimates without grading, shaming, diagnosing, or moralising.
Sensitive metrics and intake kinds are omitted from exports unless the user
explicitly includes them.

## Not shipped

Remote product-data sync, purchase-backed premium entitlements, biometric app
protection, encrypted SQLite, saved meals, meal plans, community content, and a
second food-data provider are future work. See the [roadmap](roadmap.md) for
the active sequence; archived plans are not promises of current behaviour.
