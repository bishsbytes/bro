import type * as DatabaseApp from "@bro/database-app";
import type { ExternalConsumable } from "@bro/domain/food-search";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "./test-support/node-sqlite";

const mockSqlite = createNodeSqliteMock();
let mockRandomSeed = 0;
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomSeed += 1;
		bytes[length - 1] = mockRandomSeed;
		return bytes;
	}),
}));

const { IntakeStore } = jest.requireActual(
	"./intake/intake-store",
) as typeof import("./intake/intake-store");
const { IntakeSettingsStore } = jest.requireActual(
	"./intake/intake-settings-store",
) as typeof import("./intake/intake-settings-store");

const chicken: ExternalConsumable = {
	ref: "off:12345678",
	name: "Chicken thighs",
	brand: "Example",
	barcode: "12345678",
	kind: "food",
	basis: { type: "mass", massKg: 0.1 },
	constituents: { energy: 210, protein: 0.026, carbohydrate: 0 },
	portions: [
		{
			id: "serving",
			label: "120 g",
			massKg: 0.12,
			volumeL: null,
			basisUnits: null,
		},
		{
			id: "100g",
			label: "100 g",
			massKg: 0.1,
			volumeL: null,
			basisUnits: null,
		},
	],
	defaultPortionId: "serving",
	source: "Open Food Facts",
	licence: "ODbL-1.0",
};

describe("intake store", () => {
	let now = new Date("2026-09-02T19:30:00.000Z");
	let store: InstanceType<typeof IntakeStore>;
	let settings: InstanceType<typeof IntakeSettingsStore>;

	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		now = new Date("2026-09-02T19:30:00.000Z");
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("intake-store.db");
		await databaseApp.runMigrations(db);
		store = new IntakeStore(
			db,
			() => now,
			() => "en-GB",
		);
		settings = new IntakeSettingsStore(db, () => "en-GB");
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("logs a catalogue drink as one snapshotted event and totals what is tracked", async () => {
		await settings.setTracked("energy_intake", true);
		await settings.setTracked("ethanol_intake", true);

		const event = await store.log(
			{ type: "system", key: "drink:lager-4_5" },
			{ type: "portion", portionId: "pint-uk", quantity: 2 },
			{ localDay: "2026-09-02", time: "19:00" },
			"drink",
		);
		expect(event).toMatchObject({
			kind: "drink",
			consumableId: null,
			sourceRef: "system:drink:lager-4_5",
			name: "Lager, 4.5%",
			portionLabel: "pint",
			quantity: 2,
			context: "drink",
			localDay: "2026-09-02",
		});
		expect(event.volumeL).toBeCloseTo(1.136_522_5, 12);
		expect(event.constituents.fluid).toBeCloseTo(1.136_522_5, 12);
		expect(event.constituents.ethanol).toBeCloseTo(0.040_364_5, 6);
		expect(event.constituents.energy).toBeCloseTo(488.7, 1);

		const day = await store.loadToday();
		expect(day.totals.map(({ metric }) => metric.slug)).toEqual([
			"energy_intake",
			"ethanol_intake",
		]);
		expect(day.totals.map(({ dayFormatted }) => dayFormatted)).toEqual([
			"489 kcal",
			"5.1 units",
		]);
		expect(day.events).toHaveLength(1);
		expect(day.events[0]).toMatchObject({
			detail: "2 × pint · 19:00",
			contributions: "489 kcal · 5.1 units",
		});
		// A total nothing tracks does not appear; nothing writes an observation.
		expect(
			day.metrics.find(({ metric }) => metric.slug === "caffeine_intake"),
		).toMatchObject({ tracked: false, dayValue: 0 });
		expect(await new databaseApp.ObservationRepository(db).listAll()).toEqual(
			[],
		);
	});

	it("refuses an optional stream that is off and logs it once switched on", async () => {
		const log = () =>
			store.log(
				{ type: "system", key: "nicotine:cigarette" },
				{ type: "portion", portionId: "half", quantity: 1 },
				{ localDay: "2026-09-02", time: "11:45" },
			);
		await expect(log()).rejects.toThrow(
			"Turn on Smoking & vaping in intake settings before logging it.",
		);
		await settings.setStreamEnabled("nicotine", true);
		const half = await log();
		expect(half.kind).toBe("nicotine");
		expect(half.constituents.nicotine).toBeCloseTo(0.6e-6, 15);
		expect(half.volumeL).toBeNull();

		const day = await store.loadToday();
		expect(day.enabledKinds).toEqual(["food", "drink", "nicotine"]);
		expect(day.events.map(({ event }) => event.name)).toEqual(["Cigarette"]);
		// Switched off again, the day shows what a never-opted-in user sees;
		// the event stays stored.
		await settings.setStreamEnabled("nicotine", false);
		expect((await store.loadToday()).events).toEqual([]);
		expect(
			await new databaseApp.IntakeEventRepository(db).listAll(),
		).toHaveLength(1);
	});

	it("saves a searched food to the library once and logs against it", async () => {
		const first = await store.log(
			{ type: "external", consumable: chicken },
			{ type: "portion", portionId: "serving", quantity: 1 },
			{ localDay: "2026-09-02", time: "13:00" },
			"lunch",
		);
		const second = await store.log(
			{ type: "external", consumable: chicken },
			{ type: "mass", massKg: 0.2 },
			{ localDay: "2026-09-02", time: "19:00" },
		);
		const library = await new databaseApp.ConsumableRepository(db).listByKind(
			"food",
		);
		expect(library).toHaveLength(1);
		expect(library[0]).toMatchObject({
			name: "Chicken thighs",
			barcode: "12345678",
			source: { type: "provider", provider: "off", externalId: "12345678" },
		});
		expect(first).toMatchObject({
			consumableId: library[0]?.id,
			sourceRef: "off:12345678",
			portionLabel: "120 g",
			massKg: 0.12,
			context: "lunch",
		});
		expect(first.constituents.energy).toBeCloseTo(252, 9);
		expect(first.constituents.protein).toBeCloseTo(0.0312, 12);
		expect(second).toMatchObject({
			portionLabel: null,
			quantity: 1,
			massKg: 0.2,
		});
		expect(second.constituents.energy).toBeCloseTo(420, 9);
		// The provider's own portions are what the log screen offers.
		expect((await store.loadLog()).library.map(({ name }) => name)).toEqual([
			"Chicken thighs",
		]);
	});

	it("repeats, rescales on edit, and hard-deletes", async () => {
		await settings.setTracked("energy_intake", true);
		const original = await store.log(
			{ type: "system", key: "drink:filter-coffee" },
			{ type: "portion", portionId: "mug-250ml", quantity: 1 },
			{ localDay: "2026-09-01", time: "07:40" },
		);
		const repeated = await store.repeatEvent(original.id);
		expect(repeated).toMatchObject({
			name: original.name,
			constituents: original.constituents,
			localDay: "2026-09-02",
		});

		const edited = await store.updateEvent(repeated.id, {
			name: "Filter coffee",
			portionLabel: "half mug",
			quantity: 0.5,
			localDay: "2026-09-02",
			time: "08:00",
		});
		expect(edited.constituents.caffeine).toBeCloseTo(
			(original.constituents.caffeine ?? 0) / 2,
			15,
		);
		expect(edited.volumeL).toBeCloseTo(0.125, 12);
		expect(edited.quantity).toBe(0.5);

		const day = await store.loadDay("2026-09-02");
		expect(day.dayLabel).toBe("Today");
		expect(day.dayDate).toBe("Wednesday 2 September");
		expect((await store.loadLog()).recents).toHaveLength(2);

		// A recent logged again at another quantity is the same thing, scaled.
		const doubled = await store.repeatEvent(
			original.id,
			{ localDay: "2026-09-02", time: "09:00" },
			2,
		);
		expect(doubled.quantity).toBe(2);
		expect(doubled.volumeL).toBeCloseTo(0.5, 12);
		expect(doubled.constituents.caffeine).toBeCloseTo(
			(original.constituents.caffeine ?? 0) * 2,
			15,
		);
		await store.deleteEvent(doubled.id);
		await store.deleteEvent(edited.id);
		expect((await store.loadDay("2026-09-02")).events).toEqual([]);
		await expect(store.deleteEvent(edited.id)).rejects.toThrow(
			"Entry not found.",
		);
	});

	it("logs a free entry per portion times quantity and validates it", async () => {
		const bar = await store.logFree({
			kind: "food",
			name: "Oat bar",
			portionLabel: "bar",
			quantity: 2,
			constituents: { energy: 210, protein: 0.004 },
			localDay: "2026-09-02",
			time: "10:30",
		});
		expect(bar).toMatchObject({
			kind: "food",
			sourceRef: null,
			portionLabel: "bar",
			quantity: 2,
			constituents: { energy: 420, protein: 0.008 },
			context: null,
		});
		await expect(
			store.logFree({
				kind: "food",
				name: " ",
				portionLabel: null,
				quantity: 1,
				constituents: { energy: 1 },
				localDay: "2026-09-02",
				time: "10:30",
			}),
		).rejects.toThrow("Give it a name.");
		await expect(
			store.logFree({
				kind: "food",
				name: "Nothing",
				portionLabel: null,
				quantity: 1,
				constituents: {},
				localDay: "2026-09-02",
				time: "10:30",
			}),
		).rejects.toThrow("Enter at least one value.");
		await expect(
			store.logFree({
				kind: "supplement",
				name: "Creatine",
				portionLabel: "scoop",
				quantity: 1,
				constituents: { creatine: 0.005 },
				localDay: "2026-09-02",
				time: "10:30",
			}),
		).rejects.toThrow("Turn on Supplements in intake settings");
	});

	it("opens a goal in the unit being read and reports its progress", async () => {
		await settings.setTracked("energy_intake", true);
		await store.log(
			{ type: "system", key: "drink:cola" },
			{ type: "portion", portionId: "can-330ml", quantity: 1 },
			{ localDay: "2026-09-02", time: "15:00" },
		);
		await expect(
			store.createGoal("energy_intake", "abc", null),
		).rejects.toThrow("Enter a valid measurement.");
		const goal = await store.createGoal("energy_intake", "2000", null);
		expect(goal).toMatchObject({
			metricSlug: "energy_intake",
			direction: "increase",
			targetValue: 2000,
		});
		await expect(
			store.createGoal("energy_intake", "1800", null),
		).rejects.toThrow("Remove the active heading before creating another.");
		await expect(store.createGoal("thc_intake", "1", null)).rejects.toThrow(
			"Unknown total: thc_intake",
		);
		const energy = (await store.loadToday()).totals.find(
			({ metric }) => metric.slug === "energy_intake",
		);
		expect(energy?.goals[0]).toMatchObject({
			status: "active",
			targetFormatted: "2,000 kcal",
			targetReached: false,
		});
		await expect(store.achieveGoal(goal.id)).resolves.toMatchObject({
			achievedAt: expect.any(Number),
		});
	});
	it("groups the same thing at one sitting into one row and states what it added", async () => {
		await settings.setTracked("energy_intake", true);
		await settings.setTracked("ethanol_intake", true);
		const pint = (time: string) =>
			store.log(
				{ type: "system", key: "drink:lager-4_5" },
				{ type: "portion", portionId: "pint-uk", quantity: 1 },
				{ localDay: "2026-09-02", time },
			);
		await pint("18:17");
		await store.log(
			{ type: "system", key: "drink:filter-coffee" },
			{ type: "portion", portionId: "mug-250ml", quantity: 1 },
			{ localDay: "2026-09-02", time: "07:40" },
		);
		await pint("18:40");
		// The same pint hours later is another sitting.
		await pint("22:30");

		const day = await store.loadToday();
		expect(day.events).toHaveLength(4);
		expect(
			day.entries.map(({ time, name, meta, value }) => ({
				time,
				name,
				meta,
				value,
			})),
		).toEqual([
			{
				time: "07:40",
				name: "Filter coffee",
				meta: expect.stringMatching(/^1 × /),
				value: "3 kcal",
			},
			{
				time: "18:17",
				name: "Lager, 4.5%",
				meta: "2 × pint",
				value: "489 kcal · 5.1 units",
			},
			{
				time: "22:30",
				name: "Lager, 4.5%",
				meta: "1 × pint",
				value: "244 kcal · 2.6 units",
			},
		]);
		expect(day.entries[1]?.events.map(({ event }) => event.quantity)).toEqual([
			1, 1,
		]);
		expect(day.entries[1]?.accessibilityLabel).toBe(
			"Lager, 4.5%, 2 × pint, 489 kcal · 5.1 units, at 18:17",
		);
	});

	it("ranks recents by how close their time of day is to now", async () => {
		await store.log(
			{ type: "system", key: "drink:filter-coffee" },
			{ type: "portion", portionId: "mug-250ml", quantity: 1 },
			{ localDay: "2026-09-01", time: "07:40" },
		);
		await store.log(
			{ type: "system", key: "drink:cola" },
			{ type: "portion", portionId: "can-330ml", quantity: 1 },
			{ localDay: "2026-09-01", time: "13:00" },
		);
		await store.log(
			{ type: "system", key: "drink:lager-4_5" },
			{ type: "portion", portionId: "pint-uk", quantity: 1 },
			{ localDay: "2026-09-01", time: "18:17" },
		);

		now = new Date(2026, 8, 2, 19, 30);
		expect(
			(await store.loadLog()).recents.map(({ event }) => event.name),
		).toEqual(["Lager, 4.5%", "Cola", "Filter coffee"]);
		now = new Date(2026, 8, 2, 8, 0);
		expect(
			(await store.loadLog()).recents.map(({ event }) => event.name),
		).toEqual(["Filter coffee", "Cola", "Lager, 4.5%"]);
	});

	it("states a usual range after fourteen logged days, and both modes for a total that is zero most days", async () => {
		await settings.setTracked("energy_intake", true);
		await settings.setTracked("ethanol_intake", true);
		const days = Array.from({ length: 14 }, (_, index) =>
			databaseApp === undefined
				? ""
				: new Date(Date.UTC(2026, 7, 20 + index)).toISOString().slice(0, 10),
		);
		const drinkingDays = new Set([days[1], days[4], days[8], days[12]]);
		for (const localDay of days.slice(0, 13)) {
			await store.log(
				{ type: "system", key: "drink:cola" },
				{ type: "portion", portionId: "can-330ml", quantity: 1 },
				{ localDay, time: "12:00" },
			);
			if (drinkingDays.has(localDay)) {
				await store.log(
					{ type: "system", key: "drink:lager-4_5" },
					{ type: "portion", portionId: "pint-uk", quantity: 1 },
					{ localDay, time: "19:00" },
				);
			}
		}

		// Thirteen logged days: the number alone, no band, no guess.
		let energy = (await store.loadToday()).totals.find(
			({ metric }) => metric.slug === "energy_intake",
		);
		expect(energy).toMatchObject({
			dayValue: null,
			dayValueParts: null,
			gauge: null,
			read: null,
			meta: "so far today",
			domain: "body",
		});

		await store.log(
			{ type: "system", key: "drink:cola" },
			{ type: "portion", portionId: "can-330ml", quantity: 1 },
			{ localDay: "2026-09-02", time: "12:00" },
		);
		const day = await store.loadToday();
		energy = day.totals.find(({ metric }) => metric.slug === "energy_intake");
		expect(energy?.dayValueParts).toEqual({ value: "139", unit: "kcal" });
		expect(energy?.read).toMatch(
			/^Your days usually land between \d+ and \d+\.$/,
		);
		expect(energy?.gauge?.band.min).toBeCloseTo(138.6, 6);
		// The rail ends on a round number past the band: 322 × 1.15 rounds up to 400.
		expect(energy?.gauge?.rail).toEqual({ min: 0, max: 400 });
		expect(energy?.gauge?.railLabels).toEqual({ min: "0", max: "400" });

		// Alcohol on four of fourteen days: the read names both modes and, with
		// too few drinking days for a band, draws nothing. Today's cola carries
		// alcohol as a measured zero, which is a fact about the can, not a gap.
		const alcohol = day.totals.find(
			({ metric }) => metric.slug === "ethanol_intake",
		);
		expect(alcohol).toMatchObject({
			domain: "load",
			dayValue: 0,
			gauge: null,
			read: "Most of your days: none.",
		});

		// Exactly half the logged days carrying alcohol is not "most days none".
		// Add three carrying days to the four above, preserving fourteen logged days.
		for (const localDay of [days[0], days[2], days[3]]) {
			await store.log(
				{ type: "system", key: "drink:lager-4_5" },
				{ type: "portion", portionId: "pint-uk", quantity: 1 },
				{ localDay, time: "19:00" },
			);
		}
		const evenlySplitAlcohol = (await store.loadToday()).totals.find(
			({ metric }) => metric.slug === "ethanol_intake",
		);
		expect(evenlySplitAlcohol?.read).not.toBe("Most of your days: none.");
		expect(evenlySplitAlcohol?.read).toMatch(
			/^Your days usually land between /,
		);
	});
});
