import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";

/** One of a set, or independently toggled: the mark and the role follow. */
export type OptionSelection = "single" | "multiple";

const MARKS = {
	single: { on: "check-circle", off: "circle" },
	multiple: { on: "square-check", off: "square" },
} as const satisfies Record<OptionSelection, { on: IconName; off: IconName }>;

type OptionRowProps = {
	label: string;
	detail?: string;
	/** Leading glyph, where the choice is easier to recognise than to read. */
	icon?: IconName;
	selected: boolean;
	selection?: OptionSelection;
	accessibilityLabel: string;
	disabled?: boolean;
	onPress: () => void;
};

export function OptionRow({
	label,
	detail,
	icon,
	selected,
	selection = "single",
	accessibilityLabel,
	disabled = false,
	onPress,
}: OptionRowProps) {
	const { theme } = useUnistyles();
	const mark = MARKS[selection];

	return (
		<TouchableOpacity
			accessibilityRole={selection === "single" ? "radio" : "checkbox"}
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ selected, checked: selected, disabled }}
			activeOpacity={0.72}
			disabled={disabled}
			style={[
				styles.option,
				selected && styles.selectedOption,
				disabled && styles.disabled,
			]}
			onPress={onPress}
		>
			{icon ? (
				<View style={[styles.icon, selected && styles.selectedIcon]}>
					<Icon
						name={icon}
						size={22}
						color={selected ? theme.colors.brand : theme.colors.textMuted}
					/>
				</View>
			) : null}
			<View style={styles.copy}>
				<AppText variant="label" style={styles.label}>
					{label}
				</AppText>
				{detail ? (
					<AppText variant="caption" color="muted">
						{detail}
					</AppText>
				) : null}
			</View>
			<Icon
				name={selected ? mark.on : mark.off}
				size={22}
				color={selected ? theme.colors.brand : theme.colors.border}
			/>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create((theme) => ({
	option: {
		minHeight: theme.control.buttonMinHeight,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
		padding: theme.spacing.md,
		borderRadius: theme.radius.sm,
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
	},
	selectedOption: {
		borderColor: theme.colors.accent,
		backgroundColor: theme.colors.accentTint,
	},
	disabled: { opacity: theme.opacity.disabled },
	icon: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.background,
	},
	selectedIcon: { backgroundColor: theme.colors.surface },
	copy: { flex: 1 },
	label: { fontWeight: "600" },
}));
