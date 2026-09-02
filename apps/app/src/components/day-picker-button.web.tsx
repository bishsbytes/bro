import { localDayOf } from "@bro/domain";
import { type CSSProperties, useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type DayPickerButtonProps = {
	label: string;
	value: string;
	/**
	 * Ignored here: the browser's own date control renders the day in the
	 * reader's locale, and replacing that with our wording would cost the
	 * keyboard entry and calendar popover that come with it.
	 */
	displayValue: string;
	onChangeDate: (localDay: string) => void;
	minimumDate?: Date;
	maximumDate?: Date;
};

/** Web twin of the header day chooser — see ./day-picker-button.tsx. */
export function DayPickerButton({
	label,
	value,
	onChangeDate,
	minimumDate,
	maximumDate,
}: DayPickerButtonProps) {
	const { theme, rt } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const inputStyle: CSSProperties = {
		boxSizing: "border-box",
		height: theme.control.buttonMinHeight,
		borderWidth: focused ? 2 : 1,
		borderStyle: "solid",
		borderColor: focused ? theme.colors.accent : "transparent",
		borderRadius: theme.radius.pill,
		padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
		fontSize: theme.typography.label.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		fontVariantNumeric: "tabular-nums",
		color: theme.colors.ink,
		backgroundColor: "transparent",
		colorScheme: rt.themeName === "dark" ? "dark" : "light",
		outline: "none",
	};

	return (
		<View style={styles.wrapper}>
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
		</View>
	);
}

const styles = StyleSheet.create(() => ({
	wrapper: { alignItems: "flex-end", justifyContent: "center" },
}));
