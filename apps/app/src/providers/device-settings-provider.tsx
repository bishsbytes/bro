import {
	type DeviceSettingsSnapshot,
	setOnboardingComplete,
	setRemoteSessionMarker,
} from "@bro/database-app";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

type DeviceSettingsContextValue = {
	settings: DeviceSettingsSnapshot;
	completeOnboarding: () => Promise<void>;
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

	const completeOnboarding = useCallback(async () => {
		await setOnboardingComplete(true);
		setSettings((current) => ({ ...current, onboardingComplete: true }));
	}, []);

	const markRemoteSessionStored = useCallback(
		async (userId: string | null) => {
			if (
				settings.hasStoredRemoteSession &&
				(userId === null || settings.lastRemoteUserId === userId)
			) {
				return;
			}

			const nextUserId = userId ?? settings.lastRemoteUserId;
			await setRemoteSessionMarker(true, nextUserId);
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

		await setRemoteSessionMarker(false, null);
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
			markRemoteSessionStored,
			clearRemoteSession,
		}),
		[settings, completeOnboarding, markRemoteSessionStored, clearRemoteSession],
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
