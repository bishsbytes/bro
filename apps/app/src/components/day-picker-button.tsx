import { isCalendarDay, localDayOf } from "@bro/domain";
import DateTimePicker, {
	DateTimePickerAndroid,
	type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";
import { Icon } from "./icon";

type DayPickerButtonProps = {
	/** Announced by the button, and the heading of the picker dialog. */
	label: string;
	/** The chosen day, as YYYY-MM-DD. */
	value: string;
	/** How that day reads on the button — "Today", "Tue 12 Aug". */
	displayValue: string;
	onChangeDate: (localDay: string) => void;
	minimumDate?: Date;
	maximumDate?: Date;
};

function dateFromLocalDay(localDay: string): Date | null {
	if (!isCalendarDay(localDay)) return null;
	const [year, month, day] = localDay.split("-").map(Number);
	// Noon avoids crossing a calendar boundary around daylight-saving changes.
	return new Date(year, month - 1, day, 12);
}

/**
 * A compact day chooser sized for a navigation header, where {@link DateField}
 * — with its own label and full-width box — would not fit.
 *
 * It shows the day the way a reader thinks of it rather than as a date, so the
 * header doubles as the answer to "which day am I writing about?".
 */
export function DayPickerButton({
	label,
	value,
	displayValue,
	onChangeDate,
	minimumDate,
	maximumDate,
}: DayPickerButtonProps) {
	const { t } = useTranslation("common");
	const { theme, rt } = useUnistyles();
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
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={t("datePicker.openHint")}
				accessibilityValue={{ text: value }}
				hitSlop={12}
				style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
				onPress={openPicker}
			>
				<Icon name="calendar" color={theme.colors.ink2} size={18} />
				<AppText variant="label">{displayValue}</AppText>
				<Icon name="chevron-down" color={theme.colors.ink2} size={18} />
			</Pressable>

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
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	// Filled rather than bare: in a navigation bar the chip has to read as
	// something to press, with no surrounding form to borrow that from.
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xs,
		alignSelf: "center",
		borderWidth: 1,
		borderColor: theme.colors.line,
		borderRadius: theme.radius.pill,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		backgroundColor: theme.colors.surface,
	},
	pressed: { backgroundColor: theme.colors.accentTint },
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
