---
type: library
title: Server authentication
description: Better Auth server factory, optional account deletion contract, Expo plugin options, trusted origins, and generated Postgres schema workflow.
tags: [authentication, better-auth, server]
openwiki:
  roles: [integration, operations, testing]
  change_kinds: [authentication, schema, account-lifecycle]
  source_paths: [packages/auth/api/src/options.ts, packages/auth/api/src/server.ts, packages/auth/api/better-auth.config.ts]
  symbols: [createAuth, authOptions, APP_SCHEME, defaultTrustedOrigins]
  test_paths: [apps/api/src/account-deletion.test.ts]
  invariants: [Runtime and generator share authOptions., Account deletion currently owns Better Auth rows only.]
  validation_commands: [pnpm nx run @bro/auth-api:auth:generate-schema]
---

# Server authentication

`@bro/auth-api` is server-only. `createAuth` in `packages/auth/api/src/server.ts` accepts an injected `ApiDb`, secret, base URL, and optional trusted origins, then configures Better Auth with Drizzle/Postgres. The API supplies these dependencies from `apps/api/src/env.ts`; the library never reads environment variables. [Mobile authentication](client.md) is its Expo client counterpart.

`authOptions` is the single schema-affecting source used by both the runtime factory and `better-auth.config.ts`: email/password is enabled, user deletion is enabled, and the `expo()` plugin is registered. `APP_SCHEME` is `app`; default trusted origins include `app://` and `exp://*`. Keep this scheme aligned with `apps/app/app.json` and the Expo client plugin.

## Schema and lifecycle contract

Changing a plugin, email/password option, custom user/session field, or delete-user behavior has a complete surface:

1. Update `authOptions` and any matching client configuration.
2. Run `pnpm nx run @bro/auth-api:auth:generate-schema` to regenerate `packages/database/api/src/schema/auth.ts`.
3. Run `pnpm nx run @bro/database-api:db:generate`, inspect generated SQL, and apply `pnpm nx run @bro/database-api:db:migrate` against the intended Postgres database.
4. Keep exports in `packages/auth/api/src/index.ts` correct and validate the API consumer path through `createApp`.

Generated auth schema and migration output are derived artifacts; do not hand-edit them to make runtime behavior appear complete. A defining module test/typecheck alone does not prove Better Auth, the package root, generated schema, and API consumer agree.

Account deletion currently owns the Better Auth user/account/session rows, whose foreign keys cascade from the user. Before attaching external account-owned resources, add an explicit pre-delete lifecycle hook rather than assuming the current cascade covers them. `apps/api/src/account-deletion.test.ts` verifies registration, wrong-password preservation, successful cascade, and unusable deleted session using Testcontainers; run it when deletion, Better Auth options, or server schema changes.
