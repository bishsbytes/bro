---
type: quickstart
title: Bro code wiki quickstart
description: Entry point for understanding and safely changing the Bro offline-first Expo Router, local SQLite, shared-domain, and Hono API monorepo.
tags: [quickstart, navigation]
openwiki:
  roles: [repository, workflow]
  change_kinds: [navigation]
---

# Bro code wiki quickstart

Bro is an Nx + pnpm monorepo for an offline-first men's wellbeing journal. The Expo Router app stores product data on device and works without an account; the Hono API supports optional identity and anonymous food lookup. Begin with [repository architecture](architecture/overview.md), then use the routing table to reach the owning symbols, tests, and narrowest check.

## Wiki map

- [Repository architecture](architecture/overview.md) — packages, dependency direction, and ownership boundaries.
- [Shared domain, records, and logic](architecture/shared-domain.md) — catalogues, record contracts, pure calculations, and cross-package extension seams.
- [Mobile client](app/mobile-client.md) — Expo startup, protected routes, tabs, native boundaries, and navigation.
- [Mobile product workflows](app/product-workflows.md) — Journal, Intake, Body, Life, Settings, feature stores, and local-data continuity.
- [Mobile database](database/mobile.md) — three SQLite stores, migrations, repositories, and persistence changes.
- [Hono API server](api/server.md) — health, Better Auth, food lookup, CORS, rate limiting, and request tests.
- [Mobile authentication](auth/client.md) and [server authentication](auth/server.md) — optional identity contract and account lifecycle.
- [Server database](database/server.md) — Postgres, Drizzle, and Better Auth schema generation.
- [Development operations](development/operations.md) and [automation](development/automation.md) — setup, Nx, CI, EAS, and generated artifacts.

## Task routing

| Change area or user intent | Relevant wiki page | Exact source entry points | Important symbols or types | Focused tests | Minimal validation command |
| --- | --- | --- | --- | --- | --- |
| Add or change a mobile route, tab, or shared chrome | [Mobile client](app/mobile-client.md) | `apps/app/src/app/_layout.tsx`, `apps/app/src/app/(tabs)/_layout.tsx` | `RootNavigator`, `TabLayout`, `TabShell` | `app-navigation.test.tsx`, `tab-layout.test.tsx` | `pnpm nx test @bro/app --runTestsByPath src/tab-layout.test.tsx` |
| Change a Journal, Intake, Body, Life, or Settings flow | [Mobile product workflows](app/product-workflows.md) | `apps/app/src/screens/`, feature store under `apps/app/src/` | feature-specific `create...Store` | nearest `*-flow.test.tsx` | `pnpm nx test @bro/app --runTestsByPath src/<focused-test>.tsx` |
| Add local product data, repository, or migration | [Mobile database](database/mobile.md) | `packages/database/app/src/schema.ts`, `local-schema.ts`, `repositories/`, `src/index.ts` | `BaseRepository`, `runMigrations`, `runLocalMigrations` | `migrator.test.ts`, closest repository test | `pnpm nx test @bro/database-app --runTestsByPath src/migrator.test.ts` |
| Change catalogue, unit, record, or pure derivation | [Shared domain and logic](architecture/shared-domain.md) | `packages/domain/src/`, `packages/mobile-model/src/records.ts`, `packages/logic/src/` | catalogue APIs, `IntakeEvent`, logic barrel exports | nearest package `*.test.ts` | `pnpm nx test @bro/logic --runTestsByPath src/<focused-test>.ts` |
| Add/change an API food or application route | [API server](api/server.md) | `apps/api/src/app.ts`, `routes/food.ts`, `food/open-food-facts.ts` | `createApp`, `createFoodRoutes`, `InMemoryFoodRateLimiter` | `food.test.ts` | `pnpm nx test @bro/api --runTestsByPath src/food.test.ts` |
| Change sign-in, sign-out, or account deletion | [Mobile auth](auth/client.md), [server auth](auth/server.md) | `auth-provider.tsx`, `packages/auth/api/src/options.ts` | `AuthProvider`, `RemoteSessionBridge`, `authOptions` | `auth-provider.test.tsx`, `local-data-continuity.test.tsx` | `pnpm nx test @bro/app --runTestsByPath src/auth-provider.test.tsx` |
| Change Postgres/auth schema | [Server database](database/server.md), [server auth](auth/server.md) | `packages/database/api/src/schema/`, `better-auth.config.ts` | `createApiDb`, `createAuth`, `authOptions` | `account-deletion.test.ts` | `pnpm nx run @bro/auth-api:auth:generate-schema` |
| Change workspace, native build, generated assets, or CI | [Operations](development/operations.md), [automation](development/automation.md) | `package.json`, `nx.json`, `apps/app/app.json`, workflow YAML | Nx targets, EAS hook, brand generator | affected config/package test | nearest documented command; native build only when native inputs change |

## Start locally

Use Node 20+, pnpm, and Docker. Copy placeholder environment examples locally, start Postgres, apply migrations, then start the API and Expo app in separate terminals:

```sh
pnpm install
docker compose up -d
pnpm nx run @bro/database-api:db:migrate
pnpm nx run @bro/api:serve
pnpm nx run @bro/app:start
```

For Android emulator use `http://10.0.2.2:3000` as `EXPO_PUBLIC_API_URL`; iOS simulator/web use `http://localhost:3000`; a physical device needs the development machine's LAN address. Do not commit environment files or secrets. Prefer the focused test in the table; `pnpm lint`, `pnpm check`, and `pnpm nx run-many -t typecheck` are broader checks for cross-package, lint, or workspace changes.

## Backlog and scope boundaries

No documentation coverage is deferred. Remote product-data synchronization, premium entitlements, biometric protection, encrypted SQLite, saved meals/meal plans, community content, and a second food provider are roadmap work rather than current systems; source anchors are `README.md` and `docs/product.md`.
