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
					testID="account-header-icon"
					name="person"
					color={theme.colors.text}
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
		borderWidth: 0,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: "transparent",
	},
	initial: {
		...theme.typography.score,
		color: theme.colors.text,
	},
}));
