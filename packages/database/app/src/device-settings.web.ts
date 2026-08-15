export const DEVICE_SETTINGS_DATABASE_NAME = "bro-device.db";

/**
 * Browser equivalent of the native device-settings database. These values stay
 * outside the product database and are never candidates for replication.
 */
export type DeviceSettingsSnapshot = {
	installationId: string;
	onboardingComplete: boolean;
	appLockEnabled: boolean;
	appLockTimeoutSeconds: number | null;
	hasStoredRemoteSession: boolean;
	lastRemoteUserId: string | null;
};

type BrowserStorage = {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
};

type BrowserCrypto = {
	getRandomValues: (bytes: Uint8Array) => Uint8Array;
};

const KEYS = {
	schemaVersion: "schemaVersion",
	installationId: "installationId",
	onboardingComplete: "onboardingComplete",
	appLockEnabled: "appLockEnabled",
	appLockTimeoutSeconds: "appLockTimeoutSeconds",
	hasStoredRemoteSession: "hasStoredRemoteSession",
	lastRemoteUserId: "lastRemoteUserId",
} as const;

const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = `${DEVICE_SETTINGS_DATABASE_NAME}:`;

function getStorage(): BrowserStorage {
	const storage = (
		globalThis as typeof globalThis & { localStorage?: BrowserStorage }
	).localStorage;

	if (!storage) {
		throw new Error("Browser storage is unavailable.");
	}

	return storage;
}

function getItem(key: string): string | null {
	return getStorage().getItem(`${STORAGE_PREFIX}${key}`);
}

function setItem(key: string, value: string): void {
	getStorage().setItem(`${STORAGE_PREFIX}${key}`, value);
}

function removeItem(key: string): void {
	getStorage().removeItem(`${STORAGE_PREFIX}${key}`);
}

function createUuid(): string {
	const crypto = (
		globalThis as typeof globalThis & { crypto?: BrowserCrypto }
	).crypto;

	if (!crypto) {
		throw new Error("Secure browser randomness is unavailable.");
	}

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function readBoolean(key: string): boolean {
	return getItem(key) === "true";
}

function readInteger(key: string): number | null {
	const raw = getItem(key);
	if (raw === null) {
		return null;
	}

	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export function readDeviceSettings(): DeviceSettingsSnapshot {
	const storedVersion = readInteger(KEYS.schemaVersion);

	if (storedVersion !== null && storedVersion > SCHEMA_VERSION) {
		throw new Error(
			"Device settings were created by a newer version of the app.",
		);
	}

	let installationId = getItem(KEYS.installationId);

	if (installationId === null) {
		installationId = createUuid();
		setItem(KEYS.installationId, installationId);
		setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
	}

	return {
		installationId,
		onboardingComplete: readBoolean(KEYS.onboardingComplete),
		appLockEnabled: readBoolean(KEYS.appLockEnabled),
		appLockTimeoutSeconds: readInteger(KEYS.appLockTimeoutSeconds),
		hasStoredRemoteSession: readBoolean(KEYS.hasStoredRemoteSession),
		lastRemoteUserId: getItem(KEYS.lastRemoteUserId),
	};
}

export function setOnboardingComplete(complete: boolean): void {
	setItem(KEYS.onboardingComplete, String(complete));
}

export function setAppLock(
	enabled: boolean,
	timeoutSeconds: number | null,
): void {
	setItem(KEYS.appLockEnabled, String(enabled));

	if (timeoutSeconds === null) {
		removeItem(KEYS.appLockTimeoutSeconds);
		return;
	}

	setItem(KEYS.appLockTimeoutSeconds, String(timeoutSeconds));
}

export function setRemoteSessionMarker(
	hasStoredRemoteSession: boolean,
	lastRemoteUserId: string | null,
): void {
	setItem(KEYS.hasStoredRemoteSession, String(hasStoredRemoteSession));

	if (lastRemoteUserId === null) {
		removeItem(KEYS.lastRemoteUserId);
		return;
	}

	setItem(KEYS.lastRemoteUserId, lastRemoteUserId);
}

/** Browser localStorage has no open handle to release between retries. */
export function closeDeviceSettings(): void {}
