# Bro

Bro is an offline-first men's wellbeing app. The product is an Expo/React
Native client backed by a small Hono API, developed as an Nx and pnpm
monorepo.

The app works without an account. Product data is written to SQLite on the
device; the API currently provides optional authentication and anonymous food
lookup. Remote product-data sync, premium entitlements, and app protection are
roadmap work rather than shipped behaviour.

## Start locally

Prerequisites: Node 20 or newer, pnpm, and Docker.

```sh
pnpm install
cp .env.example .env
cp apps/app/.env.example apps/app/.env
# Replace BETTER_AUTH_SECRET in .env; `openssl rand -base64 32` is suitable.

docker compose up -d
pnpm nx run @bro/database-api:db:migrate
```

Then start the API and app in separate terminals:

```sh
pnpm nx run @bro/api:serve
```

```sh
pnpm nx run @bro/app:start
```

Use `http://10.0.2.2:3000` as `EXPO_PUBLIC_API_URL` on the Android emulator,
`http://localhost:3000` on the iOS simulator or web, and the development
machine's LAN address on a physical device.

## Workspace

| Project | Responsibility |
| --- | --- |
| `@bro/app` | Expo application, routes, screens, feature stores, and native integrations |
| `@bro/api` | Hono API for auth, account deletion, a health check, and food lookup |
| `@bro/database-app` | On-device schemas, migrations, connections, and repositories |
| `@bro/database-api` | Postgres schema, migrations, and Drizzle client |
| `@bro/auth-app` | Better Auth Expo client and React provider |
| `@bro/auth-api` | Better Auth server configuration |
| `@bro/domain` | Shared catalogues, intake definitions, metric registry, and units |
| `@bro/mobile-model` | Persistence-independent mobile record contracts |
| `@bro/logic` | Pure calculations over mobile records |

Nx resolves the complete project and target configuration. Use
`pnpm nx show projects` and `pnpm nx show project <name>` instead of inferring
it from package files.

## Documentation

- [Documentation index](docs/README.md) — which document owns each concern
- [Product](docs/product.md) — current product shape and behavioural rules
- [Architecture](docs/architecture.md) — boundaries, dependencies, and storage
- [Development](docs/development.md) — setup, commands, conventions, and checks
- [Roadmap](docs/roadmap.md) — work that has not shipped yet
- [Design package](design/README.md) — design authority and platform mapping
- [Historical plans](docs/archive/README.md) — completed and superseded decisions

Source code and tests are authoritative when documentation disagrees with the
implementation. `openwiki/` is generated evidence, not hand-maintained product
documentation.
