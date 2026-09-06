import { BaseRepository } from "./base-repository";

/** Find the window before loading its contents, including days containing only notes. */
export class HistoryDaysRepository extends BaseRepository {
	async listRecent(limit: number): Promise<string[]> {
		if (!Number.isSafeInteger(limit) || limit < 1)
			throw new RangeError("History day limit must be a positive integer.");
		const rows = await this.all<{ local_day: string }>(
			`SELECT local_day FROM (
			 SELECT local_day FROM observations
			 UNION SELECT local_day FROM day_notes
			 UNION SELECT local_day FROM daily_metrics
			 UNION SELECT local_day FROM habit_completions
			 UNION SELECT local_day FROM challenge_progress
			) ORDER BY local_day DESC LIMIT ?`,
			[limit],
		);
		return rows.map((row) => row.local_day);
	}
}
