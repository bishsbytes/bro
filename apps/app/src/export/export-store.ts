import {
	AssessmentRepository,
	ChallengeEnrolmentRepository,
	ChallengeProgressRepository,
	ConsumableRepository,
	DailyMetricRepository,
	DayNoteRepository,
	GoalRepository,
	getDb,
	HabitCompletionRepository,
	HabitRepository,
	IntakeEventRepository,
	IntakeStreamRepository,
	ObservationRepository,
	ReminderRepository,
	restoreProductData,
	TrackedMetricsRepository,
	UnitPreferenceRepository,
	withTransaction,
} from "@bro/database-app";
import { METRIC_REGISTRY } from "@bro/domain/metric-registry";
import { parseCheckInExport, serializeCheckInExport } from "@bro/logic";
import Constants from "expo-constants";
import type { SQLiteDatabase } from "expo-sqlite";

export class ExportStore {
	constructor(
		private readonly db: SQLiteDatabase,
		private readonly appVersion: string,
		private readonly now: () => number = Date.now,
	) {}

	async restore(payload: string): Promise<number> {
		const parsed = parseCheckInExport(payload);
		return restoreProductData(this.db, parsed, async (database) => {
			// Exercise every repository decoder before committing the restored rows.
			await new ExportStore(database, this.appVersion, this.now).serialize(
				true,
				true,
			);
		});
	}

	async serialize(
		includeSensitive: boolean,
		includeNotes = false,
	): Promise<string> {
		return withTransaction(this.db, async ({ database }) =>
			new ExportStore(database, this.appVersion, this.now).serializeWithin(
				includeSensitive,
				includeNotes,
			),
		);
	}

	private async serializeWithin(
		includeSensitive: boolean,
		includeNotes = false,
	): Promise<string> {
		const consumableRepository = new ConsumableRepository(this.db);
		const [
			observations,
			dayNotes,
			trackedMetrics,
			reminders,
			assessments,
			goals,
			unitPreferences,
			dailyMetrics,
			habits,
			habitCompletions,
			challengeEnrolments,
			challengeProgress,
			intakeEvents,
			consumables,
			intakeStreams,
		] = await Promise.all([
			new ObservationRepository(this.db).listAll(),
			new DayNoteRepository(this.db).listAll(),
			new TrackedMetricsRepository(this.db).listAll(),
			new ReminderRepository(this.db).listAll(),
			new AssessmentRepository(this.db).listAll(),
			new GoalRepository(this.db).listAll(),
			new UnitPreferenceRepository(this.db).list(),
			new DailyMetricRepository(this.db).listAll(),
			new HabitRepository(this.db).listAll(),
			new HabitCompletionRepository(this.db).listAll(),
			new ChallengeEnrolmentRepository(this.db).listAll(),
			new ChallengeProgressRepository(this.db).listAll(),
			new IntakeEventRepository(this.db).listAll(),
			consumableRepository.listAll({ includeArchived: true }),
			new IntakeStreamRepository(this.db).listAll(),
		]);
		const recipeIngredients = (
			await Promise.all(
				consumables
					.filter((consumable) => consumable.recipe !== null)
					.map(({ id }) => consumableRepository.listIngredients(id)),
			)
		).flat();

		return serializeCheckInExport(
			{
				observations,
				dayNotes,
				trackedMetrics,
				reminders,
				assessments,
				goals,
				unitPreferences,
				dailyMetrics,
				habits,
				habitCompletions,
				challengeEnrolments,
				challengeProgress,
				intakeEvents,
				consumables,
				recipeIngredients,
				intakeStreams,
				registry: METRIC_REGISTRY,
			},
			{
				appVersion: this.appVersion,
				exportedAt: this.now(),
				excludeSensitiveMetrics: !includeSensitive,
				excludeNotes: !includeNotes,
			},
		);
	}
}

export function createExportStore(): ExportStore {
	return new ExportStore(getDb(), Constants.expoConfig?.version ?? "unknown");
}
