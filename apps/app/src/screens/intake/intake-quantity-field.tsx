import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { Icon } from "../../components/icon";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

export function IntakeQuantityField({
	label,
	value,
	unit,
	step,
	disabled = false,
	onChange,
	options,
}: {
	label: string;
	value: string;
	unit: string;
	step: number;
	disabled?: boolean;
	onChange: (value: string) => void;
	options?: {
		id: string;
		label: string;
		accessibilityLabel?: string;
		selected: boolean;
		onSelect: () => void;
	}[];
}) {
	const { t } = useTranslation("intake");
	const { theme } = useUnistyles();
	const [expanded, setExpanded] = useState(false);
	const number = Number(value);
	const valid = value.trim() !== "" && Number.isFinite(number) && number > 0;
	const change = (direction: number) => {
		const next = (valid ? number : 0) + direction * step;
		onChange(String(Number(Math.max(step, next).toFixed(6))));
	};
	return (
		<View style={styles.field}>
			<AppText variant="label">{label}</AppText>
			<View style={styles.row}>
				<View style={styles.stepper}>
					<Button
						label="−"
						accessibilityLabel={t("log.fewer")}
						variant="text"
						disabled={disabled || !valid || number <= step}
						style={styles.step}
						onPress={() => change(-1)}
					/>
					<FormField
						label={label}
						showLabel={false}
						value={value}
						onChangeText={onChange}
						keyboardType="decimal-pad"
						editable={!disabled}
						containerStyle={styles.grow}
						style={styles.input}
					/>
					<Button
						label="+"
						accessibilityLabel={t("log.more")}
						variant="text"
						disabled={disabled}
						style={styles.step}
						onPress={() => change(1)}
					/>
				</View>
				{options ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={t("log.chooseUnit")}
						accessibilityValue={{ text: unit }}
						accessibilityState={{ expanded, disabled }}
						disabled={disabled}
						onPress={() => setExpanded((current) => !current)}
						style={styles.unit}
					>
						<AppText variant="caption" style={styles.unitText}>
							{unit}
						</AppText>
						<Icon name="chevron-down" size={16} color={theme.colors.ink2} />
					</Pressable>
				) : (
					<View style={styles.unit}>
						<AppText variant="caption" style={styles.unitText}>
							{unit}
						</AppText>
					</View>
				)}
			</View>
			{expanded ? (
				<View
					style={styles.options}
					accessibilityRole="radiogroup"
					accessibilityLabel={t("log.chooseUnit")}
				>
					{options?.map((option) => (
						<Button
							key={option.id}
							label={option.label}
							accessibilityLabel={option.accessibilityLabel}
							accessibilityRole="radio"
							accessibilityState={{
								selected: option.selected,
								checked: option.selected,
								disabled,
							}}
							disabled={disabled}
							variant={option.selected ? "primary" : "secondary"}
							onPress={() => {
								option.onSelect();
								setExpanded(false);
							}}
						/>
					))}
				</View>
			) : null}
			{!valid ? (
				<AppText accessibilityRole="alert" variant="caption" color="danger">
					{t("log.quantityError")}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	field: { gap: theme.spacing.sm },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
	stepper: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.control,
	},
	step: { width: theme.control.minHitArea, paddingHorizontal: 0 },
	grow: { flex: 1, minWidth: 0 },
	input: {
		textAlign: "center",
		paddingHorizontal: theme.spacing.xs,
		...theme.typography.monoList,
	},
	unit: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.sm,
		minWidth: theme.control.minHitArea,
		maxWidth: "40%",
		minHeight: theme.control.buttonMinHeight,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.line,
		borderRadius: theme.radius.pill,
	},
	unitText: { flexShrink: 1, textAlign: "center" },
	options: { gap: theme.spacing.sm },
}));
