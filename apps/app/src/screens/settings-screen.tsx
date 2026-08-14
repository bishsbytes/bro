import { deleteLocalProductData } from "@bro/database-app";
import { router } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

const DELETE_LOCAL_DATA_COPY =
	"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.";

type SettingsScreenProps = {
	deleteProductData?: () => Promise<void>;
};

type DeleteStep = "idle" | "confirm" | "complete";

export function SettingsScreen({
	deleteProductData = deleteLocalProductData,
}: SettingsScreenProps) {
	const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirmDelete() {
		if (deleting) {
			return;
		}

		setDeleting(true);
		setError(null);
		try {
			await deleteProductData();
			setDeleteStep("complete");
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Local data could not be deleted.",
			);
		} finally {
			setDeleting(false);
		}
	}

	return (
		<SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
			<ScrollView contentContainerStyle={styles.container}>
				<TouchableOpacity onPress={() => router.back()}>
					<Text style={styles.back}>Back</Text>
				</TouchableOpacity>
				<Text style={styles.title}>Settings</Text>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Data on this device</Text>
					{deleteStep === "idle" ? (
						<>
							<Text style={styles.detail}>
								Delete your check-ins, notes, and metric preferences from this
								device.
							</Text>
							<TouchableOpacity
								style={styles.dangerOutlineButton}
								onPress={() => {
									setError(null);
									setDeleteStep("confirm");
								}}
							>
								<Text style={styles.dangerOutlineText}>Delete local data</Text>
							</TouchableOpacity>
						</>
					) : null}

					{deleteStep === "confirm" ? (
						<View style={styles.confirmation}>
							<Text style={styles.warningTitle}>Delete local data?</Text>
							<Text style={styles.detail}>{DELETE_LOCAL_DATA_COPY}</Text>
							{error ? <Text style={styles.error}>{error}</Text> : null}
							<TouchableOpacity
								disabled={deleting}
								style={[
									styles.dangerButton,
									deleting && styles.disabled,
								]}
								onPress={() => void confirmDelete()}
							>
								{deleting ? (
									<ActivityIndicator color={styles.dangerButtonText.color} />
								) : (
									<Text style={styles.dangerButtonText}>
										Permanently delete local data
									</Text>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								disabled={deleting}
								style={styles.cancelButton}
								onPress={() => {
									setError(null);
									setDeleteStep("idle");
								}}
							>
								<Text style={styles.cancelText}>Cancel</Text>
							</TouchableOpacity>
						</View>
					) : null}

					{deleteStep === "complete" ? (
						<View style={styles.confirmation}>
							<Text style={styles.sectionTitle}>Local data deleted</Text>
							<Text style={styles.detail}>
								Check-ins, notes, and metric preferences have been removed from
								this device.
							</Text>
							<TouchableOpacity
								style={styles.primaryButton}
								onPress={() => router.replace("/")}
							>
								<Text style={styles.primaryButtonText}>Back to today</Text>
							</TouchableOpacity>
						</View>
					) : null}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create((theme) => ({
	safeArea: { flex: 1, backgroundColor: theme.colors.background },
	container: { padding: theme.spacing.xl, gap: theme.spacing.lg },
	back: { ...theme.typography.label, color: theme.colors.brand },
	title: { ...theme.typography.title, color: theme.colors.text },
	section: {
		padding: theme.spacing.lg,
		gap: theme.spacing.md,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	sectionTitle: { ...theme.typography.section, color: theme.colors.text },
	warningTitle: { ...theme.typography.score, color: theme.colors.danger },
	detail: { ...theme.typography.body, color: theme.colors.textMuted },
	confirmation: { gap: theme.spacing.md },
	dangerOutlineButton: {
		alignItems: "center",
		padding: theme.spacing.md,
		borderWidth: 1,
		borderColor: theme.colors.danger,
		borderRadius: theme.radius.sm,
	},
	dangerOutlineText: { ...theme.typography.label, color: theme.colors.danger },
	dangerButton: {
		alignItems: "center",
		padding: theme.spacing.md,
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.danger,
	},
	dangerButtonText: {
		...theme.typography.label,
		color: theme.colors.onDanger,
	},
	cancelButton: { alignItems: "center", padding: theme.spacing.sm },
	cancelText: { ...theme.typography.label, color: theme.colors.textMuted },
	primaryButton: {
		alignItems: "center",
		padding: theme.spacing.md,
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.brand,
	},
	primaryButtonText: {
		...theme.typography.label,
		color: theme.colors.onBrand,
	},
	error: { ...theme.typography.body, color: theme.colors.danger },
	disabled: { opacity: theme.opacity.disabled },
}));
