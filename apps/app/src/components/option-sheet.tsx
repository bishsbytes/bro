import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import type { IconName } from "./icon";
import { ModalSheet } from "./modal-sheet";
import { OptionRow } from "./option-row";
import { SectionHeader } from "./section-header";

export type SheetOption<Value extends string> = {
	value: Value;
	label: string;
	detail?: string;
	icon?: IconName;
	accessibilityLabel: string;
};

type OptionSheetProps<Value extends string> = {
	visible: boolean;
	title: string;
	intro?: string;
	/** Extra line under the intro, such as the default a choice inherits. */
	note?: string;
	closeAccessibilityLabel: string;
	options: readonly SheetOption<Value>[];
	disabled?: boolean;
	onClose: () => void;
} & (
	| {
			selection?: "single";
			selected: Value | null;
			onSelect: (value: Value) => void;
	  }
	| {
			selection: "multiple";
			selected: readonly Value[];
			onSelect: (value: Value) => void;
	  }
);

/**
 * The control behind a settings row. A single choice answers the row and
 * dismisses; a multiple choice stays open so a whole group can be set in one
 * visit.
 */
export function OptionSheet<Value extends string>(
	props: OptionSheetProps<Value>,
) {
	const {
		visible,
		title,
		intro,
		note,
		closeAccessibilityLabel,
		options,
		disabled = false,
		onClose,
	} = props;
	const multiple = props.selection === "multiple";

	function isSelected(value: Value) {
		return props.selection === "multiple"
			? props.selected.includes(value)
			: props.selected === value;
	}

	function choose(value: Value) {
		props.onSelect(value);
		if (!multiple) onClose();
	}

	return (
		<ModalSheet
			visible={visible}
			onClose={onClose}
			closeAccessibilityLabel={closeAccessibilityLabel}
		>
			<View style={styles.header}>
				<SectionHeader title={title} />
				{intro ? <AppText color="muted">{intro}</AppText> : null}
				{note ? (
					<AppText variant="caption" color="muted">
						{note}
					</AppText>
				) : null}
			</View>
			<View
				accessibilityRole={multiple ? "list" : "radiogroup"}
				accessibilityLabel={title}
				style={styles.options}
			>
				{options.map((option) => (
					<OptionRow
						key={option.value}
						label={option.label}
						detail={option.detail}
						icon={option.icon}
						selection={multiple ? "multiple" : "single"}
						selected={isSelected(option.value)}
						accessibilityLabel={option.accessibilityLabel}
						disabled={disabled}
						onPress={() => choose(option.value)}
					/>
				))}
			</View>
		</ModalSheet>
	);
}

const styles = StyleSheet.create((theme) => ({
	header: { gap: theme.spacing.sm },
	options: { gap: theme.spacing.sm },
}));
