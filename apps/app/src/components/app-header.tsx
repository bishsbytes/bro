import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "../theme/unistyles";
import { SettingsButton } from "./settings-button";

type AppHeaderProps = {
	title: string;
	eyebrow?: string;
	eyebrowAccessibilityLabel?: string;
	onEyebrowPress?: () => void;
	leading?: ReactNode;
	actions?: ReactNode;
	centerTitle?: boolean;
	showSettings?: boolean;
	onSettingsPress?: () => void;
};

export function AppHeader({
	title,
	eyebrow,
	eyebrowAccessibilityLabel,
	onEyebrowPress,
	leading,
	actions,
	centerTitle = false,
	showSettings = true,
	onSettingsPress,
}: AppHeaderProps) {
	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			<View style={styles.header}>
				{leading ? <View style={styles.leading}>{leading}</View> : null}
				{onEyebrowPress ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={eyebrowAccessibilityLabel}
						style={[styles.copy, centerTitle && styles.centeredCopy]}
						onPress={onEyebrowPress}
					>
						{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
						<Text style={styles.title}>{title}</Text>
					</Pressable>
				) : (
					<View
						style={[
							styles.copy,
							centerTitle && styles.centeredCopy,
							{ pointerEvents: centerTitle ? "none" : "auto" },
						]}
					>
						{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
						<Text style={styles.title}>{title}</Text>
					</View>
				)}
				<View style={styles.actions}>
					{actions}
					{showSettings ? (
						<SettingsButton onPress={onSettingsPress} surface />
					) : null}
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create((theme) => ({
	safeArea: { backgroundColor: theme.colors.background },
	header: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.lg,
		paddingBottom: theme.spacing.sm,
	},
	leading: { flexDirection: "row", alignItems: "center" },
	copy: { flex: 1 },
	centeredCopy: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
	},
	eyebrow: {
		...theme.typography.caption,
		color: theme.colors.ink3,
		fontWeight: "500",
	},
	title: { ...theme.typography.largeTitle, color: theme.colors.text },
	actions: {
		marginLeft: "auto",
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
}));
