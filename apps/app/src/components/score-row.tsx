import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { StyleSheet, useUnistyles } from "../theme/unistyles";
import { AppText } from "./app-text";
import { Icon } from "./icon";
import { type EndLabels, ScaleEndLabels } from "./scale-end-labels";

/** The daily five-point scale. Longer ones belong on a DiscreteScale, which
 *  stays thumb-sized past five stops where a row of buttons does not. */
const SCORES = [1, 2, 3, 4, 5] as const;

type ScoreRowProps = {
	/** Prefixes each button's accessibility label, as in "Mood 4". */
	accessibilityPrefix: string;
	selected: number | null;
	onSelect: (score: number) => void;
	/** Existing meanings for each point; numeric values remain unchanged. */
	labels?: readonly string[];
	/** Retained for older callers; all selection rows now have equal height. */
	varyHeight?: boolean;
	endLabels?: EndLabels;
	disabled?: boolean;
};

export function ScoreRow({
	accessibilityPrefix,
	selected,
	onSelect,
	labels,
	varyHeight: _varyHeight = false,
	endLabels,
	disabled = false,
}: ScoreRowProps) {
	const { t } = useTranslation("common");
	const { theme } = useUnistyles();
	return (
		<View style={styles.container}>
			<View
				style={styles.row}
				accessibilityRole="radiogroup"
				accessibilityLabel={accessibilityPrefix}
			>
				{SCORES.map((score, index) => {
					const isSelected = selected === score;
					const label = labels?.[index];
					return (
						<TouchableOpacity
							key={score}
							accessibilityRole="radio"
							accessibilityLabel={t("a11y.score", {
								prefix: accessibilityPrefix,
								score,
							})}
							accessibilityHint={label}
							accessibilityState={{
								selected: isSelected,
								checked: isSelected,
								disabled,
							}}
							disabled={disabled}
							style={[
								styles.button,
								isSelected && styles.selected,
								disabled && styles.disabled,
							]}
							onPress={() => onSelect(score)}
						>
							<AppText
								variant="body"
								style={[styles.buttonLabel, isSelected && styles.selectedText]}
							>
								{label ?? score}
							</AppText>
							{isSelected ? (
								<View
									accessible={false}
									importantForAccessibility="no-hide-descendants"
								>
									<Icon name="check" size={24} color={theme.colors.onBrand} />
								</View>
							) : null}
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
	row: { gap: theme.spacing.sm },
	button: {
		flexDirection: "row",
		gap: theme.spacing.md,
		padding: theme.spacing.lg,
		borderWidth: 1,
		borderColor: theme.colors.interactiveBorder,
		minHeight: theme.control.scoreMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface2,
	},
	buttonLabel: { flex: 1 },
	selected: {
		backgroundColor: theme.colors.brand,
		borderColor: theme.colors.brand,
	},
	selectedText: { color: theme.colors.onBrand },
	disabled: { opacity: theme.opacity.disabled },
}));
