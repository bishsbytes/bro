import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";
import { usePickerDialog } from "./picker-dialog";

type DayPickerButtonProps = {
	/** Announced by the button, and the heading of the picker dialog. */
	label: string;
	/** The chosen day, as YYYY-MM-DD. */
	value: string;
	/** How that day reads on the button — "Today", "12 Aug". */
	displayValue: string;
	onChangeDate: (localDay: string) => void;
	minimumDate?: Date;
	maximumDate?: Date;
};

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
	const { theme } = useUnistyles();
	const { open, dialog } = usePickerDialog({
		label,
		mode: "date",
		value,
		onChange: onChangeDate,
		minimumDate,
		maximumDate,
	});

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={t("datePicker.openHint")}
				accessibilityValue={{ text: value }}
				hitSlop={12}
				style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
				onPress={open}
			>
				<Icon name="calendar" color={theme.colors.ink2} size={18} />
				<AppText variant="label">{displayValue}</AppText>
				<Icon name="chevron-down" color={theme.colors.ink2} size={18} />
			</Pressable>
			{dialog}
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
}));
