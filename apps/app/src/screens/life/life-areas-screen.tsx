import {
	TrackedMetricsRepository as DatabaseTrackedMetricsRepository,
	getDb,
	type ResolvedTrackedMetric,
	type TrackedMetricsRepository,
} from "@bro/database-app";
import {
	DEFAULT_LIFE_AREA_METRICS,
	type LifeAreaSlug,
	MAX_ACTIVE_LIFE_AREAS,
	type ResolvedLifeArea,
} from "@bro/domain/life-area-catalogue";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingIndicator } from "../../components/loading-indicator";
import { StackScreen as Screen } from "../../components/screen";
import { ThemedSwitch } from "../../components/themed-switch";
import { resolveLifeAreas } from "../../content";
import { StyleSheet } from "../../theme/unistyles";

type LifeAreaRepository = Pick<
	TrackedMetricsRepository,
	"listResolved" | "configure" | "configureMany" | "relabel"
>;

export type LifeAreasScreenProps = {
	repository?: LifeAreaRepository;
};

function createRepository(): LifeAreaRepository {
	return new DatabaseTrackedMetricsRepository(getDb());
}

export function LifeAreasScreen({ repository }: LifeAreasScreenProps) {
	const { t } = useTranslation(["life", "common"]);
	const areasRepository = useMemo(
		() => repository ?? createRepository(),
		[repository],
	);
	const [areas, setAreas] = useState<ResolvedLifeArea[] | null>(null);
	const [editingSlug, setEditingSlug] = useState<LifeAreaSlug | null>(null);
	const [labelDraft, setLabelDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			const overlays: ResolvedTrackedMetric[] =
				await areasRepository.listResolved(DEFAULT_LIFE_AREA_METRICS);
			setAreas(resolveLifeAreas(overlays));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [areasRepository]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
	);

	async function mutate(work: () => Promise<unknown>) {
		setBusy(true);
		setError(null);
		try {
			await work();
			setEditingSlug(null);
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setBusy(false);
		}
	}

	function startRelabel(area: ResolvedLifeArea) {
		setEditingSlug(area.slug);
		setLabelDraft(area.customLabel ?? area.defaultLabel);
		setError(null);
	}

	async function move(index: number, offset: -1 | 1) {
		if (!areas) {
			return;
		}
		const area = areas[index];
		const neighbour = areas[index + offset];
		if (!area || !neighbour) {
			return;
		}
		await mutate(() =>
			areasRepository.configureMany([
				{
					metricSlug: area.slug,
					position: neighbour.position,
					enabled: area.enabled,
				},
				{
					metricSlug: neighbour.slug,
					position: area.position,
					enabled: neighbour.enabled,
				},
			]),
		);
	}

	if (!areas && !error) {
		return (
			<Screen centered>
				<LoadingIndicator size="large" />
			</Screen>
		);
	}

	if (!areas) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("areas.loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<AppText color="muted">{t("areas.intro")}</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{areas.map((area, index) => (
				<Card key={area.slug} style={styles.areaCard}>
					<View style={styles.heading}>
						<View style={styles.headingCopy}>
							<AppText variant="section">{area.label}</AppText>
							{area.customLabel ? (
								<AppText variant="caption" color="muted">
									{t("areas.defaultLabel", { name: area.defaultLabel })}
								</AppText>
							) : null}
						</View>
						<ThemedSwitch
							accessibilityLabel={
								area.enabled
									? t("areas.disable", { name: area.label })
									: t("areas.enable", { name: area.label })
							}
							value={area.enabled}
							disabled={busy}
							onValueChange={(enabled) => {
								if (
									enabled &&
									areas.filter((candidate) => candidate.enabled).length >=
										MAX_ACTIVE_LIFE_AREAS
								) {
									setError(t("areas.limit", { max: MAX_ACTIVE_LIFE_AREAS }));
									return;
								}
								void mutate(() =>
									areasRepository.configure(area.slug, area.position, enabled),
								);
							}}
						/>
					</View>

					<View style={styles.actions}>
						<Button
							label={t("areas.moveUp")}
							accessibilityLabel={t("areas.moveUpA11y", { name: area.label })}
							variant="secondary"
							disabled={busy || index === 0}
							style={styles.actionButton}
							onPress={() => void move(index, -1)}
						/>
						<Button
							label={t("areas.moveDown")}
							accessibilityLabel={t("areas.moveDownA11y", { name: area.label })}
							variant="secondary"
							disabled={busy || index === areas.length - 1}
							style={styles.actionButton}
							onPress={() => void move(index, 1)}
						/>
					</View>

					{editingSlug === area.slug ? (
						<View style={styles.editor}>
							<FormField
								label={t("areas.labelField", { name: area.defaultLabel })}
								value={labelDraft}
								placeholder={area.defaultLabel}
								autoCapitalize="sentences"
								editable={!busy}
								onChangeText={setLabelDraft}
							/>
							<View style={styles.actions}>
								<Button
									label={t("areas.saveLabel")}
									loading={busy}
									style={styles.actionButton}
									onPress={() =>
										void mutate(() =>
											areasRepository.relabel(
												area.slug,
												labelDraft.trim() === area.defaultLabel
													? null
													: labelDraft,
												{ position: area.position, enabled: area.enabled },
											),
										)
									}
								/>
								<Button
									label={t("areas.cancel")}
									variant="text"
									disabled={busy}
									style={styles.actionButton}
									onPress={() => setEditingSlug(null)}
								/>
							</View>
						</View>
					) : (
						<Button
							label={t("areas.changeLabel")}
							accessibilityLabel={t("areas.changeLabelA11y", {
								name: area.label,
							})}
							variant="text"
							disabled={busy}
							onPress={() => startRelabel(area)}
						/>
					)}
				</Card>
			))}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	areaCard: { gap: theme.spacing.md },
	heading: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: theme.spacing.md,
	},
	headingCopy: { flex: 1, gap: theme.spacing.xs },
	actions: { flexDirection: "row", gap: theme.spacing.sm },
	actionButton: { flex: 1 },
	editor: { gap: theme.spacing.md },
}));
