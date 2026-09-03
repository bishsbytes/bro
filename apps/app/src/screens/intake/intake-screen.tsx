import { type Href, router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LogConfirmationToast } from "../../components/log-confirmation-toast";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { upperCaseForLanguage } from "../../i18n";
import {
	createIntakeStore,
	type IntakeDaySnapshot,
	type IntakeStore,
} from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type IntakeScreenProps = {
	store?: Pick<IntakeStore, "loadToday" | "repeatEvent">;
};

/**
 * The day as one stream. Tracked totals first, then everything logged today
 * in time order across every kind, then the ways in. First cut: the designed
 * tab — week strip, category cards, usual-range rows — is the next phase.
 */
export function IntakeScreen({ store }: IntakeScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const [busy, setBusy] = useState(false);
	const confirmationSequence = useRef(0);
	const [confirmation, setConfirmation] = useState<{
		name: string;
		localDay: string;
	} | null>(null);
	const dismissConfirmation = useCallback(() => setConfirmation(null), []);
	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => intake.loadToday(), [intake]));

	async function repeat(id: string, name: string) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const event = await intake.repeatEvent(id);
			setSnapshot((await intake.loadToday()) as IntakeDaySnapshot);
			confirmationSequence.current += 1;
			setConfirmation({ name, localDay: event.localDay });
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen variant="tab" />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("intake:loadFailed")}
					body={error ?? t("intake:loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	// Energy is the one total every stream contributes to, so it is the one
	// metric-size number; every other total reads at label size.
	const energy = snapshot.totals.find(
		({ metric }) => metric.slug === "energy_intake",
	);
	const otherTotals = snapshot.totals.filter(
		({ metric }) => metric.slug !== "energy_intake",
	);

	return (
		<>
			<Screen scroll padded gap="lg">
				<AppText color="muted">{t("intake:tab.intro")}</AppText>

				<Card style={styles.section}>
					<SectionHeader
						title={t("intake:tab.today")}
						eyebrow={snapshot.localDay}
					/>
					{snapshot.totals.length === 0 ? (
						<AppText variant="caption" color="muted">
							{t("intake:tab.totalsEmpty")}
						</AppText>
					) : (
						<>
							{energy ? (
								<View style={styles.energy}>
									<AppText variant="micro" color="subtle">
										{upperCaseForLanguage(energy.metric.label)}
									</AppText>
									<AppText variant="section">
										{energy.dayFormatted ?? t("common:emDash")}
									</AppText>
								</View>
							) : null}
							<View style={styles.totals}>
								{otherTotals.map((total) => (
									<View key={total.metric.slug} style={styles.total}>
										<AppText variant="micro" color="subtle">
											{upperCaseForLanguage(total.metric.label)}
										</AppText>
										<AppText variant="label">
											{total.dayFormatted ?? t("common:emDash")}
										</AppText>
									</View>
								))}
							</View>
						</>
					)}
					<AppText variant="caption" color="subtle">
						{t("intake:tab.disclaimer")}
					</AppText>
				</Card>

				{error ? <AppText color="danger">{error}</AppText> : null}

				<Button
					label={t("intake:tab.log")}
					onPress={() => router.push("/intake/log" as Href)}
				/>

				<View style={styles.section}>
					<SectionHeader title={t("intake:tab.eventsTitle")} />
					{snapshot.events.length === 0 ? (
						<EmptyState
							title={t("intake:tab.emptyTitle")}
							body={t("intake:tab.emptyBody")}
						/>
					) : (
						snapshot.events.map((presented) => (
							<ListRow
								key={presented.event.id}
								title={presented.event.name}
								detail={presented.detail}
								value={presented.contributions || undefined}
								accessibilityLabel={t("intake:event.edit", {
									name: presented.event.name,
								})}
								onPress={() =>
									router.push(`/intake/${snapshot.localDay}` as Href)
								}
							/>
						))
					)}
				</View>

				{snapshot.recents.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:log.recentsTitle")} />
						<View style={styles.wrap}>
							{snapshot.recents.map(({ event }) => (
								<Button
									key={event.id}
									label={t("intake:log.option", {
										item: event.name,
										portion:
											event.portionLabel ?? t("intake:event.defaultPortion"),
									})}
									accessibilityLabel={t("intake:log.repeatA11y", {
										name: event.name,
									})}
									variant="secondary"
									disabled={busy}
									onPress={() => void repeat(event.id, event.name)}
								/>
							))}
						</View>
					</View>
				) : null}

				<View style={styles.section}>
					<SectionHeader title={t("intake:tab.manageTitle")} />
					<ListRow
						title={t("intake:tab.library")}
						detail={t("intake:tab.libraryDetail")}
						onPress={() => router.push("/intake/library" as Href)}
					/>
					<ListRow
						title={t("intake:tab.goals")}
						detail={t("intake:tab.goalsDetail")}
						onPress={() => router.push("/intake/goals" as Href)}
					/>
					<ListRow
						title={t("intake:tab.settings")}
						detail={t("intake:tab.settingsDetail")}
						onPress={() => router.push("/settings/intake" as Href)}
					/>
				</View>

				{snapshot.recentLocalDays.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:tab.recentDays")} />
						{snapshot.recentLocalDays.map((day) => (
							<ListRow
								key={day}
								title={day}
								onPress={() => router.push(`/intake/${day}` as Href)}
							/>
						))}
					</View>
				) : null}
			</Screen>
			<LogConfirmationToast
				message={
					confirmation
						? t("intake:log.added", { name: confirmation.name })
						: null
				}
				actionLabel={t("intake:log.viewDay")}
				onDismiss={dismissConfirmation}
				onAction={() => {
					if (confirmation) {
						router.push(`/intake/${confirmation.localDay}` as Href);
					}
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	energy: { gap: theme.spacing.xs },
	totals: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
	total: { minWidth: "28%", flexGrow: 1, gap: theme.spacing.xs },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
}));

export default IntakeScreen;
