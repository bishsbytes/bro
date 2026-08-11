---
type: quickstart
title: Bro code wiki quickstart
description: Entry point for understanding and safely changing the Bro offline-first Expo and Hono monorepo.
tags: [quickstart, navigation]
---

# Bro code wiki quickstart

Bro is an Nx + pnpm monorepo for a men's wellbeing app: an offline-first Expo mobile client backed by a Hono API. Start with [repository architecture](architecture/overview.md), then follow the system page for your change. [Runtime workflows](architecture/workflows.md) explains the cross-system ordering.

## Wiki map

- [Repository architecture](architecture/overview.md) — package graph, ownership boundaries, and authoritative versus local data.
- [Runtime workflows](architecture/workflows.md) — mobile startup, auth request flow, and migration lifecycles.
- [Expo mobile client](app/mobile-client.md) — `App`, screen branching, Expo/Metro surface, and startup errors.
- [Hono API server](api/server.md) — `createApp`, `main`, health/auth routes, environment, and session middleware.
- [Server authentication](auth/server.md) — `createAuth`, `authOptions`, trusted origins, and generated schema contract.
- [Mobile authentication](auth/client.md) — `authClient`, SecureStore, `AuthProvider`, and `useAuth`.
- [Server database](database/server.md) — Postgres Drizzle client, Better Auth tables, and migrations.
- [Mobile database](database/mobile.md) — embedded SQLite/libSQL, migration manifest, and repository seam.
- [Development operations](development/operations.md) — local setup, Nx targets, validation, and TypeScript boundaries.
- [CI and build automation](development/automation.md) — OpenWiki scheduled updates and EAS post-install behavior.

## Task routing

| Intent | Canonical page | Entry points and symbols | Focused validation |
|---|---|---|---|
| Add/change an API route | [API server](api/server.md) | `apps/api/src/app.ts`, route modules, `createApp`, `withSession` | `app.request(...)` seam, API typecheck/build |
| Change sign-in/session behavior | [Mobile auth](auth/client.md) and [server auth](auth/server.md) | `authClient`, `AuthProvider`, `createAuth`, `authOptions` | auth schema generation, typecheck, Expo start |
| Change auth tables | [Server database](database/server.md) | `database/api/src/schema/auth.ts`, `better-auth.config.ts` | auth schema generation, `db:generate`, `db:migrate` |
| Add local data/domain storage | [Mobile database](database/mobile.md) | `connection.ts`, `runMigrations`, `BaseRepository`, `src/schema.ts` | `database-app:db:generate`, app startup/typecheck |
| Change startup or screens | [Mobile client](app/mobile-client.md) | `apps/app/src/app/App.tsx`, screen components | Expo start, typecheck, lint |
| Change workspace/build/CI behavior | [Operations](development/operations.md) and [automation](development/automation.md) | package `nx.targets`, workflow YAML, EAS hook | lint, relevant Nx/Expo/EAS path |

## Getting started

Use Node 20+, pnpm, and Docker. Copy placeholder environment examples locally, start Postgres, apply migrations, then run the API and Expo development server:

```sh
pnpm install
docker compose up -d
pnpm exec nx run @bro/database-api:db:migrate
pnpm exec nx run @bro/api:serve
pnpm exec nx run app:start
```

Run `pnpm lint`, `pnpm check`, or `pnpm exec nx run-many -t typecheck` for broad checks. Keep API-side `.js` import suffixes and app-side extensionless imports consistent with their package's module-resolution mode. Do not commit secrets or environment files.

## Backlog and scope boundaries

No backlog item is deferred for documentation coverage. The source currently has no navigation library, application-domain repositories, business API routes, or scheduled Turso sync; those are future extension areas and are explicitly described as boundaries on the relevant pages.
