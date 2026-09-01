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

type TimeFieldProps = {
	label: string;
	value: string;
	onChangeTime: (time: string) => void;
	containerStyle?: ViewStyle;
	error?: string | null;
};

function dateFromTime(value: string): Date | null {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
	if (!match) return null;
	const date = new Date();
	date.setHours(Number(match[1]), Number(match[2]), 0, 0);
	return date;
}

function timeFromDate(date: Date): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes(),
	).padStart(2, "0")}`;
}

export function TimeField({
	label,
	value,
	onChangeTime,
	containerStyle,
	error,
}: TimeFieldProps) {
	const { t } = useTranslation("common");
	const { theme, rt } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const [pickerVisible, setPickerVisible] = useState(false);
	const [draftTime, setDraftTime] = useState(
		() => dateFromTime(value) ?? new Date(),
	);
	const selectedTime = dateFromTime(value) ?? new Date();

	function openPicker() {
		const initialTime = dateFromTime(value) ?? new Date();
		setDraftTime(initialTime);
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: initialTime,
				mode: "time",
				display: "default",
				is24Hour: true,
				onValueChange: (_event, date) => onChangeTime(timeFromDate(date)),
			});
			return;
		}
		setPickerVisible(true);
	}

	function previewTime(_event: DateTimePickerChangeEvent, date: Date) {
		setDraftTime(date);
	}

	function chooseTime() {
		onChangeTime(timeFromDate(draftTime));
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
				onPress={openPicker}
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

			{Platform.OS !== "android" ? (
				<Modal
					animationType="none"
					transparent
					visible={pickerVisible}
					onRequestClose={() => setPickerVisible(false)}
				>
					<View accessibilityViewIsModal style={styles.overlay}>
						<Pressable
							accessibilityLabel={t("timePicker.cancel")}
							style={styles.scrim}
							onPress={() => setPickerVisible(false)}
						/>
						<View style={styles.dialog}>
							<AppText variant="section">{label}</AppText>
							<DateTimePicker
								testID="time-picker"
								value={pickerVisible ? draftTime : selectedTime}
								mode="time"
								display="spinner"
								accentColor={theme.colors.accent}
								themeVariant={rt.themeName === "dark" ? "dark" : "light"}
								onValueChange={previewTime}
							/>
							<View style={styles.actions}>
								<Button
									label={t("timePicker.cancel")}
									variant="secondary"
									style={styles.action}
									onPress={() => setPickerVisible(false)}
								/>
								<Button
									label={t("timePicker.done")}
									style={styles.action}
									onPress={chooseTime}
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
