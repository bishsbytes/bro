// Prevent Expo's lazy native fetch polyfill from loading after a test finishes.
globalThis.fetch = jest.fn(async () => {
	throw new Error("Unexpected network request in test.");
}) as typeof fetch;

// Expo Crypto 56 exposes native AES classes that are unavailable in Jest's
// native-module shim. The app only consumes random bytes for UUIDv7 ids.
let mockRandomByte = 0;
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomByte = (mockRandomByte + 1) % 256;
		bytes.fill(mockRandomByte);
		return bytes;
	}),
}));

jest.mock("expo-haptics", () => ({
	selectionAsync: jest.fn(async () => undefined),
}));

// Unistyles ships this mock; it stands in for the Nitro native module and
// resolves theme callbacks against whatever StyleSheet.configure registered.
require("react-native-unistyles/mocks");
// Register the real themes, so a screen rendered on its own resolves the same
// tokens it would under the root layout.
require("./theme/unistyles");

// PagerView is a native container. Tests exercise its selection callback through
// this host-view stand-in while the package owns the platform gesture behavior.
jest.mock("react-native-pager-view", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return React.forwardRef(
		(
			{
				children,
				initialPage = 0,
				...props
			}: {
				children?: React.ReactNode;
				initialPage?: number;
				[key: string]: unknown;
			},
			ref,
		) => {
			const pages = React.Children.toArray(children);
			return React.createElement(
				View,
				{
					...props,
					initialPage,
					pageCount: pages.length,
					ref,
				} as unknown as React.ComponentProps<typeof View>,
				pages[initialPage],
			);
		},
	);
});

// Native notification behaviour is covered through the app's gateway. Most
// router tests only need startup to see an undetermined permission state.
jest.mock("expo-notifications", () => ({
	PermissionStatus: {
		GRANTED: "granted",
		DENIED: "denied",
		UNDETERMINED: "undetermined",
	},
	AndroidImportance: { NONE: 0, DEFAULT: 3 },
	SchedulableTriggerInputTypes: { DATE: "date" },
	setNotificationHandler: jest.fn(),
	setNotificationChannelAsync: jest.fn(async () => null),
	getNotificationChannelAsync: jest.fn(async () => ({ importance: 3 })),
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
