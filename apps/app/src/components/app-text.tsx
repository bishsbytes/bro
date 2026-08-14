import type { ComponentProps } from "react";
import { Text } from "react-native";
import { useUnistyles } from "../theme/unistyles";

type TextVariant =
	| "display"
	| "title"
	| "section"
	| "score"
	| "body"
	| "label"
	| "caption"
	| "micro";

type TextColor =
	| "default"
	| "muted"
	| "subtle"
	| "brand"
	| "danger"
	| "onBrand";

type AppTextProps = ComponentProps<typeof Text> & {
	variant?: TextVariant;
	color?: TextColor;
};

export function AppText({
	variant = "body",
	color = "default",
	style,
	...props
}: AppTextProps) {
	const { theme } = useUnistyles();
	const colors = {
		default: theme.colors.text,
		muted: theme.colors.textMuted,
		subtle: theme.colors.textSubtle,
		brand: theme.colors.brand,
		danger: theme.colors.danger,
		onBrand: theme.colors.onBrand,
	};

	return (
		<Text
			{...props}
			style={[theme.typography[variant], { color: colors[color] }, style]}
		/>
	);
}
