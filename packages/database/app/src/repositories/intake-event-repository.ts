import { isCalendarDay } from "@bro/domain";
import {
	assertConstituentAmounts,
	type ConstituentAmounts,
	isConstituentAmounts,
} from "@bro/domain/constituent-catalogue";
import {
	type ConsumableKind,
	isConsumableKind,
	isIntakeContext,
} from "@bro/domain/consumable";
import type {
	CreateIntakeEvent,
	IntakeEvent,
	UpdateIntakeEvent,
} from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type {
	CreateIntakeEvent,
	IntakeEvent,
	UpdateIntakeEvent,
} from "@bro/mobile-model";

type IntakeEventRow = {
	id: string;
	kind: string;
	consumable_id: string | null;
	source_ref: string | null;
	name: string;
	brand: string | null;
	portion_label: string | null;
	quantity: number;
	mass_kg: number | null;
	volume_l: number | null;
	constituents: string;
	context: string | null;
	notes: string | null;
	occurred_at: number;
	local_day: string;
	tz_offset_minutes: number;
	created_at: number;
	updated_at: number;
};

const SELECT_COLUMNS = `
	id, kind, consumable_id, source_ref, name, brand, portion_label, quantity,
	mass_kg, volume_l, constituents, context, notes, occurred_at, local_day,
	tz_offset_minutes, created_at, updated_at
`;

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

function assertEvent(input: CreateIntakeEvent): void {
	if (!isConsumableKind(input.kind)) {
		throw new TypeError(`Unsupported intake event kind: ${String(input.kind)}`);
	}
	required(input.name, "Intake event name");
	if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
		throw new RangeError(
			"Intake event quantity must be a positive finite value.",
		);
	}
	assertOptionalAmount(input.massKg, "Intake event mass");
	assertOptionalAmount(input.volumeL, "Intake event volume");
	assertConstituentAmounts(input.constituents, "Intake event constituent");
	if (
		input.massKg === null &&
		input.volumeL === null &&
		Object.keys(input.constituents).length === 0
	) {
		throw new RangeError(
			"Intake event must carry a mass, a volume, or at least one constituent.",
		);
	}
	if (input.context !== null && !isIntakeContext(input.context)) {
		throw new TypeError(`Unsupported intake context: ${String(input.context)}`);
	}
	if (!Number.isInteger(input.occurredAt)) {
		throw new TypeError("Intake event occurredAt must be epoch milliseconds.");
	}
	if (!isCalendarDay(input.localDay)) {
		throw new TypeError(
			"Intake event localDay must be a real YYYY-MM-DD date.",
		);
	}
	if (!Number.isInteger(input.tzOffsetMinutes)) {
		throw new TypeError("Intake event timezone offset must be whole minutes.");
	}
}

function normalizeEvent(input: CreateIntakeEvent): CreateIntakeEvent {
	return {
		...input,
		consumableId: optional(input.consumableId),
		sourceRef: optional(input.sourceRef),
		name: required(input.name, "Intake event name"),
		brand: optional(input.brand),
		portionLabel: optional(input.portionLabel),
		constituents: { ...input.constituents },
		notes: optional(input.notes),
	};
}

/**
 * Unknown codes are preserved exactly as stored: a build that does not know a
 * constituent still writes it back untouched, and the totals engine skips it.
 */
function parseConstituents(value: string, id: string): ConstituentAmounts {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		throw new TypeError(`Intake event ${id} constituents are invalid JSON.`);
	}
	if (!isConstituentAmounts(parsed)) {
		throw new TypeError(`Intake event ${id} constituents are malformed.`);
	}
	return parsed;
}

function toIntakeEvent(row: IntakeEventRow): IntakeEvent {
	if (!isConsumableKind(row.kind)) {
		throw new TypeError(`Unsupported intake event kind: ${row.kind}`);
	}
	return {
		id: row.id,
		kind: row.kind,
		consumableId: row.consumable_id,
		sourceRef: row.source_ref,
		name: row.name,
		brand: row.brand,
		portionLabel: row.portion_label,
		quantity: row.quantity,
		massKg: row.mass_kg,
		volumeL: row.volume_l,
		constituents: parseConstituents(row.constituents, row.id),
		// A context this build cannot read is dropped rather than rendered raw;
		// nothing depends on it.
		context: isIntakeContext(row.context) ? row.context : null,
		notes: row.notes,
		occurredAt: row.occurred_at,
		localDay: row.local_day,
		tzOffsetMinutes: row.tz_offset_minutes,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertDay(localDay: string): void {
	if (!isCalendarDay(localDay)) {
		throw new TypeError(
			"Intake event localDay must be a real YYYY-MM-DD date.",
		);
	}
}

function assertLimit(limit: number): void {
	if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
		throw new RangeError(
			"Intake event recent limit must be from 1 through 200.",
		);
	}
}

export class IntakeEventRepository extends BaseRepository {
	async create(input: CreateIntakeEvent): Promise<IntakeEvent> {
		assertEvent(input);
		const normalized = normalizeEvent(input);
		const now = this.now();
		const event: IntakeEvent = {
			...normalized,
			id: this.createId(now),
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO intake_events (
				id, kind, consumable_id, source_ref, name, brand, portion_label,
				quantity, mass_kg, volume_l, constituents, context, notes, occurred_at,
				local_day, tz_offset_minutes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				event.id,
				event.kind,
				event.consumableId,
				event.sourceRef,
				event.name,
				event.brand,
				event.portionLabel,
				event.quantity,
				event.massKg,
				event.volumeL,
				JSON.stringify(event.constituents),
				event.context,
				event.notes,
				event.occurredAt,
				event.localDay,
				event.tzOffsetMinutes,
				event.createdAt,
				event.updatedAt,
			],
		);

		return event;
	}

	async findById(id: string): Promise<IntakeEvent | null> {
		const row = await this.first<IntakeEventRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_events WHERE id = ?`,
			[id],
		);
		return row ? toIntakeEvent(row) : null;
	}

	/** Every event, newest day first. Export reads this; day surfaces window. */
	async listAll(): Promise<IntakeEvent[]> {
		const rows = await this.all<IntakeEventRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_events
			 ORDER BY local_day DESC, occurred_at DESC, created_at DESC, id DESC`,
		);
		return rows.map(toIntakeEvent);
	}

	async listByDay(localDay: string): Promise<IntakeEvent[]> {
		assertDay(localDay);
		const rows = await this.all<IntakeEventRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_events
			 WHERE local_day = ?
			 ORDER BY occurred_at ASC, created_at ASC, id ASC`,
			[localDay],
		);
		return rows.map(toIntakeEvent);
	}

	/** Events from `fromLocalDay` through `throughLocalDay` inclusive, in time order. */
	async listBetween(
		fromLocalDay: string,
		throughLocalDay: string,
	): Promise<IntakeEvent[]> {
		assertDay(fromLocalDay);
		assertDay(throughLocalDay);
		if (fromLocalDay > throughLocalDay) {
			throw new RangeError("Intake event window must run forwards.");
		}
		const rows = await this.all<IntakeEventRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_events
			 WHERE local_day >= ? AND local_day <= ?
			 ORDER BY local_day ASC, occurred_at ASC, created_at ASC, id ASC`,
			[fromLocalDay, throughLocalDay],
		);
		return rows.map(toIntakeEvent);
	}

	/** The most recently logged events of the given kinds, newest first. */
	async listRecent(
		kinds: readonly ConsumableKind[],
		limit = 24,
	): Promise<IntakeEvent[]> {
		assertLimit(limit);
		if (kinds.length === 0) return [];
		for (const kind of kinds) {
			if (!isConsumableKind(kind)) {
				throw new TypeError(`Unsupported intake event kind: ${String(kind)}`);
			}
		}
		const rows = await this.all<IntakeEventRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_events
			 WHERE kind IN (${kinds.map(() => "?").join(", ")})
			 ORDER BY occurred_at DESC, created_at DESC, id DESC
			 LIMIT ?`,
			[...kinds, limit],
		);
		return rows.map(toIntakeEvent);
	}

	async update(
		id: string,
		input: UpdateIntakeEvent,
	): Promise<IntakeEvent | null> {
		const existing = await this.findById(id);
		if (!existing) {
			return null;
		}
		const complete: CreateIntakeEvent = { ...input, kind: existing.kind };
		assertEvent(complete);
		const normalized = normalizeEvent(complete);
		await this.run(
			`UPDATE intake_events SET
				consumable_id = ?, source_ref = ?, name = ?, brand = ?, portion_label = ?,
				quantity = ?, mass_kg = ?, volume_l = ?, constituents = ?, context = ?,
				notes = ?, occurred_at = ?, local_day = ?, tz_offset_minutes = ?,
				updated_at = ?
			 WHERE id = ?`,
			[
				normalized.consumableId,
				normalized.sourceRef,
				normalized.name,
				normalized.brand,
				normalized.portionLabel,
				normalized.quantity,
				normalized.massKg,
				normalized.volumeL,
				JSON.stringify(normalized.constituents),
				normalized.context,
				normalized.notes,
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
		const result = await this.run("DELETE FROM intake_events WHERE id = ?", [
			id,
		]);
		return result.changes > 0;
	}
}
