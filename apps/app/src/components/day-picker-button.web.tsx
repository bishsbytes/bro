import { localDayOf } from "@bro/domain";
import { useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { useWebPickerInputStyle } from "./web-picker-input";

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
	const [focused, setFocused] = useState(false);
	const inputStyle = useWebPickerInputStyle({ variant: "chip", focused });

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
