---
type: operations guide
title: Development operations
description: Local environment, Docker Postgres, Nx target discovery, generated artifacts, module-resolution boundaries, and focused validation commands.
tags: [operations, development, nx]
openwiki:
  roles: [operations, repository, testing]
  change_kinds: [workspace, validation, generated-artifact]
  source_paths: [package.json, nx.json, pnpm-workspace.yaml, apps/app/package.json]
  validation_commands: [pnpm nx show projects]
---

# Development operations

Requirements are Node 20+, pnpm, and Docker. Copy the placeholder environment examples locally, start Postgres, apply server migrations, then run API and Expo targets in separate terminals. Do not commit environment files or secrets.

```sh
pnpm install
docker compose up -d
pnpm nx run @bro/database-api:db:migrate
pnpm nx run @bro/api:serve
pnpm nx run @bro/app:start
```

For emulator/device API address selection, use the [quickstart](../quickstart.md#start-locally). Runtime ordering and storage ownership are documented in [runtime workflows](../architecture/workflows.md) and [mobile database](../database/mobile.md).

## Target discovery and validation

Nx resolves the complete project and target configuration; package manifests may carry project metadata, but `pnpm nx show projects` and `pnpm nx show project <name>` are authoritative. Use these focused routes before broad checks:

- App route/store/component change: `pnpm nx test @bro/app --runTestsByPath src/<focused-test>.tsx`.
- Pure shared calculation: `pnpm nx test @bro/logic --runTestsByPath src/<focused-test>.ts`.
- Device migration/repository: `pnpm nx test @bro/database-app --runTestsByPath src/<focused-test>.ts`; use `db:generate` after schema changes.
- API request behavior: `pnpm nx test @bro/api --runTestsByPath src/<focused-test>.ts`.
- Better Auth schema: `pnpm nx run @bro/auth-api:auth:generate-schema`, then `pnpm nx run @bro/database-api:db:generate` and `db:migrate`.

`pnpm lint`, `pnpm check`, and `pnpm nx run-many -t typecheck` are broader checks. Use them for changed package edges, public exports, workspace configuration, or when the focused check exposes a cross-package type issue—not as the default confirmation of an isolated feature change. Docker/Testcontainers integration tests and Android/iOS/EAS builds are conditional on their integration boundaries.

## Generated and module-boundary rules

Mobile migration manifests and server SQL are generated from schemas; Better Auth's schema is generated from shared options; native projects/assets have their own Expo/brand inputs. Run the source-backed generator and review derived output rather than hand-editing a manifest, migration, or generated schema. See [automation](automation.md) for EAS/OpenWiki and [shared domain and logic](../architecture/shared-domain.md) for cross-package exports.

API-side TypeScript uses Node ESM with `.js` relative import suffixes. Expo-side packages use bundler resolution and extensionless imports because Metro does not remap `.js` to `.ts`. Run Nx sync after adding cross-package imports; Biome owns formatting/general linting and ESLint enforces Nx module boundaries.
