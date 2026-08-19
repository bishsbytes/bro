import {
	getLocalDb,
	HealthConnectionRepository,
	type HealthPlatform,
} from "@bro/database-app";
import { resolveMetric } from "@bro/domain/metric-registry";
import { type HealthMetricSlug, V1_HEALTH_METRIC_SLUGS } from "@bro/logic";
import type { HealthGatewayAvailability } from "./gateway";
import type { HealthImportEngine } from "./import-engine";
import { healthImportEngine } from "./import-service";

export type HealthMetricConnectionStatus = {
	metricSlug: HealthMetricSlug;
	label: string;
	connected: boolean;
	lastImportedAt: number | null;
};

export type HealthSettingsSnapshot = {
	availability: HealthGatewayAvailability;
	platform: HealthPlatform | null;
	platformLabel: string;
	connected: boolean;
	metrics: HealthMetricConnectionStatus[];
};

type HealthSettingsEngine = Pick<
	HealthImportEngine,
	"availability" | "connect" | "refresh" | "disconnect" | "openSettings"
>;

function platformLabel(platform: HealthPlatform | null): string {
	if (platform === "healthkit") return "Apple Health";
	if (platform === "health_connect") return "Health Connect";
	return "Health data";
}

function metricLabel(metricSlug: HealthMetricSlug): string {
	const metric = resolveMetric(metricSlug);
	return metric.kind === "known" ? metric.metric.label : metricSlug;
}

export class HealthSettingsStore {
	constructor(
		private readonly engine: HealthSettingsEngine,
		private readonly connections: () => HealthConnectionRepository = () =>
			new HealthConnectionRepository(getLocalDb()),
	) {}

	async load(): Promise<HealthSettingsSnapshot> {
		const availability = await this.engine.availability();
		const platform = availability.platform;
		const connections = platform
			? (await this.connections().list()).filter(
					(connection) => connection.platform === platform,
				)
			: [];
		const connectionByMetric = new Map(
			connections.map((connection) => [connection.metricSlug, connection]),
		);
		return {
			availability,
			platform,
			platformLabel: platformLabel(platform),
			connected: connections.length > 0,
			metrics: V1_HEALTH_METRIC_SLUGS.map((metricSlug) => {
				const connection = connectionByMetric.get(metricSlug);
				return {
					metricSlug,
					label: metricLabel(metricSlug),
					connected: connection !== undefined,
					lastImportedAt: connection?.lastImportedAt ?? null,
				};
			}),
		};
	}

	async connect(): Promise<HealthSettingsSnapshot> {
		await this.engine.connect();
		return await this.load();
	}

	async refresh(): Promise<HealthSettingsSnapshot> {
		await this.engine.refresh();
		return await this.load();
	}

	async disconnect(): Promise<HealthSettingsSnapshot> {
		await this.engine.disconnect();
		return await this.load();
	}

	/**
	 * Returns `undefined` rather than `void` so screens can treat every store
	 * action as "a fresh snapshot, or nothing" in one union; `void` in that
	 * union is what biome's noConfusingVoidType refuses.
	 */
	async openSettings(): Promise<undefined> {
		await this.engine.openSettings();
	}
}

export function createHealthSettingsStore(): HealthSettingsStore {
	return new HealthSettingsStore(healthImportEngine);
}
