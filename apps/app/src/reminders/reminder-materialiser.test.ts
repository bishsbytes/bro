import type * as DatabaseApp from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { createNodeSqliteMock } from "../test-support/node-sqlite";
import type {
	NotificationPermissionStatus,
	ReminderNotificationGateway,
} from "./notification-gateway";

const mockSqlite = createNodeSqliteMock();
let databaseApp: typeof DatabaseApp;
let db: SQLiteDatabase;
let reminderMaterialiser: typeof import("./reminder-materialiser");

jest.mock("expo-sqlite", () => ({
	openDatabaseSync: mockSqlite.openDatabaseSync,
	openDatabaseAsync: mockSqlite.openDatabaseAsync,
}));
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

function createGateway(
	permission: NotificationPermissionStatus = "granted",
): ReminderNotificationGateway & {
	scheduled: Set<string>;
	schedule: jest.Mock;
	cancel: jest.Mock;
	listScheduled: jest.Mock;
} {
	const scheduled = new Set<string>();
	return {
		scheduled,
		configureChannel: jest.fn(async () => undefined),
		getPermissionStatus: jest.fn(async () => permission),
		requestPermission: jest.fn(async () => permission),
		listScheduled: jest.fn(async () =>
			[...scheduled].map((identifier) => ({ identifier })),
		),
		schedule: jest.fn(async (identifier: string) => {
			scheduled.add(identifier);
		}),
		cancel: jest.fn(async (identifier: string) => {
			scheduled.delete(identifier);
		}),
	};
}

describe("reminder notification materialisation", () => {
	beforeEach(async () => {
		mockSqlite.reset();
		jest.resetModules();
		databaseApp = jest.requireActual("@bro/database-app");
		reminderMaterialiser = jest.requireActual("./reminder-materialiser");
		db = await databaseApp.initDb("reminder-materialiser.db");
		await databaseApp.runMigrations(db);
	});

	afterEach(async () => {
		await databaseApp.closeDb();
	});

	afterAll(() => {
		mockSqlite.cleanup();
	});

	it("is idempotent and cancels today's occurrence after a check-in", async () => {
		const gateway = createGateway();
		const reminders = new databaseApp.ReminderRepository(db, {
			createId: () => "reminder-1",
		});
		await reminders.create({
			minuteOfDay: 20 * 60,
			daysOfWeek: 0b111_1111,
			slot: "evening",
		});
		const now = new Date(2026, 7, 14, 10);

		const first = await reminderMaterialiser.materialiseReminderNotifications({
			db,
			gateway,
			now,
		});
		expect(first.scheduled).toHaveLength(14);
		expect(gateway.scheduled).toContain(
			"checkin-reminder:reminder-1:2026-08-14",
		);

		gateway.schedule.mockClear();
		gateway.cancel.mockClear();
		await reminderMaterialiser.materialiseReminderNotifications({
			db,
			gateway,
			now,
		});
		expect(gateway.schedule).not.toHaveBeenCalled();
		expect(gateway.cancel).not.toHaveBeenCalled();

		// The reminder nudges for the evening, so it takes an evening sitting to
		// silence it.
		await new databaseApp.ObservationRepository(db, {
			createId: () => "observation-1",
		}).create({
			metricSlug: "mood",
			value: 4,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: now.getTime(),
			localDay: "2026-08-14",
			tzOffsetMinutes: now.getTimezoneOffset(),
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
			slot: "evening",
		});
		await new databaseApp.ObservationRepository(db, {
			createId: () => "observation-2",
		}).create({
			metricSlug: "energy",
			value: 3,
			scaleMin: 1,
			scaleMax: 5,
			observedAt: now.getTime(),
			localDay: "2026-08-14",
			tzOffsetMinutes: now.getTimezoneOffset(),
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
			slot: "evening",
		});
		const afterCheckIn =
			await reminderMaterialiser.materialiseReminderNotifications({
				db,
				gateway,
				now,
			});
		expect(afterCheckIn.cancelled).toEqual([
			"checkin-reminder:reminder-1:2026-08-14",
		]);
		expect(gateway.scheduled).toContain(
			"checkin-reminder:reminder-1:2026-08-15",
		);
	});

	it("keeps today's occurrence after a non-check-in observation", async () => {
		const gateway = createGateway();
		const reminders = new databaseApp.ReminderRepository(db, {
			createId: () => "reminder-1",
		});
		await reminders.create({
			minuteOfDay: 20 * 60,
			daysOfWeek: 0b111_1111,
			slot: "evening",
		});
		const now = new Date(2026, 7, 14, 10);
		await reminderMaterialiser.materialiseReminderNotifications({
			db,
			gateway,
			now,
		});

		await new databaseApp.ObservationRepository(db, {
			createId: () => "review-observation-1",
		}).create({
			metricSlug: "wheel:physical-health",
			value: 7,
			scaleMin: 1,
			scaleMax: 10,
			observedAt: now.getTime(),
			localDay: "2026-08-14",
			tzOffsetMinutes: now.getTimezoneOffset(),
			source: "user",
			sourceRecordId: null,
			assessmentId: null,
		});

		const afterReview =
			await reminderMaterialiser.materialiseReminderNotifications({
				db,
				gateway,
				now,
			});
		expect(afterReview.cancelled).toEqual([]);
		expect(gateway.scheduled).toContain(
			"checkin-reminder:reminder-1:2026-08-14",
		);
	});

	it("does not inspect or mutate scheduled notifications without permission", async () => {
		const gateway = createGateway("denied");
		await expect(
			reminderMaterialiser.materialiseReminderNotifications({ db, gateway }),
		).resolves.toEqual({ permission: "denied", scheduled: [], cancelled: [] });
		expect(gateway.listScheduled).not.toHaveBeenCalled();
		expect(gateway.schedule).not.toHaveBeenCalled();
		expect(gateway.cancel).not.toHaveBeenCalled();
	});

	it("cancels only check-in reminders", async () => {
		const gateway = createGateway();
		gateway.scheduled.add("checkin-reminder:one:2026-08-14");
		gateway.scheduled.add("another-domain:one");

		await expect(
			reminderMaterialiser.cancelAllReminderNotifications(gateway),
		).resolves.toEqual(["checkin-reminder:one:2026-08-14"]);
		expect(gateway.scheduled).toEqual(new Set(["another-domain:one"]));
	});
});
