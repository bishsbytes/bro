import { deleteLocalProductData } from "@bro/database-app";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import type { HealthGatewayAvailability } from "../health/gateway";
import { healthImportEngine } from "../health/import-service";
import { cancelAllReminderNotifications } from "../reminders/reminder-materialiser";
import { StyleSheet } from "../theme/unistyles";

const DELETE_LOCAL_DATA_COPY =
	"This permanently deletes data stored by bro on this device. It does not delete your account or data stored elsewhere.";

type SettingsScreenProps = {
	deleteProductData?: () => Promise<void>;
	cancelReminderNotifications?: () => Promise<unknown>;
	healthAvailability?: () => Promise<HealthGatewayAvailability>;
};

type DeleteStep = "idle" | "confirm" | "complete";

const defaultHealthAvailability = () => healthImportEngine.availability();

function HealthSettingsEntry({
	availability = defaultHealthAvailability,
}: {
	availability?: () => Promise<HealthGatewayAvailability>;
}) {
	const [health, setHealth] = useState<HealthGatewayAvailability | null>(null);

	useEffect(() => {
		let active = true;
		void availability()
			.then((next) => {
				if (active) setHealth(next);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [availability]);

	if (!health?.platform) return null;
	const label =
		health.platform === "healthkit" ? "Apple Health" : "Health Connect";
	return (
		<Card style={styles.section}>
			<SectionHeader title="Health data" />
			<AppText color="muted">
				Import health history from {label}. Your data stays on this device.
			</AppText>
			<Button
				label="Manage health data"
				variant="secondary"
				onPress={() => router.push("/settings/health")}
			/>
		</Card>
	);
}

export function SettingsScreen({
	deleteProductData = deleteLocalProductData,
	cancelReminderNotifications = cancelAllReminderNotifications,
	healthAvailability = defaultHealthAvailability,
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
			await cancelReminderNotifications();
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
		<Screen scroll padded edges={["bottom"]}>
			<HealthSettingsEntry availability={healthAvailability} />
			<Card style={styles.section}>
				<SectionHeader title="Habits" />
				<AppText color="muted">
					Choose routines, set their days, and add your own.
				</AppText>
				<Button
					label="Manage habits"
					variant="secondary"
					onPress={() => router.push("/settings/habits")}
				/>
			</Card>
			<Card style={styles.section}>
				<SectionHeader title="Life areas" />
				<AppText color="muted">
					Choose, order, and rename the areas shown in your wheel of life.
				</AppText>
				<Button
					label="Manage life areas"
					variant="secondary"
					onPress={() => router.push("/settings/life-areas")}
				/>
			</Card>
			<Card style={styles.section}>
				<SectionHeader title="Units" />
				<AppText color="muted">
					Choose how weight, length, and body fat measurements appear.
				</AppText>
				<Button
					label="Manage units"
					variant="secondary"
					onPress={() => router.push("/settings/units")}
				/>
			</Card>
			<Card style={styles.section}>
				<SectionHeader title="Reminders" />
				<AppText color="muted">
					Choose when this device nudges you to check in.
				</AppText>
				<Button
					label="Manage reminders"
					variant="secondary"
					onPress={() => router.push("/settings/reminders")}
				/>
			</Card>
			<Card style={styles.section}>
				<SectionHeader title="Data on this device" />
				{deleteStep === "idle" ? (
					<>
						<AppText color="muted">
							Delete your check-ins, notes, and metric preferences from this
							device.
						</AppText>
						<Button
							label="Delete local data"
							variant="secondary"
							tone="danger"
							onPress={() => {
								setError(null);
								setDeleteStep("confirm");
							}}
						/>
					</>
				) : null}

				{deleteStep === "confirm" ? (
					<View style={styles.confirmation}>
						<AppText variant="score" color="danger">
							Delete local data?
						</AppText>
						<AppText color="muted">{DELETE_LOCAL_DATA_COPY}</AppText>
						{error ? <AppText color="danger">{error}</AppText> : null}
						<Button
							label="Permanently delete local data"
							variant="danger"
							loading={deleting}
							onPress={() => void confirmDelete()}
						/>
						<Button
							label="Cancel"
							variant="text"
							disabled={deleting}
							onPress={() => {
								setError(null);
								setDeleteStep("idle");
							}}
						/>
					</View>
				) : null}

				{deleteStep === "complete" ? (
					<View style={styles.confirmation}>
						<SectionHeader title="Local data deleted" />
						<AppText color="muted">
							Check-ins, notes, and metric preferences have been removed from
							this device.
						</AppText>
						<Button label="Back to today" onPress={() => router.replace("/")} />
					</View>
				) : null}
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	confirmation: { gap: theme.spacing.md },
}));
