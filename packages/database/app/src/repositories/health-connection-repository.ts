import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type HealthPlatform = "healthkit" | "health_connect";

export type HealthConnection = {
	id: string;
	platform: HealthPlatform;
	metricSlug: string;
	changeToken: string | null;
	connectedAt: number;
	lastImportedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

type HealthConnectionRow = {
	id: string;
	platform: HealthPlatform;
	metric_slug: string;
	change_token: string | null;
	connected_at: number;
	last_imported_at: number | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS =
	"id, platform, metric_slug, change_token, connected_at, last_imported_at, created_at, updated_at";

function toConnection(row: HealthConnectionRow): HealthConnection {
	return {
		id: row.id,
		platform: row.platform,
		metricSlug: row.metric_slug,
		changeToken: row.change_token,
		connectedAt: row.connected_at,
		lastImportedAt: row.last_imported_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertPlatform(platform: string): asserts platform is HealthPlatform {
	if (platform !== "healthkit" && platform !== "health_connect") {
		throw new TypeError(`Unsupported health platform: ${platform}`);
	}
}

function normalizedMetricSlug(metricSlug: string): string {
	const normalized = metricSlug.trim();
	if (!normalized) {
		throw new TypeError("Health connection metric slug must not be empty.");
	}
	return normalized;
}

export class HealthConnectionRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async connect(
		platform: HealthPlatform,
		metricSlug: string,
	): Promise<HealthConnection> {
		assertPlatform(platform);
		const slug = normalizedMetricSlug(metricSlug);

		return await this.transaction(async () => {
			const existing = await this.first<HealthConnectionRow>(
				`SELECT ${SELECT_COLUMNS} FROM health_connections
				 WHERE platform = ? AND metric_slug = ?
				 ORDER BY updated_at DESC, id DESC LIMIT 1`,
				[platform, slug],
			);
			if (existing) {
				return toConnection(existing);
			}

			const now = this.now();
			const connection: HealthConnection = {
				id: this.createId(now),
				platform,
				metricSlug: slug,
				changeToken: null,
				connectedAt: now,
				lastImportedAt: null,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO health_connections (
					id, platform, metric_slug, change_token, connected_at,
					last_imported_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					connection.id,
					connection.platform,
					connection.metricSlug,
					connection.changeToken,
					connection.connectedAt,
					connection.lastImportedAt,
					connection.createdAt,
					connection.updatedAt,
				],
			);
			return connection;
		});
	}

	async markImported(
		platform: HealthPlatform,
		metricSlug: string,
		changeToken: string | null,
		importedAt = this.now(),
	): Promise<HealthConnection> {
		assertPlatform(platform);
		const slug = normalizedMetricSlug(metricSlug);
		const result = await this.run(
			`UPDATE health_connections
			 SET change_token = ?, last_imported_at = ?, updated_at = ?
			 WHERE id = (
				SELECT id FROM health_connections
				WHERE platform = ? AND metric_slug = ?
				ORDER BY updated_at DESC, id DESC LIMIT 1
			 )`,
			[changeToken, importedAt, importedAt, platform, slug],
		);
		if (result.changes === 0) {
			throw new Error(`No ${platform} connection exists for ${slug}.`);
		}
		const connection = await this.find(platform, slug);
		if (!connection) {
			throw new Error("Health connection update did not persist.");
		}
		return connection;
	}

	async find(
		platform: HealthPlatform,
		metricSlug: string,
	): Promise<HealthConnection | null> {
		assertPlatform(platform);
		const row = await this.first<HealthConnectionRow>(
			`SELECT ${SELECT_COLUMNS} FROM health_connections
			 WHERE platform = ? AND metric_slug = ?
			 ORDER BY updated_at DESC, id DESC LIMIT 1`,
			[platform, normalizedMetricSlug(metricSlug)],
		);
		return row ? toConnection(row) : null;
	}

	async list(): Promise<HealthConnection[]> {
		const rows = await this.all<HealthConnectionRow>(
			`SELECT ${SELECT_COLUMNS} FROM health_connections
			 ORDER BY platform ASC, metric_slug ASC, updated_at DESC, id DESC`,
		);
		return rows.map(toConnection);
	}

	async disconnect(
		platform: HealthPlatform,
		metricSlug?: string,
	): Promise<number> {
		assertPlatform(platform);
		const result = metricSlug
			? await this.run(
					"DELETE FROM health_connections WHERE platform = ? AND metric_slug = ?",
					[platform, normalizedMetricSlug(metricSlug)],
				)
			: await this.run("DELETE FROM health_connections WHERE platform = ?", [
					platform,
				]);
		return result.changes;
	}
}
