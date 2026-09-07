import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { StyleSheet } from "../../theme/unistyles";

export function IntakeQuantityField({
	label,
	value,
	unit,
	step,
	disabled = false,
	onChange,
}: {
	label: string;
	value: string;
	unit: string;
	step: number;
	disabled?: boolean;
	onChange: (value: string) => void;
}) {
	const { t } = useTranslation("intake");
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
			<AppText variant="caption" color="muted">
				{unit}
			</AppText>
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
	row: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.control,
	},
	step: { width: theme.control.minHitArea, paddingHorizontal: 0 },
	grow: { flex: 1, minWidth: 0 },
	input: { textAlign: "center", ...theme.typography.monoReadout },
}));
