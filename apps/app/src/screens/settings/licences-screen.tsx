import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet } from "../../theme/unistyles";

export function LicencesScreen() {
	return (
		<Screen scroll padded gap="lg">
			<Card style={styles.section}>
				<SectionHeader title="Open Food Facts" eyebrow="FOOD DATA" />
				<View style={styles.section}>
					<AppText color="muted">
						Food search results are provided by Open Food Facts and its
						contributors.
					</AppText>
					<AppText color="muted">
						The Open Food Facts database is available under the Open Database
						License (ODbL) 1.0. The licence requires attribution and share-alike
						for public adaptations of the database.
					</AppText>
					<AppText variant="caption" color="subtle">
						Source: Open Food Facts · Licence: ODbL-1.0
					</AppText>
				</View>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
}));
