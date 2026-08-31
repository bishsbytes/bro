# Bro

A men's wellbeing app: an Expo mobile client backed by a Hono API, in an Nx + pnpm monorepo.

The app is **offline-first** — it reads and writes its own embedded database on the device, so the UI never waits on the network. The API owns the authoritative Postgres database and authentication. Remote database sync is planned but is not enabled by the app yet.

## Layout

```
apps/
  app/                     @bro/app           Expo (SDK 56) mobile client
  api/                     @bro/api           Hono API server (Node)
packages/
  database/
    api/                   @bro/database-api  Postgres schema, migrations, Drizzle client
    app/                   @bro/database-app  Embedded Turso/libSQL access + repositories
  auth/
    api/                   @bro/auth-api      Better Auth server configuration
    app/                   @bro/auth-app      Better Auth Expo client, provider, hooks
  domain/                  @bro/domain        Shared catalogues, metric registry, units logic
  mobile-model/            @bro/mobile-model  Persistence-independent mobile record contracts
  logic/                   @bro/logic         Pure computation over mobile records
```

`database` and `auth` are each split into an `api` and an `app` half. The two halves never import each other, so server-only code (Postgres driver, Drizzle, auth secret) can't be pulled into the React Native bundle.

`domain` is the exception to the split: pure TypeScript with no runtime dependencies, holding the product's definitional core — the content catalogues (habits, challenges, insights, life areas), the metric registry, unit conversion/formatting, and shared vocabulary types. It is tagged `scope:shared`, so ESLint lets both sides depend on it while it may depend on nothing. The app consumes it today; the API can adopt it when it grows server-side features.

`mobile-model` owns database-independent record shapes. Both `database/app` and `logic` depend on it, so repository implementation and migration changes do not invalidate pure computation. `database/app` re-exports these types for compatibility, while `logic` imports their owning package directly.

```mermaid
graph TD
  APP["apps/app<br/>Expo"] --> DBAPP["database/app<br/>embedded Turso"]
  APP --> AUTHAPP["auth/app<br/>Better Auth client"]
  APP --> DOMAIN["domain<br/>catalogues + units"]
  APP --> LOGIC["logic<br/>pure computation"]
  DBAPP --> DOMAIN
  DBAPP --> MODEL
  LOGIC --> DOMAIN
  LOGIC --> MODEL
  MODEL --> DOMAIN
  API["apps/api<br/>Hono"] --> DBAPI["database/api<br/>Postgres"]
  API --> AUTHAPI["auth/api<br/>Better Auth server"]
  AUTHAPI --> DBAPI
  AUTHAPP -. HTTP .-> API
```

Directories nest but package names flatten (`packages/database/api` → `@bro/database-api`), because npm names can't contain a slash past the scope. Nested packages are picked up by the `packages/*/*` glob in `pnpm-workspace.yaml` — without it, pnpm never creates the `@bro/*` symlinks and nothing resolves.

## Two databases, two access patterns

| | App (`@bro/database-app`) | API (`@bro/database-api`) |
|---|---|---|
| Store | Embedded libSQL/Turso on device | Postgres |
| Runtime queries | Hand-written SQL via repositories | Drizzle query client |
| Role of Drizzle | Schema authoring + migration codegen only | Schema *and* runtime client |
| Migrations run | At app startup, on device | Via `db:migrate` against a server |

On the app side the Drizzle client is deliberately kept out of the runtime path. `src/schema.ts` exists purely to drive `drizzle-kit generate`; queries go through one repository class per data domain, each issuing parameterised SQL over `expo-sqlite`'s raw API. See [the repository recipe](packages/database/app/src/repositories/README.md) for how to add one.

Migration SQL is compiled into `src/migrations/manifest.ts` as plain strings by a [small script](packages/database/app/scripts/generate-migrations-manifest.ts), because Metro can't read files off disk at runtime. This avoids needing `babel-plugin-inline-import` and Metro `sourceExts` changes across the package boundary.

### Local storage and future Turso sync

[`connection.ts`](packages/database/app/src/connection.ts) opens a purely local SQLite product database, one per device. Device-only metadata lives separately in `bro-device.db` as key-value pairs read synchronously, so onboarding, app-lock preferences, installation identity, and session hints can never replicate. Phase 5 will reintroduce embedded replicas with short-lived, database-scoped credentials minted by the API; no Turso credential is accepted from an Expo build-time environment variable.

## Auth

Better Auth, with the server half in `@bro/auth-api` and the client half in `@bro/auth-app`. These are necessarily separate — `createAuthClient` infers its types from the options you pass it, not from the server instance, and the server config carries the database and secret.

Each server plugin needs its client counterpart, and three values are paired by hand across the boundary:

| Concern | Server (`auth/api`) | Client (`auth/app`) |
|---|---|---|
| Plugin | `expo()` | `expoClient()` |
| App scheme | `defaultTrustedOrigins` | `expoClient({ scheme })` |
| Address | `baseURL` | `baseURL` from `EXPO_PUBLIC_API_URL` |

Within the server side, every option that affects the database schema lives in [`options.ts`](packages/auth/api/src/options.ts), shared by the runtime factory and by [`better-auth.config.ts`](packages/auth/api/better-auth.config.ts), which exists only so the CLI can generate the schema. That's what stops the generated tables from drifting from the runtime config.

The auth tables in [`database/api/src/schema/auth.ts`](packages/database/api/src/schema/auth.ts) are **generated** — regenerate with `nx run @bro/auth-api:auth:generate-schema` after changing auth plugins or options, then generate and apply a migration. Note the CLI is published as `auth`, not `@better-auth/cli` (which is stranded on an old version).

When custom `user`/`session` fields are added, the client will need `inferAdditionalFields<typeof auth>()` to know about them — a type-only generic, so it doesn't bundle server code.

Accounts are optional and never gate local app entry. The header cog opens Settings, where the account controls sit alongside the app's configuration. This screen owns sign-in, registration, local-first sign-out, retrying a stored session, account switching, and password-confirmed deletion. Deletion is server-first: a failed request preserves the session marker and all local data; success removes the Better Auth user/account/session rows, clears the supported Expo auth cache, and leaves `bro.db` open.

### Auth integration tests

Account deletion is exercised through Hono and Better Auth with Vitest. Testcontainers starts a fresh PostgreSQL container, applies the real migrations, and removes the container after the suite; no test database URL or manually managed Compose service is required.

```sh
pnpm nx run @bro/api:test
```

## Getting started

Requires Node 20+, pnpm, and Docker.

```sh
pnpm install
cp .env.example .env                  # then set BETTER_AUTH_SECRET
cp apps/app/.env.example apps/app/.env

docker compose up -d                  # Postgres on :5432
pnpm exec nx run @bro/database-api:db:migrate

pnpm exec nx run @bro/api:serve       # API on :3000
pnpm exec nx run app:start            # Expo dev server
```

Generate a secret with `openssl rand -base64 32`. For the Android emulator, set
`EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`; Android reserves `10.0.2.2` as an
alias to the development machine. The iOS simulator and web can use
`http://localhost:3000`. On a physical device, use your machine's LAN IP.

## Common tasks

| Command | Purpose |
|---|---|
| `nx run @bro/api:serve` | Run the development esbuild bundle with watch and automatic restart |
| `nx run @bro/api:build` | Production bundle (esbuild) |
| `pnpm nx run @bro/api:test` | Run API integration tests with Vitest and Testcontainers |
| `pnpm nx run @bro/app:test` | Run the Expo router, Account, startup, and storage tests |
| `pnpm nx run @bro/database-app:test` | Run embedded-database repository and migration tests |
| `pnpm nx run-many -t test-ci` | Run atomized per-file unit-test targets |
| `nx run app:start` | Expo dev server |
| `nx run @bro/database-api:db:generate` | Generate a Postgres migration from schema changes |
| `nx run @bro/database-api:db:migrate` | Apply pending Postgres migrations |
| `nx run @bro/database-app:db:generate` | Generate an app migration and rebuild the manifest |
| `nx run @bro/auth-api:auth:generate-schema` | Regenerate the Better Auth tables |
| `nx run-many -t typecheck` | Typecheck every project |
| `pnpm biome check --write` | Format and lint |

## Conventions

- **No `project.json`.** Nx config is inferred, with custom targets in each `package.json` under `nx.targets`.
- **Biome** owns formatting and general linting (tabs, double quotes). ESLint is intentionally limited to Nx module-boundary enforcement; run both with `pnpm lint`.
- **Module resolution differs by side.** The API-side packages use `nodenext`, so their relative imports carry `.js` suffixes. The app-side packages (`database/app`, `auth/app`, `mobile-model`, `logic`) and `domain` use `bundler` resolution with no suffixes, because Metro does not remap `.js` to `.ts`. Match the package you're editing.
- **TypeScript project references** are managed by `nx sync`; run it after adding a cross-package import.
- Dependencies shared with Expo must match the SDK. Check `node_modules/expo/bundledNativeModules.json` for the correct version rather than taking `latest`.

### Reading a feature store from a screen

A screen does not hand-roll the read. [`useFocusStoreLoad`](apps/app/src/lib/use-store-load.ts) re-reads every time the screen comes into focus — the default, so returning after an edit shows the edit — and `useStoreLoad` reads on mount and whenever its loader changes, for a detail screen keyed on a route parameter. Both take a `useCallback`-stabilised loader and return `{ data, error, loading, reload, setData, setError }`.

```tsx
const history = useMemo(() => store ?? createHistoryStore(), [store]);
const { data: days, error, loading, reload } = useFocusStoreLoad(
  useCallback(() => history.loadHistory(), [history]),
);

if (loading) return <LoadingScreen />;
```

`data` is `undefined` until the first attempt settles, which is what `loading` reports, so a loader that legitimately resolves to `null` — a record since deleted — stays distinguishable from one still in flight. Test `loading`, never `data === null`. The hook drops a response superseded by a newer one, keeps the current content on screen while refreshing, and shows the spinner again only when there is nothing to keep.

Mutations stay in the screen: run the write, then `setData` the snapshot it returns, or `reload()`. The `store?` prop stays the test seam — it is the argument to `createXStore()`, not something the hook owns.

[`LoadingScreen`](apps/app/src/components/screen.tsx) renders the whole-screen spinner. Its `variant` must match the Screen the loaded content uses (`stack` by default, `tab`, or `full`), so the spinner sits inside the same safe-area boundary.

[`toMessage`](apps/app/src/lib/errors.ts) narrows a caught `unknown` to the message a screen shows, with an optional translated fallback for the non-`Error` case.

`home-screen` deliberately keeps its own loader: its reads share a write stamp with the note save and check-in commit so a slow read cannot land on top of a newer write.

## Localisation

All user-facing copy in the app comes from typed catalogues in [`apps/app/src/i18n`](apps/app/src/i18n), read through i18next. The catalogues are TypeScript rather than JSON so that each entry can carry a translator note and so key types flow into `t()` without extra tsconfig setup — a typo or a deleted key fails `nx typecheck`.

- **Adding copy.** Put it in the namespace file for the feature (`locales/en/<feature>.ts`), or `common.ts` when two or more screens share it. New namespaces need one line in `locales/index.ts`; the key types follow automatically.
- **Interpolate, never concatenate.** Word order differs across languages, so build one string with `{{placeholders}}` rather than joining fragments in JSX.
- **ESLint enforces this** for JSX text and copy-bearing props throughout `apps/app/src`, at error level. It also guards known copy-bearing fields in app presentation models. Tests and the catalogues themselves are exempt: tests assert on rendered English on purpose, while catalogues are where that English belongs.
- **Pseudo-locale.** Run with `EXPO_PUBLIC_PSEUDO_LOCALE=1` to render every string accented, padded ~35%, and bracketed. Plain ASCII means copy that never reached a catalogue; clipped text means a layout that will not survive a longer language; a bracket mid-sentence means fragments that will not reorder. It is a tool for running the app — the test suite asserts English and will fail under it.
- **Outside the catalogues.** iOS permission prompts are read by the system before any JavaScript runs, so they live in [`apps/app/locales/en.json`](apps/app/locales/en.json), wired through the `locales` key in `app.json`.

### Authored product content

Metric names, life areas, habits, challenges, drinks, and insight copy stay in [`packages/domain/src/content`](packages/domain/src/content): that package is the product's definitional core and has no runtime dependencies, so it cannot call i18next.

The English half of the `content` namespace is therefore *derived* from those catalogues at startup rather than retyped, keeping one source for the authored wording. Translation happens on the way out, in [`apps/app/src/content`](apps/app/src/content/index.ts), which wraps the domain accessors and substitutes the copy — so a screen still reads `metric.label` as it always has. Import those accessors from `src/content` rather than `@bro/domain/*` whenever the value reaches a screen. A language that omits a key falls through to the authored English, one string at a time.

### Numbers, dates, and units

Language follows the device and falls back to English. Dates, numbers, and units are formatted from the *device* locale via `Intl`, deliberately separate from the copy language, so a fallback to English copy does not also change number and date formats.

`formatMeasurement` and friends take that locale and render through `Intl.NumberFormat`, so the decimal separator matches what `parseMeasurementInput` accepts back. Two details are deliberate: values that seed an editable field are formatted without a group separator, because a numeric keyboard cannot type one and the parser rejects it; and units written as words rather than symbols (`units`, `standard drinks`, `fl oz`) are passed in from the app through count-aware `UnitWordOverrides` callbacks. Those callbacks resolve through i18next with `count`, so every plural category supported by the active language remains available; symbols such as `kg` and `ml` stay in the dependency-free domain formatter.

### Thrown messages

Screens render `caught.message`, so a message a person can actually trigger belongs in [`validation.ts`](apps/app/src/i18n/locales/en/validation.ts) like any other copy. Messages that report a broken invariant — `Unknown measurement slug: …`, `Unit x does not measure y` — stay in English: they are diagnostics carrying a slug, and translating them would mean translating a bug report. No lint rule enforces this boundary, because nothing syntactic separates the two.

The same reasoning applies to the field-validation messages in `packages/database/app`: the app layer validates before those can fire, so reaching one means a defect.

## Known rough edges

- [`auth/app/src/client.ts`](packages/auth/app/src/client.ts) carries a `@ts-expect-error` on the Expo plugin: `@better-auth/expo@1.6.27` types `getActions` incompatibly with `BetterAuthClientPlugin` even on matched dependency versions. It is suppressed rather than cast, because casting collapses session type inference. Remove it once upstream fixes the declaration.
- The app scheme `"app"` is repeated in `apps/app/app.json`, `auth/api/src/options.ts`, and `auth/app/src/client.ts`. Changing one alone breaks auth redirects silently.
- Turso sync is not wired into the app lifecycle yet. Phase 5 will add short-lived, database-scoped tokens minted by the API and a supported connection-reopen path.
- Expo Router now keeps onboarding and the local app independent of remote authentication; sign-in and sign-up are optional account routes.
- Only local embedded storage is currently supported. Replica connection and synchronization return in Phase 5 with API-minted credentials.
- Reminder notifications bake their copy in at schedule time, and the materialiser reconciles by identifier alone. Adding an in-app language picker will need every scheduled reminder cancelled and rescheduled on the switch; see the note in [`reminders/notification-gateway.ts`](apps/app/src/reminders/notification-gateway.ts).
- The map from a health source to its display name (`"healthkit"` → Apple Health) lives in [`health/platform-label.ts`](apps/app/src/health/platform-label.ts). It returns `null` for anything else, because callers word that case differently — the log and body screens say "You", settings falls back to its own section title, and the history day screen shows the raw source.
- `src/content` rebuilds its wrapper objects on every call, so identity comparisons against a catalogue entry will not hold. Nothing compares them today; compare slugs if that need arises.

## Design

Everything an agent or a person needs to build UI that belongs to bro.
Read **DESIGN.md first** — it is the authority and overrides framework
defaults and personal instinct. Add it to your agent context (e.g. reference
it from the repo's CLAUDE.md / AGENTS.md) so it loads for every UI task.

```
design/
├── README.md                  this file
├── DESIGN.md                  the rulebook — read before any UI work
├── tokens/
│   ├── tokens.css             runtime tokens (light, dark, accent derivation)
│   ├── tokens.json            canonical machine-readable tokens
│   ├── tailwind.css           Tailwind v4 @theme bridge onto tokens.css
│   └── accent.ts              accent presets + applyAccent()/normalizeHue()
├── brand/
│   ├── bro-icon-light.svg     app icon, light  (1024, OS applies corner mask)
│   ├── bro-icon-dark.svg      app icon, dark
│   ├── bro-icon-tinted.svg    app icon, iOS tinted / Android monochrome basis
│   ├── bro-glyph.svg          circular b. glyph — notifications, favicon, watch
│   ├── bro-wordmark.svg       drawn wordmark; dot takes var(--accent)
│   └── bro-lockup.svg         marketing lockup (wordmark + gauge rail), ≥300px wide
└── reference/
    ├── baseline-design-system.html   living style guide — open in a browser
    └── bro-icon-sheet.html           identity sheet: concepts, sizes, usage rules
```

## Wiring it up

Plain CSS: link `tokens/tokens.css` before app styles; set `data-theme="dark"`
on `<html>` for dark mode; call `applyAccent()` from `tokens/accent.ts` on boot.

Tailwind v4:

```css
@import "tailwindcss";
@import "./design/tokens/tokens.css";
@import "./design/tokens/tailwind.css";
```

Then `bg-surface text-ink border-line rounded-md p-4 text-body font-sans`
resolve to system values, and `bg-accent text-on-accent` gives a compliant
primary button.

## Fonts

Archivo (400/500/600/700) and Source Serif 4 (400/500), e.g.:

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500&display=swap" rel="stylesheet">
```

Self-host for production.

## The three color jobs (the rule most likely to be broken)

- **Domain** (mind/body/sleep/load): what the data measures. Data surfaces only.
- **Accent** (user's hue): what the user is touching. Interaction surfaces only.
- **Alert**: genuine health risk. Max once per screen. Never decorative.