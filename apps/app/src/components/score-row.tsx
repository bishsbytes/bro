import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

const SCORES = [1, 2, 3, 4, 5] as const;

type ScoreRowProps = {
	/** Prefixes each button's accessibility label, as in "Mood 4". */
	accessibilityPrefix: string;
	selected: number | null;
	onSelect: (score: number) => void;
	/** One glyph per score; when given, the numeral drops to a caption below it. */
	faces?: readonly string[];
	disabled?: boolean;
};

export function ScoreRow({
	accessibilityPrefix,
	selected,
	onSelect,
	faces,
	disabled = false,
}: ScoreRowProps) {
	const { t } = useTranslation("common");
	return (
		<View style={styles.row}>
			{SCORES.map((score, index) => {
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
							<>
								<AppText style={styles.face}>{face}</AppText>
								<AppText
									variant="micro"
									color="subtle"
									style={[isSelected && styles.selectedText]}
								>
									{score}
								</AppText>
							</>
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
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	row: { flexDirection: "row", gap: theme.spacing.sm },
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
	selected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	selectedText: { color: theme.colors.onSelected },
	disabled: { opacity: theme.opacity.disabled },
	face: {
		fontSize: theme.typography.face.fontSize,
		lineHeight: theme.typography.face.lineHeight,
	},
}));
