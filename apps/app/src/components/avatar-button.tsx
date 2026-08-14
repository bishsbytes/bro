import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useContext } from "react";
import { Text, TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AvatarIdentityContext } from "./avatar-identity-context";

type AvatarButtonProps = {
	onPress?: () => void;
};

export function AvatarButton({
	onPress = () => router.push("/account"),
}: AvatarButtonProps) {
	const accountName = useContext(AvatarIdentityContext);
	const { theme } = useUnistyles();
	const name = accountName?.trim();
	const initial = name ? Array.from(name)[0]?.toLocaleUpperCase() : null;

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={name ? `Account for ${name}` : "Account"}
			hitSlop={theme.spacing.sm}
			style={styles.avatar}
			onPress={onPress}
		>
			{initial ? (
				<Text style={styles.initial}>{initial}</Text>
			) : (
				<MaterialIcons
					name="person"
					color={theme.colors.brand}
					size={theme.control.avatarIconSize}
				/>
			)}
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	avatar: {
		width: theme.control.avatarSize,
		height: theme.control.avatarSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: theme.colors.surface,
	},
	initial: {
		...theme.typography.score,
		color: theme.colors.brand,
	},
}));
