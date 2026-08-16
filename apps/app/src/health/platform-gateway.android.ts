import type { HealthPlatform } from "@bro/database-app";
import {
	getChanges,
	getGrantedPermissions,
	getSdkStatus,
	initialize,
	openHealthConnectSettings,
	readRecords,
	requestPermission,
	SdkAvailabilityStatus,
	SleepStageType,
	type HealthConnectRecordResult,
	type Permission,
	type RecordType,
} from "react-native-health-connect";
import {
	HealthChangeTokenExpiredError,
	type HealthBackfillRange,
	type HealthGateway,
	type HealthGatewayBatch,
} from "./gateway";
import type { PlatformHealthSample } from "./mapping";
import { type HealthMetricSlug, V1_HEALTH_METRIC_SLUGS } from "./policy";

const PLATFORM = "health_connect" satisfies HealthPlatform;

const RECORD_TYPE_BY_METRIC: Record<HealthMetricSlug, RecordType> = {
	sleep_duration: "SleepSession",
	steps: "Steps",
	resting_heart_rate: "RestingHeartRate",
	weight: "Weight",
	body_fat: "BodyFat",
};

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) {
		throw new TypeError(`Invalid Health Connect timestamp: ${value}`);
	}
	return parsed;
}

function recordIdentity(record: HealthConnectRecordResult): string {
	const id = record.metadata?.id?.trim();
	if (!id)
		throw new TypeError("Health Connect returned a record without an id.");
	return id;
}

function intervalSeconds(start: string, end: string): number {
	return Math.max(0, (timestamp(end) - timestamp(start)) / 1_000);
}

function mapRecord(record: HealthConnectRecordResult): PlatformHealthSample {
	const sourceRecordId = recordIdentity(record);
	if (record.recordType === "SleepSession") {
		const sleepingStages = record.stages?.filter((stage) =>
			[
				SleepStageType.SLEEPING,
				SleepStageType.LIGHT,
				SleepStageType.DEEP,
				SleepStageType.REM,
			].includes(stage.stage as 2 | 4 | 5 | 6),
		);
		const value = sleepingStages?.length
			? sleepingStages.reduce(
					(total, stage) =>
						total + intervalSeconds(stage.startTime, stage.endTime),
					0,
				)
			: intervalSeconds(record.startTime, record.endTime);
		return {
			metricSlug: "sleep_duration",
			value,
			unit: "second",
			startedAt: timestamp(record.startTime),
			endedAt: timestamp(record.endTime),
			source: PLATFORM,
			sourceRecordId,
		};
	}
	if (record.recordType === "Steps") {
		return {
			metricSlug: "steps",
			value: record.count,
			unit: "count",
			startedAt: timestamp(record.startTime),
			endedAt: timestamp(record.endTime),
			source: PLATFORM,
			sourceRecordId,
		};
	}
	if (record.recordType === "RestingHeartRate") {
		const at = timestamp(record.time);
		return {
			metricSlug: "resting_heart_rate",
			value: record.beatsPerMinute,
			unit: "bpm",
			startedAt: at,
			endedAt: at,
			source: PLATFORM,
			sourceRecordId,
		};
	}
	if (record.recordType === "Weight") {
		const at = timestamp(record.time);
		return {
			metricSlug: "weight",
			value: record.weight.inKilograms,
			unit: "kg",
			startedAt: at,
			endedAt: at,
			source: PLATFORM,
			sourceRecordId,
		};
	}
	if (record.recordType === "BodyFat") {
		const at = timestamp(record.time);
		return {
			metricSlug: "body_fat",
			value: record.percentage,
			unit: "percent",
			startedAt: at,
			endedAt: at,
			source: PLATFORM,
			sourceRecordId,
		};
	}
	throw new TypeError(
		`Unsupported Health Connect record: ${record.recordType}`,
	);
}

function requestedPermissions(
	metricSlugs: readonly HealthMetricSlug[],
): Permission[] {
	return metricSlugs.map((metricSlug) => ({
		accessType: "read",
		recordType: RECORD_TYPE_BY_METRIC[metricSlug],
	}));
}

function grantedMetricSlugs(
	permissions: readonly { accessType: string; recordType: string }[],
): HealthMetricSlug[] {
	return V1_HEALTH_METRIC_SLUGS.filter((metricSlug) =>
		permissions.some(
			(permission) =>
				permission.accessType === "read" &&
				permission.recordType === RECORD_TYPE_BY_METRIC[metricSlug],
		),
	);
}

async function readSnapshot(
	metricSlug: HealthMetricSlug,
	range: HealthBackfillRange,
): Promise<PlatformHealthSample[]> {
	const recordType = RECORD_TYPE_BY_METRIC[metricSlug];
	const records: HealthConnectRecordResult[] = [];
	let pageToken: string | undefined;
	do {
		const page = await readRecords(recordType, {
			timeRangeFilter: {
				operator: "between",
				startTime: new Date(range.from).toISOString(),
				endTime: new Date(range.through).toISOString(),
			},
			pageSize: 1_000,
			pageToken,
			ascendingOrder: true,
		});
		records.push(
			...page.records.map(
				(record) => ({ ...record, recordType }) as HealthConnectRecordResult,
			),
		);
		pageToken = page.pageToken;
	} while (pageToken);
	return records.map(mapRecord);
}

export class HealthConnectGateway implements HealthGateway {
	readonly platform = PLATFORM;

	private async ready(): Promise<boolean> {
		if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) {
			return false;
		}
		return await initialize();
	}

	async availability() {
		return (await this.ready())
			? ({ available: true, platform: PLATFORM } as const)
			: ({
					available: false,
					platform: PLATFORM,
					reason: "Health Connect is unavailable or needs an update.",
				} as const);
	}

	async authorize(
		metricSlugs: readonly HealthMetricSlug[],
	): Promise<HealthMetricSlug[]> {
		if (!(await this.ready())) return [];
		const granted = await requestPermission([
			...requestedPermissions(metricSlugs),
			{ accessType: "read", recordType: "ReadHealthDataHistory" },
		]);
		return grantedMetricSlugs(granted);
	}

	async grantedMetrics(): Promise<HealthMetricSlug[]> {
		if (!(await this.ready())) return [];
		return grantedMetricSlugs(await getGrantedPermissions());
	}

	async fetchChanges(
		metricSlug: HealthMetricSlug,
		changeToken: string | null,
		backfill: HealthBackfillRange,
	): Promise<HealthGatewayBatch> {
		if (!changeToken) {
			const tokenResult = await getChanges({
				recordTypes: [RECORD_TYPE_BY_METRIC[metricSlug]],
			});
			if (tokenResult.changesTokenExpired) {
				throw new HealthChangeTokenExpiredError(metricSlug);
			}
			return {
				mode: "snapshot",
				additions: await readSnapshot(metricSlug, backfill),
				deletions: [],
				nextToken: tokenResult.nextChangesToken,
			};
		}

		const additions: PlatformHealthSample[] = [];
		const deletions: HealthGatewayBatch["deletions"] = [];
		let token = changeToken;
		let hasMore: boolean;
		do {
			const result = await getChanges({ changesToken: token });
			if (result.changesTokenExpired) {
				throw new HealthChangeTokenExpiredError(metricSlug);
			}
			additions.push(
				...result.upsertionChanges
					.map(({ record }) => record)
					.filter(
						(record) => record.recordType === RECORD_TYPE_BY_METRIC[metricSlug],
					)
					.map(mapRecord),
			);
			deletions.push(
				...result.deletionChanges.map(({ recordId }) => ({
					source: PLATFORM as HealthPlatform,
					sourceRecordId: recordId,
				})),
			);
			token = result.nextChangesToken;
			hasMore = result.hasMore;
		} while (hasMore);
		return { mode: "changes", additions, deletions, nextToken: token };
	}

	async openSettings(): Promise<void> {
		openHealthConnectSettings();
	}
}

export function createPlatformHealthGateway(): HealthGateway {
	return new HealthConnectGateway();
}
