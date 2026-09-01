import { View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

/** Visible meanings for the two ends of a rating scale. */
export type EndLabels = Readonly<{ minimum: string; maximum: string }>;

/** Names both ends of a scale, so its numbers carry a direction on sight. */
export function ScaleEndLabels({ minimum, maximum }: EndLabels) {
	return (
		<View style={styles.endLabels}>
			<AppText variant="micro" color="subtle">
				{minimum}
			</AppText>
			<AppText variant="micro" color="subtle">
				{maximum}
			</AppText>
		</View>
	);
}

const styles = StyleSheet.create(() => ({
	endLabels: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
}));
