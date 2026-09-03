# Roadmap

This file contains work that has not shipped. Current behaviour belongs in
[product](product.md) and [architecture](architecture.md); completed delivery
plans live in the [archive](archive/README.md).

The sequence is directional, not a release commitment. Each phase should be
revalidated against the code before implementation.

## Release validation debt

Before treating the existing native integrations as release-ready:

- Complete the focused Android and iOS account-state and identity-journey pass.
- Exercise reminders on physical devices, including killed-app delivery,
  permission recovery, timezone/DST changes, and notification routing.
- Complete HealthKit/Health Connect physical-device flows, backup-exclusion
  inspection, the authenticated iOS development build, and Play Console health
  declarations.

## Intake

The unified consumable/constituent model, generic logging, local library, and a
first recipe creator are complete. Remaining work is organised by outcome
rather than by the obsolete delivery phase numbers in the archived plan:

1. **Designed daily experience.** Make repeat logging faster, add the Intake
   week/day view, personal baseline bands, category summaries, and the full
   tracked-constituent settings experience.
2. **Finish the composition editor.** Edit a consumable against an explicit
   mass, volume, or portion basis; preserve provider/system content through
   fork-on-edit; save provider items without logging them.
3. **Finish recipe lifecycle.** Edit existing recipes, choose referenced or
   nested ingredients, preserve ingredient snapshots, and keep cycle rejection
   visible in the UI.
4. **Saved meals.** Expand one reusable meal into independent intake events so
   every logged item remains separately correctable.
5. **Meal plans.** Keep planned intent separate from recorded intake; confirming,
   skipping, or replacing a plan item must never infer consumption.
6. **Stream refinement.** Improve supplement and medication presentation over
   the existing generic event model. Medication remains sensitive and does not
   imply scheduling or adherence.
7. **Provider abstraction.** Formalise the existing Open Food Facts adapter as
   a multi-provider boundary, add a second provider behind a feature flag, and
   retain source/licence data.
8. **Community content.** Version downloadable consumables, recipes, saved meals,
   and plans; fork on edit; make upgrades explicit; enforce publishability by
   kind and constituent.

Stable constraints across these phases: events snapshot their constituents;
local ids are not external content ids; reusable rows retain provenance;
provider search is the only normal intake path that requires a network.

## Platform, identity, and premium

Local-first entry and optional accounts are implemented. Future phases are:

1. **Optional app protection.** Add a biometric/device-credential privacy gate
   after settling fallback behaviour, background timeout, and unsupported-device
   copy. This is a UI gate unless encrypted SQLite is delivered separately.
2. **Premium authority.** Choose the purchase provider and entitlement model;
   verify entitlements server-side through idempotent webhooks and reconciliation.
   The client must represent an `unknown` state without silently granting access.
3. **Opt-in Turso sync.** Provision a database per user (subject to confirmed
   service limits), mint short-lived database-scoped credentials from verified
   server entitlements, adopt local data explicitly, and handle sync generations
   and schema compatibility.
4. **Optional encryption at rest.** Decide the SQLCipher threat model, key
   recovery, database adoption, and performance costs before implementation.

Sync does not follow automatically from account creation or purchase. The user
must opt in, and `bro-device.db` plus `bro-local.db` remain device-only.

## Decisions required before implementation

- Platform backup policy for all three mobile stores.
- App-lock fallback and timeout semantics.
- Purchase provider, trial scope, restore behaviour, and entitlement lapse UX.
- Turso topology, per-account limits, adoption feasibility, retention after a
  premium lapse, and conflict/recovery behaviour.
- SQLCipher recovery policy and its interaction with sync.
