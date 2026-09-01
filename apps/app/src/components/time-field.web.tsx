import { type CSSProperties, useState } from "react";
import { View, type ViewStyle } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";

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
	const { theme, rt } = useUnistyles();
	const [focused, setFocused] = useState(false);
	const inputStyle: CSSProperties = {
		boxSizing: "border-box",
		width: "100%",
		height: theme.control.buttonMinHeight,
		borderWidth: focused ? 2 : 1,
		borderStyle: "solid",
		borderColor: error
			? theme.colors.alert
			: focused
				? theme.colors.accent
				: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
		fontSize: theme.typography.label.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		fontVariantNumeric: "tabular-nums",
		color: theme.colors.ink,
		backgroundColor: theme.colors.surface,
		colorScheme: rt.themeName === "dark" ? "dark" : "light",
		outline: "none",
	};

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
