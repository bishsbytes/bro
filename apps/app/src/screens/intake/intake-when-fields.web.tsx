import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { useWebPickerInputStyle } from "../../components/web-picker-input";
import { StyleSheet } from "../../theme/unistyles";
import type { IntakeWhenFields as NativeIntakeWhenFields } from "./intake-when-fields";

export function IntakeWhenFields({
	localDay,
	time,
	disabled = false,
	onChangeDay,
	onChangeTime,
}: Parameters<typeof NativeIntakeWhenFields>[0]) {
	const { t } = useTranslation("intake");
	return (
		<View>
			<PickerRow
				label={t("log.date")}
				value={localDay}
				type="date"
				disabled={disabled}
				onChange={onChangeDay}
			/>
			<PickerRow
				label={t("log.time")}
				value={time}
				type="time"
				disabled={disabled}
				onChange={onChangeTime}
			/>
		</View>
	);
}

function PickerRow({
	label,
	value,
	type,
	disabled,
	onChange,
}: {
	label: string;
	value: string;
	type: "date" | "time";
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const [focused, setFocused] = useState(false);
	const inputStyle = useWebPickerInputStyle({ focused });
	return (
		<View style={styles.row}>
			<AppText style={styles.label}>{label}</AppText>
			<input
				aria-label={label}
				type={type}
				value={value}
				disabled={disabled}
				style={{
					...inputStyle,
					width: "65%",
					minWidth: 0,
					padding: 8,
					textAlign: "right",
					backgroundColor: "transparent",
					borderColor: focused ? inputStyle.borderColor : "transparent",
				}}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onChange={(event) =>
					onChange((event.target as unknown as { value: string }).value)
				}
			/>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		minHeight: theme.control.buttonMinHeight,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	label: { flex: 1 },
}));
