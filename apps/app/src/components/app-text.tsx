import type { ComponentProps } from "react";
import { Text } from "react-native";
import { useUnistyles } from "../theme/unistyles";

type TextVariant =
	| "largeTitle"
	| "metric"
	| "monoDial"
	| "monoReadout"
	| "monoList"
	| "monoInline"
	| "serifQuote"
	| "display"
	| "title"
	| "section"
	| "score"
	| "lead"
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
	| "mind"
	| "body"
	| "sleep"
	| "load"
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
		default: theme.colors.ink,
		muted: theme.colors.ink2,
		subtle: theme.colors.ink3,
		brand: theme.colors.accent,
		danger: theme.colors.alert,
		mind: theme.colors.mind,
		body: theme.colors.body,
		sleep: theme.colors.sleep,
		load: theme.colors.load,
		onBrand: theme.colors.onAccent,
	};

	return (
		<Text
			{...props}
			style={[theme.typography[variant], { color: colors[color] }, style]}
		/>
	);
}
