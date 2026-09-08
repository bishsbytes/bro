import { isCalendarDay } from "@bro/domain";
import type { CreateGoal, Goal, UpdateGoal } from "@bro/mobile-model";
import { BaseRepository } from "./base-repository";

export type {
	CreateGoal,
	Goal,
	GoalDirection,
	UpdateGoal,
} from "@bro/mobile-model";

type GoalRow = {
	id: string;
	name: string;
	intent: string | null;
	area_slug: string | null;
	metric_slug: string | null;
	direction: string | null;
	target_value: number | null;
	target_date: string | null;
	started_at: number;
	note: string | null;
	achieved_at: number | null;
	abandoned_at: number | null;
	created_at: number;
	updated_at: number;
};

const SELECT_COLUMNS = `
	id, name, intent, area_slug, metric_slug, direction, target_value, target_date,
	started_at, note, achieved_at, abandoned_at, created_at, updated_at
`;

function toGoal(row: GoalRow): Goal {
	if (
		row.direction !== null &&
		row.direction !== "increase" &&
		row.direction !== "decrease"
	) {
		throw new TypeError(`Unknown goal direction: ${row.direction}`);
	}
	return {
		id: row.id,
		name: row.name,
		intent: row.intent,
		areaSlug: row.area_slug,
		metricSlug: row.metric_slug,
		direction: row.direction,
		targetValue: row.target_value,
		targetDate: row.target_date,
		startedAt: row.started_at,
		note: row.note,
		achievedAt: row.achieved_at,
		abandonedAt: row.abandoned_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertName(name: string): void {
	if (!name.trim()) {
		throw new TypeError("Goal name must not be empty.");
	}
}

function assertDates(input: Pick<Goal, "targetDate" | "startedAt">): void {
	if (input.targetDate !== null && !isCalendarDay(input.targetDate)) {
		throw new TypeError("Goal targetDate must be a real YYYY-MM-DD date.");
	}
	if (!Number.isInteger(input.startedAt)) {
		throw new TypeError("Goal startedAt must be epoch milliseconds.");
	}
}

/**
 * A heading is measurable or qualitative. Half a measurement — a target with no
 * metric, or a metric with no target — would render as progress towards
 * nothing, so it is rejected at the boundary rather than guessed at later.
 */
function assertGoal(input: CreateGoal): void {
	assertName(input.name);
	assertDates(input);
	if (input.metricSlug === null) {
		if (input.direction !== null || input.targetValue !== null) {
			throw new TypeError(
				"A goal without a metricSlug must carry no direction or targetValue.",
			);
		}
		return;
	}
	if (!input.metricSlug.trim()) {
		throw new TypeError("Goal metricSlug must not be empty.");
	}
	if (input.direction !== "increase" && input.direction !== "decrease") {
		throw new TypeError("Goal direction must be increase or decrease.");
	}
	if (!Number.isFinite(input.targetValue)) {
		throw new RangeError("Goal targetValue must be finite.");
	}
}

export class GoalRepository extends BaseRepository {
	async create(input: CreateGoal): Promise<Goal> {
		assertGoal(input);
		const now = this.now();
		const goal: Goal = {
			id: this.createId(now),
			...input,
			achievedAt: null,
			abandonedAt: null,
			createdAt: now,
			updatedAt: now,
		};

		await this.run(
			`INSERT INTO goals (
				id, name, intent, area_slug, metric_slug, direction, target_value,
				target_date, started_at, note, achieved_at, abandoned_at, created_at,
				updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				goal.id,
				goal.name,
				goal.intent,
				goal.areaSlug,
				goal.metricSlug,
				goal.direction,
				goal.targetValue,
				goal.targetDate,
				goal.startedAt,
				goal.note,
				goal.achievedAt,
				goal.abandonedAt,
				goal.createdAt,
				goal.updatedAt,
			],
		);
		return goal;
	}

	/**
	 * Edits what a person wrote, never what the heading is measured against.
	 * A row that has gone is left alone rather than resurrected.
	 */
	async update(id: string, input: UpdateGoal): Promise<Goal | null> {
		assertName(input.name);
		assertDates(input);
		const now = this.now();
		await this.run(
			`UPDATE goals
			 SET name = ?, intent = ?, area_slug = ?, target_date = ?, started_at = ?,
			     note = ?, updated_at = ?
			 WHERE id = ?`,
			[
				input.name,
				input.intent,
				input.areaSlug,
				input.targetDate,
				input.startedAt,
				input.note,
				now,
				id,
			],
		);
		return await this.findById(id);
	}

	async findById(id: string): Promise<Goal | null> {
		const row = await this.first<GoalRow>(
			`SELECT ${SELECT_COLUMNS} FROM goals WHERE id = ?`,
			[id],
		);
		return row ? toGoal(row) : null;
	}

	async listAll(): Promise<Goal[]> {
		const rows = await this.all<GoalRow>(
			`SELECT ${SELECT_COLUMNS} FROM goals
			 ORDER BY started_at DESC, created_at DESC, id DESC`,
		);
		return rows.map(toGoal);
	}

	async achieve(id: string): Promise<Goal | null> {
		const now = this.now();
		await this.run(
			`UPDATE goals
			 SET achieved_at = ?, abandoned_at = NULL, updated_at = ?
			 WHERE id = ?`,
			[now, now, id],
		);
		return await this.findById(id);
	}

	async abandon(id: string): Promise<Goal | null> {
		const now = this.now();
		await this.run(
			`UPDATE goals
			 SET abandoned_at = ?, achieved_at = NULL, updated_at = ?
			 WHERE id = ?`,
			[now, now, id],
		);
		return await this.findById(id);
	}
}
