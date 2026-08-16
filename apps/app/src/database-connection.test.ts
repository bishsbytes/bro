import type * as DatabaseApp from "@bro/database-app";

const mockOpenDatabaseAsync = jest.fn();

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: mockOpenDatabaseAsync }));

describe("product database startup", () => {
	beforeEach(() => {
		jest.resetModules();
		mockOpenDatabaseAsync.mockReset();
	});

	it("allows a clean retry after opening fails", async () => {
		const db = { closeAsync: jest.fn() };
		mockOpenDatabaseAsync
			.mockRejectedValueOnce(new Error("disk unavailable"))
			.mockResolvedValueOnce(db);
		let initDb = null as unknown as typeof DatabaseApp.initDb;
		jest.isolateModules(() => {
			({ initDb } = jest.requireActual("@bro/database-app"));
		});

		await expect(initDb("retry.db")).rejects.toThrow("disk unavailable");
		await expect(initDb("retry.db")).resolves.toBe(db);
		expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
	});

	it("refuses a concurrent open of a different database file", async () => {
		const db = { closeAsync: jest.fn() };
		mockOpenDatabaseAsync.mockResolvedValue(db);
		let initDb = null as unknown as typeof DatabaseApp.initDb;
		jest.isolateModules(() => {
			({ initDb } = jest.requireActual("@bro/database-app"));
		});

		// Both calls are in flight, so neither has set the resolved handle yet.
		const first = initDb("first.db");
		await expect(initDb("second.db")).rejects.toThrow(
			'Database "first.db" is already open',
		);
		await expect(first).resolves.toBe(db);
		expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
	});

	it("opens the disposable local store independently from the product store", async () => {
		const productDb = { closeAsync: jest.fn() };
		const localDb = { closeAsync: jest.fn() };
		mockOpenDatabaseAsync
			.mockResolvedValueOnce(productDb)
			.mockResolvedValueOnce(localDb);
		let initDb = null as unknown as typeof DatabaseApp.initDb;
		let initLocalDb = null as unknown as typeof DatabaseApp.initLocalDb;
		jest.isolateModules(() => {
			({ initDb, initLocalDb } = jest.requireActual("@bro/database-app"));
		});

		await expect(initDb()).resolves.toBe(productDb);
		await expect(initLocalDb()).resolves.toBe(localDb);
		expect(mockOpenDatabaseAsync).toHaveBeenNthCalledWith(1, "bro.db");
		expect(mockOpenDatabaseAsync).toHaveBeenNthCalledWith(2, "bro-local.db");
	});
});
