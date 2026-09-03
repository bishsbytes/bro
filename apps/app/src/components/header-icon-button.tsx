import { TouchableOpacity } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { Icon, type IconName } from "./icon";

type HeaderIconButtonProps = {
	icon: IconName;
	testID: string;
	label: string;
	onPress: () => void;
};

/** A quiet, accessible action shared by custom and native stack headers. */
export function HeaderIconButton({
	icon,
	testID,
	label,
	onPress,
}: HeaderIconButtonProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={theme.spacing.sm}
			style={styles.button}
			onPress={onPress}
		>
			<Icon
				testID={testID}
				name={icon}
				color={theme.colors.ink2}
				size={theme.control.avatarIconSize}
			/>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	button: {
		width: theme.control.avatarSize,
		height: theme.control.avatarSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 0,
		borderRadius: theme.control.avatarSize / 2,
		backgroundColor: "transparent",
	},
}));
