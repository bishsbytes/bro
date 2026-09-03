import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "../theme/unistyles";
import { SettingsButton } from "./settings-button";

type AppHeaderProps = {
	title: string;
	leading?: ReactNode;
	actions?: ReactNode;
	centerTitle?: boolean;
	showSettings?: boolean;
	onSettingsPress?: () => void;
};

export function AppHeader({
	title,
	leading,
	actions,
	centerTitle = false,
	showSettings = true,
	onSettingsPress,
}: AppHeaderProps) {
	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			<View style={styles.header}>
				<View style={styles.leading}>{leading}</View>
				<View
					style={[
						styles.copy,
						centerTitle && styles.centeredCopy,
						{ pointerEvents: centerTitle ? "none" : "auto" },
					]}
				>
					<Text style={styles.title}>{title}</Text>
				</View>
				<View style={styles.actions}>
					{actions}
					{showSettings ? <SettingsButton onPress={onSettingsPress} /> : null}
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create((theme) => ({
	safeArea: { backgroundColor: theme.colors.background },
	header: {
		minHeight: theme.control.avatarSize,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.lg,
		paddingTop: theme.spacing.sm,
		paddingBottom: theme.spacing.md,
	},
	leading: { flexDirection: "row", alignItems: "center" },
	copy: { flex: 1 },
	centeredCopy: {
		position: "absolute",
		left: 0,
		right: 0,
		alignItems: "center",
	},
	title: { ...theme.typography.largeTitle, color: theme.colors.text },
	actions: {
		marginLeft: "auto",
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
}));
