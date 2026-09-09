import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";
import { MarkdownText } from "./markdown-text";

type NoteRowProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
	markdown: string;
	createdAt: number;
	updatedAt: number;
	first?: boolean;
};

/**
 * A saved note in a list. It stays on the screen's canvas rather than becoming
 * a nested surface; when there is another note below, one quiet line is enough
 * to show where the next touch target begins.
 */
export function NoteRow({
	markdown,
	createdAt,
	updatedAt,
	first = false,
	style,
	...props
}: NoteRowProps) {
	const { t } = useTranslation("notes");
	const { theme } = useUnistyles();
	const edited = updatedAt > createdAt;
	const time = new Date(edited ? updatedAt : createdAt).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<Pressable
			accessibilityRole="button"
			{...props}
			aria-disabled={!!props.disabled}
			accessibilityState={{
				...props.accessibilityState,
				disabled: !!props.disabled,
			}}
			style={(state) => [
				styles.row,
				first && styles.firstRow,
				typeof style === "function" ? style(state) : style,
				state.pressed && !props.disabled && styles.pressed,
				props.disabled && styles.disabled,
			]}
		>
			<View style={styles.content}>
				<MarkdownText markdown={markdown} containerStyle={styles.preview} />
				<AppText variant="footnote" color="subtle">
					{t(edited ? "row.editedAt" : "row.addedAt", { time })}
				</AppText>
			</View>
			<Icon
				name="chevron-right"
				size={24}
				color={theme.colors.ink3}
				testID="note-row-chevron"
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: {
		flexDirection: "row",
		alignItems: "center",
		minHeight: theme.control.buttonMinHeight,
		justifyContent: "center",
		gap: theme.spacing.md,
		paddingVertical: theme.spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: theme.colors.line,
		backgroundColor: theme.colors.canvas,
	},
	firstRow: {
		borderTopWidth: 1,
		borderTopColor: theme.colors.line,
	},
	pressed: { backgroundColor: theme.colors.rowPressed },
	disabled: { opacity: theme.opacity.disabled },
	content: { flex: 1, gap: theme.spacing.xs },
	// Two lines plus the largest gap a pair of formatted list items can carry.
	// A fixed preview viewport keeps list rows level without flattening Markdown.
	preview: {
		height: theme.typography.serifQuote.lineHeight * 2 + theme.spacing.xs,
		overflow: "hidden",
	},
}));
