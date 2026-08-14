import type { ReactNode } from "react";
import {
	ScrollView,
	type ScrollViewProps,
	View,
	type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type Spacing = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

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

	return (
		<SafeAreaView style={[styles.screen, style]} edges={edges}>
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

const styles = StyleSheet.create((theme) => ({
	screen: { flex: 1, backgroundColor: theme.colors.background },
	scroll: { flex: 1, backgroundColor: theme.colors.background },
	content: { flexGrow: 1 },
	padded: { padding: theme.spacing.xl },
	centered: { alignItems: "center", justifyContent: "center" },
}));
