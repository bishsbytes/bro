---
type: operations guide
title: Development operations
description: Local environment, Docker Postgres, Nx targets, module-resolution conventions, and narrow validation commands for safe repository changes.
tags: [operations, development, nx]
---

# Development operations

Requirements are Node 20+, pnpm, and Docker. Copy the root `.env.example` to `.env` with placeholder values replaced locally, copy `apps/app/.env.example` to the app environment, start Postgres with `docker compose up -d`, apply server migrations, then run the API and Expo targets. Do not commit environment files or secrets.

```sh
pnpm install
docker compose up -d
pnpm exec nx run @bro/database-api:db:migrate
pnpm exec nx run @bro/api:serve
pnpm exec nx run app:start
```

## Target routing

- API: `nx run @bro/api:serve` or `nx run @bro/api:build`.
- Server schema: `nx run @bro/database-api:db:generate` and `db:migrate`.
- Mobile schema: `nx run @bro/database-app:db:generate`.
- Auth schema: `nx run @bro/auth-api:auth:generate-schema`.
- Repository-wide checks: `pnpm lint`, `pnpm check`, `pnpm exec nx run-many -t typecheck`.

Nx configuration is inferred from each `package.json`; there are no `project.json` files. API-side TypeScript uses `nodenext` and `.js` relative import suffixes. Expo-side packages use bundler resolution without suffixes because Metro does not remap `.js` to `.ts`. Run Nx sync after adding cross-package imports. Biome owns formatting/general linting, while ESLint enforces Nx module boundaries.

See [automation](automation.md) for CI/OpenWiki and EAS behavior. See [architecture](../architecture/overview.md) for package ownership and [runtime workflows](../architecture/workflows.md) for startup/migration ordering.
