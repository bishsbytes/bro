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

		await expect(initDb("workspace.db")).rejects.toThrow("disk unavailable");
		await expect(initDb("workspace.db")).resolves.toBe(db);
		expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
	});

	it("refuses a concurrent open of a different workspace", async () => {
		const db = { closeAsync: jest.fn() };
		mockOpenDatabaseAsync.mockResolvedValue(db);
		let initDb = null as unknown as typeof DatabaseApp.initDb;
		jest.isolateModules(() => {
			({ initDb } = jest.requireActual("@bro/database-app"));
		});

		// Both calls are in flight, so neither has set the resolved handle yet.
		const first = initDb("workspace-a.db");
		await expect(initDb("workspace-b.db")).rejects.toThrow(
			'Database "workspace-a.db" is already open',
		);
		await expect(first).resolves.toBe(db);
		expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
	});
});
