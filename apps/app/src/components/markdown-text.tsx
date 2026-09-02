import type { ViewStyle } from "react-native";
import {
	EnrichedMarkdownText,
	type MarkdownStyle,
} from "react-native-enriched-markdown";
import { useUnistyles } from "../theme/unistyles";

type MarkdownTextProps = {
	/** The note as it was written, in markdown. */
	markdown: string;
	containerStyle?: ViewStyle;
	onLinkPress?: (url: string) => void;
};

/**
 * A note rendered the way it was written — bold, italic and lists resolved
 * rather than shown as their markdown punctuation.
 *
 * Every surface that shows a saved note goes through here, so a note reads the
 * same in the list, on the home screen and in the day it belongs to. Notes
 * written before the composer could format are plain prose, which markdown
 * renders unchanged.
 */
export function MarkdownText({
	markdown,
	containerStyle,
	onLinkPress,
}: MarkdownTextProps) {
	const { theme } = useUnistyles();
	// Rebuilt per theme rather than memoised: `useUnistyles` already re-renders
	// on a theme change, and this is a plain object literal either way.
	const markdownStyle: MarkdownStyle = {
		paragraph: {
			fontFamily: theme.typography.lead.fontFamily,
			fontSize: theme.typography.lead.fontSize,
			lineHeight: theme.typography.lead.lineHeight,
			color: theme.colors.ink,
			marginTop: 0,
			// The editor treats each paragraph as the next line in one note. Keep
			// that rhythm here instead of inserting renderer-default block gaps.
			marginBottom: 0,
		},
		// The real cuts are loaded, so tell the renderer to set them as they are
		// instead of slanting and thickening the regular face on top of them.
		strong: { fontFamily: "SourceSerif4_600SemiBold", fontWeight: "normal" },
		em: { fontFamily: "SourceSerif4_400Regular_Italic", fontStyle: "normal" },
		list: {
			fontFamily: theme.typography.lead.fontFamily,
			fontSize: theme.typography.lead.fontSize,
			lineHeight: theme.typography.lead.lineHeight,
			color: theme.colors.ink,
			bulletColor: theme.colors.ink2,
			markerColor: theme.colors.ink2,
			gapWidth: theme.spacing.sm,
			marginLeft: theme.spacing.sm,
			marginTop: 0,
			marginBottom: 0,
			itemSpacing: theme.spacing.xs,
		},
		link: { color: theme.colors.accent, underline: true },
	};

	return (
		<EnrichedMarkdownText
			markdown={markdown}
			markdownStyle={markdownStyle}
			containerStyle={containerStyle}
			onLinkPress={onLinkPress ? ({ url }) => onLinkPress(url) : undefined}
			// A list row opens the note it contains, and a selectable text view would
			// take the press and long press for itself. Off everywhere so a saved note
			// answers a touch the same way wherever it is read.
			selectable={false}
		/>
	);
}
