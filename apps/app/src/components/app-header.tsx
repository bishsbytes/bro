import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "../theme/unistyles";
import { AvatarButton } from "./avatar-button";

type AppHeaderProps = {
	title: string;
	actions?: ReactNode;
	showAvatar?: boolean;
	onAvatarPress?: () => void;
};

export function AppHeader({
	title,
	actions,
	showAvatar = true,
	onAvatarPress,
}: AppHeaderProps) {
	return (
		<SafeAreaView style={styles.safeArea} edges={["top"]}>
			<View style={styles.header}>
				<View style={styles.copy}>
					<Text style={styles.title}>{title}</Text>
				</View>
				<View style={styles.actions}>
					{actions}
					{showAvatar ? <AvatarButton onPress={onAvatarPress} /> : null}
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create((theme) => ({
	safeArea: { backgroundColor: theme.colors.background },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.lg,
		paddingHorizontal: theme.spacing.xl,
		paddingTop: theme.spacing.sm,
		paddingBottom: theme.spacing.lg,
	},
	copy: { flex: 1 },
	title: { ...theme.typography.title, color: theme.colors.text },
	actions: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
}));
