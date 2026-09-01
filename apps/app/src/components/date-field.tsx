import { isCalendarDay, localDayOf } from "@bro/domain";
import DateTimePicker, {
	DateTimePickerAndroid,
	type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { Icon } from "./icon";

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

function dateFromLocalDay(localDay: string): Date | null {
	if (!isCalendarDay(localDay)) return null;
	const [year, month, day] = localDay.split("-").map(Number);
	// Noon avoids crossing a calendar boundary around daylight-saving changes.
	return new Date(year, month - 1, day, 12);
}

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
	const [pickerVisible, setPickerVisible] = useState(false);
	const [draftDate, setDraftDate] = useState(
		() => dateFromLocalDay(value) ?? new Date(),
	);
	const selectedDate = dateFromLocalDay(value) ?? new Date();

	function openPicker() {
		const initialDate = dateFromLocalDay(value) ?? new Date();
		setDraftDate(initialDate);
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: initialDate,
				mode: "date",
				display: "default",
				minimumDate,
				maximumDate,
				onValueChange: (_event, date) => onChangeDate(localDayOf(date)),
			});
			return;
		}
		setPickerVisible(true);
	}

	function previewDate(_event: DateTimePickerChangeEvent, date: Date) {
		setDraftDate(date);
	}

	function chooseDate() {
		onChangeDate(localDayOf(draftDate));
		setPickerVisible(false);
	}

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
				onPress={openPicker}
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

			{Platform.OS !== "android" ? (
				<Modal
					animationType="none"
					transparent
					visible={pickerVisible}
					onRequestClose={() => setPickerVisible(false)}
				>
					<View accessibilityViewIsModal style={styles.overlay}>
						<Pressable
							accessibilityLabel={t("datePicker.cancel")}
							style={styles.scrim}
							onPress={() => setPickerVisible(false)}
						/>
						<View style={styles.dialog}>
							<AppText variant="section">{label}</AppText>
							<DateTimePicker
								testID="date-picker"
								value={pickerVisible ? draftDate : selectedDate}
								mode="date"
								display="inline"
								minimumDate={minimumDate}
								maximumDate={maximumDate}
								accentColor={theme.colors.accent}
								themeVariant={rt.themeName === "dark" ? "dark" : "light"}
								onValueChange={previewDate}
							/>
							<View style={styles.actions}>
								<Button
									label={t("datePicker.cancel")}
									variant="secondary"
									style={styles.action}
									onPress={() => setPickerVisible(false)}
								/>
								<Button
									label={t("datePicker.done")}
									style={styles.action}
									onPress={chooseDate}
								/>
							</View>
						</View>
					</View>
				</Modal>
			) : null}
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
	overlay: {
		flex: 1,
		justifyContent: "center",
		padding: theme.spacing.xl,
	},
	scrim: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: theme.colors.scrim,
	},
	dialog: {
		gap: theme.spacing.lg,
		borderWidth: 1,
		borderColor: theme.colors.line,
		borderRadius: theme.radius.lg,
		padding: theme.spacing.lg,
		backgroundColor: theme.colors.surface,
	},
	actions: { flexDirection: "row", gap: theme.spacing.md },
	action: { flex: 1 },
}));
