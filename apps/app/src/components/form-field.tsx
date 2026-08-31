import { type ComponentProps, useState } from "react";
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
	onFocus,
	onBlur,
	...props
}: FormFieldProps) {
	const { theme } = useUnistyles();
	const [focused, setFocused] = useState(false);

	return (
		<View style={containerStyle}>
			{showLabel ? (
				<AppText variant="label" style={styles.label}>
					{label}
				</AppText>
			) : null}
			<TextInput
				accessibilityLabel={accessibilityLabel}
				placeholderTextColor={placeholderTextColor ?? theme.colors.ink3}
				style={[
					styles.input,
					focused && styles.focused,
					error && styles.invalid,
					props.multiline && styles.multiline,
					style,
				]}
				onFocus={(event) => {
					setFocused(true);
					onFocus?.(event);
				}}
				onBlur={(event) => {
					setFocused(false);
					onBlur?.(event);
				}}
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
	label: { marginBottom: theme.spacing.sm },
	input: {
		minHeight: theme.control.buttonMinHeight,
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.md,
		fontSize: theme.typography.label.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		color: theme.colors.ink,
		backgroundColor: theme.colors.surface,
	},
	focused: { borderWidth: 2, borderColor: theme.colors.accent },
	invalid: { borderColor: theme.colors.alert },
	multiline: {
		minHeight: theme.control.noteMinHeight,
		fontFamily: theme.typography.lead.fontFamily,
		fontSize: theme.typography.lead.fontSize,
		lineHeight: theme.typography.lead.lineHeight,
		textAlignVertical: "top",
	},
	error: { marginTop: theme.spacing.xs },
}));
