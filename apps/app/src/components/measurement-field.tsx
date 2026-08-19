import {
	COMPOUND_UNIT_PARTS,
	type DisplayUnit,
	isCompoundDisplayUnit,
	type MeasurementEntry,
} from "@bro/domain";
import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { FormField } from "./form-field";

/** Spoken names for the parts of a compound field, for screen readers. */
const UNIT_PART_NAMES: Record<DisplayUnit, string> = {
	kg: "kilograms",
	lb: "pounds",
	st: "stones",
	cm: "centimetres",
	in: "inches",
	ft: "feet",
	"%": "percent",
};

type MeasurementFieldProps = {
	label: string;
	unit: DisplayUnit;
	entry: MeasurementEntry;
	onChangeEntry: (entry: MeasurementEntry) => void;
	/** Base for the spoken label; the unit name is appended to each part. */
	accessibilityLabel?: string;
	placeholder?: string;
	error?: string | null;
	editable?: boolean;
};

/**
 * Measurement entry. A compound unit gets one numeric field per part, each
 * labelled with the unit it counts, so what a field wants is visible before
 * anything is typed and the keyboard stays numeric throughout.
 */
export function MeasurementField({
	label,
	unit,
	entry,
	onChangeEntry,
	accessibilityLabel,
	placeholder,
	error,
	editable = true,
}: MeasurementFieldProps) {
	if (!isCompoundDisplayUnit(unit)) {
		return (
			<FormField
				label={`${label} (${unit})`}
				accessibilityLabel={accessibilityLabel ?? `${label} (${unit})`}
				value={entry.major}
				onChangeText={(major) => onChangeEntry({ major, minor: "" })}
				placeholder={placeholder}
				keyboardType="decimal-pad"
				autoCapitalize="none"
				editable={editable}
				error={error}
			/>
		);
	}

	const spokenBase = accessibilityLabel ?? label;
	const minorUnit = COMPOUND_UNIT_PARTS[unit].minor;

	return (
		<View>
			<AppText variant="label" style={styles.label}>
				{label}
			</AppText>
			<View style={styles.parts}>
				<View style={styles.part}>
					<FormField
						label={`${spokenBase} (${UNIT_PART_NAMES[unit]})`}
						showLabel={false}
						containerStyle={styles.partInput}
						value={entry.major}
						onChangeText={(major) => onChangeEntry({ ...entry, major })}
						keyboardType="decimal-pad"
						editable={editable}
					/>
					<AppText variant="label" color="muted">
						{unit}
					</AppText>
				</View>
				<View style={styles.part}>
					<FormField
						label={`${spokenBase} (${UNIT_PART_NAMES[minorUnit]})`}
						showLabel={false}
						containerStyle={styles.partInput}
						value={entry.minor}
						onChangeText={(minor) => onChangeEntry({ ...entry, minor })}
						keyboardType="decimal-pad"
						editable={editable}
					/>
					<AppText variant="label" color="muted">
						{minorUnit}
					</AppText>
				</View>
			</View>
			{error ? (
				<AppText variant="caption" color="danger" style={styles.error}>
					{error}
				</AppText>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	label: { marginBottom: theme.spacing.sm, fontWeight: "600" },
	parts: { flexDirection: "row", gap: theme.spacing.md },
	part: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
	partInput: { flex: 1 },
	error: { marginTop: theme.spacing.xs },
}));
