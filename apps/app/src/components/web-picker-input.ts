import type { CSSProperties } from "react";
import { useUnistyles } from "../theme/unistyles";

/**
 * Styling for the browser's own `<input type="date">` / `<input type="time">`.
 *
 * Web builds hand date and time entry to the platform control rather than the
 * modal the native builds use, so this is the one place the app's type, colour
 * and focus treatment are applied to it. Imported only from `.web.tsx` files,
 * which is what keeps it out of the native bundle.
 *
 * `field` fills the width of a form row; `chip` is the compact pill a
 * navigation bar has room for.
 */
export function useWebPickerInputStyle({
	variant = "field",
	focused,
	error,
}: {
	variant?: "field" | "chip";
	focused: boolean;
	error?: string | null;
}): CSSProperties {
	const { theme, rt } = useUnistyles();
	const chip = variant === "chip";

	return {
		boxSizing: "border-box",
		width: chip ? undefined : "100%",
		height: theme.control.buttonMinHeight,
		borderWidth: focused ? 2 : 1,
		borderStyle: "solid",
		borderColor: error
			? theme.colors.alert
			: focused
				? theme.colors.accent
				: chip
					? theme.colors.line
					: theme.colors.lineStrong,
		borderRadius: chip ? theme.radius.pill : theme.radius.md,
		padding: chip
			? `${theme.spacing.xs}px ${theme.spacing.md}px`
			: `${theme.spacing.md}px ${theme.spacing.lg}px`,
		fontSize: theme.typography.label.fontSize,
		fontFamily: theme.typography.body.fontFamily,
		fontVariantNumeric: "tabular-nums",
		color: theme.colors.ink,
		backgroundColor: theme.colors.surface,
		colorScheme: rt.themeName === "dark" ? "dark" : "light",
		outline: "none",
	};
}
