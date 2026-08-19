import {
	AssessmentRepository,
	ChallengeEnrolmentRepository,
	ChallengeProgressRepository,
	ConsumptionEntryRepository,
	CustomConsumableRepository,
	DailyMetricRepository,
	DayNoteRepository,
	GoalRepository,
	getDb,
	HabitCompletionRepository,
	HabitRepository,
	ObservationRepository,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
} from "@bro/database-app";
import { METRIC_REGISTRY } from "@bro/domain/metric-registry";
import { serializeCheckInExport } from "@bro/logic";
import Constants from "expo-constants";
import type { SQLiteDatabase } from "expo-sqlite";

export class ExportStore {
	constructor(
		private readonly db: SQLiteDatabase,
		private readonly appVersion: string,
		private readonly now: () => number = Date.now,
	) {}

	async serialize(includeSensitive: boolean): Promise<string> {
		const customConsumableRepository = new CustomConsumableRepository(this.db);
		const [
			observations,
			dayNotes,
			trackedMetrics,
			assessments,
			goals,
			unitPreferences,
			dailyMetrics,
			habits,
			habitCompletions,
			challengeEnrolments,
			challengeProgress,
			consumptionEntries,
			customConsumables,
		] = await Promise.all([
			new ObservationRepository(this.db).listAll(),
			new DayNoteRepository(this.db).listAll(),
			new TrackedMetricsRepository(this.db).listAll(),
			new AssessmentRepository(this.db).listAll(),
			new GoalRepository(this.db).listAll(),
			new UnitPreferenceRepository(this.db).list(),
			new DailyMetricRepository(this.db).listAll(),
			new HabitRepository(this.db).listAll(),
			new HabitCompletionRepository(this.db).listAll(),
			new ChallengeEnrolmentRepository(this.db).listAll(),
			new ChallengeProgressRepository(this.db).listAll(),
			new ConsumptionEntryRepository(this.db).listAll(),
			customConsumableRepository.listAll(),
		]);
		const customConsumableComponents = (
			await Promise.all(
				customConsumables.map(({ id }) =>
					customConsumableRepository.listComponents(id),
				),
			)
		).flat();

		return serializeCheckInExport(
			{
				observations,
				dayNotes,
				trackedMetrics,
				assessments,
				goals,
				unitPreferences,
				dailyMetrics,
				habits,
				habitCompletions,
				challengeEnrolments,
				challengeProgress,
				consumptionEntries,
				customConsumables,
				customConsumableComponents,
				registry: METRIC_REGISTRY,
			},
			{
				appVersion: this.appVersion,
				exportedAt: this.now(),
				excludeSensitiveMetrics: !includeSensitive,
			},
		);
	}
}

export function createExportStore(): ExportStore {
	return new ExportStore(getDb(), Constants.expoConfig?.version ?? "unknown");
}
