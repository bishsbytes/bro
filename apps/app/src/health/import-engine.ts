import {
	DailyMetricRepository,
	getDb,
	getLocalDb,
	HealthConnectionRepository,
	type HealthPlatform,
	type RawSample,
	RawSampleRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	HealthChangeTokenExpiredError,
	type HealthGateway,
	type HealthGatewayBatch,
} from "./gateway";
import {
	type CanonicalHealthSample,
	localDayAt,
	mapPlatformSample,
} from "./mapping";
import {
	HEALTH_BACKFILL_DAYS,
	type HealthMetricSlug,
	isHealthMetricSlug,
	RAW_SAMPLE_RETENTION_DAYS,
	V1_HEALTH_METRIC_SLUGS,
} from "./policy";
import { applyHealthSampleChanges } from "./rollup";

export type HealthImportSummary = {
	platform: HealthPlatform | null;
	importedMetrics: HealthMetricSlug[];
	importedSamples: number;
};

type EngineDependencies = {
	gateway: HealthGateway;
	getProductDb?: () => SQLiteDatabase;
	getImportDb?: () => SQLiteDatabase;
	now?: () => number;
	timeZone?: () => string;
};

const DAY_MS = 86_400_000;

/**
 * Fixed 24-hour days keep the window independent of the runtime's own zone;
 * day attribution is the only place the device's named zone matters.
 */
function daysBefore(timestamp: number, days: number): number {
	return timestamp - days * DAY_MS;
}

function rawToCanonical(sample: RawSample): CanonicalHealthSample {
	if (!isHealthMetricSlug(sample.metricSlug)) {
		throw new TypeError(
			`Unsupported stored health metric: ${sample.metricSlug}`,
		);
	}
	if (sample.source !== "healthkit" && sample.source !== "health_connect") {
		throw new TypeError(`Unsupported stored health source: ${sample.source}`);
	}
	return {
		metricSlug: sample.metricSlug,
		value: sample.value,
		startedAt: sample.startedAt,
		endedAt: sample.endedAt,
		localDay: sample.localDay,
		source: sample.source,
		sourceRecordId: sample.sourceRecordId,
		origin: sample.origin,
	};
}

function identity(source: HealthPlatform, sourceRecordId: string): string {
	return JSON.stringify([source, sourceRecordId]);
}

export class HealthImportEngine {
	private readonly getProductDb: () => SQLiteDatabase;
	private readonly getImportDb: () => SQLiteDatabase;
	private readonly now: () => number;
	private readonly timeZone: () => string;
	private running: Promise<HealthImportSummary> | null = null;

	constructor(private readonly dependencies: EngineDependencies) {
		this.getProductDb = dependencies.getProductDb ?? getDb;
		this.getImportDb = dependencies.getImportDb ?? getLocalDb;
		this.now = dependencies.now ?? Date.now;
		this.timeZone =
			dependencies.timeZone ??
			(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
	}

	availability() {
		return this.dependencies.gateway.availability();
	}

	async connect(
		metricSlugs: readonly HealthMetricSlug[] = V1_HEALTH_METRIC_SLUGS,
	): Promise<HealthImportSummary> {
		return await this.singleFlight(async () => {
			const availability = await this.dependencies.gateway.availability();
			if (!availability.available || !this.dependencies.gateway.platform) {
				return {
					platform: availability.platform,
					importedMetrics: [],
					importedSamples: 0,
				};
			}
			const granted = await this.dependencies.gateway.authorize(metricSlugs);
			const connections = new HealthConnectionRepository(this.getImportDb());
			for (const metricSlug of granted) {
				await connections.connect(
					this.dependencies.gateway.platform,
					metricSlug,
				);
			}
			return await this.importMetrics(granted);
		}, "queue");
	}

	async refresh(): Promise<HealthImportSummary> {
		return await this.singleFlight(async () => {
			const platform = this.dependencies.gateway.platform;
			if (!platform) {
				return { platform: null, importedMetrics: [], importedSamples: 0 };
			}
			const availability = await this.dependencies.gateway.availability();
			if (!availability.available) {
				return { platform, importedMetrics: [], importedSamples: 0 };
			}
			const connectionRepository = new HealthConnectionRepository(
				this.getImportDb(),
			);
			const connected = (await connectionRepository.list())
				.filter((connection) => connection.platform === platform)
				.map((connection) => connection.metricSlug)
				.filter(isHealthMetricSlug);
			if (connected.length === 0) {
				return { platform, importedMetrics: [], importedSamples: 0 };
			}
			const granted = new Set(await this.dependencies.gateway.grantedMetrics());
			return await this.importMetrics(
				connected.filter((metricSlug) => granted.has(metricSlug)),
			);
		}, "coalesce");
	}

	async disconnect(): Promise<number> {
		const platform = this.dependencies.gateway.platform;
		if (!platform) return 0;
		return await new HealthConnectionRepository(this.getImportDb()).disconnect(
			platform,
		);
	}

	async openSettings(): Promise<void> {
		await this.dependencies.gateway.openSettings();
	}

	/**
	 * Refreshes coalesce into whatever run is already in flight — any full run
	 * covers a refresh. A connect must never be swallowed that way (the user
	 * tapped it expecting the grant sheet), so it queues behind the current run
	 * and then performs its own work.
	 */
	private async singleFlight(
		work: () => Promise<HealthImportSummary>,
		mode: "coalesce" | "queue",
	): Promise<HealthImportSummary> {
		if (this.running && mode === "coalesce") return await this.running;
		const run = this.running ? this.running.then(work, work) : work();
		this.running = run;
		try {
			return await run;
		} finally {
			if (this.running === run) this.running = null;
		}
	}

	private async importMetrics(
		metricSlugs: readonly HealthMetricSlug[],
	): Promise<HealthImportSummary> {
		const importedMetrics: HealthMetricSlug[] = [];
		let importedSamples = 0;
		for (const metricSlug of metricSlugs) {
			importedSamples += await this.importMetric(metricSlug);
			importedMetrics.push(metricSlug);
		}
		return {
			platform: this.dependencies.gateway.platform,
			importedMetrics,
			importedSamples,
		};
	}

	/**
	 * A change batch can only be re-rolled-up from retained raw samples. An
	 * addition on a day the retention window has already pruned would recompute
	 * that day from partial data and silently corrupt its durable rollup, and a
	 * deletion whose identity is no longer retained cannot be applied at all.
	 * Both cases need a fresh snapshot instead.
	 */
	private async changesTouchPrunedData(
		rawRepository: RawSampleRepository,
		metricSlug: HealthMetricSlug,
		batch: HealthGatewayBatch,
		additions: readonly CanonicalHealthSample[],
		importedAt: number,
		timeZone: string,
	): Promise<boolean> {
		const platform = this.dependencies.gateway.platform;
		if (!platform) return false;
		const prunedDayCutoff = localDayAt(
			daysBefore(importedAt, RAW_SAMPLE_RETENTION_DAYS),
			timeZone,
		);
		if (additions.some((sample) => sample.localDay <= prunedDayCutoff)) {
			return true;
		}
		if (batch.deletions.length === 0) return false;

		const retained = await rawRepository.listByMetricSource(
			metricSlug,
			platform,
		);
		const known = new Set(
			retained.map((sample) => identity(platform, sample.sourceRecordId)),
		);
		for (const addition of batch.additions) {
			known.add(identity(platform, addition.sourceRecordId));
		}
		return batch.deletions.some(
			(deletion) =>
				!known.has(identity(deletion.source, deletion.sourceRecordId)),
		);
	}

	private async importMetric(metricSlug: HealthMetricSlug): Promise<number> {
		const platform = this.dependencies.gateway.platform;
		if (!platform) return 0;
		const importDb = this.getImportDb();
		const connectionRepository = new HealthConnectionRepository(importDb);
		const connection = await connectionRepository.find(platform, metricSlug);
		if (!connection) return 0;

		const importedAt = this.now();
		const timeZone = this.timeZone();
		const backfill = {
			// A replacement snapshot must cover everything this connection could
			// previously have imported, not just today's trailing year. This preserves
			// durable history while still allowing expired tokens and pruned deletion
			// identities to reconcile exactly.
			from: Math.min(
				daysBefore(importedAt, HEALTH_BACKFILL_DAYS),
				daysBefore(connection.connectedAt, HEALTH_BACKFILL_DAYS),
			),
			through: importedAt,
		};
		let batch: HealthGatewayBatch;
		try {
			batch = await this.dependencies.gateway.fetchChanges(
				metricSlug,
				connection.changeToken,
				backfill,
			);
		} catch (error) {
			if (!(error instanceof HealthChangeTokenExpiredError)) throw error;
			batch = await this.dependencies.gateway.fetchChanges(
				metricSlug,
				null,
				backfill,
			);
		}

		const rawRepository = new RawSampleRepository(importDb);
		const mapAdditions = (fetched: HealthGatewayBatch) =>
			fetched.additions.map((sample) => {
				if (sample.metricSlug !== metricSlug || sample.source !== platform) {
					throw new TypeError("A health gateway returned a mismatched sample.");
				}
				return mapPlatformSample(sample, timeZone);
			});
		let additions = mapAdditions(batch);
		if (
			batch.mode === "changes" &&
			(await this.changesTouchPrunedData(
				rawRepository,
				metricSlug,
				batch,
				additions,
				importedAt,
				timeZone,
			))
		) {
			batch = await this.dependencies.gateway.fetchChanges(
				metricSlug,
				null,
				backfill,
			);
			additions = mapAdditions(batch);
		}
		const productDb = this.getProductDb();
		const dailyRepository = new DailyMetricRepository(productDb, {
			now: () => importedAt,
		});

		await importDb.withTransactionAsync(async () => {
			const existingRows =
				batch.mode === "snapshot"
					? []
					: await rawRepository.listByMetricSource(metricSlug, platform);
			const applied = applyHealthSampleChanges(
				existingRows.map(rawToCanonical),
				{ additions, deletions: batch.deletions },
			);

			if (batch.mode === "snapshot") {
				await rawRepository.deleteByMetricSourceInCurrentTransaction(
					metricSlug,
					platform,
				);
			} else {
				for (const deletion of batch.deletions) {
					await rawRepository.deleteBySourceRecordInCurrentTransaction(
						deletion.source,
						deletion.sourceRecordId,
					);
				}
			}
			for (const sample of additions) {
				await rawRepository.upsert({ ...sample, importedAt });
			}

			await productDb.withTransactionAsync(async () => {
				if (batch.mode === "snapshot") {
					await dailyRepository.deleteByMetricSourceFromDay(
						metricSlug,
						platform,
						localDayAt(backfill.from, timeZone),
					);
				}
				for (const rollup of applied.rollups) {
					if (rollup.value === null) {
						await dailyRepository.deleteNaturalKey(
							rollup.metricSlug,
							rollup.localDay,
							rollup.source,
						);
					} else {
						await dailyRepository.upsert({ ...rollup, value: rollup.value });
					}
				}
			});

			await rawRepository.pruneEndedBefore(
				daysBefore(importedAt, RAW_SAMPLE_RETENTION_DAYS),
			);
			// Advance only after the durable rollup transaction commits. A failure
			// above rolls back both the raw writes and token so replay stays safe.
			await connectionRepository.markImported(
				platform,
				metricSlug,
				batch.nextToken,
				importedAt,
			);
		});
		return additions.length;
	}
}
