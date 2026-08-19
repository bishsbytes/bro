import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";
import { isCalendarDay } from "./calendar-day";

export type ConsumptionEntryKind = "drink" | "food";

export type ConsumptionEntry = {
	id: string;
	kind: ConsumptionEntryKind;
	catalogueRef: string | null;
	consumableRef?: string | null;
	label: string;
	servingLabel: string | null;
	quantity: number;
	volumeL: number | null;
	ethanolKg: number | null;
	caffeineKg: number | null;
	energyKcal: number | null;
	proteinG?: number | null;
	carbsG?: number | null;
	fatG?: number | null;
	occurredAt: number;
	localDay: string;
	tzOffsetMinutes: number;
	createdAt: number;
	updatedAt: number;
};

type FoodSnapshotFields = Pick<
	ConsumptionEntry,
	"consumableRef" | "proteinG" | "carbsG" | "fatG"
>;

type NormalizedConsumptionEntryInput = Omit<
	CreateConsumptionEntry,
	keyof FoodSnapshotFields
> &
	Required<FoodSnapshotFields>;

export type CreateConsumptionEntry = Omit<
	ConsumptionEntry,
	"id" | "createdAt" | "updatedAt" | keyof FoodSnapshotFields
> &
	Partial<FoodSnapshotFields>;

export type UpdateConsumptionEntry = Omit<CreateConsumptionEntry, "kind">;

type ConsumptionEntryRow = {
	id: string;
	kind: string;
	catalogue_ref: string | null;
	consumable_ref: string | null;
	label: string;
	serving_label: string | null;
	quantity: number;
	volume_l: number | null;
	ethanol_kg: number | null;
	caffeine_kg: number | null;
	energy_kcal: number | null;
	protein_g: number | null;
	carbs_g: number | null;
	fat_g: number | null;
	occurred_at: number;
	local_day: string;
	tz_offset_minutes: number;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, kind, catalogue_ref, consumable_ref, label, serving_label, quantity,
	volume_l, ethanol_kg, caffeine_kg, energy_kcal, protein_g, carbs_g, fat_g,
	occurred_at, local_day, tz_offset_minutes, created_at, updated_at
`;

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) {
		throw new TypeError(`${label} must not be empty.`);
	}
	return normalized;
}

function optional(value: string | null): string | null {
	const normalized = value?.trim();
	return normalized ? normalized : null;
}

function assertOptionalQuantity(
	value: number | null | undefined,
	label: string,
): void {
	if (value != null && (!Number.isFinite(value) || value < 0)) {
		throw new RangeError(
			`${label} must be null or a non-negative finite value.`,
		);
	}
}

function assertEntry(input: CreateConsumptionEntry): void {
	if (input.kind !== "drink" && input.kind !== "food") {
		throw new TypeError("Consumption entry kind must be drink or food.");
	}
	required(input.label, "Consumption entry label");
	if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
		throw new RangeError(
			"Consumption entry quantity must be a positive finite value.",
		);
	}
	assertOptionalQuantity(input.volumeL, "Consumption entry volume");
	assertOptionalQuantity(input.ethanolKg, "Consumption entry ethanol mass");
	assertOptionalQuantity(input.caffeineKg, "Consumption entry caffeine mass");
	assertOptionalQuantity(input.energyKcal, "Consumption entry energy");
	assertOptionalQuantity(input.proteinG, "Consumption entry protein");
	assertOptionalQuantity(input.carbsG, "Consumption entry carbs");
	assertOptionalQuantity(input.fatG, "Consumption entry fat");
	if (
		input.volumeL === null &&
		input.ethanolKg === null &&
		input.caffeineKg === null &&
		input.energyKcal === null &&
		input.proteinG == null &&
		input.carbsG == null &&
		input.fatG == null
	) {
		throw new RangeError(
			"Consumption entry must carry at least one canonical quantity.",
		);
	}
	if (!Number.isInteger(input.occurredAt)) {
		throw new TypeError(
			"Consumption entry occurredAt must be epoch milliseconds.",
		);
	}
	if (!isCalendarDay(input.localDay)) {
		throw new TypeError(
			"Consumption entry localDay must be a real YYYY-MM-DD date.",
		);
	}
	if (!Number.isInteger(input.tzOffsetMinutes)) {
		throw new TypeError(
			"Consumption entry timezone offset must be whole minutes.",
		);
	}
}

function normalizeEntry(
	input: CreateConsumptionEntry,
): NormalizedConsumptionEntryInput {
	return {
		...input,
		catalogueRef: optional(input.catalogueRef),
		consumableRef: optional(input.consumableRef ?? null),
		label: required(input.label, "Consumption entry label"),
		servingLabel: optional(input.servingLabel),
		proteinG: input.proteinG ?? null,
		carbsG: input.carbsG ?? null,
		fatG: input.fatG ?? null,
	};
}

function toConsumptionEntry(row: ConsumptionEntryRow): ConsumptionEntry {
	if (row.kind !== "drink" && row.kind !== "food") {
		throw new TypeError(`Unsupported consumption entry kind: ${row.kind}`);
	}
	return {
		id: row.id,
		kind: row.kind,
		catalogueRef: row.catalogue_ref,
		consumableRef: row.consumable_ref,
		label: row.label,
		servingLabel: row.serving_label,
		quantity: row.quantity,
		volumeL: row.volume_l,
		ethanolKg: row.ethanol_kg,
		caffeineKg: row.caffeine_kg,
		energyKcal: row.energy_kcal,
		proteinG: row.protein_g,
		carbsG: row.carbs_g,
		fatG: row.fat_g,
		occurredAt: row.occurred_at,
		localDay: row.local_day,
		tzOffsetMinutes: row.tz_offset_minutes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class ConsumptionEntryRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async create(input: CreateConsumptionEntry): Promise<ConsumptionEntry> {
		assertEntry(input);
		const normalized = normalizeEntry(input);
		const now = this.now();
		const entry: ConsumptionEntry & Required<FoodSnapshotFields> = {
			...normalized,
			id: this.createId(now),
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO consumption_entries (
				id, kind, catalogue_ref, consumable_ref, label, serving_label,
				quantity, volume_l, ethanol_kg, caffeine_kg, energy_kcal, protein_g,
				carbs_g, fat_g, occurred_at, local_day, tz_offset_minutes, created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.kind,
				entry.catalogueRef,
				entry.consumableRef,
				entry.label,
				entry.servingLabel,
				entry.quantity,
				entry.volumeL,
				entry.ethanolKg,
				entry.caffeineKg,
				entry.energyKcal,
				entry.proteinG,
				entry.carbsG,
				entry.fatG,
				entry.occurredAt,
				entry.localDay,
				entry.tzOffsetMinutes,
				entry.createdAt,
				entry.updatedAt,
			],
		);

		return entry;
	}

	async findById(id: string): Promise<ConsumptionEntry | null> {
		const row = await this.first<ConsumptionEntryRow>(
			`SELECT ${SELECT_COLUMNS} FROM consumption_entries WHERE id = ?`,
			[id],
		);
		return row ? toConsumptionEntry(row) : null;
	}

	async listAll(): Promise<ConsumptionEntry[]> {
		const rows = await this.all<ConsumptionEntryRow>(
			`SELECT ${SELECT_COLUMNS} FROM consumption_entries
			 ORDER BY local_day DESC, occurred_at DESC, created_at DESC, id DESC`,
		);
		return rows.map(toConsumptionEntry);
	}

	async listByDay(localDay: string): Promise<ConsumptionEntry[]> {
		if (!isCalendarDay(localDay)) {
			throw new TypeError(
				"Consumption entry localDay must be a real YYYY-MM-DD date.",
			);
		}
		const rows = await this.all<ConsumptionEntryRow>(
			`SELECT ${SELECT_COLUMNS} FROM consumption_entries
			 WHERE local_day = ?
			 ORDER BY occurred_at ASC, created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toConsumptionEntry);
	}

	async listRecent(limit = 8): Promise<ConsumptionEntry[]> {
		return await this.listRecentByKind("drink", limit);
	}

	async listRecentByKind(
		kind: ConsumptionEntryKind,
		limit = 8,
	): Promise<ConsumptionEntry[]> {
		if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
			throw new RangeError(
				"Consumption entry recent limit must be from 1 through 100.",
			);
		}
		const rows = await this.all<ConsumptionEntryRow>(
			`SELECT ${SELECT_COLUMNS} FROM consumption_entries
			 WHERE kind = ?
			 ORDER BY occurred_at DESC, created_at DESC, id DESC
			 LIMIT ?`,
			[kind, limit],
		);
		return rows.map(toConsumptionEntry);
	}

	async update(
		id: string,
		input: UpdateConsumptionEntry,
	): Promise<ConsumptionEntry | null> {
		const existing = await this.findById(id);
		if (!existing) {
			return null;
		}
		const complete: CreateConsumptionEntry = {
			...input,
			kind: existing.kind,
		};
		assertEntry(complete);
		const normalized = normalizeEntry(complete);
		await this.run(
			`UPDATE consumption_entries SET
				catalogue_ref = ?, consumable_ref = ?, label = ?, serving_label = ?,
				quantity = ?, volume_l = ?, ethanol_kg = ?, caffeine_kg = ?,
				energy_kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?, occurred_at = ?,
				local_day = ?, tz_offset_minutes = ?, updated_at = ?
			 WHERE id = ?`,
			[
				normalized.catalogueRef,
				normalized.consumableRef,
				normalized.label,
				normalized.servingLabel,
				normalized.quantity,
				normalized.volumeL,
				normalized.ethanolKg,
				normalized.caffeineKg,
				normalized.energyKcal,
				normalized.proteinG,
				normalized.carbsG,
				normalized.fatG,
				normalized.occurredAt,
				normalized.localDay,
				normalized.tzOffsetMinutes,
				this.now(),
				id,
			],
		);
		return await this.findById(id);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.run(
			"DELETE FROM consumption_entries WHERE id = ?",
			[id],
		);
		return result.changes > 0;
	}
}
