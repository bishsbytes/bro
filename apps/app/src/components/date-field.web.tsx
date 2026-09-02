import { localDayOf } from "@bro/domain";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View, type ViewStyle } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { useWebPickerInputStyle } from "./web-picker-input";

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
	const [focused, setFocused] = useState(false);
	const inputStyle = useWebPickerInputStyle({ focused, error });

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
