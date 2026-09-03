---
type: data layer
title: Mobile database
description: Three device-local SQLite stores with generated Drizzle migration manifests, repository-only runtime access, device settings, and explicit product-data deletion boundaries.
tags: [database, sqlite, offline-first, migrations]
openwiki:
  roles: [architecture, domain, workflow, testing]
  change_kinds: [local-data, migration, repository]
  source_paths: [packages/database/app/src/index.ts, packages/database/app/src/migrator.ts, packages/database/app/src/device-settings.ts]
  symbols: [initDb, initLocalDb, runMigrations, runLocalMigrations, BaseRepository, deleteLocalProductData]
  test_paths: [packages/database/app/src/migrator.test.ts, packages/database/app/src/repositories.test.ts, packages/database/app/src/device-settings.test.ts]
  invariants: [Product, disposable local, and device-settings data have separate lifecycle contracts., Both migration manifests must finish before app providers mount.]
  validation_commands: [pnpm nx test @bro/database-app --runTestsByPath src/migrator.test.ts]
---

# Mobile database

`@bro/database-app` is the device persistence boundary for [the Expo client](../app/mobile-client.md). It owns three independent SQLite stores, generated migrations, and domain repositories. Runtime reads and writes use parameterized `expo-sqlite` APIs; Drizzle schema files and Drizzle's async SQLite dialect support migration generation and application, not arbitrary app queries. Record meaning and calculations belong to [shared domain and logic](../architecture/shared-domain.md).

## Storage ownership

| Store | Connection and migration | Contents and lifecycle |
| --- | --- | --- |
| `bro.db` | `initDb`, `runMigrations`, `src/schema.ts`, `src/migrations/manifest.ts` | Durable product records: observations, notes, reminders, reviews, goals, habits, intake, preferences, and daily rollups. Future sync candidate, but currently local only. |
| `bro-local.db` | `initLocalDb`, `runLocalMigrations`, `src/local-schema.ts`, `src/migrations/local-manifest.ts` | Disposable/device-specific data including health connections, raw imported samples, and the food cache. |
| `bro-device.db` | `readDeviceSettings` via SQLite key/value storage | Onboarding, theme/accent, installation identity, app-lock preference, and remote-session hints. Never a product-data authority. |

The startup order is owned by `RootLayout`: read device settings, open product then local relational stores, and migrate both before providers mount. See [mobile client](../app/mobile-client.md#startup-and-route-gates). The two relational opens must stay sequential for web VFS safety. Product data intentionally survives optional sign-in, sign-out, account switching, and account deletion; `bro-device.db` may only hold a session hint, never ownership of `bro.db` rows.

## Migration and repository seam

`drizzle.config.ts` and schema files produce SQL migrations. `scripts/generate-migrations-manifest.ts` embeds their SQL/journal in TypeScript because Metro cannot load migration files from disk. `runMigrations` and `runLocalMigrations` pass each independent manifest through Drizzle's async SQLite dialect. A migration failure blocks startup; the retry logic closes handles before reopening.

`BaseRepository` is the narrow runtime abstraction. Repositories accept an initialized `SQLiteDatabase`, offer named domain operations over parameterized SQL, and use their transaction helpers for multi-step writes. `src/index.ts` is the package's consumer-facing barrel: a repository or public record type is incomplete until exported there. `PRODUCT_TABLE_NAMES` and `LOCAL_TABLE_NAMES` are deletion inventories; change them with schemas so lifecycle operations cover every owned table.

## Persistence change recipe

1. Decide the owner: durable product table in `schema.ts`, disposable/device integration table in `local-schema.ts`, or device preference in the settings store. Do not merge their lifecycles merely because a screen consumes both.
2. Update the schema and migration inputs, then run `pnpm nx run @bro/database-app:db:generate`; it produces SQL and updates the bundled manifest. Generated SQL/manifests are derived output—do not hand-edit them.
3. Add a typed repository with parameterized SQL, transactional writes where a record and its children must agree, and export it from `src/index.ts`. Add a persistence-independent contract in `@bro/mobile-model` when logic crosses package boundaries.
4. Wire the repository into a feature store only after startup guarantees the connection/migrations. Add a targeted repository/migrator test and the feature-flow test.

For app-local data, this does not create a server table, API route, or sync path. Escalate to [server database](server.md) and [API server](../api/server.md) only when a separately designed remote feature needs them.

## Focused validation

Use `pnpm nx test @bro/database-app --runTestsByPath src/migrator.test.ts` for manifest and apply behavior; use `repositories.test.ts`, `health-repositories.test.ts`, or `habit-challenge-repositories.test.ts` for the closest persistence contract; `device-settings.test.ts` covers settings semantics. Then run the affected app store/flow test. Run a device startup smoke test after migration changes. A broad app build is conditional on native/database adapter changes, not an ordinary repository query change.
