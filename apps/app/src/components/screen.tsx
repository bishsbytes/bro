import type { ReactNode } from "react";
import {
	ScrollView,
	type ScrollViewProps,
	View,
	type ViewStyle,
} from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type Spacing = "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl";

type ScreenProps = {
	children: ReactNode;
	scroll?: boolean;
	padded?: boolean;
	centered?: boolean;
	gap?: Spacing;
	edges?: readonly Edge[];
	style?: ViewStyle;
	contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
	keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
};

type StackScreenProps = Omit<ScreenProps, "edges">;
type FullScreenProps = Omit<ScreenProps, "edges">;

export function Screen({
	children,
	scroll = false,
	padded = false,
	centered = false,
	gap,
	edges = [],
	style,
	contentContainerStyle,
	keyboardShouldPersistTaps,
}: ScreenProps) {
	const { theme } = useUnistyles();
	const contentStyle = [
		styles.content,
		padded && styles.padded,
		centered && styles.centered,
		gap ? { gap: theme.spacing[gap] } : undefined,
		contentContainerStyle,
	];
	// SafeAreaView flattens its style before forwarding it to a React Native View.
	// On web that drops Unistyles' generated class, so keep this flex boundary as
	// a plain style object. minHeight lets the boundary shrink to the navigator's
	// viewport and gives the nested ScrollView a real scroll range.
	const screenStyle: ViewStyle = {
		flex: 1,
		minHeight: 0,
		backgroundColor: theme.colors.background,
	};

	return (
		<SafeAreaView style={[screenStyle, style]} edges={edges}>
			{scroll ? (
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={contentStyle}
					keyboardShouldPersistTaps={keyboardShouldPersistTaps}
				>
					{children}
				</ScrollView>
			) : (
				<View style={contentStyle}>{children}</View>
			)}
		</SafeAreaView>
	);
}

/**
 * Screen used under a native stack header. The header owns the top inset; this
 * component guarantees that scrolling and fixed content stop above system
 * navigation at the bottom of the device.
 */
export function StackScreen(props: StackScreenProps) {
	return <Screen {...props} edges={["bottom"]} />;
}

/** Screen used without either a native header or a bottom tab bar. */
export function FullScreen(props: FullScreenProps) {
	return <Screen {...props} edges={["top", "bottom"]} />;
}

const styles = StyleSheet.create((theme) => ({
	scroll: { flex: 1, backgroundColor: theme.colors.background },
	content: { flexGrow: 1 },
	padded: {
		paddingHorizontal: theme.spacing.lg,
		paddingTop: theme.spacing.md,
		paddingBottom: theme.spacing.xl,
	},
	centered: { alignItems: "stretch", justifyContent: "center" },
}));
