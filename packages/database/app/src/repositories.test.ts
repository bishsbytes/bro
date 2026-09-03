import {
	DEFAULT_LIFE_AREA_METRICS,
	listActiveLifeAreas,
	resolveLifeAreas,
} from "@bro/domain/life-area-catalogue";
import { DEFAULT_TRACKED_METRICS } from "@bro/domain/metric-registry";
import type { SQLiteDatabase } from "expo-sqlite";
import type * as DatabaseApp from "./index";
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
	databaseApp = jest.requireActual("./index");
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
		slot: "morning",
		...overrides,
	};
}

function intakeEvent(
	overrides: Partial<DatabaseApp.CreateIntakeEvent> = {},
): DatabaseApp.CreateIntakeEvent {
	return {
		kind: "drink",
		consumableId: null,
		sourceRef: "system:drink:lager-4_5",
		name: "Lager, 4.5%",
		brand: null,
		portionLabel: "pint",
		quantity: 1,
		massKg: null,
		volumeL: 0.568_261_25,
		constituents: {
			fluid: 0.568_261_25,
			ethanol: 0.020_181_999,
			caffeine: 0,
			energy: 244,
		},
		context: null,
		notes: null,
		occurredAt: Date.parse("2026-08-14T21:00:00.000Z"),
		localDay: "2026-08-14",
		tzOffsetMinutes: -60,
		...overrides,
	};
}

function userFood(
	overrides: Partial<DatabaseApp.CreateConsumable> = {},
): DatabaseApp.CreateConsumable {
	return {
		kind: "food",
		name: "Greek yoghurt",
		brand: "Corner shop",
		barcode: null,
		basis: { type: "mass", massKg: 0.1 },
		constituents: { energy: 97, protein: 0.009, carbohydrate: 0.004 },
		portions: [
			{
				id: "pot",
				label: "1 pot",
				massKg: 0.17,
				volumeL: null,
				basisUnits: null,
			},
		],
		defaultPortionId: "pot",
		recipe: null,
		source: { type: "user" },
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
			slot: "morning",
		});
	});

	it("round-trips a check-in's sitting and leaves other rows without one", async () => {
		let nextId = 0;
		const repository = new databaseApp.ObservationRepository(db, {
			now: () => 10_000,
			createId: () => {
				nextId += 1;
				return `observation-${nextId}`;
			},
		});

		const morning = await repository.create(
			observation({ slot: "morning" as const }),
		);
		// A body measurement never names a sitting, and must not have to.
		const weight = await repository.create(
			observation({
				metricSlug: "weight",
				value: 80,
				scaleMin: null,
				scaleMax: null,
				slot: null,
			}),
		);

		expect(morning.slot).toBe("morning");
		expect(weight.slot).toBe(null);
		expect(await repository.findById(morning.id)).toEqual(morning);

		// An edit rewrites the value and leaves the sitting where it was.
		const edited = await repository.update(morning.id, {
			value: 2,
			scaleMin: morning.scaleMin,
			scaleMax: morning.scaleMax,
			observedAt: morning.observedAt,
			localDay: morning.localDay,
			tzOffsetMinutes: morning.tzOffsetMinutes,
		});
		expect(edited).toMatchObject({ value: 2, slot: "morning" });
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

	it("hard-deletes tag taps without touching scored observations", async () => {
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
				slot: null,
			}),
		);
		await repository.create(
			observation({
				metricSlug: "alcohol",
				value: 1,
				scaleMin: null,
				scaleMax: null,
				slot: null,
			}),
		);
		const mood = await repository.create(observation());

		await expect(
			repository.untapTagForDay("alcohol", "2026-08-14"),
		).resolves.toBe(2);
		expect(await repository.listByDay("2026-08-14")).toEqual([mood]);
	});

	it("creates, windows, edits, and hard-deletes snapshotted intake events", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.IntakeEventRepository(db, {
			now: () => now,
			createId: () => `event-${++nextId}`,
		});
		const lager = await repository.create(
			intakeEvent({ name: "  Lager, 4.5%  ", portionLabel: " pint " }),
		);

		now = 2_000;
		const coffee = await repository.create(
			intakeEvent({
				sourceRef: "system:drink:filter-coffee",
				name: "Filter coffee",
				portionLabel: "mug",
				volumeL: 0.25,
				constituents: { fluid: 0.25, ethanol: 0, caffeine: 0.0001, energy: 2 },
				occurredAt: Date.parse("2026-08-15T08:00:00.000Z"),
				localDay: "2026-08-15",
			}),
		);
		now = 2_500;
		const chicken = await repository.create(
			intakeEvent({
				kind: "food",
				consumableId: "library-1",
				sourceRef: "off:123456",
				name: "Chicken thighs",
				brand: "Example",
				portionLabel: "2 thighs",
				quantity: 2,
				massKg: 0.24,
				volumeL: null,
				// An unknown code round-trips untouched beside the known ones.
				constituents: { energy: 436, protein: 0.052, carbohydrate: 0, thc: 0 },
				context: "lunch",
				notes: "  leftovers ",
				occurredAt: Date.parse("2026-08-15T12:00:00.000Z"),
				localDay: "2026-08-15",
			}),
		);

		expect(lager).toMatchObject({
			id: "event-1",
			name: "Lager, 4.5%",
			portionLabel: "pint",
			createdAt: 1_000,
			updatedAt: 1_000,
		});
		expect(chicken).toMatchObject({
			consumableId: "library-1",
			sourceRef: "off:123456",
			context: "lunch",
			notes: "leftovers",
			constituents: { energy: 436, protein: 0.052, carbohydrate: 0, thc: 0 },
		});
		await expect(repository.findById(chicken.id)).resolves.toEqual(chicken);
		await expect(repository.listByDay("2026-08-14")).resolves.toEqual([lager]);
		await expect(
			repository.listBetween("2026-08-14", "2026-08-15"),
		).resolves.toEqual([lager, coffee, chicken]);
		await expect(
			repository.listBetween("2026-08-15", "2026-08-15"),
		).resolves.toEqual([coffee, chicken]);
		await expect(repository.listRecent(["drink"], 1)).resolves.toEqual([
			coffee,
		]);
		await expect(repository.listRecent(["food", "drink"], 2)).resolves.toEqual([
			chicken,
			coffee,
		]);
		await expect(repository.listRecent(["nicotine"])).resolves.toEqual([]);

		now = 3_000;
		const corrected = await repository.update(lager.id, {
			consumableId: lager.consumableId,
			sourceRef: lager.sourceRef,
			name: lager.name,
			brand: lager.brand,
			portionLabel: "half pint",
			quantity: 0.5,
			massKg: null,
			volumeL: lager.volumeL === null ? null : lager.volumeL / 2,
			constituents: {
				fluid: 0.284_130_625,
				ethanol: 0.010_090_999_5,
				caffeine: 0,
				energy: 122,
			},
			context: "drink",
			notes: null,
			occurredAt: lager.occurredAt,
			localDay: lager.localDay,
			tzOffsetMinutes: lager.tzOffsetMinutes,
		});
		expect(corrected).toMatchObject({
			id: lager.id,
			kind: "drink",
			portionLabel: "half pint",
			context: "drink",
			constituents: { energy: 122 },
			createdAt: 1_000,
			updatedAt: 3_000,
		});
		await expect(repository.delete(lager.id)).resolves.toBe(true);
		await expect(repository.delete(lager.id)).resolves.toBe(false);
		await expect(repository.listAll()).resolves.toEqual([chicken, coffee]);

		await expect(
			repository.create(intakeEvent({ quantity: 0 })),
		).rejects.toThrow("quantity must be a positive finite value");
		await expect(
			repository.create(
				intakeEvent({ massKg: null, volumeL: null, constituents: {} }),
			),
		).rejects.toThrow(
			"must carry a mass, a volume, or at least one constituent",
		);
		await expect(
			repository.create(intakeEvent({ constituents: { energy: -1 } })),
		).rejects.toThrow("energy must be finite and non-negative");
		await expect(
			repository.create(
				intakeEvent({
					context: "brunch" as DatabaseApp.IntakeEvent["context"],
				}),
			),
		).rejects.toThrow("Unsupported intake context");
		await expect(repository.listByDay("2026-02-30")).rejects.toThrow(
			"real YYYY-MM-DD date",
		);
		await expect(
			repository.listBetween("2026-08-15", "2026-08-14"),
		).rejects.toThrow("must run forwards");
	});

	it("stores library consumables with provenance, forks, and archives", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.ConsumableRepository(db, {
			now: () => now,
			createId: () => `consumable-${++nextId}`,
		});
		const yoghurt = await repository.create(
			userFood({ name: "  Greek yoghurt  " }),
		);
		expect(yoghurt).toMatchObject({
			id: "consumable-1",
			name: "Greek yoghurt",
			source: { type: "user" },
			forkedFrom: null,
			archivedAt: null,
		});
		await expect(repository.findById(yoghurt.id)).resolves.toEqual(yoghurt);

		// A searched product is one library row, however often it is logged.
		now = 2_000;
		const provider = {
			type: "provider",
			provider: "off",
			externalId: "5000112637922",
		} as const;
		await expect(repository.findBySource(provider)).resolves.toBeNull();
		const cola = await repository.create(
			userFood({
				kind: "drink",
				name: "Cola",
				brand: "Example",
				barcode: "5000112637922",
				basis: { type: "volume", volumeL: 0.1 },
				constituents: { energy: 42, sugar: 0.0106, caffeine: 0.000_01 },
				portions: [
					{
						id: "can",
						label: "330 ml can",
						massKg: null,
						volumeL: 0.33,
						basisUnits: null,
					},
				],
				defaultPortionId: "can",
				source: provider,
			}),
		);
		await expect(repository.findBySource(provider)).resolves.toEqual(cola);
		await expect(
			repository.findBySource({
				type: "community",
				contentId: "c",
				version: 1,
			}),
		).resolves.toBeNull();
		await expect(repository.findBySource({ type: "user" })).resolves.toBeNull();

		// Editing a catalogue drink makes a user row that says where it came from.
		now = 3_000;
		const fork = await repository.createFork(
			{ type: "system", key: "drink:lager-4_5" },
			userFood({
				kind: "drink",
				name: "Lager, 4.5% (my pub)",
				brand: null,
				basis: { type: "volume", volumeL: 0.1 },
				constituents: {
					fluid: 0.1,
					ethanol: 0.003_551_58,
					caffeine: 0,
					energy: 43,
				},
				portions: [
					{
						id: "schooner",
						label: "schooner",
						massKg: null,
						volumeL: 0.425,
						basisUnits: null,
					},
				],
				defaultPortionId: "schooner",
			}),
		);
		expect(fork).toMatchObject({
			source: { type: "user" },
			forkedFrom: { type: "system", key: "drink:lager-4_5" },
		});
		await expect(repository.listByKind("drink")).resolves.toEqual([cola, fork]);
		await expect(repository.listByKind("food")).resolves.toEqual([yoghurt]);
		await expect(repository.listAll()).resolves.toEqual([cola, yoghurt, fork]);

		now = 4_000;
		const edited = await repository.update(yoghurt.id, {
			name: "Greek yoghurt, 0%",
			brand: yoghurt.brand,
			barcode: "5011234",
			basis: yoghurt.basis,
			constituents: { energy: 57, protein: 0.01, carbohydrate: 0.004 },
			portions: yoghurt.portions,
			defaultPortionId: "pot",
			recipe: null,
		});
		expect(edited).toMatchObject({
			name: "Greek yoghurt, 0%",
			barcode: "5011234",
			constituents: { energy: 57 },
			createdAt: 1_000,
			updatedAt: 4_000,
		});

		now = 5_000;
		await expect(repository.archive(cola.id)).resolves.toMatchObject({
			archivedAt: 5_000,
		});
		await expect(repository.listByKind("drink")).resolves.toEqual([fork]);
		expect(
			(await repository.listByKind("drink", { includeArchived: true })).map(
				({ id }) => id,
			),
		).toEqual([cola.id, fork.id]);
		await expect(repository.unarchive(cola.id)).resolves.toMatchObject({
			archivedAt: null,
		});
		await expect(repository.delete(fork.id)).resolves.toBe(true);
		await expect(repository.delete(fork.id)).resolves.toBe(false);

		await expect(
			repository.create(
				userFood({ source: { type: "system", key: "drink:water" } }),
			),
		).rejects.toThrow("live in the catalogue");
		await expect(
			repository.create(userFood({ constituents: {} })),
		).rejects.toThrow("at least one constituent");
		await expect(
			repository.create(userFood({ defaultPortionId: "bowl" })),
		).rejects.toThrow("Default portion bowl is not one of the portions");
		await expect(
			repository.create(userFood({ constituents: { energy: Number.NaN } })),
		).rejects.toThrow("energy must be finite and non-negative");
	});

	it("recomputes a recipe from its ingredients and refuses a cycle", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.ConsumableRepository(db, {
			now: () => now,
			createId: () => `recipe-${++nextId}`,
		});
		const smoothie = await repository.create(
			userFood({
				kind: "drink",
				name: "Protein smoothie",
				brand: null,
				basis: { type: "portion", portionId: "serving" },
				constituents: {},
				portions: [],
				defaultPortionId: null,
				recipe: { yield: { quantity: 2, unit: "serving" } },
			}),
		);
		// An empty recipe stores the calculated (empty) composition per serving.
		expect(smoothie).toMatchObject({
			recipe: { yield: { quantity: 2, unit: "serving" } },
			constituents: {},
		});

		now = 2_000;
		const milk = await repository.addIngredient(smoothie.id, {
			position: 0,
			consumableId: null,
			sourceRef: "off:milk",
			name: "Milk",
			portionLabel: "250 ml",
			quantity: 1,
			massKg: 0.258,
			volumeL: 0.25,
			constituents: { energy: 115, protein: 0.0085, calcium: 0.0003 },
		});
		const whey = await repository.addIngredient(smoothie.id, {
			position: 1,
			consumableId: null,
			sourceRef: null,
			name: "Whey",
			portionLabel: "scoop",
			quantity: 1,
			massKg: 0.03,
			volumeL: null,
			constituents: { energy: 120, protein: 0.024, creatine: 0.005 },
		});
		expect(await repository.findById(smoothie.id)).toMatchObject({
			basis: { type: "portion", portionId: "serving" },
			constituents: {
				energy: 117.5,
				protein: 0.016_25,
				calcium: 0.000_15,
				creatine: 0.0025,
			},
			portions: [
				{
					id: "serving",
					label: "serving",
					massKg: expect.closeTo(0.144, 12),
					volumeL: null,
					basisUnits: 1,
				},
			],
			defaultPortionId: "serving",
			updatedAt: 2_000,
		});

		now = 3_000;
		await repository.updateIngredient(whey.id, {
			position: 1,
			consumableId: null,
			sourceRef: null,
			name: "Whey",
			portionLabel: "scoop",
			quantity: 2,
			massKg: 0.06,
			volumeL: null,
			constituents: { energy: 240, protein: 0.048, creatine: 0.01 },
		});
		expect(await repository.findById(smoothie.id)).toMatchObject({
			constituents: { energy: 177.5, creatine: 0.005 },
			updatedAt: 3_000,
		});
		// Re-yielding the recipe recalculates from the same ingredients.
		now = 3_500;
		await repository.update(smoothie.id, {
			name: "Protein smoothie",
			brand: null,
			barcode: null,
			basis: smoothie.basis,
			constituents: {},
			portions: [],
			defaultPortionId: null,
			recipe: { yield: { quantity: 500, unit: "ml" } },
		});
		expect(await repository.findById(smoothie.id)).toMatchObject({
			basis: { type: "volume", volumeL: 0.1 },
			constituents: { energy: 71, creatine: 0.002 },
			portions: [],
			defaultPortionId: null,
		});

		await expect(repository.deleteIngredient(milk.id)).resolves.toBe(true);
		expect(await repository.findById(smoothie.id)).toMatchObject({
			constituents: {
				energy: 48,
				protein: expect.closeTo(0.0096, 12),
				creatine: 0.002,
			},
		});
		expect(
			(await repository.listIngredients(smoothie.id)).map(({ id }) => id),
		).toEqual([whey.id]);

		// A recipe inside a recipe is fine; a recipe inside itself is not.
		const martini = await repository.create(
			userFood({
				kind: "drink",
				name: "Espresso martini",
				brand: null,
				basis: { type: "portion", portionId: "glass" },
				constituents: {},
				portions: [],
				defaultPortionId: null,
				recipe: { yield: { quantity: 1, unit: "glass" } },
			}),
		);
		await repository.addIngredient(martini.id, {
			position: 0,
			consumableId: smoothie.id,
			sourceRef: `library:${smoothie.id}`,
			name: "Protein smoothie",
			portionLabel: "100 ml",
			quantity: 1,
			massKg: null,
			volumeL: 0.1,
			constituents: { energy: 48 },
		});
		await expect(
			repository.addIngredient(smoothie.id, {
				position: 5,
				consumableId: martini.id,
				sourceRef: `library:${martini.id}`,
				name: "Espresso martini",
				portionLabel: "glass",
				quantity: 1,
				massKg: null,
				volumeL: null,
				constituents: { energy: 48 },
			}),
		).rejects.toThrow("A recipe cannot contain itself.");
		await expect(
			repository.replaceIngredients(martini.id, [
				{
					position: 0,
					consumableId: martini.id,
					sourceRef: null,
					name: "Espresso martini",
					portionLabel: null,
					quantity: 1,
					massKg: null,
					volumeL: null,
					constituents: { energy: 1 },
				},
			]),
		).rejects.toThrow("A recipe cannot contain itself.");
		await expect(
			repository.update(smoothie.id, {
				name: "Protein smoothie",
				brand: null,
				barcode: null,
				basis: { type: "volume", volumeL: 0.1 },
				constituents: { energy: 48 },
				portions: [],
				defaultPortionId: null,
				recipe: null,
			}),
		).rejects.toThrow("Remove a recipe's ingredients");
		const yoghurt = await repository.create(userFood());
		await expect(
			repository.addIngredient(yoghurt.id, {
				position: 0,
				consumableId: null,
				sourceRef: null,
				name: "Honey",
				portionLabel: null,
				quantity: 1,
				massKg: 0.02,
				volumeL: null,
				constituents: { energy: 60 },
			}),
		).rejects.toThrow("Only recipes can have ingredients.");

		// Deleting the recipe takes its ingredient rows with it; the martini's
		// reference dangles and its snapshot stays.
		await expect(repository.delete(smoothie.id)).resolves.toBe(true);
		await expect(repository.listIngredients(smoothie.id)).resolves.toEqual([]);
		expect(await repository.listIngredients(martini.id)).toMatchObject([
			{ consumableId: smoothie.id, constituents: { energy: 48 } },
		]);
	});

	it("switches optional intake streams on and off without touching food or drink", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.IntakeStreamRepository(db, {
			now: () => now,
			createId: () => `stream-${++nextId}`,
		});
		await expect(repository.listEnabledKinds()).resolves.toEqual([
			"food",
			"drink",
		]);
		await expect(repository.isEnabled("nicotine")).resolves.toBe(false);
		await expect(repository.isEnabled("food")).resolves.toBe(true);

		const enabled = await repository.setEnabled("nicotine", true);
		expect(enabled).toMatchObject({
			id: "stream-1",
			kind: "nicotine",
			enabledAt: 1_000,
			disabledAt: null,
		});
		await expect(repository.listEnabledKinds()).resolves.toEqual([
			"food",
			"drink",
			"nicotine",
		]);
		await expect(repository.isEnabled("nicotine")).resolves.toBe(true);

		now = 2_000;
		await expect(
			repository.setEnabled("nicotine", false),
		).resolves.toMatchObject({
			id: "stream-1",
			disabledAt: 2_000,
		});
		await expect(repository.listEnabledKinds()).resolves.toEqual([
			"food",
			"drink",
		]);

		now = 3_000;
		// Switching back on reuses the row rather than minting a second one.
		await expect(
			repository.setEnabled("nicotine", true),
		).resolves.toMatchObject({
			id: "stream-1",
			enabledAt: 3_000,
			disabledAt: null,
		});
		await repository.setEnabled("supplement", true);
		expect((await repository.listAll()).map(({ kind }) => kind)).toEqual([
			"nicotine",
			"supplement",
		]);
		await expect(repository.setEnabled("food", false)).rejects.toThrow(
			"Only optional intake streams can be switched",
		);
	});

	it("keeps a day's notes in the order they were written", async () => {
		let now = 1_000;
		let nextId = 0;
		const repository = new databaseApp.DayNoteRepository(db, {
			now: () => now,
			createId: () => {
				nextId += 1;
				return `note-${nextId}`;
			},
		});
		const first = await repository.create("2026-08-14", "First");

		now = 2_000;
		const second = await repository.create("2026-08-14", "Second");
		expect(await repository.listByDay("2026-08-14")).toEqual([first, second]);

		now = 3_000;
		const edited = await repository.update(first.id, "Edited");
		expect(edited).toMatchObject({
			id: first.id,
			createdAt: 1_000,
			updatedAt: 3_000,
			body: "Edited",
		});

		await expect(repository.delete(second.id)).resolves.toBe(true);
		expect(await repository.listByDay("2026-08-14")).toEqual([edited]);
	});

	it("windows recent days whole, and says when older ones remain", async () => {
		let nextId = 0;
		const repository = new databaseApp.DayNoteRepository(db, {
			now: () => 1_000,
			createId: () => {
				nextId += 1;
				return `windowed-${nextId}`;
			},
		});
		for (const localDay of ["2026-07-01", "2026-07-02", "2026-07-03"]) {
			await repository.create(localDay, `${localDay} first`);
			await repository.create(localDay, `${localDay} second`);
		}

		const page = await repository.listRecentDays(2);
		// Two days, both of them whole — a day is never split across a window.
		expect(page.hasMore).toBe(true);
		expect(page.notes.map((note) => note.body)).toEqual([
			"2026-07-03 first",
			"2026-07-03 second",
			"2026-07-02 first",
			"2026-07-02 second",
		]);

		const all = await repository.listRecentDays(30);
		expect(all.hasMore).toBe(false);
		expect(all.notes).toHaveLength(6);

		await expect(repository.listRecentDays(0)).rejects.toThrow(RangeError);
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
			createId: () => "tracked-training",
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
		// Derived from the defaults rather than a hand-kept list: this asserts the
		// repository materialises what the registry declares, and does not need
		// editing every time an opt-in metric joins it.
		const disabledByDefault = new Set(
			DEFAULT_TRACKED_METRICS.filter(
				(metric) => "enabled" in metric && metric.enabled === false,
			).map((metric) => metric.metricSlug),
		);
		expect(
			initial
				.filter(({ metricSlug }) => !disabledByDefault.has(metricSlug))
				.every((metric) => metric.enabled),
		).toBe(true);
		expect(
			initial
				.filter(({ metricSlug }) => disabledByDefault.has(metricSlug))
				.every((metric) => !metric.enabled),
		).toBe(true);
		expect(await repository.listAll()).toEqual([]);

		const training = initial.find((metric) => metric.metricSlug === "training");
		expect(training).toBeDefined();
		now = 2_000;
		await repository.configure("training", training?.position ?? 0, false);

		await databaseApp.closeDb();
		await openDatabase();
		const relaunched = new databaseApp.TrackedMetricsRepository(db);
		const resolved = await relaunched.listResolved(DEFAULT_TRACKED_METRICS);
		expect(
			resolved.find((metric) => metric.metricSlug === "training"),
		).toMatchObject({
			enabled: false,
			overlayId: "tracked-training",
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

	it("overrides and clears which sittings ask a scored prompt", async () => {
		let now = 1_000;
		const repository = new databaseApp.TrackedMetricsRepository(db, {
			now: () => now,
			createId: () => "tracked-libido",
		});

		// The first write materialises the overlay; the metric stays enabled and
		// keeps the position it was given.
		await expect(
			repository.setCheckInSlots("libido", "morning", { position: 4 }),
		).resolves.toMatchObject({
			metricSlug: "libido",
			position: 4,
			removedAt: null,
			checkInSlots: "morning",
		});

		now = 2_000;
		await repository.configure("libido", 9, false);
		expect(
			(
				await repository.listResolved([{ metricSlug: "libido", position: 4 }])
			)[0],
		).toMatchObject({
			position: 9,
			enabled: false,
			// Disabling a prompt must not forget where the user had put it.
			checkInSlots: "morning",
		});

		now = 3_000;
		await expect(
			repository.setCheckInSlots("libido", null, { position: 4 }),
		).resolves.toMatchObject({
			position: 9,
			removedAt: 2_000,
			checkInSlots: null,
			updatedAt: 3_000,
		});
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
					slot: null,
				}),
				observation({
					metricSlug: "wheel:health",
					value: 8,
					scaleMin: 1,
					scaleMax: 10,
					slot: null,
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
						slot: null,
					}),
					observation({
						metricSlug: "wheel:health",
						value: 11,
						scaleMin: 1,
						scaleMax: 10,
						slot: null,
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
			slot: "evening",
		});
		expect(await repository.listAll()).toEqual([created]);

		now = 2_000;
		await expect(
			repository.update(created.id, {
				minuteOfDay: 8 * 60 + 30,
				daysOfWeek: 0b001_1111,
				slot: "morning",
			}),
		).resolves.toMatchObject({
			id: "reminder-1",
			minuteOfDay: 510,
			daysOfWeek: 0b001_1111,
			slot: "morning",
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
