import { openDatabaseSync } from "expo-sqlite";
import { SQLiteStorage } from "expo-sqlite/kv-store";

export const DEVICE_SETTINGS_DATABASE_NAME = "bro-device.db";

/**
 * Device-local settings. Never replicated: everything in the product database
 * (`bro.db`) syncs once a user opts in, so onboarding state and lock
 * preferences kept there would propagate to their other devices and
 * `installationId` would stop identifying an install.
 *
 * Stored as key-value rather than as a schema, because it is seven flat scalars
 * — a relational shape would be ceremony without a table to justify it.
 */
export type DeviceSettingsSnapshot = {
	/** Random UUID for this install. Meaningless elsewhere; not a credential. */
	installationId: string;
	onboardingComplete: boolean;
	appLockEnabled: boolean;
	appLockTimeoutSeconds: number | null;
	/** Lets startup skip all session work for a user who has never registered. */
	hasStoredRemoteSession: boolean;
	lastRemoteUserId: string | null;
	/**
	 * The account this device's local data belongs to, or null while unclaimed.
	 * Read at Phase 5 adoption to refuse uploading one account's data into
	 * another's remote database. It never gates opening the database: local data
	 * stays readable after sign-out, because the account is optional.
	 */
	ownerUserId: string | null;
};

const KEYS = {
	schemaVersion: "schemaVersion",
	installationId: "installationId",
	onboardingComplete: "onboardingComplete",
	appLockEnabled: "appLockEnabled",
	appLockTimeoutSeconds: "appLockTimeoutSeconds",
	hasStoredRemoteSession: "hasStoredRemoteSession",
	lastRemoteUserId: "lastRemoteUserId",
	ownerUserId: "ownerUserId",
} as const;

/** Bumped only when stored values need reshaping, which nothing yet does. */
const SCHEMA_VERSION = 1;

let store: SQLiteStorage | undefined;

function getStore(): SQLiteStorage {
	store ??= new SQLiteStorage(DEVICE_SETTINGS_DATABASE_NAME);
	return store;
}

/**
 * Uses SQLite's own RNG through an in-memory handle, so installation identity
 * needs no crypto dependency and no native module beyond the one already here.
 */
function createUuid(): string {
	const db = openDatabaseSync(":memory:");

	try {
		const row = db.getFirstSync<{ value: string }>(`
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
	} finally {
		db.closeSync();
	}
}

function readBoolean(key: string): boolean {
	return getStore().getItemSync(key) === "true";
}

function readInteger(key: string): number | null {
	const raw = getStore().getItemSync(key);
	if (raw === null) {
		return null;
	}

	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Reads device settings, creating this install's identity on first call.
 * Synchronous: the caller decides app entry from `onboardingComplete`, and that
 * decision should not wait on I/O.
 */
export function readDeviceSettings(): DeviceSettingsSnapshot {
	const kv = getStore();
	const storedVersion = readInteger(KEYS.schemaVersion);

	if (storedVersion !== null && storedVersion > SCHEMA_VERSION) {
		throw new Error(
			"Device settings were created by a newer version of the app.",
		);
	}

	let installationId = kv.getItemSync(KEYS.installationId);

	if (installationId === null) {
		installationId = createUuid();
		kv.setItemSync(KEYS.installationId, installationId);
		kv.setItemSync(KEYS.schemaVersion, String(SCHEMA_VERSION));
	}

	return {
		installationId,
		onboardingComplete: readBoolean(KEYS.onboardingComplete),
		appLockEnabled: readBoolean(KEYS.appLockEnabled),
		appLockTimeoutSeconds: readInteger(KEYS.appLockTimeoutSeconds),
		hasStoredRemoteSession: readBoolean(KEYS.hasStoredRemoteSession),
		lastRemoteUserId: kv.getItemSync(KEYS.lastRemoteUserId),
		ownerUserId: kv.getItemSync(KEYS.ownerUserId),
	};
}

export function setOnboardingComplete(complete: boolean): void {
	getStore().setItemSync(KEYS.onboardingComplete, String(complete));
}

export function setAppLock(
	enabled: boolean,
	timeoutSeconds: number | null,
): void {
	const kv = getStore();
	kv.setItemSync(KEYS.appLockEnabled, String(enabled));

	if (timeoutSeconds === null) {
		kv.removeItemSync(KEYS.appLockTimeoutSeconds);
		return;
	}

	kv.setItemSync(KEYS.appLockTimeoutSeconds, String(timeoutSeconds));
}

export function setRemoteSessionMarker(
	hasStoredRemoteSession: boolean,
	lastRemoteUserId: string | null,
): void {
	const kv = getStore();
	kv.setItemSync(KEYS.hasStoredRemoteSession, String(hasStoredRemoteSession));

	if (lastRemoteUserId === null) {
		kv.removeItemSync(KEYS.lastRemoteUserId);
		return;
	}

	kv.setItemSync(KEYS.lastRemoteUserId, lastRemoteUserId);
}

/** Records which account claimed this device's local data. Set at Phase 5 adoption. */
export function setWorkspaceOwner(ownerUserId: string | null): void {
	const kv = getStore();

	if (ownerUserId === null) {
		kv.removeItemSync(KEYS.ownerUserId);
		return;
	}

	kv.setItemSync(KEYS.ownerUserId, ownerUserId);
}

/** Closes the handle so startup can retry after a storage failure. */
export function closeDeviceSettings(): void {
	store?.closeSync();
	store = undefined;
}
