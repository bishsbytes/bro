import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";
import { usePickerDialog } from "./picker-dialog";

type TimeFieldProps = {
	label: string;
	value: string;
	onChangeTime: (time: string) => void;
	containerStyle?: ViewStyle;
	error?: string | null;
};

export function TimeField({
	label,
	value,
	onChangeTime,
	containerStyle,
	error,
}: TimeFieldProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const { open, dialog } = usePickerDialog({
		label,
		mode: "time",
		value,
		onChange: onChangeTime,
	});

	return (
		<View style={containerStyle}>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={t("timePicker.openHint")}
				accessibilityValue={{
					text: value || t("timePicker.noTimeSelected"),
				}}
				style={({ pressed }) => [
					styles.input,
					focused && styles.focused,
					error && styles.invalid,
					pressed && styles.pressed,
				]}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onPress={open}
			>
				<AppText color={value ? "default" : "subtle"} style={styles.value}>
					{value || t("timePicker.chooseTime")}
				</AppText>
				<Icon name="clock" color={theme.colors.ink2} size={20} />
			</Pressable>
			{error ? (
				<AppText variant="caption" color="danger" style={styles.error}>
					{error}
				</AppText>
			) : null}
			{dialog}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.sm },
	input: {
		minHeight: theme.control.buttonMinHeight,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		paddingHorizontal: theme.spacing.lg,
		paddingVertical: theme.spacing.md,
		backgroundColor: theme.colors.surface,
	},
	focused: { borderWidth: 2, borderColor: theme.colors.accent },
	invalid: { borderColor: theme.colors.alert },
	pressed: { backgroundColor: theme.colors.accentTint },
	value: { flex: 1, fontVariant: ["tabular-nums"] },
	error: { marginTop: theme.spacing.xs },
}));
