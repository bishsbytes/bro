import type { HealthPlatform } from "@bro/database-app";
import type {
	CategorySample,
	DeletedSample,
	ObjectTypeIdentifier,
	QuantitySample,
} from "@kingstinct/react-native-healthkit";
import { Linking } from "react-native";
import type {
	HealthBackfillRange,
	HealthGateway,
	HealthGatewayBatch,
} from "./gateway";
import type { PlatformHealthSample } from "./mapping";
import { type HealthMetricSlug, V1_HEALTH_METRIC_SLUGS } from "./policy";

const PLATFORM = "healthkit" satisfies HealthPlatform;
const SLEEP_IDENTIFIER = "HKCategoryTypeIdentifierSleepAnalysis" as const;
const QUANTITY_IDENTIFIER_BY_METRIC = {
	steps: "HKQuantityTypeIdentifierStepCount",
	resting_heart_rate: "HKQuantityTypeIdentifierRestingHeartRate",
	weight: "HKQuantityTypeIdentifierBodyMass",
	body_fat: "HKQuantityTypeIdentifierBodyFatPercentage",
} as const;

function identifierFor(metricSlug: HealthMetricSlug): ObjectTypeIdentifier {
	return metricSlug === "sleep_duration"
		? SLEEP_IDENTIFIER
		: QUANTITY_IDENTIFIER_BY_METRIC[metricSlug];
}

function rangeFilter(range: HealthBackfillRange) {
	return {
		date: {
			startDate: new Date(range.from),
			endDate: new Date(range.through),
			strictStartDate: false,
			strictEndDate: false,
		},
	};
}

function sampleTimes(sample: { startDate: Date; endDate: Date }) {
	return {
		startedAt: sample.startDate.getTime(),
		endedAt: sample.endDate.getTime(),
	};
}

function mapQuantitySample(
	metricSlug: Exclude<HealthMetricSlug, "sleep_duration">,
	sample: QuantitySample,
): PlatformHealthSample {
	const unit =
		metricSlug === "steps"
			? "count"
			: metricSlug === "resting_heart_rate"
				? "bpm"
				: metricSlug === "weight"
					? "kg"
					: "percent";
	return {
		metricSlug,
		value: sample.quantity,
		unit,
		...sampleTimes(sample),
		source: PLATFORM,
		sourceRecordId: sample.uuid,
		origin: sample.sourceRevision?.source.bundleIdentifier ?? null,
	};
}

function isAsleep(sample: CategorySample): boolean {
	return [
		1, // asleep / asleepUnspecified
		3, // asleepCore
		4, // asleepDeep
		5, // asleepREM
	].includes(sample.value as 1 | 3 | 4 | 5);
}

function mapSleepSample(sample: CategorySample): PlatformHealthSample {
	const times = sampleTimes(sample);
	return {
		metricSlug: "sleep_duration",
		value: Math.max(0, (times.endedAt - times.startedAt) / 1_000),
		unit: "second",
		...times,
		source: PLATFORM,
		sourceRecordId: sample.uuid,
		origin: sample.sourceRevision?.source.bundleIdentifier ?? null,
	};
}

function mapDeletions(
	deleted: readonly DeletedSample[],
): HealthGatewayBatch["deletions"] {
	return deleted.map(({ uuid }) => ({
		source: PLATFORM,
		sourceRecordId: uuid,
	}));
}

export class HealthKitGateway implements HealthGateway {
	readonly platform = PLATFORM;

	async availability() {
		const { isHealthDataAvailableAsync } = await import(
			"@kingstinct/react-native-healthkit"
		);
		return (await isHealthDataAvailableAsync())
			? ({ available: true, platform: PLATFORM } as const)
			: ({
					available: false,
					platform: PLATFORM,
					reason: "Apple Health data is unavailable on this device.",
				} as const);
	}

	private async availableMetrics(
		metricSlugs: readonly HealthMetricSlug[],
	): Promise<HealthMetricSlug[]> {
		const { areObjectTypesAvailableAsync } = await import(
			"@kingstinct/react-native-healthkit"
		);
		const identifiers = metricSlugs.map(identifierFor);
		const available = await areObjectTypesAvailableAsync(identifiers);
		return metricSlugs.filter(
			(metricSlug) => available[identifierFor(metricSlug)] === true,
		);
	}

	async authorize(
		metricSlugs: readonly HealthMetricSlug[],
	): Promise<HealthMetricSlug[]> {
		const { isHealthDataAvailableAsync, requestAuthorization } = await import(
			"@kingstinct/react-native-healthkit"
		);
		if (!(await isHealthDataAvailableAsync())) return [];
		const available = await this.availableMetrics(metricSlugs);
		const requested = await requestAuthorization({
			toRead: available.map(identifierFor),
		});
		// HealthKit intentionally does not reveal read denials. A successful request
		// means these types may be queried; denied types simply return no samples.
		return requested ? available : [];
	}

	async grantedMetrics(): Promise<HealthMetricSlug[]> {
		const { isHealthDataAvailableAsync } = await import(
			"@kingstinct/react-native-healthkit"
		);
		if (!(await isHealthDataAvailableAsync())) return [];
		return await this.availableMetrics(V1_HEALTH_METRIC_SLUGS);
	}

	async fetchChanges(
		metricSlug: HealthMetricSlug,
		changeToken: string | null,
		backfill: HealthBackfillRange,
	): Promise<HealthGatewayBatch> {
		const { queryCategorySamplesWithAnchor, queryQuantitySamplesWithAnchor } =
			await import("@kingstinct/react-native-healthkit");
		const options = {
			limit: 0,
			...(changeToken
				? { anchor: changeToken }
				: { filter: rangeFilter(backfill) }),
		};
		if (metricSlug === "sleep_duration") {
			const result = await queryCategorySamplesWithAnchor(
				SLEEP_IDENTIFIER,
				options,
			);
			return {
				mode: changeToken ? "changes" : "snapshot",
				additions: result.samples.filter(isAsleep).map(mapSleepSample),
				deletions: mapDeletions(result.deletedSamples),
				nextToken: result.newAnchor,
			};
		}

		const result = await queryQuantitySamplesWithAnchor(
			QUANTITY_IDENTIFIER_BY_METRIC[metricSlug],
			options,
		);
		return {
			mode: changeToken ? "changes" : "snapshot",
			additions: result.samples.map((sample) =>
				mapQuantitySample(metricSlug, sample),
			),
			deletions: mapDeletions(result.deletedSamples),
			nextToken: result.newAnchor,
		};
	}

	async openSettings(): Promise<void> {
		await Linking.openSettings();
	}
}

export function createPlatformHealthGateway(): HealthGateway {
	return new HealthKitGateway();
}
