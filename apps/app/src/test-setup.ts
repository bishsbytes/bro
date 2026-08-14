// Prevent Expo's lazy native fetch polyfill from loading after a test finishes.
globalThis.fetch = jest.fn(async () => {
	throw new Error("Unexpected network request in test.");
}) as typeof fetch;

// Unistyles ships this mock; it stands in for the Nitro native module and
// resolves theme callbacks against whatever StyleSheet.configure registered.
require("react-native-unistyles/mocks");
// Register the real themes, so a screen rendered on its own resolves the same
// tokens it would under the root layout.
require("./theme/unistyles");

// Native notification behaviour is covered through the app's gateway. Most
// router tests only need startup to see an undetermined permission state.
jest.mock("expo-notifications", () => ({
	PermissionStatus: {
		GRANTED: "granted",
		DENIED: "denied",
		UNDETERMINED: "undetermined",
	},
	AndroidImportance: { DEFAULT: 3 },
	SchedulableTriggerInputTypes: { DATE: "date" },
	setNotificationHandler: jest.fn(),
	setNotificationChannelAsync: jest.fn(async () => null),
	getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
	requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
	getAllScheduledNotificationsAsync: jest.fn(async () => []),
	scheduleNotificationAsync: jest.fn(async ({ identifier }) => identifier),
	cancelScheduledNotificationAsync: jest.fn(async () => undefined),
	getLastNotificationResponse: jest.fn(() => null),
	clearLastNotificationResponse: jest.fn(),
	addNotificationResponseReceivedListener: jest.fn(() => ({
		remove: jest.fn(),
	})),
}));
