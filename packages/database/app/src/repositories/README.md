# Adding a data-domain repository

The app reads and writes its embedded database through one repository class per
data domain, each issuing hand-written parameterised SQL. Drizzle is used here
only to author the schema and generate migrations — the Drizzle query client is
never imported at runtime.

The first product domains are implemented. Use
[`observation-repository.ts`](observation-repository.ts) as the reference for a
value-bearing repository and [`day-note-repository.ts`](day-note-repository.ts)
for a smaller text domain. When adding another one:

## 1. Define the table

Add the table name to [`../product-tables.ts`](../product-tables.ts), then add a
`sqliteTable` to [`../schema.ts`](../schema.ts). The shared name list drives
local-data deletion and is checked against migration history during generation;
the schema drives migration codegen and is the reference for SQL column names.

```ts
export const observations = sqliteTable(
  PRODUCT_TABLE_NAMES.observations,
  { /* see ../schema.ts for the real columns */ },
);
```

## 2. Generate the migration

```bash
pnpm exec nx run @bro/database-app:db:generate
```

This runs `drizzle-kit generate` and then regenerates
`src/migrations/manifest.ts`, which bundles the SQL as plain strings so Metro
can ship it to the device. Commit both the new `drizzle/*.sql` file and the
updated manifest.

Do not hand-edit either one. The manifest generator rewrites `CREATE TABLE` and
`CREATE INDEX` into their `IF NOT EXISTS` forms as it bundles them, because the
migrator has to tolerate replaying a migration whose marker write was not
observed. A migration that adds a column has no `IF NOT EXISTS` form in SQLite;
`migrator.ts` skips those statements when the column is already present.

## 3. Write the repository

Create `<domain>-repository.ts` in this directory, extending `BaseRepository`.
Expose domain operations as named methods; keep the SQL and row-to-domain
mapping inside it. The real observation read path is the pattern:

Define persistence-independent records and public create/update contracts in
[`@bro/mobile-model`](../../../../mobile-model/src/records.ts). Import those
types into the repository and re-export them when compatibility requires it;
keep database row shapes and SQL mapping types private to the repository. This
lets pure application logic depend on the model without depending on SQLite,
migrations, or repository implementations.

```ts
async listByDay(localDay: string): Promise<Observation[]> {
  const rows = await this.all<ObservationRow>(
    `SELECT ${SELECT_COLUMNS} FROM observations
     WHERE local_day = ?
     ORDER BY observed_at ASC, created_at ASC, id ASC`,
    [localDay],
  );
  return rows.map(toObservation);
}
```

Always pass values as parameters (`?`) rather than interpolating them into the
SQL string.

## 4. Export it

Add the class to [`../index.ts`](../index.ts).

## 5. Use it

Construct it against the open database handle, after `initDb()` has run during
app startup:

```ts
const observations = new ObservationRepository(getDb());
const today = await observations.listByDay("2026-08-14");
```
