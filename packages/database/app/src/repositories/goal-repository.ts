import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type GoalDirection = "increase" | "decrease";

export type Goal = {
	id: string;
	metricSlug: string;
	direction: GoalDirection;
	targetValue: number;
	targetDate: string | null;
	startedAt: number;
	achievedAt: number | null;
	abandonedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateGoal = Pick<
	Goal,
	"metricSlug" | "direction" | "targetValue" | "targetDate" | "startedAt"
>;

type GoalRow = {
	id: string;
	metric_slug: string;
	direction: string;
	target_value: number;
	target_date: string | null;
	started_at: number;
	achieved_at: number | null;
	abandoned_at: number | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, metric_slug, direction, target_value, target_date, started_at, achieved_at,
	abandoned_at, created_at, updated_at
`;

function toGoal(row: GoalRow): Goal {
	if (row.direction !== "increase" && row.direction !== "decrease") {
		throw new TypeError(`Unknown goal direction: ${row.direction}`);
	}
	return {
		id: row.id,
		metricSlug: row.metric_slug,
		direction: row.direction,
		targetValue: row.target_value,
		targetDate: row.target_date,
		startedAt: row.started_at,
		achievedAt: row.achieved_at,
		abandonedAt: row.abandoned_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertGoal(input: CreateGoal): void {
	if (!input.metricSlug.trim()) {
		throw new TypeError("Goal metricSlug must not be empty.");
	}
	if (input.direction !== "increase" && input.direction !== "decrease") {
		throw new TypeError("Goal direction must be increase or decrease.");
	}
	if (!Number.isFinite(input.targetValue)) {
		throw new RangeError("Goal targetValue must be finite.");
	}
	if (
		input.targetDate !== null &&
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.targetDate)
	) {
		throw new TypeError("Goal targetDate must use YYYY-MM-DD format.");
	}
	if (!Number.isInteger(input.startedAt)) {
		throw new TypeError("Goal startedAt must be epoch milliseconds.");
	}
}

export class GoalRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

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
				id, metric_slug, direction, target_value, target_date, started_at,
				achieved_at, abandoned_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				goal.id,
				goal.metricSlug,
				goal.direction,
				goal.targetValue,
				goal.targetDate,
				goal.startedAt,
				goal.achievedAt,
				goal.abandonedAt,
				goal.createdAt,
				goal.updatedAt,
			],
		);
		return goal;
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
