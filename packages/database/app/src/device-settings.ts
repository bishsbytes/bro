import { openDatabaseSync } from "expo-sqlite";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import {
	createDeviceSettings,
	DEVICE_SETTINGS_DATABASE_NAME,
} from "./device-settings-store";

export {
	DEFAULT_ACCENT_CHROMA,
	DEFAULT_ACCENT_HUE,
	DEVICE_SETTINGS_DATABASE_NAME,
	type DeviceSettingsSnapshot,
	GRAPHITE_ACCENT_CHROMA,
	normalizeAccentHue,
	type ThemeMode,
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
	setAppearance,
	setOnboardingComplete,
	setAppLock,
	setRemoteSessionMarker,
	closeDeviceSettings,
} = settings;

/** A composer draft is install-local and never part of an account or shared export. */
export function readNoteDraft(): string | null {
	return getStore().getItemSync("noteDraft");
}
export function writeNoteDraft(value: string | null): void {
	if (value === null) getStore().removeItemSync("noteDraft");
	else getStore().setItemSync("noteDraft", value);
}

/** A check-in draft is install-local and never part of an account or shared export. */
export function readCheckInDraft(slot: "morning" | "evening"): string | null {
	return getStore().getItemSync(`checkInDraft:${slot}`);
}
export function writeCheckInDraft(
	slot: "morning" | "evening",
	value: string | null,
): void {
	if (value === null) getStore().removeItemSync(`checkInDraft:${slot}`);
	else getStore().setItemSync(`checkInDraft:${slot}`, value);
}
