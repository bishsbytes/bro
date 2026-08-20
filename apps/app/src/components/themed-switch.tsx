import type { ComponentProps } from "react";
import { Platform, Switch } from "react-native";
import { type createTheme, useUnistyles } from "../theme/unistyles";

type ThemedSwitchProps = Omit<
	ComponentProps<typeof Switch>,
	"trackColor" | "thumbColor" | "ios_backgroundColor"
>;

type SwitchTheme = Pick<ReturnType<typeof createTheme>, "colors">;

export function switchColors(
	theme: SwitchTheme,
	checked: boolean,
	platform: string,
) {
	const android = platform === "android";
	return {
		trackColor: {
			false: theme.colors.border,
			true: android ? theme.colors.selected : theme.colors.brand,
		},
		thumbColor: android
			? checked
				? theme.colors.brand
				: theme.colors.textSubtle
			: undefined,
	};
}

export function ThemedSwitch({ value = false, ...props }: ThemedSwitchProps) {
	const { theme } = useUnistyles();
	const colors = switchColors(theme, value, Platform.OS);

	return <Switch {...props} {...colors} value={value} />;
}
