import type { Consumable } from "@bro/database-app";
import type { ConsumableKind, SystemConsumable } from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import { useTranslation } from "react-i18next";
import { TextInput, TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Icon } from "../../components/icon";
import { LoadingIndicator } from "../../components/loading-indicator";
import { SectionHeader } from "../../components/section-header";
import type { IntakeSearchSnapshot } from "../../intake/intake-search-store";
import type { PresentedIntakeEvent } from "../../intake/intake-store";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeArtwork } from "./intake-artwork";
import { IntakeRow, RowPanel } from "./intake-rows";
import { RecentIntakeRow } from "./recent-intake-row";

type IntakeBrowseProps = {
	query: string;
	onQueryChange: (value: string) => void;
	/** Empty until the query is long enough to have been normalised and searched. */
	normalizedQuery: string;
	kind: ConsumableKind | null;
	enabledKinds: readonly ConsumableKind[];
	onKindChange: (kind: ConsumableKind | null) => void;
	/** Shown when the user has chosen a moment other than now. */
	whenLabel: string | null;
	error: string | null;
	busy: boolean;
	recents: readonly PresentedIntakeEvent[];
	library: readonly Consumable[];
	catalogue: readonly SystemConsumable[];
	results: readonly ExternalConsumable[];
	searchBusy: boolean;
	searchSnapshot: IntakeSearchSnapshot | null;
	onRepeatRecent: (presented: PresentedIntakeEvent) => void;
	onEditRecent: (presented: PresentedIntakeEvent) => void;
	onOpenLibrary: (consumable: Consumable) => void;
	onOpenCatalogue: (entry: SystemConsumable) => void;
	onOpenExternal: (consumable: ExternalConsumable) => void;
};

/** Everything the user can pick from: what they log often, own, or can find. */
export function IntakeBrowse({
	query,
	onQueryChange,
	normalizedQuery,
	kind,
	enabledKinds,
	onKindChange,
	whenLabel,
	error,
	busy,
	recents,
	library,
	catalogue,
	results,
	searchBusy,
	searchSnapshot,
	onRepeatRecent,
	onEditRecent,
	onOpenLibrary,
	onOpenCatalogue,
	onOpenExternal,
}: IntakeBrowseProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const nothingAtAll =
		!searchBusy &&
		results.length === 0 &&
		recents.length === 0 &&
		library.length === 0 &&
		catalogue.length === 0 &&
		!searchSnapshot?.message;

	return (
		<>
			<AppText variant="largeTitle">{t("intake:log.heading")}</AppText>
			<View style={styles.search}>
				<Icon name="search" color={theme.colors.ink2} size={24} />
				<TextInput
					accessibilityLabel={t("intake:log.searchA11y")}
					autoCapitalize="none"
					autoCorrect={false}
					placeholder={t("intake:log.searchPlaceholder")}
					placeholderTextColor={theme.colors.ink3}
					returnKeyType="search"
					style={styles.searchInput}
					value={query}
					onChangeText={onQueryChange}
				/>
				{query ? (
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityLabel={t("intake:log.clearA11y")}
						style={styles.clear}
						onPress={() => onQueryChange("")}
					>
						<Icon name="close" color={theme.colors.ink2} size={24} />
					</TouchableOpacity>
				) : null}
			</View>
			{whenLabel ? (
				<AppText variant="caption" color="muted">
					{whenLabel}
				</AppText>
			) : null}

			<View style={styles.wrap}>
				<Button
					label={t("intake:log.all")}
					accessibilityState={{ selected: kind === null }}
					variant={kind === null ? "primary" : "secondary"}
					style={styles.filter}
					onPress={() => onKindChange(null)}
				/>
				{enabledKinds.map((candidate) => (
					<Button
						key={candidate}
						style={styles.filter}
						label={t(`intake:kinds.${candidate}`)}
						accessibilityLabel={t("intake:log.kindA11y", {
							name: t(`intake:kinds.${candidate}`),
						})}
						accessibilityState={{ selected: kind === candidate }}
						variant={kind === candidate ? "primary" : "secondary"}
						onPress={() => onKindChange(kind === candidate ? null : candidate)}
					/>
				))}
			</View>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<AppText variant="title">{t("intake:log.recentsTitle")}</AppText>
				{recents.length === 0 && !normalizedQuery ? (
					<AppText variant="caption" color="subtle">
						{t("intake:log.recentsEmpty")}
					</AppText>
				) : (
					<View style={styles.wrap}>
						{recents.map((presented) => (
							<RecentIntakeRow
								key={presented.event.id}
								presented={presented}
								disabled={busy}
								onRepeat={() => onRepeatRecent(presented)}
								onEdit={() => onEditRecent(presented)}
							/>
						))}
					</View>
				)}
			</View>

			{library.length > 0 ? (
				<View style={styles.section}>
					<AppText variant="title">{t("intake:log.libraryTitle")}</AppText>
					<RowPanel>
						{library.map((consumable, index) => (
							<IntakeRow
								key={consumable.id}
								thumbnail={
									<IntakeArtwork
										name={consumable.name}
										kind={consumable.kind}
										sourceRef={
											consumable.source.type === "system"
												? consumable.source.key
												: consumable.source.type === "user" && !consumable.brand
													? null
													: consumable.id
										}
									/>
								}
								title={consumable.name}
								meta={consumable.brand ?? t(`intake:kinds.${consumable.kind}`)}
								chevron
								last={index === library.length - 1}
								accessibilityLabel={t("intake:log.logA11y", {
									name: consumable.name,
								})}
								onPress={() => onOpenLibrary(consumable)}
							/>
						))}
					</RowPanel>
				</View>
			) : null}

			{catalogue.length > 0 ? (
				<View style={styles.section}>
					<AppText variant="title">{t("intake:log.catalogueTitle")}</AppText>
					<RowPanel>
						{catalogue.map((consumable, index) => (
							<IntakeRow
								key={consumable.key}
								title={consumable.name}
								meta={
									consumable.portions.find(
										(portion) => portion.id === consumable.defaultPortionId,
									)?.label ?? t(`intake:kinds.${consumable.kind}`)
								}
								thumbnail={
									<IntakeArtwork
										name={consumable.name}
										kind={consumable.kind}
										sourceRef={consumable.key}
									/>
								}
								chevron
								last={index === catalogue.length - 1}
								accessibilityLabel={t("intake:log.logA11y", {
									name: consumable.name,
								})}
								onPress={() => onOpenCatalogue(consumable)}
							/>
						))}
					</RowPanel>
				</View>
			) : null}

			{normalizedQuery.length >= 2 ? (
				<View style={styles.section}>
					<SectionHeader
						title={t("intake:log.resultsTitle")}
						eyebrow={
							searchSnapshot?.fromCache
								? t("intake:log.cachedEyebrow")
								: undefined
						}
					/>
					{searchBusy ? <LoadingIndicator /> : null}
					{searchSnapshot?.message ? (
						<AppText variant="caption" color="muted">
							{searchSnapshot.message}
						</AppText>
					) : null}
					{results.length > 0 ? (
						<RowPanel>
							{results.map((result, index) => (
								<IntakeRow
									key={result.ref}
									thumbnail={
										<IntakeArtwork
											name={result.name}
											kind={result.kind}
											sourceRef={result.ref}
										/>
									}
									title={result.name}
									meta={t("intake:log.provenance", {
										source: result.brand ?? result.source,
										licence: result.licence,
									})}
									chevron
									last={index === results.length - 1}
									accessibilityLabel={t("intake:log.logA11y", {
										name: result.name,
									})}
									onPress={() => onOpenExternal(result)}
								/>
							))}
						</RowPanel>
					) : null}
					{nothingAtAll ? (
						<AppText variant="caption" color="muted">
							{t("intake:log.noResults")}
						</AppText>
					) : null}
				</View>
			) : null}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	filter: {
		borderWidth: 0,
		minHeight: theme.control.minHitArea,
	},
	search: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		minHeight: theme.control.minHitArea,
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface,
	},
	searchInput: {
		flex: 1,
		...theme.typography.body,
		color: theme.colors.ink,
		paddingVertical: 0,
	},
	clear: {
		minWidth: theme.control.minHitArea,
		minHeight: theme.control.minHitArea,
		alignItems: "center",
		justifyContent: "center",
	},
}));
