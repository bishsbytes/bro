import type { SQLiteDatabase } from "expo-sqlite";
import { createUuidV7 } from "../uuid-v7";
import { BaseRepository } from "./base-repository";
import {
	type CreateObservation,
	type Observation,
	ObservationRepository,
} from "./observation-repository";

export type AssessmentItemSnapshot = {
	slug: string;
	label: string;
	position: number;
};

export type Assessment = {
	id: string;
	templateSlug: string;
	templateVersion: number;
	startedAt: number;
	completedAt: number | null;
	items: AssessmentItemSnapshot[];
	focusItemSlugs: string[];
	createdAt: number;
	updatedAt: number;
};

export type CreateAssessment = Omit<
	Assessment,
	"id" | "createdAt" | "updatedAt"
>;

export type CreateAssessmentObservation = Omit<
	CreateObservation,
	"assessmentId"
>;

export type CreateAssessmentWithObservations = CreateAssessment & {
	observations: CreateAssessmentObservation[];
};

export type SavedAssessment = {
	assessment: Assessment;
	observations: Observation[];
};

type AssessmentRow = {
	id: string;
	template_slug: string;
	template_version: number;
	started_at: number;
	completed_at: number | null;
	items: string;
	focus_item_slugs: string;
	created_at: number;
	updated_at: number;
};

type RepositoryOptions = {
	now?: () => number;
	createId?: (timestamp: number) => string;
};

const SELECT_COLUMNS = `
	id, template_slug, template_version, started_at, completed_at, items,
	focus_item_slugs, created_at, updated_at
`;

function parseJsonArray<Value>(value: string, field: string): Value[] {
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) {
		throw new TypeError(`Assessment ${field} snapshot must be an array.`);
	}
	return parsed as Value[];
}

function toAssessment(row: AssessmentRow): Assessment {
	return {
		id: row.id,
		templateSlug: row.template_slug,
		templateVersion: row.template_version,
		startedAt: row.started_at,
		completedAt: row.completed_at,
		items: parseJsonArray<AssessmentItemSnapshot>(row.items, "items"),
		focusItemSlugs: parseJsonArray<string>(
			row.focus_item_slugs,
			"focus item slugs",
		),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function assertAssessment(input: CreateAssessmentWithObservations): void {
	if (!input.templateSlug.trim()) {
		throw new TypeError("Assessment templateSlug must not be empty.");
	}
	if (!Number.isInteger(input.templateVersion) || input.templateVersion < 1) {
		throw new RangeError("Assessment templateVersion must be positive.");
	}
	if (
		!Number.isInteger(input.startedAt) ||
		(input.completedAt !== null && !Number.isInteger(input.completedAt))
	) {
		throw new TypeError("Assessment timestamps must be epoch milliseconds.");
	}
	if (input.completedAt !== null && input.completedAt < input.startedAt) {
		throw new RangeError("Assessment cannot complete before it starts.");
	}

	const itemSlugs = new Set<string>();
	if (input.items.length === 0) {
		throw new TypeError("Assessment must contain at least one item.");
	}
	for (const item of input.items) {
		if (
			!item.slug.trim() ||
			!item.label.trim() ||
			!Number.isInteger(item.position) ||
			item.position < 0
		) {
			throw new TypeError(
				"Assessment items require a slug, label, and position.",
			);
		}
		if (itemSlugs.has(item.slug)) {
			throw new TypeError("Assessment item slugs must be unique.");
		}
		itemSlugs.add(item.slug);
	}

	if (
		input.focusItemSlugs.some((slug) => !itemSlugs.has(slug)) ||
		new Set(input.focusItemSlugs).size !== input.focusItemSlugs.length
	) {
		throw new TypeError(
			"Assessment focus items must be unique slugs from the item snapshot.",
		);
	}

	const observationSlugs = new Set(
		input.observations.map(({ metricSlug }) => metricSlug),
	);
	if (
		observationSlugs.size !== input.observations.length ||
		observationSlugs.size !== itemSlugs.size ||
		[...itemSlugs].some((slug) => !observationSlugs.has(slug))
	) {
		throw new TypeError(
			"Assessment observations must contain exactly one value for every item.",
		);
	}
}

export class AssessmentRepository extends BaseRepository {
	private readonly now: () => number;
	private readonly createId: (timestamp: number) => string;

	constructor(db: SQLiteDatabase, options: RepositoryOptions = {}) {
		super(db);
		this.now = options.now ?? Date.now;
		this.createId =
			options.createId ?? ((timestamp) => createUuidV7(timestamp));
	}

	async createWithObservations(
		input: CreateAssessmentWithObservations,
	): Promise<SavedAssessment> {
		assertAssessment(input);
		const now = this.now();
		const assessment: Assessment = {
			id: this.createId(now),
			templateSlug: input.templateSlug,
			templateVersion: input.templateVersion,
			startedAt: input.startedAt,
			completedAt: input.completedAt,
			items: input.items,
			focusItemSlugs: input.focusItemSlugs,
			createdAt: now,
			updatedAt: now,
		};

		return await this.transaction(async () => {
			await this.run(
				`INSERT INTO assessments (
					id, template_slug, template_version, started_at, completed_at, items,
					focus_item_slugs, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					assessment.id,
					assessment.templateSlug,
					assessment.templateVersion,
					assessment.startedAt,
					assessment.completedAt,
					JSON.stringify(assessment.items),
					JSON.stringify(assessment.focusItemSlugs),
					assessment.createdAt,
					assessment.updatedAt,
				],
			);

			const observationRepository = new ObservationRepository(this.db, {
				now: () => now,
				createId: this.createId,
			});
			const observations: Observation[] = [];
			for (const observation of input.observations) {
				observations.push(
					await observationRepository.create({
						...observation,
						assessmentId: assessment.id,
					}),
				);
			}

			return { assessment, observations };
		});
	}

	async findById(id: string): Promise<Assessment | null> {
		const row = await this.first<AssessmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM assessments WHERE id = ?`,
			[id],
		);
		return row ? toAssessment(row) : null;
	}

	async listAll(): Promise<Assessment[]> {
		const rows = await this.all<AssessmentRow>(
			`SELECT ${SELECT_COLUMNS} FROM assessments
			 ORDER BY completed_at DESC, started_at DESC, created_at DESC, id DESC`,
		);
		return rows.map(toAssessment);
	}
}
