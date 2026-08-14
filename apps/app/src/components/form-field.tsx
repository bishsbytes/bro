import type { ComponentProps } from "react";
import { TextInput, View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

type FormFieldProps = ComponentProps<typeof TextInput> & {
	label: string;
	error?: string | null;
	showLabel?: boolean;
	containerStyle?: ViewStyle;
};

export function FormField({
	label,
	error,
	showLabel = true,
	containerStyle,
	style,
	accessibilityLabel = label,
	placeholderTextColor,
	...props
}: FormFieldProps) {
	const { theme } = useUnistyles();

	return (
		<View style={containerStyle}>
			{showLabel ? (
				<AppText variant="label" style={styles.label}>
					{label}
				</AppText>
			) : null}
			<TextInput
				accessibilityLabel={accessibilityLabel}
				placeholderTextColor={placeholderTextColor ?? theme.colors.textSubtle}
				style={[styles.input, props.multiline && styles.multiline, style]}
				{...props}
			/>
			{error ? (
				<AppText variant="caption" color="danger" style={styles.error}>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.xs, fontWeight: "600" },
	input: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.sm,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.md,
		fontSize: theme.typography.label.fontSize,
		color: theme.colors.text,
		backgroundColor: theme.colors.background,
	},
	multiline: {
		minHeight: theme.control.noteMinHeight,
		textAlignVertical: "top",
	},
	error: { marginTop: theme.spacing.xs },
}));
