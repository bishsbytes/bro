export const DEVICE_SETTINGS_DATABASE_NAME = "bro-device.db";

const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const DEFAULT_ACCENT_HUE = 235;
export const DEFAULT_ACCENT_CHROMA = 0.055;
export const GRAPHITE_ACCENT_CHROMA = 0.006;

const LEGACY_ACCENTS = {
	neutral: { hue: 250, chroma: GRAPHITE_ACCENT_CHROMA },
	emerald: { hue: 145, chroma: DEFAULT_ACCENT_CHROMA },
	sky: { hue: 235, chroma: DEFAULT_ACCENT_CHROMA },
	rose: { hue: 318, chroma: DEFAULT_ACCENT_CHROMA },
	amber: { hue: 85, chroma: DEFAULT_ACCENT_CHROMA },
	amethyst: { hue: 318, chroma: DEFAULT_ACCENT_CHROMA },
} as const;

export function normalizeAccentHue(value: unknown): number {
	const hue = Number(value);
	if (!Number.isFinite(hue)) return DEFAULT_ACCENT_HUE;
	return ((Math.round(hue) % 360) + 360) % 360;
}

function normalizeAccentChroma(value: unknown): number {
	return Number(value) === GRAPHITE_ACCENT_CHROMA
		? GRAPHITE_ACCENT_CHROMA
		: DEFAULT_ACCENT_CHROMA;
}

/**
 * Device-local settings. Never replicated: everything in the product database
 * (`bro.db`) syncs once a user opts in, so onboarding state and lock
 * preferences kept there would propagate to their other devices and
 * `installationId` would stop identifying an install.
 *
 * Stored as key-value rather than as a schema, because it is a few flat scalars
 * — a relational shape would be ceremony without a table to justify it.
 */
export type DeviceSettingsSnapshot = {
	/** Random UUID for this install. Meaningless elsewhere; not a credential. */
	installationId: string;
	onboardingComplete: boolean;
	appLockEnabled: boolean;
	appLockTimeoutSeconds: number | null;
	themeMode: ThemeMode;
	/** User-owned hue. Derived accent colours are never persisted. */
	accentHue: number;
	/** Only Graphite differs from the system chroma. */
	accentChroma: number;
	/** Lets startup skip all session work for a user who has never registered. */
	hasStoredRemoteSession: boolean;
	/** The account currently signed in on this device, or null. Not a claim on the data. */
	lastRemoteUserId: string | null;
};

export const DEVICE_SETTINGS_KEYS = {
	schemaVersion: "schemaVersion",
	installationId: "installationId",
	onboardingComplete: "onboardingComplete",
	appLockEnabled: "appLockEnabled",
	appLockTimeoutSeconds: "appLockTimeoutSeconds",
	themeMode: "themeMode",
	accentHue: "accentHue",
	accentChroma: "accentChroma",
	/** Version-one key, read once so existing installs keep their choice. */
	accentColor: "accentColor",
	hasStoredRemoteSession: "hasStoredRemoteSession",
	lastRemoteUserId: "lastRemoteUserId",
} as const;

const SCHEMA_VERSION = 2;

/**
 * The only things a platform has to supply. Everything above this line — the
 * key names, the schema-version guard, the boolean and integer encodings — is
 * the stored contract, and both platforms must agree on it or a user moving
 * between web and native would read the other's settings back as defaults.
 */
export type DeviceSettingsBackend = {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
	createUuid: () => string;
	/** Releases any open handle so startup can retry after a storage failure. */
	close: () => void;
};

export type DeviceSettingsApi = {
	readDeviceSettings: () => DeviceSettingsSnapshot;
	setOnboardingComplete: (complete: boolean) => void;
	setAppLock: (enabled: boolean, timeoutSeconds: number | null) => void;
	setAppearance: (
		themeMode: ThemeMode,
		accentHue: number,
		accentChroma?: number,
	) => void;
	setRemoteSessionMarker: (
		hasStoredRemoteSession: boolean,
		lastRemoteUserId: string | null,
	) => void;
	closeDeviceSettings: () => void;
};

export function createDeviceSettings(
	backend: DeviceSettingsBackend,
): DeviceSettingsApi {
	const readBoolean = (key: string): boolean => backend.getItem(key) === "true";

	const readInteger = (key: string): number | null => {
		const raw = backend.getItem(key);
		if (raw === null) {
			return null;
		}

		const parsed = Number.parseInt(raw, 10);
		return Number.isNaN(parsed) ? null : parsed;
	};

	const readChoice = <Choice extends string>(
		key: string,
		choices: readonly Choice[],
		fallback: Choice,
	): Choice => {
		const value = backend.getItem(key);
		return value !== null && choices.includes(value as Choice)
			? (value as Choice)
			: fallback;
	};

	/**
	 * Reads device settings, creating this install's identity on first call.
	 * Synchronous: the caller decides app entry from `onboardingComplete`, and
	 * that decision should not wait on I/O.
	 */
	const readDeviceSettings = (): DeviceSettingsSnapshot => {
		const storedVersion = readInteger(DEVICE_SETTINGS_KEYS.schemaVersion);

		if (storedVersion !== null && storedVersion > SCHEMA_VERSION) {
			throw new Error(
				"Device settings were created by a newer version of the app.",
			);
		}

		let installationId = backend.getItem(DEVICE_SETTINGS_KEYS.installationId);

		if (installationId === null) {
			installationId = backend.createUuid();
			backend.setItem(DEVICE_SETTINGS_KEYS.installationId, installationId);
			backend.setItem(
				DEVICE_SETTINGS_KEYS.schemaVersion,
				String(SCHEMA_VERSION),
			);
		}

		const legacyAccent = backend.getItem(DEVICE_SETTINGS_KEYS.accentColor);
		const legacyPreference =
			legacyAccent && legacyAccent in LEGACY_ACCENTS
				? LEGACY_ACCENTS[legacyAccent as keyof typeof LEGACY_ACCENTS]
				: undefined;
		const accentHue = normalizeAccentHue(
			backend.getItem(DEVICE_SETTINGS_KEYS.accentHue) ?? legacyPreference?.hue,
		);
		const accentChroma = normalizeAccentChroma(
			backend.getItem(DEVICE_SETTINGS_KEYS.accentChroma) ??
				legacyPreference?.chroma,
		);

		if ((storedVersion ?? 1) < SCHEMA_VERSION) {
			backend.setItem(DEVICE_SETTINGS_KEYS.accentHue, String(accentHue));
			backend.setItem(DEVICE_SETTINGS_KEYS.accentChroma, String(accentChroma));
			backend.removeItem(DEVICE_SETTINGS_KEYS.accentColor);
			backend.setItem(
				DEVICE_SETTINGS_KEYS.schemaVersion,
				String(SCHEMA_VERSION),
			);
		}

		return {
			installationId,
			onboardingComplete: readBoolean(DEVICE_SETTINGS_KEYS.onboardingComplete),
			appLockEnabled: readBoolean(DEVICE_SETTINGS_KEYS.appLockEnabled),
			appLockTimeoutSeconds: readInteger(
				DEVICE_SETTINGS_KEYS.appLockTimeoutSeconds,
			),
			themeMode: readChoice(
				DEVICE_SETTINGS_KEYS.themeMode,
				THEME_MODES,
				"system",
			),
			accentHue,
			accentChroma,
			hasStoredRemoteSession: readBoolean(
				DEVICE_SETTINGS_KEYS.hasStoredRemoteSession,
			),
			lastRemoteUserId: backend.getItem(DEVICE_SETTINGS_KEYS.lastRemoteUserId),
		};
	};

	/** Writes a value, or clears the key when there is nothing to remember. */
	const write = (key: string, value: string | null): void => {
		if (value === null) {
			backend.removeItem(key);
			return;
		}
		backend.setItem(key, value);
	};

	return {
		readDeviceSettings,

		setOnboardingComplete(complete) {
			backend.setItem(
				DEVICE_SETTINGS_KEYS.onboardingComplete,
				String(complete),
			);
		},

		setAppLock(enabled, timeoutSeconds) {
			backend.setItem(DEVICE_SETTINGS_KEYS.appLockEnabled, String(enabled));
			write(
				DEVICE_SETTINGS_KEYS.appLockTimeoutSeconds,
				timeoutSeconds === null ? null : String(timeoutSeconds),
			);
		},

		setAppearance(themeMode, accentHue, accentChroma = DEFAULT_ACCENT_CHROMA) {
			backend.setItem(DEVICE_SETTINGS_KEYS.themeMode, themeMode);
			backend.setItem(
				DEVICE_SETTINGS_KEYS.accentHue,
				String(normalizeAccentHue(accentHue)),
			);
			backend.setItem(
				DEVICE_SETTINGS_KEYS.accentChroma,
				String(normalizeAccentChroma(accentChroma)),
			);
		},

		setRemoteSessionMarker(hasStoredRemoteSession, lastRemoteUserId) {
			backend.setItem(
				DEVICE_SETTINGS_KEYS.hasStoredRemoteSession,
				String(hasStoredRemoteSession),
			);
			write(DEVICE_SETTINGS_KEYS.lastRemoteUserId, lastRemoteUserId);
		},

		closeDeviceSettings() {
			backend.close();
		},
	};
}
