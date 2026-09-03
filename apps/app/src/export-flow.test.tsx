import type * as DatabaseApp from "@bro/database-app";
import { CHECK_IN_EXPORT_FORMAT_VERSION, parseCheckInExport } from "@bro/logic";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
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

const { ExportStore } = jest.requireActual(
	"./export/export-store",
) as typeof import("./export/export-store");
const { ExportScreen } = jest.requireActual(
	"./screens/settings/export-screen",
) as typeof import("./screens/settings/export-screen");

describe("export flow", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("export-flow.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("round-trips intake data and applies the sensitive toggle", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const reminders = new databaseApp.ReminderRepository(db);
		const intakeEvents = new databaseApp.IntakeEventRepository(db);
		const consumables = new databaseApp.ConsumableRepository(db);
		const intakeStreams = new databaseApp.IntakeStreamRepository(db);
		const base = {
			observedAt: Date.parse("2026-08-18T09:00:00.000Z"),
			localDay: "2026-08-18",
			tzOffsetMinutes: -60,
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		};
		await observations.create({
			...base,
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			slot: "morning",
		});
		await observations.create({
			...base,
			metricSlug: "weight",
			value: 80,
			scaleMin: null,
			scaleMax: null,
		});
		await reminders.create({
			minuteOfDay: 20 * 60,
			daysOfWeek: 0b111_1111,
			slot: "evening",
		});
		const event = {
			consumableId: null,
			brand: null,
			quantity: 1,
			massKg: null,
			context: null,
			notes: null,
			localDay: base.localDay,
			tzOffsetMinutes: -60,
		};
		await intakeEvents.create({
			...event,
			kind: "drink",
			sourceRef: "system:drink:lager-4_5",
			name: "Lager",
			portionLabel: "pint",
			volumeL: 0.568_261_25,
			constituents: {
				fluid: 0.568_261_25,
				ethanol: 0.020_181_999,
				caffeine: 0,
				energy: 227,
			},
			occurredAt: base.observedAt,
		});
		await intakeEvents.create({
			...event,
			kind: "drink",
			sourceRef: "system:drink:filter-coffee",
			name: "Coffee",
			portionLabel: "mug",
			volumeL: 0.25,
			constituents: { fluid: 0.25, ethanol: 0, caffeine: 0.000_095, energy: 2 },
			occurredAt: base.observedAt + 1,
		});
		const recipe = await consumables.create({
			kind: "food",
			name: "Chicken and rice",
			brand: null,
			barcode: null,
			basis: { type: "portion", portionId: "serving" },
			constituents: {},
			portions: [],
			defaultPortionId: null,
			recipe: { yield: { quantity: 1, unit: "serving" } },
			source: { type: "user" },
		});
		await consumables.addIngredient(recipe.id, {
			position: 0,
			consumableId: null,
			sourceRef: "off:5000112637922",
			name: "Chicken thigh",
			portionLabel: "thigh",
			quantity: 2,
			massKg: 0.24,
			volumeL: null,
			constituents: { energy: 260, protein: 0.038, carbohydrate: 0 },
		});
		await intakeEvents.create({
			...event,
			kind: "food",
			consumableId: recipe.id,
			sourceRef: `library:${recipe.id}`,
			name: recipe.name,
			portionLabel: "serving",
			massKg: 0.24,
			volumeL: null,
			constituents: { energy: 260, protein: 0.038, carbohydrate: 0 },
			context: "dinner",
			occurredAt: base.observedAt + 2,
		});
		await intakeStreams.setEnabled("nicotine", true);
		await intakeStreams.setEnabled("supplement", true);
		const store = new ExportStore(db, "1.0.0", () => 1_787_040_000_000);

		const withoutSensitive = parseCheckInExport(await store.serialize(false));
		const withSensitive = parseCheckInExport(await store.serialize(true));
		expect(withoutSensitive.metadata.formatVersion).toBe(
			CHECK_IN_EXPORT_FORMAT_VERSION,
		);
		expect(withoutSensitive.observations.map((row) => row.metricSlug)).toEqual([
			"mood",
		]);
		expect(withSensitive.observations.map((row) => row.metricSlug)).toEqual([
			"mood",
			"weight",
		]);
		expect(withoutSensitive.reminders).toMatchObject([
			{ minuteOfDay: 20 * 60, slot: "evening" },
		]);
		expect(withSensitive.reminders).toEqual(withoutSensitive.reminders);
		expect(withoutSensitive.intakeEvents.map((event) => event.name)).toEqual([
			"Coffee",
			"Chicken and rice",
		]);
		expect(withSensitive.intakeEvents.map((event) => event.name)).toEqual([
			"Lager",
			"Coffee",
			"Chicken and rice",
		]);
		// The library and its ingredient rows travel with their recipe; the
		// stored composition is the calculated one, per serving.
		expect(withoutSensitive.consumables.map(({ name }) => name)).toEqual([
			"Chicken and rice",
		]);
		expect(withoutSensitive.consumables[0]).toMatchObject({
			recipe: { yield: { quantity: 1, unit: "serving" } },
			constituents: { energy: 260, protein: 0.038, carbohydrate: 0 },
			source: { type: "user" },
		});
		expect(
			withoutSensitive.recipeIngredients.map(({ name, sourceRef }) => [
				name,
				sourceRef,
			]),
		).toEqual([["Chicken thigh", "off:5000112637922"]]);
		expect(
			withoutSensitive.intakeEvents.find(
				({ name }) => name === "Chicken and rice",
			),
		).toMatchObject({
			constituents: { energy: 260, protein: 0.038, carbohydrate: 0 },
			context: "dinner",
			sourceRef: `library:${recipe.id}`,
		});
		// A stream being on is itself a disclosure for the sensitive kinds.
		expect(withoutSensitive.intakeStreams.map(({ kind }) => kind)).toEqual([
			"supplement",
		]);
		expect(withSensitive.intakeStreams.map(({ kind }) => kind)).toEqual([
			"nicotine",
			"supplement",
		]);
	});

	it("defaults sensitive data off and hands each generated file to the share action", async () => {
		const realStore = new ExportStore(db, "1.0.0", () => 1_787_040_000_000);
		const withoutSensitive = await realStore.serialize(false);
		const withSensitive = await realStore.serialize(true);
		const serialize = jest
			.fn()
			.mockResolvedValueOnce(withoutSensitive)
			.mockResolvedValueOnce(withSensitive);
		const share = jest.fn(async (_payload: string, _fileName: string) => ({
			message: "Export saved.",
			uri: "file://export",
		}));
		const screen = await render(
			<ExportScreen store={{ serialize }} share={share} />,
		);

		await fireEvent.press(screen.getByText("Share or save export"));
		await waitFor(() => expect(serialize).toHaveBeenCalledWith(false));
		expect(
			parseCheckInExport(share.mock.calls[0]?.[0]).metadata.formatVersion,
		).toBe(CHECK_IN_EXPORT_FORMAT_VERSION);

		await fireEvent(
			screen.getByLabelText("Include sensitive data"),
			"valueChange",
			true,
		);
		await fireEvent.press(screen.getByText("Share or save export"));
		await waitFor(() => expect(serialize).toHaveBeenLastCalledWith(true));
		expect(
			parseCheckInExport(share.mock.calls[1]?.[0]).metadata.formatVersion,
		).toBe(CHECK_IN_EXPORT_FORMAT_VERSION);
	});
});
