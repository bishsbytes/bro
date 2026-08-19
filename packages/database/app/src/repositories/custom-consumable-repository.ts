import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type CustomConsumableKind = "food" | "drink";

export type CustomConsumableServing = {
	id: string;
	label: string;
	volumeL: number | null;
	ethanolKg: number | null;
	caffeineKg: number | null;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
};

export type CustomConsumable = {
	id: string;
	kind: CustomConsumableKind;
	label: string;
	brand: string | null;
	isRecipe: boolean;
	servings: CustomConsumableServing[];
	createdAt: number;
	updatedAt: number;
};

export type CreateCustomConsumable = Pick<
	CustomConsumable,
	"kind" | "label" | "brand" | "isRecipe" | "servings"
>;

export type UpdateCustomConsumable = Omit<CreateCustomConsumable, "kind">;

export type CustomConsumableComponent = {
	id: string;
	consumableId: string;
	position: number;
	label: string;
	quantity: number;
	energyKcal: number | null;
	proteinG: number | null;
	carbsG: number | null;
	fatG: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateCustomConsumableComponent = Omit<
	CustomConsumableComponent,
	"id" | "consumableId" | "createdAt" | "updatedAt"
>;

export type UpdateCustomConsumableComponent = CreateCustomConsumableComponent;

type CustomConsumableRow = {
	id: string;
	kind: string;
	label: string;
	brand: string | null;
	is_recipe: number;
	servings: string;
	created_at: number;
	updated_at: number;
};

type CustomConsumableComponentRow = {
	id: string;
	consumable_id: string;
	position: number;
	label: string;
	quantity: number;
	energy_kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const CONSUMABLE_COLUMNS = `
	id, kind, label, brand, is_recipe, servings, created_at, updated_at
`;

const COMPONENT_COLUMNS = `
	id, consumable_id, position, label, quantity, energy_kcal, protein_g,
	carbs_g, fat_g, created_at, updated_at
`;

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function optional(value: string | null): string | null {
	return value?.trim() || null;
}

function assertKind(kind: string): asserts kind is CustomConsumableKind {
	if (kind !== "food" && kind !== "drink") {
		throw new TypeError(`Unsupported custom consumable kind: ${kind}`);
	}
}

function assertOptionalQuantity(value: number | null, label: string): void {
	if (value !== null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(`${label} must be null or a non-negative finite value.`);
	}
}

function normalizeServing(
	serving: CustomConsumableServing,
): CustomConsumableServing {
	const normalized: CustomConsumableServing = {
		...serving,
		id: required(serving.id, "Custom consumable serving id"),
		label: required(serving.label, "Custom consumable serving label"),
	};
	assertOptionalQuantity(normalized.volumeL, "Custom serving volume");
	assertOptionalQuantity(normalized.ethanolKg, "Custom serving ethanol mass");
	assertOptionalQuantity(normalized.caffeineKg, "Custom serving caffeine mass");
	assertOptionalQuantity(normalized.energyKcal, "Custom serving energy");
	assertOptionalQuantity(normalized.proteinG, "Custom serving protein");
	assertOptionalQuantity(normalized.carbsG, "Custom serving carbs");
	assertOptionalQuantity(normalized.fatG, "Custom serving fat");
	if (
		normalized.volumeL === null &&
		normalized.ethanolKg === null &&
		normalized.caffeineKg === null &&
		normalized.energyKcal === null &&
		normalized.proteinG === null &&
		normalized.carbsG === null &&
		normalized.fatG === null
	) {
		throw new RangeError(
			"Custom consumable serving must carry at least one canonical quantity.",
		);
	}
	return normalized;
}

function normalizeServings(
	servings: readonly CustomConsumableServing[],
): CustomConsumableServing[] {
	if (servings.length === 0) {
		throw new RangeError("Custom consumable must have at least one serving.");
	}
	const normalized = servings.map(normalizeServing);
	if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
		throw new TypeError("Custom consumable serving ids must be unique.");
	}
	return normalized;
}

function parseServings(value: string): CustomConsumableServing[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new TypeError("Custom consumable servings contain invalid JSON.");
	}
	if (!Array.isArray(parsed)) {
		throw new TypeError("Custom consumable servings must be an array.");
	}
	return normalizeServings(parsed as CustomConsumableServing[]);
}

function normalizeConsumable(input: CreateCustomConsumable): CreateCustomConsumable {
	assertKind(input.kind);
	return {
		...input,
		label: required(input.label, "Custom consumable label"),
		brand: optional(input.brand),
		servings: normalizeServings(input.servings),
	};
}

function normalizeComponent(
	input: CreateCustomConsumableComponent,
): CreateCustomConsumableComponent {
	if (!Number.isInteger(input.position) || input.position < 0) {
		throw new RangeError(
			"Custom consumable component position must be a non-negative integer.",
		);
	}
	if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
		throw new RangeError(
			"Custom consumable component quantity must be a positive finite value.",
		);
	}
	assertOptionalQuantity(input.energyKcal, "Custom component energy");
	assertOptionalQuantity(input.proteinG, "Custom component protein");
	assertOptionalQuantity(input.carbsG, "Custom component carbs");
	assertOptionalQuantity(input.fatG, "Custom component fat");
	if (
		input.energyKcal === null &&
		input.proteinG === null &&
		input.carbsG === null &&
		input.fatG === null
	) {
		throw new RangeError(
			"Custom consumable component must carry at least one nutrition quantity.",
		);
	}
	return {
		...input,
		label: required(input.label, "Custom consumable component label"),
	};
}

function toConsumable(row: CustomConsumableRow): CustomConsumable {
	assertKind(row.kind);
	if (row.is_recipe !== 0 && row.is_recipe !== 1) {
		throw new TypeError(`Invalid recipe flag for custom consumable ${row.id}.`);
	}
	return {
		id: row.id,
		kind: row.kind,
		label: row.label,
		brand: row.brand,
		isRecipe: row.is_recipe === 1,
		servings: parseServings(row.servings),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toComponent(
	row: CustomConsumableComponentRow,
): CustomConsumableComponent {
	return {
		id: row.id,
		consumableId: row.consumable_id,
		position: row.position,
		label: row.label,
		quantity: row.quantity,
		energyKcal: row.energy_kcal,
		proteinG: row.protein_g,
		carbsG: row.carbs_g,
		fatG: row.fat_g,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class CustomConsumableRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async create(
		input: CreateCustomConsumable,
		components: readonly CreateCustomConsumableComponent[] = [],
	): Promise<CustomConsumable> {
		const normalized = normalizeConsumable(input);
		if (!normalized.isRecipe && components.length > 0) {
			throw new TypeError("Only recipes can have consumable components.");
		}
		const normalizedComponents = components.map(normalizeComponent);
		const now = this.now();
		const consumable: CustomConsumable = {
			...normalized,
			id: this.createId(now),
			createdAt: now,
			updatedAt: now,
		};

		await this.transaction(async () => {
			await this.run(
				`INSERT INTO custom_consumables (
					id, kind, label, brand, is_recipe, servings, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					consumable.id,
					consumable.kind,
					consumable.label,
					consumable.brand,
					consumable.isRecipe ? 1 : 0,
					JSON.stringify(consumable.servings),
					consumable.createdAt,
					consumable.updatedAt,
				],
			);
			for (const component of normalizedComponents) {
				await this.insertComponent(consumable.id, component, now);
			}
		});
		return consumable;
	}

	async findById(id: string): Promise<CustomConsumable | null> {
		const row = await this.first<CustomConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM custom_consumables WHERE id = ?`,
			[id],
		);
		return row ? toConsumable(row) : null;
	}

	async listAll(): Promise<CustomConsumable[]> {
		const rows = await this.all<CustomConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM custom_consumables
			 ORDER BY updated_at DESC, created_at DESC, id DESC`,
		);
		return rows.map(toConsumable);
	}

	async listByKind(kind: CustomConsumableKind): Promise<CustomConsumable[]> {
		assertKind(kind);
		const rows = await this.all<CustomConsumableRow>(
			`SELECT ${CONSUMABLE_COLUMNS} FROM custom_consumables
			 WHERE kind = ? ORDER BY updated_at DESC, created_at DESC, id DESC`,
			[kind],
		);
		return rows.map(toConsumable);
	}

	async update(
		id: string,
		input: UpdateCustomConsumable,
	): Promise<CustomConsumable | null> {
		const existing = await this.findById(id);
		if (!existing) {
			return null;
		}
		const normalized = normalizeConsumable({ ...input, kind: existing.kind });
		if (!normalized.isRecipe && (await this.listComponents(id)).length > 0) {
			throw new TypeError(
				"A recipe with components cannot become a plain custom consumable.",
			);
		}
		await this.run(
			`UPDATE custom_consumables SET
				label = ?, brand = ?, is_recipe = ?, servings = ?, updated_at = ?
			 WHERE id = ?`,
			[
				normalized.label,
				normalized.brand,
				normalized.isRecipe ? 1 : 0,
				JSON.stringify(normalized.servings),
				this.now(),
				id,
			],
		);
		return await this.findById(id);
	}

	async listComponents(
		consumableId: string,
	): Promise<CustomConsumableComponent[]> {
		const rows = await this.all<CustomConsumableComponentRow>(
			`SELECT ${COMPONENT_COLUMNS} FROM custom_consumable_components
			 WHERE consumable_id = ? ORDER BY position ASC, created_at ASC, id ASC`,
			[consumableId],
		);
		return rows.map(toComponent);
	}

	async addComponent(
		consumableId: string,
		input: CreateCustomConsumableComponent,
	): Promise<CustomConsumableComponent> {
		const consumable = await this.findById(consumableId);
		if (!consumable) {
			throw new Error(`Custom consumable does not exist: ${consumableId}`);
		}
		if (!consumable.isRecipe) {
			throw new TypeError("Only recipes can have consumable components.");
		}
		const normalized = normalizeComponent(input);
		const now = this.now();
		let component: CustomConsumableComponent | undefined;
		await this.transaction(async () => {
			component = await this.insertComponent(consumableId, normalized, now);
			await this.touchConsumable(consumableId, now);
		});
		return component as CustomConsumableComponent;
	}

	async updateComponent(
		id: string,
		input: UpdateCustomConsumableComponent,
	): Promise<CustomConsumableComponent | null> {
		const existing = await this.findComponentById(id);
		if (!existing) {
			return null;
		}
		const normalized = normalizeComponent(input);
		const now = this.now();
		await this.transaction(async () => {
			await this.run(
				`UPDATE custom_consumable_components SET
					position = ?, label = ?, quantity = ?, energy_kcal = ?, protein_g = ?,
					carbs_g = ?, fat_g = ?, updated_at = ? WHERE id = ?`,
				[
					normalized.position,
					normalized.label,
					normalized.quantity,
					normalized.energyKcal,
					normalized.proteinG,
					normalized.carbsG,
					normalized.fatG,
					now,
					id,
				],
			);
			await this.touchConsumable(existing.consumableId, now);
		});
		return await this.findComponentById(id);
	}

	async deleteComponent(id: string): Promise<boolean> {
		const existing = await this.findComponentById(id);
		if (!existing) {
			return false;
		}
		await this.transaction(async () => {
			await this.run("DELETE FROM custom_consumable_components WHERE id = ?", [
				id,
			]);
			await this.touchConsumable(existing.consumableId, this.now());
		});
		return true;
	}

	async delete(id: string): Promise<boolean> {
		let deleted = false;
		await this.transaction(async () => {
			await this.run(
				"DELETE FROM custom_consumable_components WHERE consumable_id = ?",
				[id],
			);
			const result = await this.run("DELETE FROM custom_consumables WHERE id = ?", [
				id,
			]);
			deleted = result.changes > 0;
		});
		return deleted;
	}

	private async findComponentById(
		id: string,
	): Promise<CustomConsumableComponent | null> {
		const row = await this.first<CustomConsumableComponentRow>(
			`SELECT ${COMPONENT_COLUMNS} FROM custom_consumable_components WHERE id = ?`,
			[id],
		);
		return row ? toComponent(row) : null;
	}

	private async insertComponent(
		consumableId: string,
		input: CreateCustomConsumableComponent,
		now: number,
	): Promise<CustomConsumableComponent> {
		const component: CustomConsumableComponent = {
			...input,
			id: this.createId(now),
			consumableId,
			createdAt: now,
			updatedAt: now,
		};
		await this.run(
			`INSERT INTO custom_consumable_components (
				id, consumable_id, position, label, quantity, energy_kcal, protein_g,
				carbs_g, fat_g, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				component.id,
				component.consumableId,
				component.position,
				component.label,
				component.quantity,
				component.energyKcal,
				component.proteinG,
				component.carbsG,
				component.fatG,
				component.createdAt,
				component.updatedAt,
			],
		);
		return component;
	}

	private async touchConsumable(id: string, updatedAt: number): Promise<void> {
		await this.run("UPDATE custom_consumables SET updated_at = ? WHERE id = ?", [
			updatedAt,
			id,
		]);
	}
}
