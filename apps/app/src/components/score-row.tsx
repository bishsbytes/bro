import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { type EndLabels, ScaleEndLabels } from "./scale-end-labels";

/** The daily five-point scale. Longer ones belong on a DiscreteScale, which
 *  stays thumb-sized past five stops where a row of buttons does not. */
const SCORES = [1, 2, 3, 4, 5] as const;

type ScoreRowProps = {
	/** Prefixes each button's accessibility label, as in "Mood 4". */
	accessibilityPrefix: string;
	selected: number | null;
	onSelect: (score: number) => void;
	/** Visible meanings for each point, used by the Baseline mood scale. */
	labels?: readonly string[];
	/** Encodes the scale by shape as well as copy, from 52 through 108px. */
	varyHeight?: boolean;
	endLabels?: EndLabels;
	disabled?: boolean;
};

export function ScoreRow({
	accessibilityPrefix,
	selected,
	onSelect,
	labels,
	varyHeight = false,
	endLabels,
	disabled = false,
}: ScoreRowProps) {
	const { t } = useTranslation("common");
	return (
		<View style={styles.container}>
			<View style={styles.row}>
				{SCORES.map((score, index) => {
					const isSelected = selected === score;
					const label = labels?.[index];
					return (
						<TouchableOpacity
							key={score}
							accessibilityRole="button"
							accessibilityLabel={t("a11y.score", {
								prefix: accessibilityPrefix,
								score,
							})}
							accessibilityState={{ selected: isSelected, disabled }}
							disabled={disabled}
							style={[
								styles.button,
								varyHeight && {
									height: [52, 64, 80, 96, 108][index] ?? 52,
								},
								isSelected && styles.selected,
								disabled && styles.disabled,
							]}
							onPress={() => onSelect(score)}
						>
							<AppText
								variant={label ? "caption" : "score"}
								style={[styles.buttonLabel, isSelected && styles.selectedText]}
							>
								{label ?? score}
							</AppText>
						</TouchableOpacity>
					);
				})}
			</View>
			{endLabels ? <ScaleEndLabels {...endLabels} /> : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { gap: theme.spacing.xs },
	row: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm },
	button: {
		flex: 1,
		minHeight: theme.control.scoreMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	buttonLabel: { textAlign: "center" },
	selected: {
		borderColor: theme.colors.accent,
		backgroundColor: theme.colors.accentTint,
	},
	selectedText: { color: theme.colors.ink },
	disabled: { opacity: theme.opacity.disabled },
}));
