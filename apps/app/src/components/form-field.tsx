import { type ComponentProps, type ComponentType, useState } from "react";
import { TextInput, View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

type FormFieldProps = ComponentProps<typeof TextInput> & {
	label: string;
	error?: string | null;
	showLabel?: boolean;
	containerStyle?: ViewStyle;
	/** Supply a sheet-aware input when this field lives in a native bottom sheet. */
	inputComponent?: ComponentType<ComponentProps<typeof TextInput>>;
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
	inputComponent: Input = TextInput,
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
			<Input
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={error ?? undefined}
				keyboardAppearance={theme.isDark ? "dark" : "light"}
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
				<AppText
					accessibilityRole="alert"
					variant="caption"
					color="danger"
					style={styles.error}
				>
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
		borderColor: theme.colors.interactiveBorder,
		borderRadius: theme.radius.control,
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.md,
		fontSize: theme.typography.body.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		color: theme.colors.ink,
		backgroundColor: theme.colors.field,
	},
	focused: { borderWidth: 2, borderColor: theme.colors.brand },
	invalid: { borderColor: theme.colors.alert },
	multiline: {
		minHeight: theme.control.noteMinHeight,
		fontFamily: theme.typography.serifQuote.fontFamily,
		fontSize: theme.typography.serifQuote.fontSize,
		lineHeight: theme.typography.serifQuote.lineHeight,
		textAlignVertical: "top",
	},
	error: { marginTop: theme.spacing.xs },
}));
