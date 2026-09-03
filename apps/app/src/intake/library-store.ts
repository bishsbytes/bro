import {
	type Consumable,
	ConsumableRepository,
	type CreateRecipeIngredient,
	getDb,
	type RecipeIngredient,
} from "@bro/database-app";
import type { ConstituentAmounts } from "@bro/domain/constituent-catalogue";
import type {
	ConsumableKind,
	ContentSource,
	RecipeYield,
	SystemConsumable,
} from "@bro/domain/consumable";
import { scaleComposition, scaleConstituents } from "@bro/logic";
import type { SQLiteDatabase } from "expo-sqlite";
import { i18n } from "../i18n";

/**
 * A quick custom item: a name, a portion, and the numbers you have, per
 * portion. The basis choice (per 100 g, per 100 ml) and the full portion
 * editor are the Phase 3 composition editor; this is the shape a first-cut
 * "something I have often" needs.
 */
export type LibraryItemDraft = {
	id?: string;
	kind: ConsumableKind;
	name: string;
	brand: string | null;
	portionLabel: string;
	/** Per portion, canonical units. */
	constituents: ConstituentAmounts;
	/** Existing portion whose per-portion values are being edited. */
	portionId?: string | null;
	/** The portion's volume for a newly created quick item. */
	volumeL?: number | null;
};

export type RecipeIngredientDraft = {
	name: string;
	quantity: number;
	/** Per one, canonical units; scaled by quantity on save. */
	constituents: ConstituentAmounts;
	massKg?: number | null;
	volumeL?: number | null;
	consumableId?: string | null;
	sourceRef?: string | null;
};

export type RecipeDraft = {
	id?: string;
	kind: ConsumableKind;
	name: string;
	brand: string | null;
	yield: RecipeYield;
	ingredients: RecipeIngredientDraft[];
};

export type LibraryRecipe = {
	consumable: Consumable;
	ingredients: RecipeIngredient[];
};

const PORTION_ID = "portion";

function assertName(name: string): string {
	const normalized = name.trim();
	if (!normalized) {
		throw new TypeError(i18n.t("validation:intake.nameRequired"));
	}
	return normalized;
}

function toIngredient(
	draft: RecipeIngredientDraft,
	position: number,
): CreateRecipeIngredient {
	if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
		throw new RangeError(i18n.t("validation:intake.quantityPositive"));
	}
	return {
		position,
		consumableId: draft.consumableId ?? null,
		sourceRef: draft.sourceRef ?? null,
		name: assertName(draft.name),
		portionLabel: null,
		quantity: draft.quantity,
		massKg: draft.massKg == null ? null : draft.massKg * draft.quantity,
		volumeL: draft.volumeL == null ? null : draft.volumeL * draft.quantity,
		constituents: scaleConstituents(draft.constituents, draft.quantity),
	};
}

/**
 * The user's own consumables: items they typed in, recipes calculated from
 * ingredients, and copies of catalogue or provider content they edited.
 */
export class LibraryStore {
	private readonly consumables: ConsumableRepository;

	constructor(db: SQLiteDatabase) {
		this.consumables = new ConsumableRepository(db);
	}

	async list(kind?: ConsumableKind): Promise<Consumable[]> {
		return kind
			? await this.consumables.listByKind(kind)
			: await this.consumables.listAll();
	}

	async find(id: string): Promise<Consumable | null> {
		return await this.consumables.findById(id);
	}

	async findRecipe(id: string): Promise<LibraryRecipe | null> {
		const consumable = await this.consumables.findById(id);
		if (!consumable) return null;
		return {
			consumable,
			ingredients: await this.consumables.listIngredients(id),
		};
	}

	async saveItem(draft: LibraryItemDraft): Promise<Consumable> {
		const name = assertName(draft.name);
		if (Object.keys(draft.constituents).length === 0) {
			throw new RangeError(i18n.t("validation:intake.needsOneValue"));
		}
		const portionLabel =
			draft.portionLabel.trim() || i18n.t("intake:event.defaultPortion");
		const quickComposition = {
			basis: { type: "portion", portionId: PORTION_ID } as const,
			constituents: draft.constituents,
			portions: [
				{
					id: PORTION_ID,
					label: portionLabel,
					massKg: null,
					volumeL: draft.volumeL ?? null,
					basisUnits: 1,
				},
			],
			defaultPortionId: PORTION_ID,
		};
		if (draft.id) {
			const existing = await this.consumables.findById(draft.id);
			if (!existing) {
				throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
			}
			const selectedPortionId =
				draft.portionId ??
				existing.defaultPortionId ??
				existing.portions[0]?.id;
			const factor = selectedPortionId
				? scaleComposition(existing, {
						type: "portion",
						portionId: selectedPortionId,
						quantity: 1,
					}).factor
				: 1;
			const composition = {
				basis: existing.basis,
				constituents: scaleConstituents(draft.constituents, 1 / factor),
				portions: existing.portions.map((portion) =>
					portion.id === selectedPortionId
						? { ...portion, label: portionLabel }
						: portion,
				),
				defaultPortionId: existing.defaultPortionId,
			};
			const input = {
				kind: draft.kind,
				name,
				brand: draft.brand,
				barcode: existing.barcode,
				...composition,
				recipe: null,
			};
			if (existing.source.type !== "user") {
				return await this.consumables.createFork(existing.source, input);
			}
			const updated = await this.consumables.update(draft.id, input);
			if (!updated) {
				throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
			}
			return updated;
		}
		return await this.consumables.create({
			kind: draft.kind,
			name,
			brand: draft.brand,
			barcode: null,
			...quickComposition,
			recipe: null,
			source: { type: "user" },
		});
	}

	/**
	 * Saves a recipe and its ingredients together. The composition is
	 * calculated by the repository from the ingredient snapshots, per yield
	 * unit, and stored on the recipe; a logged meal keeps its own snapshot.
	 */
	async saveRecipe(draft: RecipeDraft): Promise<LibraryRecipe> {
		const name = assertName(draft.name);
		if (draft.ingredients.length === 0) {
			throw new RangeError(i18n.t("validation:intake.ingredientsRequired"));
		}
		const ingredients = draft.ingredients.map(toIngredient);
		let id = draft.id;
		if (id) {
			const existing = await this.consumables.findById(id);
			if (!existing) {
				throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
			}
			await this.consumables.update(id, {
				name,
				brand: draft.brand,
				barcode: existing.barcode,
				basis: existing.basis,
				constituents: existing.constituents,
				portions: existing.portions,
				defaultPortionId: existing.defaultPortionId,
				recipe: { yield: draft.yield },
			});
		} else {
			id = (
				await this.consumables.create({
					kind: draft.kind,
					name,
					brand: draft.brand,
					barcode: null,
					basis: { type: "portion", portionId: draft.yield.unit },
					constituents: {},
					portions: [],
					defaultPortionId: null,
					recipe: { yield: draft.yield },
					source: { type: "user" },
				})
			).id;
		}
		try {
			await this.consumables.replaceIngredients(id, ingredients);
		} catch (error) {
			if (error instanceof RangeError && /contain itself/.test(error.message)) {
				throw new RangeError(i18n.t("validation:intake.recipeCycle"));
			}
			throw error;
		}
		const saved = await this.findRecipe(id);
		if (!saved) {
			throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
		}
		return saved;
	}

	/**
	 * Editing something bro or a provider supplied makes a copy that is yours,
	 * with `forkedFrom` saying where it came from. The catalogue is untouched.
	 */
	async forkSystem(
		system: SystemConsumable,
		overrides: Partial<Pick<Consumable, "name" | "brand">> = {},
	): Promise<Consumable> {
		return await this.consumables.createFork(
			{ type: "system", key: system.key },
			{
				kind: system.kind,
				name: overrides.name ?? system.name,
				brand: overrides.brand ?? null,
				barcode: null,
				basis: system.basis,
				constituents: system.constituents,
				portions: [...system.portions],
				defaultPortionId: system.defaultPortionId,
				recipe: null,
			},
		);
	}

	async fork(
		original: Consumable,
		overrides: Partial<Pick<Consumable, "name" | "brand">> = {},
	): Promise<Consumable> {
		const from: ContentSource =
			original.source.type === "user" ? { type: "user" } : original.source;
		return await this.consumables.createFork(from, {
			kind: original.kind,
			name: overrides.name ?? original.name,
			brand: overrides.brand ?? original.brand,
			barcode: original.barcode,
			basis: original.basis,
			constituents: original.constituents,
			portions: original.portions,
			defaultPortionId: original.defaultPortionId,
			recipe: original.recipe,
		});
	}

	async archive(id: string): Promise<void> {
		if (!(await this.consumables.archive(id))) {
			throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
		}
	}

	async delete(id: string): Promise<void> {
		if (!(await this.consumables.delete(id))) {
			throw new TypeError(i18n.t("validation:intake.consumableNotFound"));
		}
	}
}

export function createLibraryStore(): LibraryStore {
	return new LibraryStore(getDb());
}
