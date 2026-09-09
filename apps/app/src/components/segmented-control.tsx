import { Pressable, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

export function SegmentedControl<T extends string | number>({
	label,
	options,
	value,
	role = "radio",
	disabled = false,
	onChange,
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	/** Tabs switch content; radios change one value. Both share the same shape. */
	role?: "radio" | "tab";
	disabled?: boolean;
	onChange: (value: T) => void;
}) {
	return (
		<View
			accessibilityRole={role === "tab" ? "tablist" : "radiogroup"}
			accessibilityLabel={label}
			style={styles.group}
		>
			<View pointerEvents="none" style={styles.track} />
			{options.map((option) => (
				<Pressable
					key={option.value}
					accessibilityRole={role}
					accessibilityLabel={option.label}
					aria-selected={role === "tab" ? value === option.value : undefined}
					aria-checked={role === "radio" ? value === option.value : undefined}
					aria-disabled={disabled}
					accessibilityState={{
						...(role === "tab"
							? { selected: value === option.value }
							: { checked: value === option.value }),
						disabled,
					}}
					disabled={disabled}
					onPress={() => onChange(option.value)}
					style={({ pressed }) => [
						styles.option,
						pressed && !disabled && styles.pressed,
						disabled && styles.disabled,
					]}
				>
					<View style={styles.surface(value === option.value)}>
						<AppText
							variant="label"
							color={value === option.value ? "onBrand" : "muted"}
							style={styles.label}
						>
							{option.label}
						</AppText>
					</View>
				</Pressable>
			))}
		</View>
	);
}

const styles = StyleSheet.create((theme) => {
	const visualInset =
		Math.max(
			0,
			theme.control.minHitArea - theme.control.factorChipVisualHeight,
		) / 2;
	return {
		group: {
			flexDirection: "row",
		},
		track: {
			...StyleSheet.absoluteFillObject,
			top: visualInset,
			bottom: visualInset,
			backgroundColor: theme.colors.surface1,
			borderRadius: theme.radius.control,
		},
		option: {
			flex: 1,
			minWidth: 0,
			minHeight: theme.control.minHitArea,
			paddingVertical: visualInset,
		},
		surface: (selected: boolean) => ({
			flexGrow: 1,
			minHeight: theme.control.factorChipVisualHeight,
			justifyContent: "center",
			alignItems: "center",
			paddingHorizontal: theme.spacing.sm,
			paddingVertical: theme.spacing.xs,
			borderRadius: theme.radius.control,
			overflow: "hidden",
			backgroundColor: selected ? theme.colors.brand : "transparent",
		}),
		label: { textAlign: "center" },
		pressed: { opacity: theme.opacity.pressed },
		disabled: { opacity: theme.opacity.disabled },
	};
});
