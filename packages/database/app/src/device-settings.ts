import { openDatabaseSync } from "expo-sqlite";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import {
	createDeviceSettings,
	DEVICE_SETTINGS_DATABASE_NAME,
} from "./device-settings-store";

export {
	DEVICE_SETTINGS_DATABASE_NAME,
	type DeviceSettingsSnapshot,
} from "./device-settings-store";

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

const settings = createDeviceSettings({
	getItem: (key) => getStore().getItemSync(key),
	setItem: (key, value) => getStore().setItemSync(key, value),
	removeItem: (key) => getStore().removeItemSync(key),
	createUuid,
	close: () => {
		store?.closeSync();
		store = undefined;
	},
});

export const {
	readDeviceSettings,
	setOnboardingComplete,
	setAppLock,
	setRemoteSessionMarker,
	closeDeviceSettings,
} = settings;
