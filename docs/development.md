# Development

## Setup

Use the pnpm version declared in `package.json`. Local API development also
needs Docker and a `BETTER_AUTH_SECRET` of at least 32 random bytes.

```sh
pnpm install
cp .env.example .env
cp apps/app/.env.example apps/app/.env
docker compose up -d
pnpm nx run @bro/database-api:db:migrate
```

Start the two applications in separate terminals:

```sh
pnpm nx run @bro/api:serve
pnpm nx run @bro/app:start
```

The API defaults to port 3000. Set `EXPO_PUBLIC_API_URL` to the address visible
from the target device: `10.0.2.2` for an Android emulator, `localhost` for the
iOS simulator or web, and the host's LAN address for a physical device.

## Discover projects and targets

Nx infers targets from plugins and package metadata, so do not maintain a
hand-written target inventory or add `project.json` files.

```sh
pnpm nx show projects
pnpm nx show project @bro/app
pnpm nx graph
```

Run tasks through Nx so dependency ordering, caching, and inferred configuration
stay in effect.

## Common tasks

| Command | Purpose |
| --- | --- |
| `pnpm nx run @bro/api:serve` | Run the API with watch and restart |
| `pnpm nx run @bro/api:build` | Create the production API bundle |
| `pnpm nx run @bro/app:start` | Start Expo |
| `pnpm nx run @bro/app:run-android` | Build and run the Android app |
| `pnpm nx run @bro/app:run-ios` | Build and run the iOS app |
| `pnpm nx run <project>:test` | Run a project's test suite, where defined |
| `pnpm nx run <project>:typecheck` | Type-check a project and its dependencies |
| `pnpm nx run <project>:lint` | Run module-boundary and app-copy lint rules |
| `pnpm nx run-many -t test` | Run every available test target |
| `pnpm nx run-many -t typecheck` | Type-check the workspace |
| `pnpm nx run-many -t lint` | Run every available ESLint target |
| `pnpm biome check .` | Check formatting, imports, and Biome lint rules |

## Schema workflows

Generate and apply API/Postgres migrations with:

```sh
pnpm nx run @bro/database-api:db:generate
pnpm nx run @bro/database-api:db:migrate
```

After changing app schema definitions or the product/local table inventory:

```sh
pnpm nx run @bro/database-app:db:generate
```

That target generates Drizzle SQL and rebuilds the migration manifest. Commit
both outputs and do not hand-edit them. See the
[repository recipe](../packages/database/app/src/repositories/README.md).

After changing Better Auth plugins or schema-affecting options:

```sh
pnpm nx run @bro/auth-api:auth:generate-schema
pnpm nx run @bro/database-api:db:generate
```

Review the generated auth schema before generating the Postgres migration.

## Code conventions

- API-side packages use Node ESM/`nodenext`; relative imports include `.js`.
  App-side packages and `@bro/domain` use bundler resolution without suffixes.
- Run `pnpm nx sync` after adding a cross-package import so TypeScript project
  references remain generated rather than maintained by hand.
- Add sibling workspace packages with pnpm workspace commands. Do not patch
  resolution with TypeScript path aliases.
- Dependencies shared with Expo must match the SDK. Check
  `node_modules/expo/bundledNativeModules.json` before changing a native package.
- Runtime device queries belong in repositories and use SQL parameters; record
  contracts belong in `@bro/mobile-model`; calculations belong in `@bro/logic`.
- Before UI work, read [`design/DESIGN.md`](../design/DESIGN.md) and
  [`design/REACT_NATIVE.md`](../design/REACT_NATIVE.md).

### App copy

Put user-facing strings in the feature namespace under
`apps/app/src/i18n/locales/en`, using `common.ts` only when multiple features
share the wording. Interpolate complete messages rather than concatenating
fragments. New namespaces must be registered in `locales/index.ts`.

Values from `@bro/domain` that reach a screen should pass through
`apps/app/src/content`, which supplies translated catalogue wording. Use
count-aware unit-word overrides for words such as “units” or “fl oz”; symbols
can remain in the dependency-free domain formatter.

## Verification

For a focused change, run the affected projects' test, typecheck, and lint
targets, then always run the repository-wide Biome check:

```sh
pnpm nx run <project>:test
pnpm nx run <project>:typecheck
pnpm nx run <project>:lint
pnpm biome check .
```

Use the corresponding `run-many` commands for cross-cutting changes. There is
no test/lint/format CI workflow; the scheduled GitHub workflow only refreshes
OpenWiki, so local verification is the release gate.

## Known implementation constraints

- `@bro/auth-app` has a guarded `@ts-expect-error` for the installed Better Auth
  Expo plugin's declaration mismatch. Keep it until the upstream types agree;
  casting it would weaken session inference.
- The `app` URL scheme is repeated in the Expo config and both auth packages.
  A scheme change must update all three locations and their tests.
- Reminder notification text is materialised when scheduled. A future in-app
  language switch must cancel and recreate scheduled reminders.
- The app content adapter returns new wrapper objects. Compare catalogue slugs,
  not object identity.
