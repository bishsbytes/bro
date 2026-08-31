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

type BrowserStorage = {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
};

type BrowserCrypto = {
	getRandomValues: (bytes: Uint8Array) => Uint8Array;
};

/** localStorage is shared with the whole origin, so these keys carry a prefix. */
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

function createUuid(): string {
	const crypto = (globalThis as typeof globalThis & { crypto?: BrowserCrypto })
		.crypto;

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

const settings = createDeviceSettings({
	getItem: (key) => getStorage().getItem(`${STORAGE_PREFIX}${key}`),
	setItem: (key, value) =>
		getStorage().setItem(`${STORAGE_PREFIX}${key}`, value),
	removeItem: (key) => getStorage().removeItem(`${STORAGE_PREFIX}${key}`),
	createUuid,
	/** Browser localStorage has no open handle to release between retries. */
	close: () => {},
});

export const {
	readDeviceSettings,
	setAppearance,
	setOnboardingComplete,
	setAppLock,
	setRemoteSessionMarker,
	closeDeviceSettings,
} = settings;
