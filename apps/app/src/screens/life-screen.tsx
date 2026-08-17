import { router } from "expo-router";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Screen } from "../components/screen";
import { SectionHeader } from "../components/section-header";
import { StyleSheet } from "../theme/unistyles";

export function LifeScreen() {
	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">
				Take stock of the bigger picture, choose what matters, and turn it into
				a next step.
			</AppText>

			<Card style={styles.card}>
				<SectionHeader title="Wheel of life" eyebrow="YOUR BIGGER PICTURE" />
				<AppText color="muted">
					Review your life areas, revisit your focus, and see what has moved.
				</AppText>
				<Button label="Open wheel" onPress={() => router.push("/review")} />
				<Button
					label="Take stock"
					variant="secondary"
					onPress={() => router.push("/review/new")}
				/>
			</Card>

			<Card style={styles.card}>
				<SectionHeader title="Habits" eyebrow="WHAT YOU PRACTISE" />
				<AppText color="muted">
					Choose routines for health, relationships, work, purpose, and the rest
					of your life.
				</AppText>
				<Button
					label="Manage habits"
					variant="secondary"
					onPress={() => router.push("/settings/habits")}
				/>
			</Card>

			<Card style={styles.card}>
				<SectionHeader title="Make it yours" eyebrow="LIFE AREAS" />
				<AppText color="muted">
					Choose, order, and rename the areas that appear in your wheel.
				</AppText>
				<Button
					label="Choose life areas"
					variant="secondary"
					onPress={() => router.push("/settings/life-areas")}
				/>
			</Card>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	card: { gap: theme.spacing.md },
}));

export default LifeScreen;
