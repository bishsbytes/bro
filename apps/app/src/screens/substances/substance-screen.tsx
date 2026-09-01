import type { ConsumptionDerivedMeasurementSlug } from "@bro/domain/metric-registry";
import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { ListRow } from "../../components/list-row";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import {
	createSubstanceStore,
	type SubstanceDaySnapshot,
	type SubstanceDescriptor,
	type SubstanceStore,
} from "../../substances/substance-store";
import { StyleSheet } from "../../theme/unistyles";

type SubstanceScreenProps<Slug extends ConsumptionDerivedMeasurementSlug> = {
	descriptor: SubstanceDescriptor<Slug>;
	store?: Pick<SubstanceStore<Slug>, "loadToday" | "repeatEntry">;
};

/**
 * One stream's day: what it adds up to, what you log most, and the ways in.
 * Written against the descriptor so every substance shares it — the copy and
 * the catalogue are the only things that differ.
 */
export function SubstanceScreen<
	Slug extends ConsumptionDerivedMeasurementSlug,
>({ descriptor, store }: SubstanceScreenProps<Slug>) {
	const { t } = useTranslation("common");
	const substance = useMemo(
		() => store ?? createSubstanceStore(descriptor),
		[store, descriptor],
	);
	const [busy, setBusy] = useState(false);
	const {
		data: snapshot,
		error,
		loading,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(useCallback(() => substance.loadToday(), [substance]));

	async function repeat(entryId: string) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await substance.repeatEntry(entryId);
			setSnapshot((await substance.loadToday()) as SubstanceDaySnapshot<Slug>);
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={descriptor.copy.loadFailed()}
					body={error ?? descriptor.copy.loadFailedBody()}
				/>
			</Screen>
		);
	}

	return (
		<Screen scroll padded gap="lg">
			<Card style={styles.section}>
				<View style={styles.totals}>
					{snapshot.metrics.map((metric) => (
						<View key={metric.metric.slug} style={styles.total}>
							<AppText variant="micro" color="subtle">
								{upperCaseForLanguage(metric.metric.label)}
							</AppText>
							<AppText variant="section">
								{metric.dayFormatted ?? t("emDash")}
							</AppText>
							{metric.weekFormatted ? (
								<AppText variant="caption" color="muted">
									{descriptor.copy.weekTotal(metric.weekFormatted)}
								</AppText>
							) : null}
						</View>
					))}
				</View>
				{/* States the total without grading it; see the copy contract. */}
				<AppText variant="caption" color="muted">
					{descriptor.copy.disclaimer()}
				</AppText>
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<Card style={styles.section}>
				<SectionHeader
					title={descriptor.copy.browseTitle()}
					eyebrow={descriptor.copy.quickAddEyebrow()}
				/>
				{snapshot.recents.length === 0 ? (
					<AppText variant="caption" color="muted">
						{descriptor.copy.quickAddEmpty()}
					</AppText>
				) : (
					snapshot.recents.map((presented) => (
						<ListRow
							key={presented.entry.id}
							title={presented.entry.label}
							detail={descriptor.copy.quickAddOption(
								presented.entry.label,
								presented.entry.servingLabel ?? "",
							)}
							accessibilityLabel={descriptor.copy.repeatA11y(
								presented.entry.label,
							)}
							disabled={busy}
							onPress={() => void repeat(presented.entry.id)}
						/>
					))
				)}
			</Card>

			<Card style={styles.section}>
				<SectionHeader title={descriptor.copy.manageTitle()} />
				<ListRow
					title={descriptor.copy.freeTitle()}
					detail={descriptor.copy.freeDetail()}
					onPress={() => router.push(`${descriptor.routeBase}/log` as Href)}
				/>
				<ListRow
					title={descriptor.copy.goals()}
					detail={descriptor.copy.goalsDetail()}
					onPress={() => router.push(`${descriptor.routeBase}/goals` as Href)}
				/>
			</Card>

			{snapshot.entries.length > 0 ? (
				<Card style={styles.section}>
					<SectionHeader title={snapshot.localDay} />
					{snapshot.entries.map((presented) => (
						<ListRow
							key={presented.entry.id}
							title={presented.entry.label}
							detail={presented.detail}
							onPress={() =>
								router.push(
									`${descriptor.routeBase}/${snapshot.localDay}` as Href,
								)
							}
						/>
					))}
				</Card>
			) : null}

			{snapshot.recentLocalDays.length > 0 ? (
				<Card style={styles.section}>
					<SectionHeader title={descriptor.copy.recentDays()} />
					{snapshot.recentLocalDays.map((day) => (
						<ListRow
							key={day}
							title={day}
							onPress={() =>
								router.push(`${descriptor.routeBase}/${day}` as Href)
							}
						/>
					))}
				</Card>
			) : null}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	totals: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
	total: { minWidth: "44%", flexGrow: 1, gap: theme.spacing.xs },
}));
