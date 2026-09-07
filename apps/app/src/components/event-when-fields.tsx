import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "./app-text";
import { Icon } from "./icon";
import { usePickerDialog } from "./picker-dialog";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

export function EventWhenFields({
	localDay,
	time,
	today,
	disabled = false,
	onChangeDay,
	onChangeTime,
}: {
	localDay: string;
	time: string;
	today: string;
	disabled?: boolean;
	onChangeDay: (day: string) => void;
	onChangeTime: (time: string) => void;
}) {
	const { t } = useTranslation("common");
	return (
		<View>
			<EventPickerRow
				label={t("event.date")}
				value={localDay}
				displayValue={localDay === today ? t("event.today") : localDay}
				mode="date"
				disabled={disabled}
				onChange={onChangeDay}
			/>
			<EventPickerRow
				label={t("event.time")}
				value={time}
				mode="time"
				disabled={disabled}
				onChange={onChangeTime}
			/>
		</View>
	);
}

function EventPickerRow({
	label,
	value,
	displayValue = value,
	mode,
	disabled,
	onChange,
}: {
	label: string;
	value: string;
	displayValue?: string;
	mode: "date" | "time";
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const { theme } = useUnistyles();
	const { open, dialog } = usePickerDialog({ label, mode, value, onChange });
	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityValue={{ text: displayValue }}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={open}
				style={({ pressed }) => [styles.row, pressed && styles.pressed]}
			>
				<AppText style={styles.label}>{label}</AppText>
				<AppText style={styles.value}>{displayValue}</AppText>
				<Icon name="chevron-right" color={theme.colors.ink2} size={20} />
			</Pressable>
			{dialog}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
	},
	label: { flex: 1 },
	value: { flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
	pressed: { backgroundColor: theme.colors.selectedSoft },
}));
