import { useState } from "react";
import { View, type ViewStyle } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { useWebPickerInputStyle } from "./web-picker-input";

type TimeFieldProps = {
	label: string;
	value: string;
	onChangeTime: (time: string) => void;
	containerStyle?: ViewStyle;
	error?: string | null;
};

export function TimeField({
	label,
	value,
	onChangeTime,
	containerStyle,
	error,
}: TimeFieldProps) {
	const [focused, setFocused] = useState(false);
	const inputStyle = useWebPickerInputStyle({ focused, error });

	return (
		<View style={containerStyle}>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<input
				aria-label={label}
				type="time"
				value={value}
				style={inputStyle}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onChange={(event) =>
					onChangeTime((event.target as unknown as { value: string }).value)
				}
			/>
			{error ? (
				<AppText variant="caption" color="danger" style={styles.error}>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.sm },
	error: { marginTop: theme.spacing.xs },
}));
