// Prevent Expo's lazy native fetch polyfill from loading after a test finishes.
globalThis.fetch = jest.fn(async () => {
	throw new Error("Unexpected network request in test.");
}) as typeof fetch;

require("react-native-gesture-handler/jestSetup");

// Skia owns the dial and tailor's-figure drawing surface. Unit tests exercise
// the surrounding labels and interactions, so use host views while keeping the
// path-building API available to render those components without CanvasKit.
jest.mock("@shopify/react-native-skia", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	const Primitive = ({ children, ...props }: Record<string, unknown>) =>
		React.createElement(
			View,
			props as unknown as React.ComponentProps<typeof View>,
			children as React.ReactNode,
		);
	const path = {
		addArc: jest.fn(),
		moveTo: jest.fn(),
		lineTo: jest.fn(),
		cubicTo: jest.fn(),
		close: jest.fn(),
	};
	const pathBuilder = {
		addArc: jest.fn(),
		build: jest.fn(() => path),
	};
	pathBuilder.addArc.mockReturnValue(pathBuilder);

	return {
		BlurMask: Primitive,
		Canvas: Primitive,
		Circle: Primitive,
		DashPathEffect: Primitive,
		Group: Primitive,
		Line: Primitive,
		Path: Primitive,
		Skia: {
			Path: { Make: jest.fn(() => ({ ...path })) },
			PathBuilder: { Make: jest.fn(() => pathBuilder) },
			XYWHRect: jest.fn((x, y, width, height) => ({ x, y, width, height })),
		},
		vec: jest.fn((x, y) => ({ x, y })),
	};
});

// Expo Router's native tabs require a mounted iOS/Android tab controller. Its
// test router is intentionally platform-neutral, so adapt the declarative
// NativeTabs API to the stable JS Tabs navigator for integration tests.
jest.mock("expo-router/unstable-native-tabs", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const expoRouter =
		jest.requireActual<typeof import("expo-router")>("expo-router");
	const labels: Record<string, string> = {
		index: "Journal",
		intake: "Intake",
		body: "Body",
		life: "Life",
	};
	const Trigger = Object.assign(() => null, {
		Badge: () => null,
		Icon: () => null,
		Label: () => null,
		VectorIcon: () => null,
	});
	const NativeTabs = Object.assign(
		({
			children,
			iconColor,
			screenListeners,
		}: {
			children?: React.ReactNode;
			iconColor?: { default?: string; selected?: string };
			screenListeners?: React.ComponentProps<
				typeof expoRouter.Tabs
			>["screenListeners"];
		}) => {
			const screens = React.Children.toArray(children).flatMap((child) => {
				if (
					!React.isValidElement<{ name?: string }>(child) ||
					!child.props.name
				) {
					return [];
				}
				const name = child.props.name;
				return [
					React.createElement(expoRouter.Tabs.Screen, {
						key: name,
						name,
						options: { title: labels[name] ?? name },
					}),
				];
			});
			return React.createElement(
				expoRouter.Tabs,
				{
					screenListeners,
					screenOptions: {
						tabBarActiveTintColor: iconColor?.selected,
						tabBarInactiveTintColor: iconColor?.default,
					},
				},
				screens,
			);
		},
		{ Trigger },
	);

	return { NativeTabs };
});

// Keep Reanimated/native gestures outside Jest while preserving the public
// close behavior and backdrop configuration exercised by ModalSheet tests.
jest.mock("@gorhom/bottom-sheet", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { Pressable, ScrollView, View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	type MockSheetProps = {
		children?: React.ReactNode;
		backdropComponent?: React.ComponentType<Record<string, unknown>>;
		enableDynamicSizing?: boolean;
		index?: number;
		maxDynamicContentSize?: number;
		onClose?: () => void;
		snapPoints?: Array<string | number>;
	};
	type MockBackdropProps = Record<string, unknown> & {
		onPress?: () => void;
		pressBehavior?: string;
	};

	const CloseContext = React.createContext<(() => void) | null>(null);
	const MockBottomSheet = React.forwardRef<
		{ close: () => void },
		MockSheetProps
	>(
		(
			{
				backdropComponent: Backdrop,
				children,
				enableDynamicSizing,
				index,
				maxDynamicContentSize,
				onClose,
				snapPoints,
			},
			ref,
		) => {
			const close = React.useCallback(() => onClose?.(), [onClose]);
			React.useImperativeHandle(ref, () => ({ close }), [close]);

			return React.createElement(
				CloseContext.Provider,
				{ value: close },
				React.createElement(
					View,
					{
						testID: "bottom-sheet",
						enableDynamicSizing,
						index,
						maxDynamicContentSize,
						snapPoints,
					} as unknown as React.ComponentProps<typeof View>,
					Backdrop
						? React.createElement(Backdrop, {
								animatedIndex: { value: index ?? 0 },
								animatedPosition: { value: 0 },
							})
						: null,
					children,
				),
			);
		},
	);
	const MockBackdrop = ({
		onPress,
		pressBehavior,
		...props
	}: MockBackdropProps) => {
		const close = React.useContext(CloseContext);
		return React.createElement(Pressable, {
			...props,
			testID: "modal-sheet-backdrop",
			onPress: () => {
				onPress?.();
				if (pressBehavior === "close") {
					close?.();
				}
			},
		});
	};

	return {
		__esModule: true,
		default: MockBottomSheet,
		BottomSheetBackdrop: MockBackdrop,
		BottomSheetScrollView: ScrollView,
	};
});

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

// expo-localization reads device constants Jest's native shim does not carry.
// Pinning the locale keeps language selection deterministic across machines.
jest.mock("expo-localization", () => ({
	getLocales: jest.fn(() => [{ languageTag: "en-GB", languageCode: "en" }]),
}));

// Initialise i18next against the real English catalogues rather than a stub
// that echoes keys back, so assertions on rendered copy also prove the key
// exists and interpolates the way the screen expects.
require("./i18n");

// Unistyles ships this mock; it stands in for the Nitro native module and
// resolves theme callbacks against whatever StyleSheet.configure registered.
require("react-native-unistyles/mocks");
// Register the real themes, so a screen rendered on its own resolves the same
// tokens it would under the root layout.
require("./theme/unistyles");

// The markdown note components are Fabric views whose imperative ref methods
// dispatch native commands, so both throw under Jest. The library ships this
// mock: it renders a plain TextInput and Text, and every ref method — the
// toolbar's toggleBold and friends — becomes a spy.
jest.mock("react-native-enriched-markdown", () =>
	require("react-native-enriched-markdown/jest"),
);

// The keyboard controller is a native module with its own view managers. Its
// shipped mock renders the provider and the avoiding/aware views as plain RN
// containers, and reports a closed keyboard.
jest.mock("react-native-keyboard-controller", () =>
	require("react-native-keyboard-controller/jest"),
);

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
	// Shaped like a real response: the gateway reads canAskAgain and granted
	// alongside the status, because Android's status alone cannot tell a fresh
	// install from a refusal.
	getPermissionsAsync: jest.fn(async () => ({
		status: "undetermined",
		canAskAgain: true,
		granted: false,
	})),
	requestPermissionsAsync: jest.fn(async () => ({
		status: "granted",
		canAskAgain: false,
		granted: true,
	})),
	getAllScheduledNotificationsAsync: jest.fn(async () => []),
	scheduleNotificationAsync: jest.fn(async ({ identifier }) => identifier),
	cancelScheduledNotificationAsync: jest.fn(async () => undefined),
	getLastNotificationResponse: jest.fn(() => null),
	clearLastNotificationResponse: jest.fn(),
	addNotificationResponseReceivedListener: jest.fn(() => ({
		remove: jest.fn(),
	})),
}));
