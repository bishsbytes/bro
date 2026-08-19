import type { HealthPlatform } from "@bro/database-app";
import type { HealthMetricSlug, PlatformHealthSample } from "@bro/logic";

export type HealthGatewayAvailability =
	| { available: true; platform: HealthPlatform }
	| { available: false; platform: HealthPlatform | null; reason: string };

export type HealthBackfillRange = {
	from: number;
	through: number;
};

export type HealthGatewayBatch = {
	mode: "snapshot" | "changes";
	additions: PlatformHealthSample[];
	deletions: Array<{
		source: HealthPlatform;
		sourceRecordId: string;
	}>;
	nextToken: string;
};

export class HealthChangeTokenExpiredError extends Error {
	constructor(readonly metricSlug: HealthMetricSlug) {
		super(`The health change token expired for ${metricSlug}.`);
		this.name = "HealthChangeTokenExpiredError";
	}
}

export interface HealthGateway {
	readonly platform: HealthPlatform | null;
	availability(): Promise<HealthGatewayAvailability>;
	authorize(
		metricSlugs: readonly HealthMetricSlug[],
	): Promise<HealthMetricSlug[]>;
	grantedMetrics(): Promise<HealthMetricSlug[]>;
	fetchChanges(
		metricSlug: HealthMetricSlug,
		changeToken: string | null,
		backfill: HealthBackfillRange,
	): Promise<HealthGatewayBatch>;
	openSettings(): Promise<void>;
}

export class UnsupportedHealthGateway implements HealthGateway {
	readonly platform = null;

	constructor(private readonly reason = "Health import is unavailable here.") {}

	async availability(): Promise<HealthGatewayAvailability> {
		return { available: false, platform: null, reason: this.reason };
	}

	async authorize(): Promise<HealthMetricSlug[]> {
		return [];
	}

	async grantedMetrics(): Promise<HealthMetricSlug[]> {
		return [];
	}

	async fetchChanges(): Promise<HealthGatewayBatch> {
		throw new Error(this.reason);
	}

	async openSettings(): Promise<void> {}
}
