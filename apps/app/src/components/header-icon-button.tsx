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
					size={
						surface
							? theme.control.headerActionIconSize
							: theme.control.avatarIconSize
					}
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
		width: theme.control.minHitArea,
		height: theme.control.minHitArea,
		// Align the visible circle with the header inset, keeping the full hit area.
		alignItems: "flex-end",
	},
	surface: {
		width: theme.control.headerActionVisualSize,
		height: theme.control.headerActionVisualSize,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 0,
		borderRadius: theme.control.headerActionVisualSize / 2,
		backgroundColor: theme.colors.surface2,
	},
}));
