import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import type { EventWhenFields as NativeEventWhenFields } from "./event-when-fields";
import { useWebPickerInputStyle } from "./web-picker-input";

export function EventWhenFields({
	localDay,
	time,
	disabled = false,
	onChangeDay,
	onChangeTime,
}: Parameters<typeof NativeEventWhenFields>[0]) {
	const { t } = useTranslation("common");
	return (
		<View>
			<PickerRow
				label={t("event.date")}
				value={localDay}
				type="date"
				disabled={disabled}
				onChange={onChangeDay}
			/>
			<PickerRow
				label={t("event.time")}
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
