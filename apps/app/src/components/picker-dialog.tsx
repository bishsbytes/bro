import { isCalendarDay, localDayOf } from "@bro/domain";
import DateTimePicker, {
	DateTimePickerAndroid,
	type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Button } from "./button";

export type PickerMode = "date" | "time";

type PickerDialogOptions = {
	/** Heads the dialog. Callers pass the same text their trigger announces. */
	label: string;
	/** Which picker to open, and how `value` is written. */
	mode: PickerMode;
	/** A local day (YYYY-MM-DD) in date mode, a 24-hour time (HH:MM) in time. */
	value: string;
	/** Given the new value, written the same way as `value`. */
	onChange: (value: string) => void;
	/** Date mode only. */
	minimumDate?: Date;
	/** Date mode only. */
	maximumDate?: Date;
};

type PickerDialog = {
	/** Opens the platform picker. Wire this to the trigger's press. */
	open: () => void;
	/**
	 * The iOS dialog, or null on Android where the platform owns its own. Render
	 * it somewhere inside the trigger's tree.
	 */
	dialog: ReactNode;
};

function dateFromLocalDay(localDay: string): Date | null {
	if (!isCalendarDay(localDay)) return null;
	const [year, month, day] = localDay.split("-").map(Number);
	// Noon avoids crossing a calendar boundary around daylight-saving changes.
	return new Date(year, month - 1, day, 12);
}

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

/**
 * The platform date or time picker, behind one trigger-agnostic hook.
 *
 * Android opens a system dialog of its own; every other platform gets the
 * modal built here. Both paths, the draft-until-Done behaviour, and the
 * string-to-`Date` conversions are the same wherever a picker is offered — so
 * they live here, and a caller supplies only the control that opens it. See
 * {@link DateField}, {@link TimeField} and {@link DayPickerButton}.
 */
export function usePickerDialog({
	label,
	mode,
	value,
	onChange,
	minimumDate,
	maximumDate,
}: PickerDialogOptions): PickerDialog {
	const { t } = useTranslation("common");
	const { theme, rt } = useUnistyles();
	const parse = mode === "date" ? dateFromLocalDay : dateFromTime;
	const serialise = mode === "date" ? localDayOf : timeFromDate;
	const strings = mode === "date" ? "datePicker" : "timePicker";
	const [visible, setVisible] = useState(false);
	const [draft, setDraft] = useState(() => parse(value) ?? new Date());
	const selected = parse(value) ?? new Date();

	function open() {
		const initial = parse(value) ?? new Date();
		setDraft(initial);
		if (Platform.OS === "android") {
			DateTimePickerAndroid.open({
				value: initial,
				mode,
				display: "default",
				is24Hour: mode === "time" ? true : undefined,
				minimumDate,
				maximumDate,
				onValueChange: (_event, date) => onChange(serialise(date)),
			});
			return;
		}
		setVisible(true);
	}

	function preview(_event: DateTimePickerChangeEvent, date: Date) {
		setDraft(date);
	}

	function choose() {
		onChange(serialise(draft));
		setVisible(false);
	}

	const dialog =
		Platform.OS === "android" ? null : (
			<Modal
				animationType="none"
				transparent
				visible={visible}
				onRequestClose={() => setVisible(false)}
			>
				<View accessibilityViewIsModal style={styles.overlay}>
					<Pressable
						accessibilityLabel={t(`${strings}.cancel`)}
						style={styles.scrim}
						onPress={() => setVisible(false)}
					/>
					<View style={styles.dialog}>
						<AppText variant="section">{label}</AppText>
						<DateTimePicker
							testID={`${mode}-picker`}
							value={visible ? draft : selected}
							mode={mode}
							display={mode === "date" ? "inline" : "spinner"}
							minimumDate={minimumDate}
							maximumDate={maximumDate}
							accentColor={theme.colors.accent}
							themeVariant={rt.themeName === "dark" ? "dark" : "light"}
							onValueChange={preview}
						/>
						<View style={styles.actions}>
							<Button
								label={t(`${strings}.cancel`)}
								variant="secondary"
								style={styles.action}
								onPress={() => setVisible(false)}
							/>
							<Button
								label={t(`${strings}.done`)}
								style={styles.action}
								onPress={choose}
							/>
						</View>
					</View>
				</View>
			</Modal>
		);

	return { open, dialog };
}

const styles = StyleSheet.create((theme) => ({
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
