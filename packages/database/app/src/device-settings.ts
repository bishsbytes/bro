import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { DATABASE_NAME } from "./connection";

export const DEVICE_SETTINGS_DATABASE_NAME = "bro-device.db";

export type WorkspaceIdentity = {
	workspaceId: string;
	databaseFileName: string;
	ownerUserId: string | null;
};

export type DeviceSettingsSnapshot = {
	installationId: string;
	onboardingComplete: boolean;
	appLockEnabled: boolean;
	appLockTimeoutSeconds: number | null;
	hasStoredRemoteSession: boolean;
	lastRemoteUserId: string | null;
	activeWorkspace: WorkspaceIdentity;
};

type SettingsRow = {
	installation_id: string;
	onboarding_complete: number;
	app_lock_enabled: number;
	app_lock_timeout_seconds: number | null;
	has_stored_remote_session: number;
	last_remote_user_id: string | null;
	active_workspace_id: string;
};

type WorkspaceRow = {
	workspace_id: string;
	database_file_name: string;
	owner_user_id: string | null;
};

let database: SQLiteDatabase | undefined;
let opening: Promise<SQLiteDatabase> | undefined;

async function createUuid(db: SQLiteDatabase): Promise<string> {
	const row = await db.getFirstAsync<{ value: string }>(`
		SELECT
			lower(hex(randomblob(4))) || '-' ||
			lower(hex(randomblob(2))) || '-4' ||
			substr(lower(hex(randomblob(2))), 2) || '-8' ||
			substr(lower(hex(randomblob(2))), 2) || '-' ||
			lower(hex(randomblob(6))) AS value
	`);

	if (!row) {
		throw new Error("Could not generate device identity.");
	}

	return row.value;
}

async function migrate(db: SQLiteDatabase): Promise<void> {
	const version = await db.getFirstAsync<{ user_version: number }>(
		"PRAGMA user_version",
	);

	if ((version?.user_version ?? 0) > 1) {
		throw new Error(
			"Device settings were created by a newer version of the app.",
		);
	}

	if ((version?.user_version ?? 0) < 1) {
		await db.execAsync(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS device_settings (
			id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
			installation_id TEXT NOT NULL,
			onboarding_complete INTEGER NOT NULL DEFAULT 0,
			app_lock_enabled INTEGER NOT NULL DEFAULT 0,
			app_lock_timeout_seconds INTEGER,
			has_stored_remote_session INTEGER NOT NULL DEFAULT 0,
			last_remote_user_id TEXT,
			active_workspace_id TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS local_workspaces (
			workspace_id TEXT PRIMARY KEY NOT NULL,
			database_file_name TEXT NOT NULL UNIQUE,
			owner_user_id TEXT
		);
		PRAGMA user_version = 1;
	`);
	}

	const existing = await db.getFirstAsync<{ id: number }>(
		"SELECT id FROM device_settings WHERE id = 1",
	);

	if (existing) {
		return;
	}

	const installationId = await createUuid(db);
	const workspaceId = await createUuid(db);

	await db.withTransactionAsync(async () => {
		await db.runAsync(
			`INSERT INTO local_workspaces (
				workspace_id,
				database_file_name,
				owner_user_id
			) VALUES (?, ?, NULL)`,
			[workspaceId, DATABASE_NAME],
		);
		await db.runAsync(
			`INSERT INTO device_settings (
				id,
				installation_id,
				active_workspace_id
			) VALUES (1, ?, ?)`,
			[installationId, workspaceId],
		);
	});
}

async function open(): Promise<SQLiteDatabase> {
	const db = await openDatabaseAsync(DEVICE_SETTINGS_DATABASE_NAME);

	try {
		await migrate(db);
		return db;
	} catch (error) {
		await db.closeAsync();
		throw error;
	}
}

export async function initDeviceSettings(): Promise<DeviceSettingsSnapshot> {
	if (!database) {
		opening ??= open()
			.then((db) => {
				database = db;
				return db;
			})
			.finally(() => {
				opening = undefined;
			});

		await opening;
	}

	return await getDeviceSettings();
}

export async function getDeviceSettings(): Promise<DeviceSettingsSnapshot> {
	if (!database) {
		throw new Error(
			"Device settings are not open. Await initDeviceSettings() during startup.",
		);
	}

	const row = await database.getFirstAsync<SettingsRow>(
		"SELECT * FROM device_settings WHERE id = 1",
	);

	if (!row) {
		throw new Error("Device settings are unavailable.");
	}

	const workspace = await database.getFirstAsync<WorkspaceRow>(
		"SELECT * FROM local_workspaces WHERE workspace_id = ?",
		[row.active_workspace_id],
	);

	if (!workspace) {
		throw new Error("The active local workspace is unavailable.");
	}

	return {
		installationId: row.installation_id,
		onboardingComplete: row.onboarding_complete === 1,
		appLockEnabled: row.app_lock_enabled === 1,
		appLockTimeoutSeconds: row.app_lock_timeout_seconds,
		hasStoredRemoteSession: row.has_stored_remote_session === 1,
		lastRemoteUserId: row.last_remote_user_id,
		activeWorkspace: {
			workspaceId: workspace.workspace_id,
			databaseFileName: workspace.database_file_name,
			ownerUserId: workspace.owner_user_id,
		},
	};
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
	if (!database) {
		throw new Error("Device settings are not open.");
	}

	await database.runAsync(
		"UPDATE device_settings SET onboarding_complete = ? WHERE id = 1",
		[complete ? 1 : 0],
	);
}

export async function setRemoteSessionMarker(
	hasStoredRemoteSession: boolean,
	lastRemoteUserId: string | null,
): Promise<void> {
	if (!database) {
		throw new Error("Device settings are not open.");
	}

	await database.runAsync(
		`UPDATE device_settings
		 SET has_stored_remote_session = ?, last_remote_user_id = ?
		 WHERE id = 1`,
		[hasStoredRemoteSession ? 1 : 0, lastRemoteUserId],
	);
}

export async function closeDeviceSettingsDb(): Promise<void> {
	if (!database) {
		return;
	}

	await database.closeAsync();
	database = undefined;
}
