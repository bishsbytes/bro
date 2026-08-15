import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type TrackedMetric = {
	id: string;
	metricSlug: string;
	position: number;
	addedAt: number | null;
	removedAt: number | null;
	customLabel: string | null;
	createdAt: number;
	updatedAt: number;
};

export type TrackedMetricDefault = {
	metricSlug: string;
	position: number;
	enabled?: boolean;
};

export type ResolvedTrackedMetric = TrackedMetricDefault & {
	enabled: boolean;
	overlayId: string | null;
	addedAt: number | null;
	removedAt: number | null;
	customLabel: string | null;
};

type TrackedMetricRow = {
	id: string;
	metric_slug: string;
	position: number;
	added_at: number | null;
	removed_at: number | null;
	custom_label: string | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

function toTrackedMetric(row: TrackedMetricRow): TrackedMetric {
	return {
		id: row.id,
		metricSlug: row.metric_slug,
		position: row.position,
		addedAt: row.added_at,
		removedAt: row.removed_at,
		customLabel: row.custom_label,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class TrackedMetricsRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async listAll(): Promise<TrackedMetric[]> {
		const rows = await this.all<TrackedMetricRow>(
			`SELECT id, metric_slug, position, added_at, removed_at, custom_label,
				created_at, updated_at
			 FROM tracked_metrics
			 ORDER BY updated_at DESC, id DESC`,
		);
		return rows.map(toTrackedMetric);
	}

	async listResolved(
		defaults: readonly TrackedMetricDefault[],
	): Promise<ResolvedTrackedMetric[]> {
		const latestBySlug = new Map<string, TrackedMetric>();
		for (const row of await this.listAll()) {
			if (!latestBySlug.has(row.metricSlug)) {
				latestBySlug.set(row.metricSlug, row);
			}
		}

		return defaults
			.map((fallback) => {
				const overlay = latestBySlug.get(fallback.metricSlug);
				return {
					metricSlug: fallback.metricSlug,
					position: overlay?.position ?? fallback.position,
					enabled: overlay
						? overlay.removedAt === null
						: (fallback.enabled ?? true),
					overlayId: overlay?.id ?? null,
					addedAt: overlay?.addedAt ?? null,
					removedAt: overlay?.removedAt ?? null,
					customLabel: overlay?.customLabel ?? null,
				};
			})
			.sort(
				(left, right) =>
					left.position - right.position ||
					left.metricSlug.localeCompare(right.metricSlug),
			);
	}

	async configure(
		metricSlug: string,
		position: number,
		enabled: boolean,
	): Promise<TrackedMetric> {
		if (!Number.isInteger(position) || position < 0) {
			throw new RangeError(
				"Tracked metric position must be a non-negative integer.",
			);
		}

		return await this.transaction(async () => {
			const existing = await this.first<TrackedMetricRow>(
				`SELECT id, metric_slug, position, added_at, removed_at, custom_label,
					created_at, updated_at
				 FROM tracked_metrics WHERE metric_slug = ?
				 ORDER BY updated_at DESC, id DESC LIMIT 1`,
				[metricSlug],
			);
			const now = this.now();

			if (existing) {
				// added_at/removed_at record when the metric last changed state, so
				// they only move on a disabled<->enabled transition — reordering an
				// enabled metric must not rewrite when it was enabled.
				const wasEnabled = existing.removed_at === null;
				const addedAt = enabled && !wasEnabled ? now : existing.added_at;
				const removedAt = enabled
					? null
					: wasEnabled
						? now
						: existing.removed_at;
				await this.run(
					`UPDATE tracked_metrics
					 SET position = ?, added_at = ?, removed_at = ?, updated_at = ?
					 WHERE id = ?`,
					[position, addedAt, removedAt, now, existing.id],
				);
				return toTrackedMetric({
					...existing,
					position,
					added_at: addedAt,
					removed_at: removedAt,
					updated_at: now,
				});
			}

			const tracked: TrackedMetric = {
				id: this.createId(now),
				metricSlug,
				position,
				addedAt: enabled ? now : null,
				removedAt: enabled ? null : now,
				customLabel: null,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO tracked_metrics (
					id, metric_slug, position, added_at, removed_at, custom_label, created_at,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					tracked.id,
					tracked.metricSlug,
					tracked.position,
					tracked.addedAt,
					tracked.removedAt,
					tracked.customLabel,
					tracked.createdAt,
					tracked.updatedAt,
				],
			);
			return tracked;
		});
	}

	async relabel(
		metricSlug: string,
		customLabel: string | null,
		position: number,
		enabled = true,
	): Promise<TrackedMetric> {
		if (!Number.isInteger(position) || position < 0) {
			throw new RangeError(
				"Tracked metric position must be a non-negative integer.",
			);
		}
		const normalizedLabel = customLabel?.trim() || null;

		return await this.transaction(async () => {
			const existing = await this.first<TrackedMetricRow>(
				`SELECT id, metric_slug, position, added_at, removed_at, custom_label,
					created_at, updated_at
				 FROM tracked_metrics WHERE metric_slug = ?
				 ORDER BY updated_at DESC, id DESC LIMIT 1`,
				[metricSlug],
			);
			const now = this.now();

			if (existing) {
				await this.run(
					`UPDATE tracked_metrics
					 SET custom_label = ?, updated_at = ?
					 WHERE id = ?`,
					[normalizedLabel, now, existing.id],
				);
				return toTrackedMetric({
					...existing,
					custom_label: normalizedLabel,
					updated_at: now,
				});
			}

			const tracked: TrackedMetric = {
				id: this.createId(now),
				metricSlug,
				position,
				addedAt: enabled ? now : null,
				removedAt: enabled ? null : now,
				customLabel: normalizedLabel,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO tracked_metrics (
					id, metric_slug, position, added_at, removed_at, custom_label, created_at,
					updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					tracked.id,
					tracked.metricSlug,
					tracked.position,
					tracked.addedAt,
					tracked.removedAt,
					tracked.customLabel,
					tracked.createdAt,
					tracked.updatedAt,
				],
			);
			return tracked;
		});
	}
}
