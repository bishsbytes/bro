import {
	type DeviceSettingsSnapshot,
	setAppearance,
	setOnboardingComplete,
	setRemoteSessionMarker,
	type ThemeMode,
} from "@bro/database-app";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { applyAppearance } from "../theme/unistyles";

type DeviceSettingsContextValue = {
	settings: DeviceSettingsSnapshot;
	completeOnboarding: () => void;
	updateAppearance: (
		themeMode: ThemeMode,
		accentHue: number,
		accentChroma: number,
	) => void;
	markRemoteSessionStored: (userId: string | null) => Promise<void>;
	clearRemoteSession: () => Promise<void>;
};

const DeviceSettingsContext = createContext<
	DeviceSettingsContextValue | undefined
>(undefined);

export function DeviceSettingsProvider({
	children,
	initialSettings,
}: {
	children: ReactNode;
	initialSettings: DeviceSettingsSnapshot;
}) {
	const [settings, setSettings] = useState(initialSettings);

	const completeOnboarding = useCallback(() => {
		setOnboardingComplete(true);
		setSettings((current) => ({ ...current, onboardingComplete: true }));
	}, []);

	const updateAppearance = useCallback(
		(themeMode: ThemeMode, accentHue: number, accentChroma: number) => {
			setAppearance(themeMode, accentHue, accentChroma);
			applyAppearance(themeMode, accentHue, accentChroma);
			setSettings((current) => ({
				...current,
				themeMode,
				accentHue,
				accentChroma,
			}));
		},
		[],
	);

	// The auth provider owns the marker's lifecycle and awaits these, so they
	// stay promise-returning even though the write beneath them is synchronous.
	const markRemoteSessionStored = useCallback(
		async (userId: string | null) => {
			if (
				settings.hasStoredRemoteSession &&
				(userId === null || settings.lastRemoteUserId === userId)
			) {
				return;
			}

			const nextUserId = userId ?? settings.lastRemoteUserId;
			setRemoteSessionMarker(true, nextUserId);
			setSettings((current) => ({
				...current,
				hasStoredRemoteSession: true,
				lastRemoteUserId: nextUserId,
			}));
		},
		[settings.hasStoredRemoteSession, settings.lastRemoteUserId],
	);

	const clearRemoteSession = useCallback(async () => {
		if (
			!settings.hasStoredRemoteSession &&
			settings.lastRemoteUserId === null
		) {
			return;
		}

		setRemoteSessionMarker(false, null);
		setSettings((current) => ({
			...current,
			hasStoredRemoteSession: false,
			lastRemoteUserId: null,
		}));
	}, [settings.hasStoredRemoteSession, settings.lastRemoteUserId]);

	const value = useMemo<DeviceSettingsContextValue>(
		() => ({
			settings,
			completeOnboarding,
			updateAppearance,
			markRemoteSessionStored,
			clearRemoteSession,
		}),
		[
			settings,
			completeOnboarding,
			updateAppearance,
			markRemoteSessionStored,
			clearRemoteSession,
		],
	);

	return (
		<DeviceSettingsContext.Provider value={value}>
			{children}
		</DeviceSettingsContext.Provider>
	);
}

export function useDeviceSettings(): DeviceSettingsContextValue {
	const context = useContext(DeviceSettingsContext);

	if (!context) {
		throw new Error(
			"useDeviceSettings must be used within a DeviceSettingsProvider.",
		);
	}

	return context;
}
