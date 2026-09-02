import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { Icon } from "./icon";
import { usePickerDialog } from "./picker-dialog";

type DateFieldProps = {
	label: string;
	value: string;
	onChangeDate: (localDay: string) => void;
	allowClear?: boolean;
	containerStyle?: ViewStyle;
	error?: string | null;
	minimumDate?: Date;
	maximumDate?: Date;
};

export function DateField({
	label,
	value,
	onChangeDate,
	allowClear = false,
	containerStyle,
	error,
	minimumDate,
	maximumDate,
}: DateFieldProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const { open, dialog } = usePickerDialog({
		label,
		mode: "date",
		value,
		onChange: onChangeDate,
		minimumDate,
		maximumDate,
	});

	return (
		<View style={containerStyle}>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={t("datePicker.openHint")}
				accessibilityValue={{
					text: value || t("datePicker.noDateSelected"),
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
					{value || t("datePicker.chooseDate")}
				</AppText>
				<Icon name="calendar" color={theme.colors.ink2} size={20} />
			</Pressable>
			{allowClear && value ? (
				<Button
					label={t("datePicker.clearDate")}
					variant="text"
					style={styles.clearButton}
					onPress={() => onChangeDate("")}
				/>
			) : null}
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
	clearButton: { alignSelf: "flex-start" },
	error: { marginTop: theme.spacing.xs },
}));
