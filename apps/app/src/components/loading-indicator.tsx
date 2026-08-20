import type { ComponentProps } from "react";
import { ActivityIndicator } from "react-native";
import { useUnistyles } from "../theme/unistyles";

type LoadingIndicatorProps = ComponentProps<typeof ActivityIndicator>;

/**
 * A spinner without an explicit colour falls back to the platform accent on
 * Android, which ignores the accent the user picked. Every spinner in the app
 * states its colour, defaulting to the themed accent.
 */
export function LoadingIndicator({ color, ...props }: LoadingIndicatorProps) {
	const { theme } = useUnistyles();

	return <ActivityIndicator color={color ?? theme.colors.brand} {...props} />;
}
