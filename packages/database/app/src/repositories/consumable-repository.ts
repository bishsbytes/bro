import {
	calculateRecipeComposition,
	type RecipeIngredientSnapshot,
} from "@bro/domain/composition";
import {
	assertConstituentAmounts,
	type ConstituentAmounts,
	isConstituentAmounts,
} from "@bro/domain/constituent-catalogue";
import {
	assertConsumableComposition,
	type ConsumableKind,
	type ContentSource,
	isCompositionBasis,
	isConsumableKind,
	isContentSource,
	isPortion,
	isRecipeYield,
	type Portion,
	type RecipeYield,
} from "@bro/domain/consumable";
import type {
	Consumable,
	CreateConsumable,
	CreateRecipeIngredient,
	RecipeIngredient,
	UpdateConsumable,
	UpdateRecipeIngredient,
} from "@bro/mobile-model";
import type { TransactionScope } from "../transaction";
import { BaseRepository } from "./base-repository";

export type {
	Consumable,
	CreateConsumable,
	CreateRecipeIngredient,
	RecipeIngredient,
	UpdateConsumable,
	UpdateRecipeIngredient,
} from "@bro/mobile-model";

type ConsumableRow = {
	id: string;
	kind: string;
	name: string;
	brand: string | null;
	barcode: string | null;
	basis: string;
	constituents: string;
	portions: string;
	default_portion_id: string | null;
	recipe: string | null;
	source_type: string;
	source_ref: string | null;
	source_version: number | null;
	forked_from: string | null;
	archived_at: number | null;
	created_at: number;
	updated_at: number;
};

type RecipeIngredientRow = {
	id: string;
	recipe_id: string;
	position: number;
	consumable_id: string | null;
	source_ref: string | null;
	name: string;
	portion_label: string | null;
	quantity: number;
	mass_kg: number | null;
	volume_l: number | null;
	constituents: string;
	created_at: number;
	updated_at: number;
};

const CONSUMABLE_COLUMNS = `
	id, kind, name, brand, barcode, basis, constituents, portions,
	default_portion_id, recipe, source_type, source_ref, source_version,
	forked_from, archived_at, created_at, updated_at
`;

const INGREDIENT_COLUMNS = `
	id, recipe_id, position, consumable_id, source_ref, name, portion_label,
	quantity, mass_kg, volume_l, constituents, created_at, updated_at
`;

export type ListConsumablesOptions = {
	includeArchived?: boolean;
};

type CompositionFields = Pick<
	CreateConsumable,
	"basis" | "constituents" | "portions" | "defaultPortionId"
>;

/** A recipe's stored composition, calculated per yield unit from its ingredients. */
function recipeComposition(
	ingredients: readonly RecipeIngredientSnapshot[],
	recipeYield: RecipeYield,
): CompositionFields {
	const composition = calculateRecipeComposition(ingredients, recipeYield);
	return {
		basis: composition.basis,
		constituents: composition.constituents,
		portions: [...composition.portions],
		defaultPortionId: composition.defaultPortionId,
	};
}

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function optional(value: string | null | undefined): string | null {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function assertOptionalAmount(value: number | null, label: string): void {
	if (value !== null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(
			`${label} must be null or a non-negative finite value.`,
		);
	}
}

function parseJson(value: string, label: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		throw new TypeError(`${label} contains invalid JSON.`);
	}
}

function parseConstituents(value: string, label: string): ConstituentAmounts {
	const parsed = parseJson(value, label);
	if (!isConstituentAmounts(parsed)) {
		throw new TypeError(`${label} is malformed.`);
	}
	return parsed;
}

/**
 * The columns a stored source spreads over. System content is refused: the
 * catalogue is authored, and the fork that edits it is the first library row
 * it has.
 */
function sourceColumns(source: ContentSource): {
	sourceType: string;
	sourceRef: string | null;
	sourceVersion: number | null;
} {
	switch (source.type) {
		case "user":
			return { sourceType: "user", sourceRef: null, sourceVersion: null };
		case "provider":
			return {
				sourceType: "provider",
				sourceRef: `${source.provider}:${source.externalId}`,
				sourceVersion: null,
			};
		case "community":
			return {
				sourceType: "community",
				sourceRef: source.contentId,
				sourceVersion: source.version,
			};
		case "system":
			throw new TypeError(
				"System consumables live in the catalogue; fork one to store a copy.",
			);
	}
}

function sourceFromColumns(row: ConsumableRow): ContentSource {
	if (row.source_type === "user") return { type: "user" };
	if (row.source_type === "provider" && row.source_ref) {
		const separator = row.source_ref.indexOf(":");
		if (separator > 0) {
			return {
				type: "provider",
				provider: row.source_ref.slice(0, separator),
				externalId: row.source_ref.slice(separator + 1),
			};
		}
	}
	if (
		row.source_type === "community" &&
		row.source_ref &&
		row.source_version !== null
	) {
		return {
			type: "community",
			contentId: row.source_ref,
			version: row.source_version,
		};
	}
	throw new TypeError(`Consumable ${row.id} has a malformed source.`);
}

function normalizeConsumable(input: CreateConsumable): CreateConsumable {
	if (!isConsumableKind(input.kind)) {
		throw new TypeError(`Unsupported consumable kind: ${String(input.kind)}`);
	}
	if (!isContentSource(input.source)) {
		throw new TypeError("Consumable source is malformed.");
	}
	sourceColumns(input.source);
	if (
		input.forkedFrom !== undefined &&
		input.forkedFrom !== null &&
		!isContentSource(input.forkedFrom)
	) {
		throw new TypeError("Consumable forkedFrom is malformed.");
	}
	if (input.recipe !== null && !isRecipeYield(input.recipe.yield)) {
		throw new RangeError(
			"Recipe yield must be a positive quantity of a known unit.",
		);
	}
	const normalized: CreateConsumable = {
		...input,
		name: required(input.name, "Consumable name"),
		brand: optional(input.brand),
		barcode: optional(input.barcode),
		portions: input.portions.map((portion) => ({ ...portion })),
		constituents: { ...input.constituents },
		forkedFrom: input.forkedFrom ?? null,
	};
	assertConsumableComposition(normalized);
	if (
		normalized.recipe === null &&
		Object.keys(normalized.constituents).length === 0
	) {
		throw new RangeError("Consumable must carry at least one constituent.");
	}
	return normalized;
}

function normalizeIngredient(
	input: CreateRecipeIngredient,
): CreateRecipeIngredient {
	if (!Number.isInteger(input.position) || input.position < 0) {
		throw new RangeError(
			"Recipe ingredient position must be a non-negative integer.",
		);
	}
	if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
		throw new RangeError(
			"Recipe ingredient quantity must be a positive finite value.",
		);
	}
	assertOptionalAmount(input.massKg, "Recipe ingredient mass");
	assertOptionalAmount(input.volumeL, "Recipe ingredient volume");
	assertConstituentAmounts(input.constituents, "Recipe ingredient constituent");
	return {
		...input,
		consumableId: optional(input.consumableId),
		sourceRef: optional(input.sourceRef),
		name: required(input.name, "Recipe ingredient name"),
		portionLabel: optional(input.portionLabel),
		constituents: { ...input.constituents },
	};
}

function toConsumable(row: ConsumableRow): Consumable {
	if (!isConsumableKind(row.kind)) {
		throw new TypeError(`Unsupported consumable kind: ${row.kind}`);
	}
	const label = `Consumable ${row.id}`;
	const basis = parseJson(row.basis, `${label} basis`);
	if (!isCompositionBasis(basis)) {
		throw new TypeError(`${label} basis is malformed.`);
	}
	const portions = parseJson(row.portions, `${label} portions`);
	if (!Array.isArray(portions) || !portions.every(isPortion)) {
		throw new TypeError(`${label} portions are malformed.`);
	}
	let recipe: { yield: RecipeYield } | null = null;
	if (row.recipe !== null) {
		const parsed = parseJson(row.recipe, `${label} recipe`) as {
			yield?: unknown;
		};
		if (!parsed || typeof parsed !== "object" || !isRecipeYield(parsed.yield)) {
			throw new TypeError(`${label} recipe is malformed.`);
		}
		recipe = { yield: parsed.yield };
	}
	let forkedFrom: ContentSource | null = null;
	if (row.forked_from !== null) {
		const parsed = parseJson(row.forked_from, `${label} forkedFrom`);
		if (!isContentSource(parsed)) {
			throw new TypeError(`${label} forkedFrom is malformed.`);
		}
		forkedFrom = parsed;
	}
	return {
		id: row.id,
		kind: row.kind,
		name: row.name,
		brand: row.brand,
		barcode: row.barcode,
		basis,
		constituents: parseConstituents(row.constituents, `${label} constituents`),
		portions: portions as Portion[],
		defaultPortionId: row.default_portion_id,
		recipe,
		source: sourceFromColumns(row),
		forkedFrom,
		archivedAt: row.archived_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toIngredient(row: RecipeIngredientRow): RecipeIngredient {
	return {
		id: row.id,
		recipeId: row.recipe_id,
		position: row.position,
		consumableId: row.consumable_id,
		sourceRef: row.source_ref,
		name: row.name,
		portionLabel: row.portion_label,
		quantity: row.quantity,
		massKg: row.mass_kg,
		volumeL: row.volume_l,
		constituents: parseConstituents(
			row.constituents,
			`Recipe ingredient ${row.id} constituents`,
		),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * The library: user, provider, and (later) community consumables, plus the
 * ingredient rows a recipe calculates from. Every ingredient change recomputes
 * the recipe's stored composition in the same transaction, and a cycle is
 * refused at save.
 */
export class ConsumableRepository extends BaseRepository {
	async create(input: CreateConsumable): Promise<Consumable> {
		// A recipe's composition is calculated, never supplied: a new recipe has
		// no ingredients yet, so it stores the empty composition per yield unit.
		const normalized = normalizeConsumable(
			input.recipe === null
				? input
				: { ...input, ...recipeComposition([], input.recipe.yield) },
		);
		const now = this.now();
		const consumable: Consumable = {
			...normalized,
			forkedFrom: normalized.forkedFrom ?? null,
			id: this.createId(now),
			archivedAt: null,
			createdAt: now,
			updatedAt: now,
		};
		await this.insert(consumable);
		return consumable;
	}

	/**
	 * A user-owned copy of something not the user's — a catalogue entry, a
	 * provider result, a community item — with `forkedFrom` recording where it
	 * came from. The original is untouched.
	 */
	async createFork(
		forkedFrom: ContentSource,
		input: Omit<CreateConsumable, "source" | "forkedFrom">,
	): Promise<Consumable> {
		if (!isContentSource(forkedFrom)) {
			throw new TypeError("Consumable forkedFrom is malformed.");
		}
		return await this.create({
			...input,
			source: { type: "user" },
			forkedFrom,
		});
	}

	async findById(id: string): Promise<Consumable | null> {
		const row = await this.first<ConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM consumables WHERE id = ?`,
			[id],
		);
		return row ? toConsumable(row) : null;
	}

	/**
	 * The library row for a provider or community source, so logging the same
	 * searched product twice writes one row. User rows have no natural key.
	 */
	async findBySource(source: ContentSource): Promise<Consumable | null> {
		if (source.type !== "provider" && source.type !== "community") {
			return null;
		}
		const columns = sourceColumns(source);
		const row = await this.first<ConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM consumables
			 WHERE source_type = ? AND source_ref = ?
			   AND (source_version IS ? OR ? IS NULL)
			 ORDER BY created_at ASC, id ASC LIMIT 1`,
			[
				columns.sourceType,
				columns.sourceRef,
				columns.sourceVersion,
				columns.sourceVersion,
			],
		);
		return row ? toConsumable(row) : null;
	}

	async listAll(options: ListConsumablesOptions = {}): Promise<Consumable[]> {
		const rows = await this.all<ConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM consumables
			 ${options.includeArchived ? "" : "WHERE archived_at IS NULL"}
			 ORDER BY name COLLATE NOCASE ASC, created_at ASC, id ASC`,
		);
		return rows.map(toConsumable);
	}

	async listByKind(
		kind: ConsumableKind,
		options: ListConsumablesOptions = {},
	): Promise<Consumable[]> {
		if (!isConsumableKind(kind)) {
			throw new TypeError(`Unsupported consumable kind: ${String(kind)}`);
		}
		const rows = await this.all<ConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM consumables
			 WHERE kind = ? ${options.includeArchived ? "" : "AND archived_at IS NULL"}
			 ORDER BY name COLLATE NOCASE ASC, created_at ASC, id ASC`,
			[kind],
		);
		return rows.map(toConsumable);
	}

	/** Every recipe, archived or not, so ingredient lookups can follow references. */
	async listRecipes(): Promise<Consumable[]> {
		const rows = await this.all<ConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM consumables
			 WHERE recipe IS NOT NULL
			 ORDER BY name COLLATE NOCASE ASC, created_at ASC, id ASC`,
		);
		return rows.map(toConsumable);
	}

	/**
	 * Edits a row in place. A recipe's composition is calculated, so its basis,
	 * constituents, and portions come from its ingredients and the yield given
	 * here rather than from the input.
	 */
	async update(
		id: string,
		input: UpdateConsumable,
	): Promise<Consumable | null> {
		const existing = await this.findById(id);
		if (!existing) {
			return null;
		}
		return await this.transaction(async () => {
			const ingredients = await this.listIngredients(id);
			if (input.recipe === null && ingredients.length > 0) {
				throw new TypeError(
					"Remove a recipe's ingredients before making it a plain consumable.",
				);
			}
			const composed =
				input.recipe === null
					? input
					: { ...input, ...recipeComposition(ingredients, input.recipe.yield) };
			const normalized = normalizeConsumable({
				...composed,
				kind: input.kind ?? existing.kind,
				source: existing.source,
				forkedFrom: existing.forkedFrom,
			});
			await this.writeComposition(id, normalized, this.now());
			return await this.findById(id);
		});
	}

	async archive(id: string): Promise<Consumable | null> {
		const now = this.now();
		await this.run(
			"UPDATE consumables SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL",
			[now, now, id],
		);
		return await this.findById(id);
	}

	async unarchive(id: string): Promise<Consumable | null> {
		await this.run(
			"UPDATE consumables SET archived_at = NULL, updated_at = ? WHERE id = ?",
			[this.now(), id],
		);
		return await this.findById(id);
	}

	/** Hard delete, with the recipe's own ingredient rows. Events keep their snapshot. */
	async delete(id: string): Promise<boolean> {
		return await this.transaction(async () => {
			await this.run("DELETE FROM recipe_ingredients WHERE recipe_id = ?", [
				id,
			]);
			const result = await this.run("DELETE FROM consumables WHERE id = ?", [
				id,
			]);
			return result.changes > 0;
		});
	}

	async listIngredients(recipeId: string): Promise<RecipeIngredient[]> {
		const rows = await this.all<RecipeIngredientRow>(
			`SELECT ${INGREDIENT_COLUMNS} FROM recipe_ingredients
			 WHERE recipe_id = ? ORDER BY position ASC, created_at ASC, id ASC`,
			[recipeId],
		);
		return rows.map(toIngredient);
	}

	async addIngredient(
		recipeId: string,
		input: CreateRecipeIngredient,
	): Promise<RecipeIngredient> {
		const normalized = normalizeIngredient(input);
		return await this.transaction(async () => {
			const recipe = await this.requireRecipe(recipeId);
			await this.assertNoCycle(recipeId, normalized.consumableId);
			const now = this.now();
			const ingredient = await this.insertIngredient(recipeId, normalized, now);
			await this.recompute(recipe, now);
			return ingredient;
		});
	}

	async updateIngredient(
		id: string,
		input: UpdateRecipeIngredient,
	): Promise<RecipeIngredient | null> {
		const existing = await this.findIngredientById(id);
		if (!existing) {
			return null;
		}
		const normalized = normalizeIngredient(input);
		return await this.transaction(async () => {
			const recipe = await this.requireRecipe(existing.recipeId);
			await this.assertNoCycle(existing.recipeId, normalized.consumableId);
			const now = this.now();
			await this.run(
				`UPDATE recipe_ingredients SET
					position = ?, consumable_id = ?, source_ref = ?, name = ?,
					portion_label = ?, quantity = ?, mass_kg = ?, volume_l = ?,
					constituents = ?, updated_at = ?
				 WHERE id = ?`,
				[
					normalized.position,
					normalized.consumableId,
					normalized.sourceRef,
					normalized.name,
					normalized.portionLabel,
					normalized.quantity,
					normalized.massKg,
					normalized.volumeL,
					JSON.stringify(normalized.constituents),
					now,
					id,
				],
			);
			await this.recompute(recipe, now);
			return await this.findIngredientById(id);
		});
	}

	async deleteIngredient(id: string): Promise<boolean> {
		const existing = await this.findIngredientById(id);
		if (!existing) {
			return false;
		}
		await this.transaction(async () => {
			const recipe = await this.requireRecipe(existing.recipeId);
			await this.run("DELETE FROM recipe_ingredients WHERE id = ?", [id]);
			await this.recompute(recipe, this.now());
		});
		return true;
	}

	/** Replaces every ingredient at once — the recipe editor's save. */
	async replaceIngredients(
		recipeId: string,
		inputs: readonly CreateRecipeIngredient[],
		scope?: TransactionScope,
	): Promise<RecipeIngredient[]> {
		const normalized = inputs.map(normalizeIngredient);
		return await this.transaction(async () => {
			const recipe = await this.requireRecipe(recipeId);
			for (const ingredient of normalized) {
				await this.assertNoCycle(recipeId, ingredient.consumableId);
			}
			const now = this.now();
			await this.run("DELETE FROM recipe_ingredients WHERE recipe_id = ?", [
				recipeId,
			]);
			const ingredients: RecipeIngredient[] = [];
			for (const ingredient of normalized) {
				ingredients.push(
					await this.insertIngredient(recipeId, ingredient, now),
				);
			}
			await this.recompute(recipe, now);
			return ingredients;
		}, scope);
	}

	private async insert(consumable: Consumable): Promise<void> {
		const source = sourceColumns(consumable.source);
		await this.run(
			`INSERT INTO consumables (
				id, kind, name, brand, barcode, basis, constituents, portions,
				default_portion_id, recipe, source_type, source_ref, source_version,
				forked_from, archived_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				consumable.id,
				consumable.kind,
				consumable.name,
				consumable.brand,
				consumable.barcode,
				JSON.stringify(consumable.basis),
				JSON.stringify(consumable.constituents),
				JSON.stringify(consumable.portions),
				consumable.defaultPortionId,
				consumable.recipe === null ? null : JSON.stringify(consumable.recipe),
				source.sourceType,
				source.sourceRef,
				source.sourceVersion,
				consumable.forkedFrom === null
					? null
					: JSON.stringify(consumable.forkedFrom),
				consumable.archivedAt,
				consumable.createdAt,
				consumable.updatedAt,
			],
		);
	}

	private async writeComposition(
		id: string,
		input: Pick<
			CreateConsumable,
			| "kind"
			| "name"
			| "brand"
			| "barcode"
			| "basis"
			| "constituents"
			| "portions"
			| "defaultPortionId"
			| "recipe"
		>,
		now: number,
	): Promise<void> {
		await this.run(
			`UPDATE consumables SET
				kind = ?, name = ?, brand = ?, barcode = ?, basis = ?, constituents = ?,
				portions = ?, default_portion_id = ?, recipe = ?, updated_at = ?
			 WHERE id = ?`,
			[
				input.kind,
				input.name,
				input.brand,
				input.barcode,
				JSON.stringify(input.basis),
				JSON.stringify(input.constituents),
				JSON.stringify(input.portions),
				input.defaultPortionId,
				input.recipe === null ? null : JSON.stringify(input.recipe),
				now,
				id,
			],
		);
	}

	private async requireRecipe(recipeId: string): Promise<Consumable> {
		const recipe = await this.findById(recipeId);
		if (!recipe) {
			throw new Error(`Consumable does not exist: ${recipeId}`);
		}
		if (recipe.recipe === null) {
			throw new TypeError("Only recipes can have ingredients.");
		}
		return recipe;
	}

	/**
	 * Stores the recipe's composition per yield unit from its current
	 * ingredient snapshots. Logged events are untouched: they carry their own
	 * snapshot.
	 */
	private async recompute(recipe: Consumable, now: number): Promise<void> {
		if (recipe.recipe === null) return;
		const ingredients = await this.listIngredients(recipe.id);
		await this.writeComposition(
			recipe.id,
			{
				kind: recipe.kind,
				name: recipe.name,
				brand: recipe.brand,
				barcode: recipe.barcode,
				...recipeComposition(ingredients, recipe.recipe.yield),
				recipe: recipe.recipe,
			},
			now,
		);
	}

	/**
	 * A recipe may not contain itself, directly or through another recipe.
	 * Walks ingredient references; a dangling reference simply ends the walk.
	 */
	private async assertNoCycle(
		recipeId: string,
		consumableId: string | null,
	): Promise<void> {
		if (consumableId === null) return;
		const visited = new Set<string>();
		const pending = [consumableId];
		while (pending.length > 0) {
			const current = pending.pop() as string;
			if (current === recipeId) {
				throw new RangeError("A recipe cannot contain itself.");
			}
			if (visited.has(current)) continue;
			visited.add(current);
			const rows = await this.all<{ consumable_id: string | null }>(
				`SELECT consumable_id FROM recipe_ingredients
				 WHERE recipe_id = ? AND consumable_id IS NOT NULL`,
				[current],
			);
			for (const row of rows) {
				if (row.consumable_id !== null) pending.push(row.consumable_id);
			}
		}
	}

	private async findIngredientById(
		id: string,
	): Promise<RecipeIngredient | null> {
		const row = await this.first<RecipeIngredientRow>(
			`SELECT ${INGREDIENT_COLUMNS} FROM recipe_ingredients WHERE id = ?`,
			[id],
		);
		return row ? toIngredient(row) : null;
	}

	private async insertIngredient(
		recipeId: string,
		input: CreateRecipeIngredient,
		now: number,
	): Promise<RecipeIngredient> {
		const ingredient: RecipeIngredient = {
			...input,
			id: this.createId(now),
			recipeId,
			createdAt: now,
			updatedAt: now,
		};
		await this.run(
			`INSERT INTO recipe_ingredients (
				id, recipe_id, position, consumable_id, source_ref, name, portion_label,
				quantity, mass_kg, volume_l, constituents, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				ingredient.id,
				ingredient.recipeId,
				ingredient.position,
				ingredient.consumableId,
				ingredient.sourceRef,
				ingredient.name,
				ingredient.portionLabel,
				ingredient.quantity,
				ingredient.massKg,
				ingredient.volumeL,
				JSON.stringify(ingredient.constituents),
				ingredient.createdAt,
				ingredient.updatedAt,
			],
		);
		return ingredient;
	}
}
