import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";

export type ChallengeEnrolment = {
	id: string;
	challengeSlug: string;
	title: string;
	durationDays: number;
	areaSlug: string;
	startedOn: string;
	completedAt: number | null;
	abandonedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type CreateChallengeEnrolment = Pick<
	ChallengeEnrolment,
	"challengeSlug" | "title" | "durationDays" | "areaSlug" | "startedOn"
>;

type ChallengeEnrolmentRow = {
	id: string;
	challenge_slug: string;
	title: string;
	duration_days: number;
	area_slug: string;
	started_on: string;
	completed_at: number | null;
	abandoned_at: number | null;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, challenge_slug, title, duration_days, area_slug, started_on,
	completed_at, abandoned_at, created_at, updated_at
`;

function required(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new TypeError(`${label} must not be empty.`);
	return normalized;
}

function isCalendarDay(value: string): boolean {
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
	if (!match) return false;
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}

function toChallengeEnrolment(row: ChallengeEnrolmentRow): ChallengeEnrolment {
	if (row.completed_at !== null && row.abandoned_at !== null) {
		throw new TypeError(`Challenge enrolment ${row.id} has two closed states.`);
	}
	return {
		id: row.id,
		challengeSlug: row.challenge_slug,
		title: row.title,
		durationDays: row.duration_days,
		areaSlug: row.area_slug,
		startedOn: row.started_on,
		completedAt: row.completed_at,
		abandonedAt: row.abandoned_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export class ChallengeEnrolmentRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async enrol(input: CreateChallengeEnrolment): Promise<ChallengeEnrolment> {
		const challengeSlug = required(input.challengeSlug, "Challenge slug");
		if (!challengeSlug.startsWith("challenge:")) {
			throw new TypeError("Challenge slug must use the challenge: namespace.");
		}
		const title = required(input.title, "Challenge title");
		const areaSlug = required(input.areaSlug, "Challenge area slug");
		if (!Number.isInteger(input.durationDays) || input.durationDays < 1) {
			throw new RangeError("Challenge duration must be a positive integer.");
		}
		if (!isCalendarDay(input.startedOn)) {
			throw new TypeError(
				"Challenge start day must be a real YYYY-MM-DD date.",
			);
		}

		return await this.transaction(async () => {
			const active = await this.findActiveBySlug(challengeSlug);
			if (active) {
				throw new Error(
					`Challenge already has an active enrolment: ${challengeSlug}`,
				);
			}
			const now = this.now();
			const enrolment: ChallengeEnrolment = {
				id: this.createId(now),
				challengeSlug,
				title,
				durationDays: input.durationDays,
				areaSlug,
				startedOn: input.startedOn,
				completedAt: null,
				abandonedAt: null,
				createdAt: now,
				updatedAt: now,
			};
			await this.run(
				`INSERT INTO challenge_enrolments (
					id, challenge_slug, title, duration_days, area_slug, started_on,
					completed_at, abandoned_at, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					enrolment.id,
					enrolment.challengeSlug,
					enrolment.title,
					enrolment.durationDays,
					enrolment.areaSlug,
					enrolment.startedOn,
					enrolment.completedAt,
					enrolment.abandonedAt,
					enrolment.createdAt,
					enrolment.updatedAt,
				],
			);
			return enrolment;
		});
	}

	async findById(id: string): Promise<ChallengeEnrolment | null> {
		const row = await this.first<ChallengeEnrolmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_enrolments WHERE id = ?`,
			[id],
		);
		return row ? toChallengeEnrolment(row) : null;
	}

	async findActiveBySlug(slug: string): Promise<ChallengeEnrolment | null> {
		const row = await this.first<ChallengeEnrolmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_enrolments
			 WHERE challenge_slug = ? AND completed_at IS NULL AND abandoned_at IS NULL
			 ORDER BY created_at DESC, id DESC LIMIT 1`,
			[slug],
		);
		return row ? toChallengeEnrolment(row) : null;
	}

	async listAll(): Promise<ChallengeEnrolment[]> {
		const rows = await this.all<ChallengeEnrolmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_enrolments
			 ORDER BY created_at DESC, id DESC`,
		);
		return rows.map(toChallengeEnrolment);
	}

	async listActive(): Promise<ChallengeEnrolment[]> {
		const rows = await this.all<ChallengeEnrolmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM challenge_enrolments
			 WHERE completed_at IS NULL AND abandoned_at IS NULL
			 ORDER BY created_at ASC, id ASC`,
		);
		return rows.map(toChallengeEnrolment);
	}

	async abandon(id: string): Promise<ChallengeEnrolment | null> {
		const existing = await this.findById(id);
		if (
			!existing ||
			existing.completedAt !== null ||
			existing.abandonedAt !== null
		) {
			return existing;
		}
		const now = this.now();
		await this.run(
			`UPDATE challenge_enrolments
			 SET abandoned_at = ?, updated_at = ?
			 WHERE id = ? AND completed_at IS NULL AND abandoned_at IS NULL`,
			[now, now, id],
		);
		return await this.findById(id);
	}
}
