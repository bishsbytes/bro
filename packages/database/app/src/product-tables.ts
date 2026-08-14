/**
 * Every table containing user product data in bro.db.
 *
 * The Drizzle schema names tables from this record, the migration manifest
 * generator verifies that every value is created by a migration, and local
 * deletion iterates the derived list. Adding a product table therefore has one
 * place where its deletion responsibility is declared.
 */
export const PRODUCT_TABLE_NAMES = {
	observations: "observations",
	dayNotes: "day_notes",
	trackedMetrics: "tracked_metrics",
	reminders: "reminders",
} as const;

export type ProductTableName =
	(typeof PRODUCT_TABLE_NAMES)[keyof typeof PRODUCT_TABLE_NAMES];

export const PRODUCT_TABLES: readonly ProductTableName[] = Object.freeze(
	Object.values(PRODUCT_TABLE_NAMES),
);
