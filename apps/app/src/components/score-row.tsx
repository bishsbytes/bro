import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon, type IconName } from "./icon";

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
	/** One face icon per score; when given, it replaces the visible numeral. */
	faces?: readonly IconName[];
	/** Visible meanings for the two ends of the scale. */
	endLabels?: Readonly<{ minimum: string; maximum: string }>;
	disabled?: boolean;
};

export function ScoreRow({
	accessibilityPrefix,
	selected,
	onSelect,
	scores = DEFAULT_SCORES,
	faces,
	endLabels,
	disabled = false,
}: ScoreRowProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
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
							const face = faces?.[index];
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
										isSelected && styles.selected,
										disabled && styles.disabled,
									]}
									onPress={() => onSelect(score)}
								>
									{face ? (
										<Icon
											testID={`score-face-${score}`}
											name={face}
											size={theme.typography.face.fontSize}
											color={
												isSelected ? theme.colors.brand : theme.colors.textMuted
											}
										/>
									) : (
										<AppText
											variant="score"
											style={[isSelected && styles.selectedText]}
										>
											{score}
										</AppText>
									)}
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
	row: { flexDirection: "row", gap: theme.spacing.sm },
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
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	gap: { flex: 1 },
	selected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	selectedText: { color: theme.colors.onSelected },
	disabled: { opacity: theme.opacity.disabled },
}));
