import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { StyleSheet } from "../../theme/unistyles";

export function PrivacyContent() {
	return (
		<View style={styles.content}>
			<AppText variant="display">Where your data lives</AppText>

			<View style={styles.section}>
				<AppText variant="label">On this device</AppText>
				<AppText color="muted">
					Your check-ins, notes, food logs, and other records are stored by bro
					on this device. Health data you import is read here too. Without
					optional sync, those records are never sent to bro's servers.
				</AppText>
				<AppText color="muted">
					Your phone's platform backup may include bro's local records, depending
					on your Apple or Google backup settings. That backup is managed by your
					platform provider, not by bro.
				</AppText>
			</View>

			<View style={styles.section}>
				<AppText variant="label">Food search</AppText>
				<AppText color="muted">
					When you search for food, the text you type is sent to bro's server,
					which asks the food database provider for results. The query is not
					stored or tied to an account, device, or food log. Logging and everything
					else continue to work offline.
				</AppText>
			</View>

			<View style={styles.section}>
				<AppText variant="label">Optional sync</AppText>
				<AppText color="muted">
					Sync is off unless you explicitly turn it on. If you choose it when it
					becomes available, your user-authored records and daily health summaries
					will be copied to your account so they can appear on your other devices.
					Detailed imported health samples and the food-search cache will remain
					device-local.
				</AppText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	content: { gap: theme.spacing.xl },
	section: { gap: theme.spacing.sm },
}));
