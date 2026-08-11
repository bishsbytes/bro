---
type: data layer
title: Mobile database
description: Offline-first embedded SQLite and optional libSQL connection with generated migration manifest and parameterized repository extension seam.
tags: [database, sqlite, offline-first]
---

# Mobile database

`@bro/database-app` deliberately keeps Drizzle out of the runtime query path. `src/schema.ts` and `drizzle.config.ts` support migration generation, while `connection.ts`, `migrator.ts`, and repositories use the raw `expo-sqlite` API. The default store is `bro.db` on device. Supplying both `EXPO_PUBLIC_TURSO_SYNC_URL` and `EXPO_PUBLIC_TURSO_AUTH_TOKEN` opens an embedded libSQL replica; supplying only one throws, and supplying neither is the supported local-only workflow.

`initDb` memoizes both the opened handle and an in-flight open promise, so concurrent startup callers share one connection. `getDb` requires explicit initialization, `isSyncEnabled` reports the mode, `triggerSync` calls `syncLibSQL` only in replica mode, and `closeDb` calls `closeAsync`, clears the database handle, and resets `syncEnabled` for tests, but does not reset the module-level `opening` promise; normal open failures clear that promise in the success-only `.then` chain, while a close during an in-flight open is not a supported lifecycle. An `open()` rejection clears the in-flight promise through the success-only callback chain, allowing a later `initDb` attempt; a migration failure happens after opening and does not automatically close/reset the handle, so callers must call `closeDb` or reload before a clean retry. Sync is low-level scaffolding: the application does not schedule foreground/connectivity/retry synchronization and must not ship long-lived production tokens.

## Migration lifecycle

The generated `src/migrations/manifest.ts` contains SQL strings because Metro cannot read migration files at runtime. `runMigrations` creates `__app_migrations`, skips recorded IDs, splits Drizzle breakpoints, executes every statement in one transaction, and records the migration only after successful execution. It throws on the first failure so `App` stops startup rather than using an unknown schema.

## Repository seam

`BaseRepository` accepts an initialized `SQLiteDatabase` and exposes protected `all`, `first`, `run`, and `transaction` helpers. Domain subclasses must provide named operations and parameterized SQL; there is intentionally no public arbitrary `execute(sql)` escape hatch. The repository README is the canonical recipe for adding a domain repository. Export new repositories through `src/index.ts` for app consumers.

## Persistence change recipe

For an app-local domain, add its table to `src/schema.ts`, run `nx run @bro/database-app:db:generate` so Drizzle Kit emits SQL and the manifest script embeds it, then implement a domain subclass of `BaseRepository` with parameterized SQL and export it from `src/index.ts`. Instantiate that repository only after `initDb` and `runMigrations`; `App` itself needs no registration unless the new domain must be loaded during startup. If the record is also authoritative on the server, add the corresponding Drizzle table/export under `database/api/src/schema`, run `@bro/database-api:db:generate`, apply `db:migrate`, and define the API route/service separately—there is no automatic sync or shared repository between the stores.

Generate with `pnpm exec nx run @bro/database-app:db:generate`, which runs Drizzle Kit and then `scripts/generate-migrations-manifest.ts`. Validate with app typecheck and startup; migration behavior is the focused seam for future SQLite tests. This database is not the API's authoritative store and currently has no remote sync workflow.
