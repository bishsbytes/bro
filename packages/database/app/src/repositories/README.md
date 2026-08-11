# Adding a data-domain repository

The app reads and writes its embedded database through one repository class per
data domain, each issuing hand-written parameterised SQL. Drizzle is used here
only to author the schema and generate migrations — the Drizzle query client is
never imported at runtime.

No product domains exist yet. When you add the first one:

## 1. Define the table

Add a `sqliteTable` to [`../schema.ts`](../schema.ts). This drives migration
codegen and is the reference for the column names your SQL will use.

```ts
export const checkIns = sqliteTable("check_ins", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
```

## 2. Generate the migration

```bash
pnpm exec nx run @bro/database-app:db:generate
```

This runs `drizzle-kit generate` and then regenerates
`src/migrations/manifest.ts`, which bundles the SQL as plain strings so Metro
can ship it to the device. Commit both the new `drizzle/*.sql` file and the
updated manifest.

## 3. Write the repository

Create `<domain>-repository.ts` in this directory, extending `BaseRepository`.
Expose domain operations as named methods; keep the SQL inside them.

```ts
import { BaseRepository } from "./base-repository";
import type { SQLiteDatabase } from "expo-sqlite";

type CheckInRow = { id: string; created_at: number };

export class CheckInRepository extends BaseRepository {
  constructor(db: SQLiteDatabase) {
    super(db);
  }

  async findById(id: string): Promise<CheckInRow | null> {
    return await this.first<CheckInRow>("SELECT id, created_at FROM check_ins WHERE id = ?", [id]);
  }

  async create(row: CheckInRow): Promise<void> {
    await this.run("INSERT INTO check_ins (id, created_at) VALUES (?, ?)", [
      row.id,
      row.created_at,
    ]);
  }
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
const checkIns = new CheckInRepository(getDb());
```
