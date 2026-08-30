import { router } from "expo-router";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Text, TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AvatarIdentityContext } from "./avatar-identity-context";
import { Icon } from "./icon";

type AvatarButtonProps = {
	onPress?: () => void;
};

export function AvatarButton({
	onPress = () => router.push("/account"),
}: AvatarButtonProps) {
	const accountName = useContext(AvatarIdentityContext);
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	const name = accountName?.trim();
	const initial = name ? Array.from(name)[0]?.toLocaleUpperCase() : null;

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={
				name ? t("a11y.accountFor", { name }) : t("a11y.account")
			}
			hitSlop={theme.spacing.sm}
			style={styles.avatar}
			onPress={onPress}
		>
			{initial ? (
				<Text style={styles.initial}>{initial}</Text>
			) : (
				<Icon
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
