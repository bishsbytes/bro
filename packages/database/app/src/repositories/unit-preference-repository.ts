import type { UnitPreference } from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type { UnitPreference } from "@bro/mobile-model";

type UnitPreferenceRow = {
	id: string;
	dimension: string;
	unit: string;
	created_at: number;
	updated_at: number;
};

const SELECT_COLUMNS = "id, dimension, unit, created_at, updated_at";

function toUnitPreference(row: UnitPreferenceRow): UnitPreference {
	return {
		id: row.id,
		dimension: row.dimension,
		unit: row.unit,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertPreference(dimension: string, unit: string): void {
	if (!dimension.trim()) {
		throw new TypeError("Unit preference dimension must not be empty.");
	}
	if (!unit.trim()) {
		throw new TypeError("Unit preference unit must not be empty.");
	}
}

/**
 * Persists display-unit choices without constraining future dimensions or units.
 * Known combinations are validated by the pure units module at the UI boundary.
 */
export class UnitPreferenceRepository extends BaseRepository {
	async set(dimension: string, unit: string): Promise<UnitPreference> {
		assertPreference(dimension, unit);
		const normalizedDimension = dimension.trim();
		const normalizedUnit = unit.trim();

		return await this.transaction(async () => {
			const existing = await this.first<UnitPreferenceRow>(
				`SELECT ${SELECT_COLUMNS} FROM unit_preferences
				 WHERE dimension = ?
				 ORDER BY updated_at DESC, id DESC LIMIT 1`,
				[normalizedDimension],
			);
			const now = this.now();

			if (existing) {
				await this.run(
					`UPDATE unit_preferences SET unit = ?, updated_at = ? WHERE id = ?`,
					[normalizedUnit, now, existing.id],
				);
				return toUnitPreference({
					...existing,
					unit: normalizedUnit,
					updated_at: now,
				});
			}

			const preference: UnitPreference = {
				id: this.createId(now),
				dimension: normalizedDimension,
				unit: normalizedUnit,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO unit_preferences (
					id, dimension, unit, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?)`,
				[
					preference.id,
					preference.dimension,
					preference.unit,
					preference.createdAt,
					preference.updatedAt,
				],
			);
			return preference;
		});
	}

	async list(): Promise<UnitPreference[]> {
		const rows = await this.all<UnitPreferenceRow>(
			`SELECT ${SELECT_COLUMNS} FROM unit_preferences
			 ORDER BY updated_at DESC, id DESC`,
		);
		return rows.map(toUnitPreference);
	}

	async resolveLatestPerDimension(): Promise<UnitPreference[]> {
		const latestByDimension = new Map<string, UnitPreference>();
		for (const preference of await this.list()) {
			if (!latestByDimension.has(preference.dimension)) {
				latestByDimension.set(preference.dimension, preference);
			}
		}
		return [...latestByDimension.values()].sort((left, right) =>
			left.dimension.localeCompare(right.dimension),
		);
	}
}
