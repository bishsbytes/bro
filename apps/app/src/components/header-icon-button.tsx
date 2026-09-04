import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { Icon, type IconName } from "./icon";

type HeaderIconButtonProps = {
	icon: IconName;
	testID: string;
	label: string;
	onPress: () => void;
	surface?: boolean;
};

/** A quiet, accessible action shared by custom and native stack headers. */
export function HeaderIconButton({
	icon,
	testID,
	label,
	onPress,
	surface = false,
}: HeaderIconButtonProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={label}
			hitSlop={theme.spacing.sm}
			style={[styles.button, surface && styles.surfaceButton]}
			onPress={onPress}
		>
			<View style={surface ? styles.surface : undefined}>
				<Icon
					testID={testID}
					name={icon}
					color={theme.colors.ink2}
					size={surface ? 18 : theme.control.avatarIconSize}
				/>
			</View>
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
	surfaceButton: {
		width: 34,
		height: 34,
	},
	surface: {
		width: 34,
		height: 34,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.hairline,
		borderRadius: 11,
		backgroundColor: theme.colors.surface2,
	},
}));
