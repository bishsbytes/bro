import { localDayOf } from "@bro/domain";
import { type CSSProperties, useState } from "react";
import { useTranslation } from "react-i18next";
import { View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";

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
	const { theme, rt } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const inputStyle: CSSProperties = {
		boxSizing: "border-box",
		width: "100%",
		height: theme.control.buttonMinHeight,
		borderWidth: focused ? 2 : 1,
		borderStyle: "solid",
		borderColor: error
			? theme.colors.alert
			: focused
				? theme.colors.accent
				: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
		fontSize: theme.typography.label.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		fontVariantNumeric: "tabular-nums",
		color: theme.colors.ink,
		backgroundColor: theme.colors.surface,
		colorScheme: rt.themeName === "dark" ? "dark" : "light",
		outline: "none",
	};

	return (
		<View style={containerStyle}>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<input
				aria-label={label}
				type="date"
				value={value}
				min={minimumDate ? localDayOf(minimumDate) : undefined}
				max={maximumDate ? localDayOf(maximumDate) : undefined}
				style={inputStyle}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onChange={(event) =>
					onChangeDate((event.target as unknown as { value: string }).value)
				}
			/>
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
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.sm },
	clearButton: { alignSelf: "flex-start" },
	error: { marginTop: theme.spacing.xs },
}));
