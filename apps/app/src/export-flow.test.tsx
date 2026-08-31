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

	it("round-trips food data and applies the sensitive toggle", async () => {
		const observations = new databaseApp.ObservationRepository(db);
		const reminders = new databaseApp.ReminderRepository(db);
		const consumptionEntries = new databaseApp.ConsumptionEntryRepository(db);
		const customConsumables = new databaseApp.CustomConsumableRepository(db);
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
		await consumptionEntries.create({
			kind: "drink",
			catalogueRef: "drink:lager",
			label: "Lager",
			servingLabel: "pint",
			quantity: 1,
			volumeL: 0.568_261_25,
			ethanolKg: 0.020_181_999,
			caffeineKg: 0,
			energyKcal: 227,
			occurredAt: base.observedAt,
			localDay: base.localDay,
			tzOffsetMinutes: -60,
		});
		await consumptionEntries.create({
			kind: "drink",
			catalogueRef: "drink:coffee",
			label: "Coffee",
			servingLabel: "mug",
			quantity: 1,
			volumeL: 0.25,
			ethanolKg: 0,
			caffeineKg: 0.000_095,
			energyKcal: 2,
			occurredAt: base.observedAt + 1,
			localDay: base.localDay,
			tzOffsetMinutes: -60,
		});
		const recipe = await customConsumables.create(
			{
				kind: "food",
				label: "Chicken and rice",
				brand: null,
				isRecipe: true,
				servings: [
					{
						id: "bowl",
						label: "1 bowl",
						volumeL: null,
						ethanolKg: null,
						caffeineKg: null,
						energyKcal: 430,
						proteinG: 38,
						carbsG: 0,
						fatG: null,
					},
				],
			},
			[
				{
					position: 0,
					label: "Chicken thigh",
					quantity: 2,
					energyKcal: 260,
					proteinG: 38,
					carbsG: 0,
					fatG: null,
				},
			],
		);
		await consumptionEntries.create({
			kind: "food",
			catalogueRef: null,
			consumableRef: `custom:${recipe.id}`,
			label: recipe.label,
			servingLabel: "bowl",
			quantity: 1,
			volumeL: null,
			ethanolKg: null,
			caffeineKg: null,
			energyKcal: 430,
			proteinG: 38,
			carbsG: 0,
			fatG: null,
			occurredAt: base.observedAt + 2,
			localDay: base.localDay,
			tzOffsetMinutes: -60,
		});
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
		expect(
			withoutSensitive.consumptionEntries.map((entry) => entry.label),
		).toEqual(["Coffee", "Chicken and rice"]);
		expect(
			withSensitive.consumptionEntries.map((entry) => entry.label),
		).toEqual(["Lager", "Coffee", "Chicken and rice"]);
		expect(
			withoutSensitive.customConsumables.map(({ label }) => label),
		).toEqual(["Chicken and rice"]);
		expect(
			withoutSensitive.customConsumableComponents.map(({ fatG }) => fatG),
		).toEqual([null]);
		expect(
			withoutSensitive.consumptionEntries.find(
				({ label }) => label === "Chicken and rice",
			),
		).toMatchObject({ proteinG: 38, carbsG: 0, fatG: null });
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
