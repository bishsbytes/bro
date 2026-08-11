---
type: library
title: Server authentication
description: Better Auth server factory and schema-generation contract for email/password authentication over the API's Postgres database.
tags: [authentication, better-auth, server]
---

# Server authentication

`@bro/auth-api` is a server-only library. `createAuth` in `packages/auth/api/src/server.ts` accepts an `ApiDb`, secret, base URL, and optional trusted origins, then creates Better Auth with the Drizzle Postgres adapter and exported schema. `Auth` is the inferred return type used by API middleware and environment composition.

`authOptions` in `options.ts` is the single source for schema-affecting runtime options: email/password is enabled and the `expo()` plugin is registered. `APP_SCHEME` is `app`; default trusted origins are `app://` and `exp://*`. The CLI-only `better-auth.config.ts` reuses these options so generated auth tables do not drift from runtime configuration. The generated contract is written to `packages/database/api/src/schema/auth.ts` by `nx run @bro/auth-api:auth:generate-schema`.

The API injects the secret and database from `apps/api/src/env.ts`; this package never reads `process.env`. The client must pair `expo()` with `expoClient({ scheme: "app" })`; see [client authentication](client.md).

## Extension contract

When changing plugins, email/password options, or custom user/session fields, update `authOptions`, regenerate `database/api/src/schema/auth.ts`, generate a Postgres migration, and apply it. Export changes flow through `packages/auth/api/src/index.ts` and the `@bro/auth-api` package root. Consumer-facing type impact is visible through `Auth` and `CreateAuthOptions`; the API's `auth` singleton is the runtime consumer.

Focused validation is `pnpm exec nx run @bro/auth-api:auth:generate-schema` followed by `pnpm exec nx run @bro/database-api:db:generate`, then typecheck. The repository contains no dedicated auth server test files.
