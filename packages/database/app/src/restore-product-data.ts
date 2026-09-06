import { isCalendarDay } from "@bro/domain";
import { isContentSource } from "@bro/domain/consumable";
import type { SQLiteDatabase } from "expo-sqlite";
import { PRODUCT_TABLE_NAMES } from "./product-tables";
import { withTransaction } from "./transaction";

const JSON_COLUMNS = new Set([
	"items",
	"focus_item_slugs",
	"basis",
	"constituents",
	"portions",
	"recipe",
	"forked_from",
]);
type Column = { name: string; type: string; notnull: number; pk: number };
function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function camel(name: string): string {
	return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function encode(
	row: Record<string, unknown>,
	column: Column,
): string | number | null {
	const value = row[camel(column.name)];
	if (value === null && !column.notnull && !column.pk) return null;
	if (value === undefined || value === null)
		throw new TypeError(`Missing restore field: ${column.name}`);
	if (JSON_COLUMNS.has(column.name)) {
		if (!record(value) && !Array.isArray(value))
			throw new TypeError(`Invalid restore object: ${column.name}`);
		return JSON.stringify(value);
	}
	if (column.type.toUpperCase() === "TEXT") {
		if (typeof value !== "string" || (column.pk && value.length === 0))
			throw new TypeError(`Invalid restore text: ${column.name}`);
		if (
			["local_day", "started_on", "target_date"].includes(column.name) &&
			!isCalendarDay(value)
		)
			throw new TypeError(`Invalid restore date: ${column.name}`);
		return value;
	}
	if (column.name === "enabled" && typeof value === "boolean")
		return Number(value);
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		(column.type.toUpperCase() === "INTEGER" && !Number.isSafeInteger(value))
	)
		throw new TypeError(`Invalid restore number: ${column.name}`);
	return value;
}

/** Restore is deliberately insert-only into an empty record. A failed validation rolls back every row. */
export async function restoreProductData(
	db: SQLiteDatabase,
	collections: Record<string, unknown>,
	validate: (db: SQLiteDatabase) => Promise<void>,
): Promise<number> {
	return withTransaction(db, async ({ database }) => {
		const tables = Object.entries(PRODUCT_TABLE_NAMES);
		for (const [, table] of tables) {
			const existing = await database.getFirstAsync<{ count: number }>(
				`SELECT COUNT(*) AS count FROM "${table}"`,
			);
			if (existing?.count)
				throw new Error(
					"Restore needs an empty local record. Export your current record before deleting local data.",
				);
		}
		let count = 0;
		for (const [collection, table] of tables) {
			const rows = collections[collection];
			if (!Array.isArray(rows))
				throw new TypeError(`Missing restore collection: ${collection}`);
			const columns = await database.getAllAsync<Column>(
				`PRAGMA table_info("${table}")`,
			);
			for (const input of rows) {
				if (!record(input))
					throw new TypeError(`Invalid restore row: ${collection}`);
				if (collection === "observations") {
					const { scaleMin, scaleMax, value } = input;
					if (
						(scaleMin === null) !== (scaleMax === null) ||
						(scaleMin !== null &&
							(typeof scaleMin !== "number" ||
								typeof scaleMax !== "number" ||
								typeof value !== "number" ||
								scaleMin >= scaleMax ||
								value < scaleMin ||
								value > scaleMax))
					)
						throw new TypeError("Invalid restore observation scale.");
				}
				if (collection === "assessments") {
					const { items, focusItemSlugs } = input;
					if (
						!Array.isArray(items) ||
						!items.length ||
						items.some(
							(item) =>
								!record(item) ||
								typeof item.slug !== "string" ||
								!item.slug.trim() ||
								typeof item.label !== "string" ||
								!item.label.trim() ||
								!Number.isSafeInteger(item.position) ||
								(item.position as number) < 0,
						)
					)
						throw new TypeError("Invalid restore assessment items.");
					const slugs = new Set(items.map((item) => item.slug));
					if (
						slugs.size !== items.length ||
						!Array.isArray(focusItemSlugs) ||
						new Set(focusItemSlugs).size !== focusItemSlugs.length ||
						focusItemSlugs.some((slug) => !slugs.has(slug))
					)
						throw new TypeError("Invalid restore assessment focus items.");
				}
				let row = input;
				if (collection === "consumables") {
					if (!isContentSource(row.source) || row.source.type === "system")
						throw new TypeError("Invalid stored consumable source.");
					const source = row.source;
					row = {
						...row,
						sourceType: source.type,
						sourceRef:
							source.type === "provider"
								? `${source.provider}:${source.externalId}`
								: source.type === "community"
									? source.contentId
									: null,
						sourceVersion: source.type === "community" ? source.version : null,
					};
				}
				const values = columns.map((column) => encode(row, column));
				await database.runAsync(
					`INSERT INTO "${table}" (${columns.map(({ name }) => `"${name}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
					values,
				);
				count += 1;
			}
		}
		await validate(database);
		return count;
	});
}
