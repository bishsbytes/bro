import type * as DatabaseApp from "@bro/database-app";
import {
	DEFAULT_LIFE_AREA_METRICS,
	listActiveLifeAreas,
	resolveLifeAreas,
} from "@bro/domain/life-area-catalogue";
import { DEFAULT_TRACKED_METRICS } from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

async function openDatabase(databaseName = "repositories.db") {
	jest.resetModules();
	databaseApp = jest.requireActual("@bro/database-app");
	db = await databaseApp.initDb(databaseName);
	await databaseApp.runMigrations(db);
}

function observation(
	overrides: Partial<DatabaseApp.CreateObservation> = {},
): DatabaseApp.CreateObservation {
	return {
		metricSlug: "mood",
		value: 4,
		scaleMin: 1,
		scaleMax: 5,
		observedAt: Date.UTC(2026, 7, 15, 0, 30),
		localDay: "2026-08-14",
		tzOffsetMinutes: 120,
		source: "user",
		sourceRecordId: null,
		assessmentId: null,
		...overrides,
	};
}

function consumptionEntry(
	overrides: Partial<DatabaseApp.CreateConsumptionEntry> = {},
): DatabaseApp.CreateConsumptionEntry {
	return {
		kind: "drink",
		catalogueRef: "drink:lager",
		label: "Lager",
		servingLabel: "pint",
		quantity: 1,
		volumeL: 0.568_261_25,
		ethanolKg: 0.020_181_999,
		caffeineKg: null,
		energyKcal: 227,
		occurredAt: Date.parse("2026-08-14T21:00:00.000Z"),
		localDay: "2026-08-14",
		tzOffsetMinutes: -60,
		...overrides,
	};
}

describe("product repositories", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		await openDatabase();
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("round-trips observations without deriving their local day from UTC", async () => {
		const repository = new databaseApp.ObservationRepository(db, {
			now: () => 10_000,
			createId: () => "observation-1",
		});

		const created = await repository.create(observation());

		expect(await repository.findById(created.id)).toEqual(created);
		expect(await repository.listByDay("2026-08-14")).toEqual([created]);
		expect(await repository.listByDay("2026-08-15")).toEqual([]);
		expect(created).toMatchObject({
			localDay: "2026-08-14",
			tzOffsetMinutes: 120,
		});
	});

	it("queries a metric by inclusive local-day range and bumps updatedAt", async () => {
		let now = 10_000;
		let nextId = 0;
		const repository = new databaseApp.ObservationRepository(db, {
			now: () => now,
			createId: () => {
				nextId += 1;
				return `observation-${nextId}`;
			},
		});
		const first = await repository.create(
			observation({ localDay: "2026-08-13" }),
		);
		await repository.create(
			observation({
				metricSlug: "energy",
				localDay: "2026-08-14",
			}),
		);
		await repository.create(observation({ localDay: "2026-08-15" }));

		expect(
			(
				await repository.listByMetricAndDayRange(
					"mood",
					"2026-08-13",
					"2026-08-14",
				)
			).map((row) => row.id),
		).toEqual([first.id]);

		now = 20_000;
		const updated = await repository.update(first.id, {
			value: 5,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: first.observedAt,
			localDay: first.localDay,
			tzOffsetMinutes: first.tzOffsetMinutes,
		});
		expect(updated).toMatchObject({
			id: first.id,
			createdAt: 10_000,
			updatedAt: 20_000,
			value: 5,
		});
		await expect(repository.delete(first.id)).resolves.toBe(true);
		await expect(repository.findById(first.id)).resolves.toBeNull();
	});

	it("hard-deletes factor taps without touching scored observations", async () => {
		let nextId = 0;
		const repository = new databaseApp.ObservationRepository(db, {
			createId: () => {
				nextId += 1;
				return `observation-${nextId}`;
			},
		});
		await repository.create(
			observation({
				metricSlug: "alcohol",
				value: 1,
				scaleMin: null,
				scaleMax: null,
			}),
		);
		await repository.create(
			observation({
				metricSlug: "alcohol",
				value: 1,
				scaleMin: null,
				scaleMax: null,
			}),
		);
		const mood = await repository.create(observation());

		await expect(
			repository.untapFactorForDay("alcohol", "2026-08-14"),
		).resolves.toBe(2);
		expect(await repository.listByDay("2026-08-14")).toEqual([mood]);
	});

	it("creates, lists, edits, and hard-deletes snapshotted consumption entries", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.ConsumptionEntryRepository(db, {
			now: () => now,
			createId: () => `consumption-${++nextId}`,
		});
		const lager = await repository.create(
			consumptionEntry({ label: "  Lager  ", servingLabel: " pint " }),
		);

		now = 2_000;
		const coffee = await repository.create(
			consumptionEntry({
				catalogueRef: "drink:filter-coffee",
				label: "Filter coffee",
				servingLabel: "mug",
				volumeL: 0.35,
				ethanolKg: null,
				caffeineKg: 0.000_14,
				energyKcal: 2,
				occurredAt: Date.parse("2026-08-15T08:00:00.000Z"),
				localDay: "2026-08-15",
			}),
		);
		now = 2_500;
		const chicken = await repository.create(
			consumptionEntry({
				kind: "food",
				catalogueRef: null,
				consumableRef: "off:123456",
				label: "Chicken thighs",
				servingLabel: "2 thighs",
				quantity: 2,
				volumeL: null,
				ethanolKg: null,
				caffeineKg: null,
				energyKcal: 436,
				proteinG: 52,
				carbsG: 0,
				fatG: null,
				occurredAt: Date.parse("2026-08-15T12:00:00.000Z"),
				localDay: "2026-08-15",
			}),
		);

		expect(lager).toMatchObject({
			id: "consumption-1",
			label: "Lager",
			servingLabel: "pint",
			createdAt: 1_000,
			updatedAt: 1_000,
		});
		await expect(repository.listByDay("2026-08-14")).resolves.toEqual([lager]);
		await expect(repository.listRecentByKind("drink", 1)).resolves.toEqual([
			coffee,
		]);
		await expect(repository.listRecentByKind("food", 1)).resolves.toEqual([
			chicken,
		]);
		expect(chicken).toMatchObject({
			consumableRef: "off:123456",
			proteinG: 52,
			carbsG: 0,
			fatG: null,
		});

		now = 3_000;
		const corrected = await repository.update(lager.id, {
			catalogueRef: lager.catalogueRef,
			label: lager.label,
			servingLabel: "half pint",
			quantity: 1,
			volumeL: lager.volumeL === null ? null : lager.volumeL / 2,
			ethanolKg: lager.ethanolKg === null ? null : lager.ethanolKg / 2,
			caffeineKg: null,
			energyKcal: 113.5,
			occurredAt: lager.occurredAt,
			localDay: lager.localDay,
			tzOffsetMinutes: lager.tzOffsetMinutes,
		});
		expect(corrected).toMatchObject({
			id: lager.id,
			servingLabel: "half pint",
			createdAt: 1_000,
			updatedAt: 3_000,
		});
		await expect(repository.delete(lager.id)).resolves.toBe(true);
		await expect(repository.delete(lager.id)).resolves.toBe(false);
		await expect(repository.listAll()).resolves.toEqual([chicken, coffee]);
		await expect(
			repository.create(consumptionEntry({ quantity: 0 })),
		).rejects.toThrow("quantity must be a positive finite value");
		await expect(repository.listByDay("2026-02-30")).rejects.toThrow(
			"real YYYY-MM-DD date",
		);
	});

	it("stores custom foods and edits recipe components without rewriting snapshots", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.CustomConsumableRepository(db, {
			now: () => now,
			createId: () => `custom-${++nextId}`,
		});
		const recipe = await repository.create(
			{
				kind: "food",
				label: "  Chicken traybake  ",
				brand: null,
				isRecipe: true,
				servings: [
					{
						id: "plate",
						label: "1 plate",
						volumeL: null,
						ethanolKg: null,
						caffeineKg: null,
						energyKcal: 610,
						proteinG: 48,
						carbsG: 54,
						fatG: 22,
					},
				],
			},
			[
				{
					position: 0,
					label: "Chicken thighs",
					quantity: 2,
					energyKcal: 436,
					proteinG: 52,
					carbsG: 0,
					fatG: 24,
				},
				{
					position: 1,
					label: "Potatoes",
					quantity: 250,
					energyKcal: 174,
					proteinG: 4,
					carbsG: 54,
					fatG: 0,
				},
			],
		);

		expect(recipe).toMatchObject({
			id: "custom-1",
			label: "Chicken traybake",
			isRecipe: true,
		});
		const originalComponents = await repository.listComponents(recipe.id);
		expect(originalComponents.map(({ id }) => id)).toEqual([
			"custom-2",
			"custom-3",
		]);

		now = 2_000;
		await expect(
			repository.updateComponent(originalComponents[1].id, {
				position: 1,
				label: "Roast potatoes",
				quantity: 300,
				energyKcal: 209,
				proteinG: 5,
				carbsG: 65,
				fatG: 0,
			}),
		).resolves.toMatchObject({
			id: "custom-3",
			label: "Roast potatoes",
			updatedAt: 2_000,
		});
		expect(await repository.findById(recipe.id)).toMatchObject({
			createdAt: 1_000,
			updatedAt: 2_000,
		});
		expect(originalComponents[1]).toMatchObject({
			label: "Potatoes",
			energyKcal: 174,
		});

		await expect(repository.delete(recipe.id)).resolves.toBe(true);
		await expect(repository.listComponents(recipe.id)).resolves.toEqual([]);
		await expect(repository.findById(recipe.id)).resolves.toBeNull();
	});

	it("upserts the UI note while retaining manufactured duplicates", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.DayNoteRepository(db, {
			now: () => now,
			createId: () => {
				nextId += 1;
				return `note-${nextId}`;
			},
		});
		const first = await repository.upsertForDay("2026-08-14", "First");

		now = 2_000;
		const updated = await repository.upsertForDay("2026-08-14", "Updated");
		expect(updated).toMatchObject({
			id: first.id,
			createdAt: 1_000,
			updatedAt: 2_000,
			body: "Updated",
		});

		now = 3_000;
		const duplicate = await repository.create(
			"2026-08-14",
			"Replicated duplicate",
		);
		expect(await repository.listByDay("2026-08-14")).toHaveLength(2);
		await expect(repository.delete(duplicate.id)).resolves.toBe(true);
		expect(await repository.listByDay("2026-08-14")).toEqual([updated]);
	});

	it("stamps added_at and removed_at only on enable/disable transitions", async () => {
		let now = 1_000;
		const repository = new databaseApp.TrackedMetricsRepository(db, {
			now: () => now,
			createId: () => "tracked-alcohol",
		});

		await repository.configure("alcohol", 6, false);
		now = 2_000;
		await repository.configure("alcohol", 6, false);
		expect((await repository.listAll())[0]).toMatchObject({
			addedAt: null,
			removedAt: 1_000,
			updatedAt: 2_000,
		});

		now = 3_000;
		await repository.configure("alcohol", 6, true);
		now = 4_000;
		await repository.configure("alcohol", 2, true);
		expect((await repository.listAll())[0]).toMatchObject({
			position: 2,
			addedAt: 3_000,
			removedAt: null,
			updatedAt: 4_000,
		});
	});

	it("swaps two overlay positions atomically with configureMany", async () => {
		let nextId = 0;
		let now = 1_000;
		const repository = new databaseApp.TrackedMetricsRepository(db, {
			now: () => now,
			createId: () => {
				nextId += 1;
				return `tracked-${nextId}`;
			},
		});

		await repository.configure("wheel:career", 0, true);
		await repository.configure("wheel:money", 1, false);

		now = 2_000;
		const swapped = await repository.configureMany([
			{ metricSlug: "wheel:career", position: 1, enabled: true },
			{ metricSlug: "wheel:money", position: 0, enabled: false },
		]);
		expect(
			swapped.map(({ metricSlug, position }) => [metricSlug, position]),
		).toEqual([
			["wheel:career", 1],
			["wheel:money", 0],
		]);

		const overlays = await repository.listResolved(DEFAULT_LIFE_AREA_METRICS);
		expect(
			overlays.find((metric) => metric.metricSlug === "wheel:career"),
		).toMatchObject({ position: 1, enabled: true });
		expect(
			overlays.find((metric) => metric.metricSlug === "wheel:money"),
		).toMatchObject({ position: 0, enabled: false, removedAt: 1_000 });

		await expect(
			repository.configureMany([
				{ metricSlug: "wheel:career", position: -1, enabled: true },
			]),
		).rejects.toThrow("non-negative integer");
	});

	it("materialises defaults lazily and persists a disabled overlay", async () => {
		let now = 1_000;
		const repository = new databaseApp.TrackedMetricsRepository(db, {
			now: () => now,
			createId: () => "tracked-alcohol",
		});

		const initial = await repository.listResolved(DEFAULT_TRACKED_METRICS);
		expect(initial).toHaveLength(DEFAULT_TRACKED_METRICS.length);
		expect(
			initial
				.filter(({ metricSlug }) =>
					["weight", "waist", "body_fat"].includes(metricSlug),
				)
				.every((metric) => !metric.enabled),
		).toBe(true);
		expect(
			initial
				.filter(
					({ metricSlug }) =>
						![
							"weight",
							"waist",
							"body_fat",
							"alcohol_intake",
							"caffeine_intake",
							"fluid_intake",
							"energy_intake",
							"protein_intake",
							"carbs_intake",
							"fat_intake",
						].includes(metricSlug),
				)
				.every((metric) => metric.enabled),
		).toBe(true);
		expect(await repository.listAll()).toEqual([]);

		const alcohol = initial.find((metric) => metric.metricSlug === "alcohol");
		expect(alcohol).toBeDefined();
		now = 2_000;
		await repository.configure("alcohol", alcohol?.position ?? 0, false);

		await databaseApp.closeDb();
		await openDatabase();
		const relaunched = new databaseApp.TrackedMetricsRepository(db);
		const resolved = await relaunched.listResolved(DEFAULT_TRACKED_METRICS);
		expect(
			resolved.find((metric) => metric.metricSlug === "alcohol"),
		).toMatchObject({
			enabled: false,
			overlayId: "tracked-alcohol",
			removedAt: 2_000,
		});
	});

	it("relabels tracked metrics without losing their overlay state", async () => {
		let now = 1_000;
		const repository = new databaseApp.TrackedMetricsRepository(db, {
			now: () => now,
			createId: () => "tracked-career",
		});

		await repository.configure("wheel:career", 4, false);
		now = 2_000;
		await expect(
			repository.relabel("wheel:career", "  Business  ", { position: 0 }),
		).resolves.toMatchObject({
			position: 4,
			removedAt: 1_000,
			customLabel: "Business",
			updatedAt: 2_000,
		});

		now = 3_000;
		await repository.configure("wheel:career", 2, false);
		expect((await repository.listAll())[0]).toMatchObject({
			position: 2,
			removedAt: 1_000,
			customLabel: "Business",
		});
		const overlays = await repository.listResolved(DEFAULT_LIFE_AREA_METRICS);
		const resolved = resolveLifeAreas(overlays);
		expect(resolved.find((area) => area.slug === "wheel:career")).toMatchObject(
			{
				enabled: false,
				position: 2,
				label: "Business",
				customLabel: "Business",
			},
		);
		expect(listActiveLifeAreas(overlays)).toHaveLength(7);
	});

	it("saves an assessment and all of its observations atomically", async () => {
		let nextId = 0;
		const repository = new databaseApp.AssessmentRepository(db, {
			now: () => 10_000,
			createId: () => {
				nextId += 1;
				return `assessment-part-${nextId}`;
			},
		});
		const input: DatabaseApp.CreateAssessmentWithObservations = {
			templateSlug: "wheel-of-life",
			templateVersion: 1,
			startedAt: 8_000,
			completedAt: 9_000,
			items: [
				{ slug: "wheel:career", label: "Business", position: 0 },
				{ slug: "wheel:health", label: "Health & fitness", position: 1 },
			],
			focusItemSlugs: ["wheel:career"],
			observations: [
				observation({
					metricSlug: "wheel:career",
					value: 6,
					scaleMin: 1,
					scaleMax: 10,
				}),
				observation({
					metricSlug: "wheel:health",
					value: 8,
					scaleMin: 1,
					scaleMax: 10,
				}),
			],
		};

		const saved = await repository.createWithObservations(input);
		expect(saved.assessment).toMatchObject({
			id: "assessment-part-1",
			items: input.items,
			focusItemSlugs: ["wheel:career"],
		});
		expect(saved.observations).toHaveLength(2);
		expect(
			saved.observations.every(
				(row) => row.assessmentId === saved.assessment.id,
			),
		).toBe(true);
		expect(await repository.findById(saved.assessment.id)).toEqual(
			saved.assessment,
		);
		expect(await repository.listAll()).toEqual([saved.assessment]);
	});

	it("rolls back the whole assessment when one observation is invalid", async () => {
		let nextId = 0;
		const repository = new databaseApp.AssessmentRepository(db, {
			createId: () => {
				nextId += 1;
				return `rollback-part-${nextId}`;
			},
		});

		await expect(
			repository.createWithObservations({
				templateSlug: "wheel-of-life",
				templateVersion: 1,
				startedAt: 8_000,
				completedAt: 9_000,
				items: [
					{ slug: "wheel:career", label: "Work & career", position: 0 },
					{ slug: "wheel:health", label: "Health & fitness", position: 1 },
				],
				focusItemSlugs: [],
				observations: [
					observation({
						metricSlug: "wheel:career",
						value: 6,
						scaleMin: 1,
						scaleMax: 10,
					}),
					observation({
						metricSlug: "wheel:health",
						value: 11,
						scaleMin: 1,
						scaleMax: 10,
					}),
				],
			}),
		).rejects.toThrow("Observation value must fall within its scale bounds.");
		expect(await repository.listAll()).toEqual([]);
		expect(
			await new databaseApp.ObservationRepository(db).listByDay("2026-08-14"),
		).toEqual([]);
	});

	it("creates goals and records mutually exclusive terminal states", async () => {
		let now = 1_000;
		const repository = new databaseApp.GoalRepository(db, {
			now: () => now,
			createId: () => "goal-1",
		});
		const created = await repository.create({
			metricSlug: "wheel:career",
			direction: "increase",
			targetValue: 8,
			targetDate: "2026-12-01",
			startedAt: 900,
		});
		expect(await repository.listAll()).toEqual([created]);

		now = 2_000;
		await expect(repository.achieve(created.id)).resolves.toMatchObject({
			achievedAt: 2_000,
			abandonedAt: null,
			updatedAt: 2_000,
		});
		now = 3_000;
		await expect(repository.abandon(created.id)).resolves.toMatchObject({
			achievedAt: null,
			abandonedAt: 3_000,
			updatedAt: 3_000,
		});

		await expect(
			repository.create({
				metricSlug: "wheel:career",
				direction: "increase",
				targetValue: 8,
				targetDate: "2026-13-40",
				startedAt: 900,
			}),
		).rejects.toThrow("real YYYY-MM-DD date");
	});

	it("sets unit preferences and resolves replicated rows latest-first", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.UnitPreferenceRepository(db, {
			now: () => now,
			createId: () => {
				nextId += 1;
				return `unit-preference-${nextId}`;
			},
		});

		const created = await repository.set(" mass ", " kg ");
		now = 2_000;
		await expect(repository.set("mass", "lb")).resolves.toMatchObject({
			id: created.id,
			dimension: "mass",
			unit: "lb",
			createdAt: 1_000,
			updatedAt: 2_000,
		});
		expect(await repository.list()).toHaveLength(1);

		await db.runAsync(
			`INSERT INTO unit_preferences (
				id, dimension, unit, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)`,
			[
				"replicated-mass",
				"mass",
				"st",
				1_500,
				3_000,
				"future-dimension",
				"energy",
				"kJ",
				1_500,
				2_500,
			],
		);
		expect(await repository.resolveLatestPerDimension()).toEqual([
			{
				id: "future-dimension",
				dimension: "energy",
				unit: "kJ",
				createdAt: 1_500,
				updatedAt: 2_500,
			},
			{
				id: "replicated-mass",
				dimension: "mass",
				unit: "st",
				createdAt: 1_500,
				updatedAt: 3_000,
			},
		]);

		now = 4_000;
		await expect(repository.set("mass", "kg")).resolves.toMatchObject({
			id: "replicated-mass",
			unit: "kg",
			createdAt: 1_500,
			updatedAt: 4_000,
		});
		await expect(repository.set("", "kg")).rejects.toThrow(
			"dimension must not be empty",
		);
		await expect(repository.set("length", " ")).rejects.toThrow(
			"unit must not be empty",
		);
	});

	it("creates, edits, disables, and hard-deletes reminder schedules", async () => {
		let now = 1_000;
		const repository = new databaseApp.ReminderRepository(db, {
			now: () => now,
			createId: () => "reminder-1",
		});
		const created = await repository.create({
			minuteOfDay: 20 * 60,
			daysOfWeek: 0b111_1111,
		});
		expect(await repository.listAll()).toEqual([created]);

		now = 2_000;
		await expect(
			repository.update(created.id, {
				minuteOfDay: 8 * 60 + 30,
				daysOfWeek: 0b001_1111,
			}),
		).resolves.toMatchObject({
			id: "reminder-1",
			minuteOfDay: 510,
			daysOfWeek: 0b001_1111,
			createdAt: 1_000,
			updatedAt: 2_000,
		});

		now = 3_000;
		await expect(
			repository.setEnabled(created.id, false),
		).resolves.toMatchObject({ enabled: false, updatedAt: 3_000 });
		await expect(repository.delete(created.id)).resolves.toBe(true);
		await expect(repository.listAll()).resolves.toEqual([]);
	});
});
