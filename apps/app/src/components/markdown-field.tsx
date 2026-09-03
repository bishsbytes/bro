import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, type TextStyle, View, type ViewStyle } from "react-native";
import {
	EnrichedMarkdownTextInput,
	type EnrichedMarkdownTextInputInstance,
	type StyleState,
} from "react-native-enriched-markdown";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";

type MarkdownFieldProps = {
	label: string;
	showLabel?: boolean;
	accessibilityLabel?: string;
	/**
	 * The markdown the field opens with. The native input owns its text from
	 * then on, so a later change to this value is ignored — remount the field
	 * (key it by the note) to load a different note into it.
	 */
	defaultValue?: string;
	onChangeMarkdown: (markdown: string) => void;
	placeholder?: string;
	autoFocus?: boolean;
	/**
	 * "boxed" draws the bordered field used inside a card. "flush" drops the
	 * border and fills its container, for a screen that is nothing but the note.
	 */
	appearance?: "boxed" | "flush";
	containerStyle?: ViewStyle;
};

type FormatAction = {
	icon: IconName;
	/** Key in the `common` catalogue naming this control to a screen reader. */
	label: "format.bold" | "format.italic" | "format.list";
	isActive: (state: StyleState) => boolean;
	apply: (input: EnrichedMarkdownTextInputInstance) => void;
};

/**
 * The three ways a note can be shaped. Deliberately short: a note is prose
 * with the occasional emphasis or list, not a document, and every control here
 * costs room on the row above the keyboard.
 */
const ACTIONS: readonly FormatAction[] = [
	{
		icon: "bold",
		label: "format.bold",
		isActive: (state) => state.bold.isActive,
		apply: (input) => input.toggleBold(),
	},
	{
		icon: "italic",
		label: "format.italic",
		isActive: (state) => state.italic.isActive,
		apply: (input) => input.toggleItalic(),
	},
	{
		icon: "list",
		label: "format.list",
		isActive: (state) => state.unorderedList.isActive,
		apply: (input) => input.toggleUnorderedList(),
	},
];

/**
 * A note composer: a markdown input with bold, italic and bullet-list toggles
 * on a row beneath it.
 *
 * The toggles report the style the cursor sits in rather than only the style of
 * a selection, so a writer can switch bold on and type into it. That is why the
 * row stays on screen instead of hiding behind a text selection.
 */
export function MarkdownField({
	label,
	showLabel = true,
	accessibilityLabel = label,
	defaultValue,
	onChangeMarkdown,
	placeholder,
	autoFocus = false,
	appearance = "boxed",
	containerStyle,
}: MarkdownFieldProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	const input = useRef<EnrichedMarkdownTextInputInstance>(null);
	const [state, setState] = useState<StyleState | null>(null);
	const [focused, setFocused] = useState(false);

	// The native input takes one flat style object rather than the array a React
	// Native component would accept, so its look is composed here instead of in
	// the stylesheet below.
	const flush = appearance === "flush";
	const inputStyle: TextStyle = {
		fontFamily: theme.typography.lead.fontFamily,
		fontSize: theme.typography.lead.fontSize,
		// The enriched native editor interprets lineHeight as physical pixels on
		// Android while fontSize is density-scaled. Supplying Helm's 26pt line
		// height therefore clips the 21pt serif face on high-density screens.
		// Let the native typeface provide its own readable leading here.
		fontWeight: "400",
		color: theme.colors.ink,
		...(flush
			? { flex: 1 }
			: {
					minHeight: theme.control.noteMinHeight,
					borderWidth: focused ? 2 : 1,
					borderColor: focused ? theme.colors.accent : theme.colors.lineStrong,
					borderRadius: theme.radius.md,
					paddingHorizontal: theme.spacing.lg,
					paddingVertical: theme.spacing.md,
					backgroundColor: theme.colors.surface,
				}),
	};

	return (
		<View style={containerStyle}>
			{showLabel ? (
				<AppText variant="label" style={styles.label}>
					{label}
				</AppText>
			) : null}
			<EnrichedMarkdownTextInput
				ref={input}
				accessibilityLabel={accessibilityLabel}
				defaultValue={defaultValue}
				onChangeMarkdown={onChangeMarkdown}
				onChangeState={setState}
				placeholder={placeholder}
				placeholderTextColor={theme.colors.ink3}
				autoFocus={autoFocus}
				markdownStyle={{
					strong: { color: theme.colors.ink },
					em: { color: theme.colors.ink },
					link: { color: theme.colors.accent },
					h1: { color: theme.colors.ink },
					h2: { color: theme.colors.ink },
					h3: { color: theme.colors.ink },
					h4: { color: theme.colors.ink },
					h5: { color: theme.colors.ink },
					h6: { color: theme.colors.ink },
					list: { itemSpacing: theme.spacing.xs },
				}}
				cursorColor={theme.colors.accent}
				selectionColor={theme.colors.accentTint}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				style={inputStyle}
			/>
			<View style={styles.toolbar}>
				{ACTIONS.map((action) => {
					const active = state !== null && action.isActive(state);
					return (
						<Pressable
							key={action.icon}
							accessibilityRole="button"
							accessibilityLabel={t(action.label)}
							accessibilityState={{ selected: active }}
							onPress={() => {
								const instance = input.current;
								if (instance) action.apply(instance);
							}}
							style={[styles.toolbarButton, active && styles.toolbarActive]}
						>
							<Icon
								name={action.icon}
								size={theme.control.focusIconSize}
								color={active ? theme.colors.accent : theme.colors.ink2}
							/>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.sm },
	toolbar: {
		flexDirection: "row",
		gap: theme.spacing.xs,
		paddingTop: theme.spacing.sm,
	},
	toolbarButton: {
		minWidth: theme.control.buttonMinHeight,
		minHeight: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.md,
	},
	toolbarActive: { backgroundColor: theme.colors.accentTint },
}));
