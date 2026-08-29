import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	type CheckInSettingsSnapshot,
	type CheckInSettingsStore,
	createCheckInSettingsStore,
} from "../../check-in/check-in-settings-store";
import { TAG_CATEGORY_KEYS } from "../../check-in/tag-categories";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { ThemedSwitch } from "../../components/themed-switch";
import { StyleSheet } from "../../theme/unistyles";

type CheckInSettingsScreenProps = {
	store?: Pick<CheckInSettingsStore, "load" | "setEnabled">;
};

export function CheckInSettingsScreen({ store }: CheckInSettingsScreenProps) {
	const { t } = useTranslation(["settings", "checkIn", "common"]);
	const checkIns = useMemo(
		() => store ?? createCheckInSettingsStore(),
		[store],
	);
	const [snapshot, setSnapshot] = useState<CheckInSettingsSnapshot | null>(
		null,
	);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			setSnapshot(await checkIns.load());
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [checkIns]);

	useFocusEffect(useCallback(() => void load(), [load]));

	async function setEnabled(metricSlug: string, enabled: boolean) {
		setBusyKey(metricSlug);
		setError(null);
		try {
			setSnapshot(await checkIns.setEnabled(metricSlug, enabled));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusyKey(null);
		}
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("checkIns.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const groupedTags = Object.entries(TAG_CATEGORY_KEYS).flatMap(
		([category, key]) => {
			const tags = snapshot.tags.filter((tag) => tag.category === category);
			return tags.length > 0
				? [{ category, label: t(`checkIn:${key}` as const), tags }]
				: [];
		},
	);

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("checkIns.intro")}</AppText>
			{error ? <AppText color="danger">{error}</AppText> : null}
			<View style={styles.section}>
				{snapshot.metrics.map((metric) => (
					<Card key={metric.metricSlug} style={styles.row}>
						<View style={styles.grow}>
							<AppText variant="label">{metric.label}</AppText>
							<AppText variant="caption" color="muted">
								{metric.sensitive
									? t("checkIns.scoredSensitive")
									: t("checkIns.scored")}
							</AppText>
						</View>
						<ThemedSwitch
							accessibilityLabel={
								metric.enabled
									? t("checkIns.removeScore", { name: metric.label })
									: t("checkIns.addScore", { name: metric.label })
							}
							value={metric.enabled}
							disabled={busyKey !== null}
							onValueChange={(enabled) =>
								void setEnabled(metric.metricSlug, enabled)
							}
						/>
					</Card>
				))}
			</View>
			<AppText variant="caption" color="subtle">
				{t("checkIns.scoresNote")}
			</AppText>
			<SectionHeader title={t("checkIns.tagsTitle")} />
			<AppText color="muted">{t("checkIns.tagsIntro")}</AppText>
			{groupedTags.map(({ category, label, tags }) => (
				<View key={category} style={styles.section}>
					<AppText variant="caption" color="subtle">
						{label}
					</AppText>
					{tags.map((tag) => (
						<Card key={tag.metricSlug} style={styles.row}>
							<View style={styles.grow}>
								<AppText variant="label">{tag.label}</AppText>
								{tag.sensitive ? (
									<AppText variant="caption" color="muted">
										{t("checkIns.sensitive")}
									</AppText>
								) : null}
							</View>
							<ThemedSwitch
								accessibilityLabel={
									tag.enabled
										? t("checkIns.removeTag", { name: tag.label })
										: t("checkIns.addTag", { name: tag.label })
								}
								value={tag.enabled}
								disabled={busyKey !== null}
								onValueChange={(enabled) =>
									void setEnabled(tag.metricSlug, enabled)
								}
							/>
						</Card>
					))}
				</View>
			))}
			<AppText variant="caption" color="subtle">
				{t("checkIns.tagsNote")}
			</AppText>
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
	grow: { flex: 1, gap: theme.spacing.xs },
}));
