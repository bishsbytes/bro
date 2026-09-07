import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import type { MarkdownFieldProps } from "./markdown-field";

/** The native markdown library only exports its renderer on web. Keep the
 * stored markdown intact in a multiline browser editor. */
export function MarkdownField({
	label,
	showLabel = true,
	accessibilityLabel = label,
	defaultValue,
	onChangeMarkdown,
	placeholder,
	autoFocus = false,
	appearance = "boxed",
	containerStyle,
}: MarkdownFieldProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	const [focused, setFocused] = useState(false);
	return (
		<View style={[styles.container, containerStyle]}>
			{showLabel ? <AppText variant="label">{label}</AppText> : null}
			<TextInput
				accessibilityLabel={accessibilityLabel}
				multiline
				defaultValue={defaultValue}
				onChangeText={onChangeMarkdown}
				placeholder={placeholder}
				placeholderTextColor={theme.colors.ink3}
				autoFocus={autoFocus}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				style={[
					styles.input,
					appearance === "flush" ? styles.flush : styles.boxed,
					focused && appearance === "boxed" && styles.focused,
				]}
			/>
			<AppText variant="micro" color="muted">
				{t("format.markdownHint")}
			</AppText>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { gap: theme.spacing.sm, minHeight: 0 },
	input: {
		...theme.typography.lead,
		color: theme.colors.ink,
		minHeight: theme.control.noteMinHeight,
		textAlignVertical: "top",
	},
	flush: { flex: 1 },
	boxed: {
		padding: theme.spacing.lg,
		borderWidth: 1,
		borderColor: theme.colors.interactiveBorder,
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface,
	},
	focused: { borderColor: theme.colors.brand },
}));
