import {
	ALWAYS_ON_CONSUMABLE_KINDS,
	type ConsumableKind,
	isConsumableKind,
	isOptionalStreamKind,
	type OptionalStreamKind,
} from "@bro/domain/consumable";
import type { IntakeStream } from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type { IntakeStream } from "@bro/mobile-model";

type IntakeStreamRow = {
	id: string;
	kind: string;
	enabled_at: number;
	disabled_at: number | null;
	created_at: number;
	updated_at: number;
};

const SELECT_COLUMNS =
	"id, kind, enabled_at, disabled_at, created_at, updated_at";

function toIntakeStream(row: IntakeStreamRow): IntakeStream {
	if (!isConsumableKind(row.kind)) {
		throw new TypeError(`Unsupported intake stream kind: ${row.kind}`);
	}
	return {
		id: row.id,
		kind: row.kind,
		enabledAt: row.enabled_at,
		disabledAt: row.disabled_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertOptionalKind(kind: string): asserts kind is OptionalStreamKind {
	if (!isOptionalStreamKind(kind)) {
		throw new TypeError(
			`Only optional intake streams can be switched: ${kind} is not one.`,
		);
	}
}

/**
 * Which optional streams are on. Food and drink are always on and never have a
 * row here; an optional kind is off until switched on from settings or by
 * adopting a habit that needs it, and switching it off hides every surface it
 * had — the found-not-promoted posture.
 */
export class IntakeStreamRepository extends BaseRepository {
	async listAll(): Promise<IntakeStream[]> {
		const rows = await this.all<IntakeStreamRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_streams
			 ORDER BY created_at ASC, id ASC`,
		);
		return rows.map(toIntakeStream);
	}

	/** Every kind currently on, always-on kinds first. */
	async listEnabledKinds(): Promise<ConsumableKind[]> {
		const rows = await this.all<IntakeStreamRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_streams
			 WHERE disabled_at IS NULL
			 ORDER BY enabled_at ASC, id ASC`,
		);
		const optional = rows
			.map(toIntakeStream)
			.map((stream) => stream.kind)
			.filter(isOptionalStreamKind);
		return [...ALWAYS_ON_CONSUMABLE_KINDS, ...new Set(optional)];
	}

	async isEnabled(kind: ConsumableKind): Promise<boolean> {
		if ((ALWAYS_ON_CONSUMABLE_KINDS as readonly string[]).includes(kind)) {
			return true;
		}
		const row = await this.first<{ count: number }>(
			`SELECT COUNT(*) AS count FROM intake_streams
			 WHERE kind = ? AND disabled_at IS NULL`,
			[kind],
		);
		return (row?.count ?? 0) > 0;
	}

	async setEnabled(kind: string, enabled: boolean): Promise<IntakeStream> {
		assertOptionalKind(kind);
		const now = this.now();
		const existing = await this.first<IntakeStreamRow>(
			`SELECT ${SELECT_COLUMNS} FROM intake_streams WHERE kind = ?
			 ORDER BY created_at DESC, id DESC LIMIT 1`,
			[kind],
		);
		if (!existing) {
			const stream: IntakeStream = {
				id: this.createId(now),
				kind,
				enabledAt: now,
				disabledAt: enabled ? null : now,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO intake_streams (
					id, kind, enabled_at, disabled_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?)`,
				[
					stream.id,
					stream.kind,
					stream.enabledAt,
					stream.disabledAt,
					stream.createdAt,
					stream.updatedAt,
				],
			);
			return stream;
		}
		const current = toIntakeStream(existing);
		if ((current.disabledAt === null) === enabled) {
			return current;
		}
		await this.run(
			`UPDATE intake_streams SET enabled_at = ?, disabled_at = ?, updated_at = ?
			 WHERE id = ?`,
			[
				enabled ? now : current.enabledAt,
				enabled ? null : now,
				now,
				current.id,
			],
		);
		return {
			...current,
			enabledAt: enabled ? now : current.enabledAt,
			disabledAt: enabled ? null : now,
			updatedAt: now,
		};
	}
}
