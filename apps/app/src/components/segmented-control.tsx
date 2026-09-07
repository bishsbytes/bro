import { Pressable, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

export function SegmentedControl<T extends string | number>({
	label,
	options,
	value,
	disabled = false,
	onChange,
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	disabled?: boolean;
	onChange: (value: T) => void;
}) {
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={styles.group}
		>
			{options.map((option) => (
				<Pressable
					key={option.value}
					accessibilityRole="radio"
					accessibilityLabel={option.label}
					accessibilityState={{ checked: value === option.value, disabled }}
					disabled={disabled}
					onPress={() => onChange(option.value)}
					style={[
						styles.option,
						value === option.value && styles.selected,
						disabled && styles.disabled,
					]}
				>
					<AppText
						variant="caption"
						color={value === option.value ? "onBrand" : "muted"}
						style={styles.label}
					>
						{option.label}
					</AppText>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	group: {
		flexDirection: "row",
		backgroundColor: theme.colors.surface1,
		borderRadius: theme.radius.control,
		padding: 0,
	},
	option: {
		flex: 1,
		minHeight: theme.control.minHitArea,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: theme.spacing.sm,
		paddingVertical: theme.spacing.xs,
		borderRadius: theme.radius.control,
	},
	selected: { backgroundColor: theme.colors.brand },
	label: { textAlign: "center" },
	disabled: { opacity: theme.opacity.disabled },
}));
