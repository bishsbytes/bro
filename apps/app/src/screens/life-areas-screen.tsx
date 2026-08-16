import {
	getDb,
	type ResolvedTrackedMetric,
	type TrackedMetricsRepository,
	TrackedMetricsRepository as DatabaseTrackedMetricsRepository,
} from "@bro/database-app";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { EmptyState } from "../components/empty-state";
import { FormField } from "../components/form-field";
import { Screen } from "../components/screen";
import {
	DEFAULT_LIFE_AREA_METRICS,
	resolveLifeAreas,
	type LifeAreaSlug,
	type ResolvedLifeArea,
} from "../content/life-area-catalogue";
import { StyleSheet, useUnistyles } from "../theme/unistyles";

type LifeAreaRepository = Pick<
	TrackedMetricsRepository,
	"listResolved" | "configure" | "relabel"
>;

type LifeAreasScreenProps = {
	repository?: LifeAreaRepository;
};

function createRepository(): LifeAreaRepository {
	return new DatabaseTrackedMetricsRepository(getDb());
}

export function LifeAreasScreen({ repository }: LifeAreasScreenProps) {
	const areasRepository = useMemo(
		() => repository ?? createRepository(),
		[repository],
	);
	const { theme } = useUnistyles();
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
		await mutate(async () => {
			await areasRepository.configure(
				area.slug,
				neighbour.position,
				area.enabled,
			);
			await areasRepository.configure(
				neighbour.slug,
				area.position,
				neighbour.enabled,
			);
		});
	}

	if (!areas && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!areas) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Life areas could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg" edges={["bottom"]}>
			<AppText color="muted">
				Choose which areas appear in a new wheel. Changes affect future reviews
				only; saved reviews keep their original labels and order.
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			{areas.map((area, index) => (
				<Card key={area.slug} style={styles.areaCard}>
					<View style={styles.heading}>
						<View style={styles.headingCopy}>
							<AppText variant="section">{area.label}</AppText>
							{area.customLabel ? (
								<AppText variant="caption" color="muted">
									Default: {area.defaultLabel}
								</AppText>
							) : null}
						</View>
						<Switch
							accessibilityLabel={`${area.enabled ? "Disable" : "Enable"} ${area.label}`}
							value={area.enabled}
							disabled={busy}
							trackColor={{
								false: theme.colors.border,
								true: theme.colors.brand,
							}}
							onValueChange={(enabled) =>
								void mutate(() =>
									areasRepository.configure(area.slug, area.position, enabled),
								)
							}
						/>
					</View>

					<View style={styles.actions}>
						<Button
							label="Move up"
							accessibilityLabel={`Move ${area.label} up`}
							variant="secondary"
							disabled={busy || index === 0}
							style={styles.actionButton}
							onPress={() => void move(index, -1)}
						/>
						<Button
							label="Move down"
							accessibilityLabel={`Move ${area.label} down`}
							variant="secondary"
							disabled={busy || index === areas.length - 1}
							style={styles.actionButton}
							onPress={() => void move(index, 1)}
						/>
					</View>

					{editingSlug === area.slug ? (
						<View style={styles.editor}>
							<FormField
								label={`Label for ${area.defaultLabel}`}
								value={labelDraft}
								placeholder={area.defaultLabel}
								autoCapitalize="sentences"
								editable={!busy}
								onChangeText={setLabelDraft}
							/>
							<View style={styles.actions}>
								<Button
									label="Save label"
									loading={busy}
									style={styles.actionButton}
									onPress={() =>
										void mutate(() =>
											areasRepository.relabel(
												area.slug,
												labelDraft.trim() === area.defaultLabel
													? null
													: labelDraft,
												area.position,
												area.enabled,
											),
										)
									}
								/>
								<Button
									label="Cancel"
									variant="text"
									disabled={busy}
									style={styles.actionButton}
									onPress={() => setEditingSlug(null)}
								/>
							</View>
						</View>
					) : (
						<Button
							label="Change label"
							accessibilityLabel={`Change label for ${area.label}`}
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
