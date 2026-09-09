import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";

/** A quiet, labelled link with a full touch target. */
export function TextAction({
	label,
	chevron = false,
	style,
	...props
}: Omit<ComponentProps<typeof Pressable>, "children"> & {
	label: string;
	chevron?: boolean;
}) {
	const { theme } = useUnistyles();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			{...props}
			aria-disabled={!!props.disabled}
			accessibilityState={{
				...props.accessibilityState,
				disabled: !!props.disabled,
			}}
			style={(state) => [
				styles.link,
				state.pressed && !props.disabled && styles.pressed,
				props.disabled && styles.disabled,
				typeof style === "function" ? style(state) : style,
			]}
		>
			<AppText variant="label" color="brand" style={styles.label}>
				{label}
			</AppText>
			{chevron ? (
				<Icon name="chevron-right" size={16} color={theme.colors.brand} />
			) : null}
		</Pressable>
	);
}
const styles = StyleSheet.create((theme) => ({
	link: {
		minHeight: theme.control.minHitArea,
		minWidth: theme.control.minHitArea,
		borderRadius: theme.radius.pill,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.xs,
	},
	disabled: { opacity: theme.opacity.disabled },
	pressed: { opacity: theme.opacity.pressed },
	label: { flexShrink: 1, textAlign: "center" },
}));
