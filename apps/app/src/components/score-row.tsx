import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

const DEFAULT_SCORES = [1, 2, 3, 4, 5] as const;

/** Longer scales wrap instead of shrinking every button past a thumb. */
const MAX_PER_ROW = 5;

type ScoreRowProps = {
	/** Prefixes each button's accessibility label, as in "Mood 4". */
	accessibilityPrefix: string;
	selected: number | null;
	onSelect: (score: number) => void;
	/** The scale on offer, lowest first; defaults to the daily five-point one. */
	scores?: readonly number[];
	/** Visible meanings for each point, used by the Baseline mood scale. */
	labels?: readonly string[];
	/** Encodes the scale by shape as well as copy, from 52 through 108px. */
	varyHeight?: boolean;
	/** Visible meanings for the two ends of the scale. */
	endLabels?: Readonly<{ minimum: string; maximum: string }>;
	disabled?: boolean;
};

export function ScoreRow({
	accessibilityPrefix,
	selected,
	onSelect,
	scores = DEFAULT_SCORES,
	labels,
	varyHeight = false,
	endLabels,
	disabled = false,
}: ScoreRowProps) {
	const { t } = useTranslation("common");
	const rows: number[][] = [];
	for (let start = 0; start < scores.length; start += MAX_PER_ROW) {
		rows.push([...scores.slice(start, start + MAX_PER_ROW)]);
	}
	return (
		<View style={styles.container}>
			<View style={styles.rows}>
				{rows.map((row, rowIndex) => (
					<View key={row[0]} style={styles.row}>
						{row.map((score, column) => {
							const index = rowIndex * MAX_PER_ROW + column;
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
										style={[
											styles.buttonLabel,
											isSelected && styles.selectedText,
										]}
									>
										{label ?? score}
									</AppText>
								</TouchableOpacity>
							);
						})}
						{/* A short final row keeps the button width of the rows above it. */}
						{Array.from({ length: MAX_PER_ROW - row.length }, (_, gap) => (
							<View key={`gap-${gap}`} style={styles.gap} />
						))}
					</View>
				))}
			</View>
			{endLabels ? (
				<View style={styles.endLabels}>
					<AppText variant="micro" color="subtle">
						{endLabels.minimum}
					</AppText>
					<AppText variant="micro" color="subtle">
						{endLabels.maximum}
					</AppText>
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { gap: theme.spacing.xs },
	rows: { gap: theme.spacing.sm },
	row: { flexDirection: "row", alignItems: "flex-end", gap: theme.spacing.sm },
	endLabels: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
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
	gap: { flex: 1 },
	selected: {
		borderColor: theme.colors.accent,
		backgroundColor: theme.colors.accentTint,
	},
	selectedText: { color: theme.colors.ink },
	disabled: { opacity: theme.opacity.disabled },
}));
