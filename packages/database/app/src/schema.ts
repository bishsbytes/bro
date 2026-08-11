/**
 * Drizzle schema for the app's embedded libSQL/Turso database.
 *
 * This file exists purely to drive `drizzle-kit generate`; it is never imported
 * at runtime. Runtime access goes through the raw-SQL repositories in
 * src/repositories, so adding a table here is step one of the recipe in
 * src/repositories/README.md.
 *
 * No product domains are defined yet — add `sqliteTable` definitions as the
 * data model takes shape.
 */

export {};
