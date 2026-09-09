import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

type FactorChipProps = {
	label: string;
	accessibilityLabel?: string;
	selected: boolean;
	disabled?: boolean;
	onPress: () => void;
};

/**
 * C09 FactorChip. Unselected chips are transparent with a faint outline;
 * selected chips take the selection fill and a checkmark rather than a
 * contrasting border. The 40-point visual height sits inside a 48-point touch
 * target and grows with larger text.
 */
export function FactorChip({
	label,
	accessibilityLabel = label,
	selected,
	disabled = false,
	onPress,
}: FactorChipProps) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			aria-pressed={selected}
			aria-disabled={disabled}
			accessibilityState={{ selected, disabled }}
			activeOpacity={theme.opacity.pressed}
			style={[styles.target, disabled && styles.disabled]}
			disabled={disabled}
			onPress={onPress}
		>
			<View style={[styles.surface, selected && styles.selected]}>
				<AppText
					variant="caption"
					color="muted"
					style={[styles.label, selected && styles.selectedLabel]}
				>
					{label}
				</AppText>
				{selected ? (
					<Icon name="check" size={16} color={theme.colors.onSelected} />
				) : null}
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	target: {
		maxWidth: "100%",
		minHeight: theme.control.minHitArea,
		minWidth: theme.control.minHitArea,
		justifyContent: "center",
	},
	surface: {
		minHeight: theme.control.factorChipVisualHeight,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.hairlineSoft,
		borderRadius: theme.radius.control,
		backgroundColor: "transparent",
		paddingVertical: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
	},
	selected: {
		borderColor: "transparent",
		backgroundColor: theme.colors.selected,
	},
	selectedLabel: { color: theme.colors.onSelected },
	label: { flexShrink: 1 },
	disabled: { opacity: theme.opacity.disabled },
}));
