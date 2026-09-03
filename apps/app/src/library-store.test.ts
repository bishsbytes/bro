import type * as DatabaseApp from "@bro/database-app";
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

const { LibraryStore } = jest.requireActual(
	"./intake/library-store",
) as typeof import("./intake/library-store");

describe("library store", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		mockRandomSeed = 0;
		databaseApp = jest.requireActual("@bro/database-app");
		db = await databaseApp.initDb("library-store.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => mockSqlite.cleanup());

	it("forks provider edits without losing their basis, portions, or richer nutrients", async () => {
		const repository = new databaseApp.ConsumableRepository(db);
		const original = await repository.create({
			kind: "food",
			name: "Provider yoghurt",
			brand: "Dairy",
			barcode: "12345678",
			basis: { type: "mass", massKg: 0.1 },
			constituents: {
				energy: 100,
				protein: 0.01,
				sugar: 0.005,
				sodium: 0.0001,
			},
			portions: [
				{
					id: "serving",
					label: "120 g pot",
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
			recipe: null,
			source: {
				type: "provider",
				provider: "off",
				externalId: "12345678",
			},
		});
		const store = new LibraryStore(db);

		const fork = await store.saveItem({
			id: original.id,
			kind: "drink",
			name: "My yoghurt",
			brand: "Dairy",
			portionLabel: "my pot",
			portionId: "serving",
			constituents: {
				energy: 120,
				protein: 0.012,
				sugar: 0.006,
				sodium: 0.00012,
			},
		});

		expect(fork.id).not.toBe(original.id);
		expect(fork).toMatchObject({
			kind: "drink",
			name: "My yoghurt",
			basis: original.basis,
			source: { type: "user" },
			forkedFrom: original.source,
			defaultPortionId: "serving",
		});
		expect(fork.constituents).toEqual(original.constituents);
		expect(fork.portions).toEqual([
			{ ...original.portions[0], label: "my pot" },
			original.portions[1],
		]);
		expect(await repository.findById(original.id)).toEqual(original);
	});

	it("updates a user item's selected kind in place", async () => {
		const store = new LibraryStore(db);
		const original = await store.saveItem({
			kind: "food",
			name: "Homemade shake",
			brand: null,
			portionLabel: "glass",
			constituents: { energy: 200 },
		});

		const updated = await store.saveItem({
			id: original.id,
			kind: "drink",
			name: original.name,
			brand: original.brand,
			portionLabel: "glass",
			portionId: "portion",
			constituents: original.constituents,
		});

		expect(updated.id).toBe(original.id);
		expect(updated.kind).toBe("drink");
		expect(updated.source).toEqual({ type: "user" });
	});
});
