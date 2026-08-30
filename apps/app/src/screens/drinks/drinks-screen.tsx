import { previousLocalDay } from "@bro/domain";
import { ethanolKgFromVolumeAndAbv } from "@bro/domain/drink-catalogue";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type Href, router, Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Keyboard,
	ScrollView,
	TextInput,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { ListRow } from "../../components/list-row";
import { LogConfirmationToast } from "../../components/log-confirmation-toast";
import { ModalSheet } from "../../components/modal-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { createDrinksStore, type DrinksStore } from "../../drinks/drinks-store";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type DrinksScreenProps = {
	view?: "overview" | "custom" | "log" | "goals";
	store?: Pick<
		DrinksStore,
		| "loadToday"
		| "logCatalogue"
		| "logCustom"
		| "logFree"
		| "repeatEntry"
		| "createGoal"
		| "achieveGoal"
		| "abandonGoal"
		| "saveCustom"
		| "deleteCustom"
	>;
};

type AddMode = "catalogue" | "custom" | "free" | null;

const CATALOGUE_KINDS = ["hydration", "caffeinated", "alcoholic"] as const;
type CatalogueKind = (typeof CATALOGUE_KINDS)[number];
type BrowseFilter = CatalogueKind | "custom" | null;

function optionalNumber(value: string): number | null {
	return value.trim() ? Number(value) : null;
}

function isOptionalNonNegativeNumber(value: string): boolean {
	if (value.trim() === "") return true;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0;
}

function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}

function DrinkLogForm({
	title,
	mode,
	servings,
	servingId,
	onServingChange,
	quantity,
	onQuantityChange,
	localDay,
	onLocalDayChange,
	time,
	onTimeChange,
	label,
	onLabelChange,
	servingLabel,
	onServingLabelChange,
	volumeMl,
	onVolumeMlChange,
	abv,
	onAbvChange,
	caffeineMg,
	onCaffeineMgChange,
	energyKcal,
	onEnergyKcalChange,
	today,
	busy,
	saveDisabled,
	onCancel,
	onSave,
}: {
	title: string;
	mode: Exclude<AddMode, null>;
	servings: readonly { id: string; label: string }[];
	servingId: string;
	onServingChange: (id: string) => void;
	quantity: string;
	onQuantityChange: (value: string) => void;
	localDay: string;
	onLocalDayChange: (value: string) => void;
	time: string;
	onTimeChange: (value: string) => void;
	label: string;
	onLabelChange: (value: string) => void;
	servingLabel: string;
	onServingLabelChange: (value: string) => void;
	volumeMl: string;
	onVolumeMlChange: (value: string) => void;
	abv: string;
	onAbvChange: (value: string) => void;
	caffeineMg: string;
	onCaffeineMgChange: (value: string) => void;
	energyKcal: string;
	onEnergyKcalChange: (value: string) => void;
	today: string;
	busy: boolean;
	saveDisabled: boolean;
	onCancel: () => void;
	onSave: () => void;
}) {
	const { t } = useTranslation("drinks");

	return (
		<View style={styles.section}>
			<AppText variant="section">{title}</AppText>
			{mode === "free" ? (
				<View style={styles.section}>
					<FormField
						label={t("add.nameField")}
						value={label}
						onChangeText={onLabelChange}
					/>
					<FormField
						label={t("add.servingNameField")}
						value={servingLabel}
						onChangeText={onServingLabelChange}
						placeholder={t("add.servingNamePlaceholder")}
					/>
					<View style={styles.actions}>
						<FormField
							label={t("add.volumeField")}
							value={volumeMl}
							onChangeText={onVolumeMlChange}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label={t("add.abvField")}
							value={abv}
							onChangeText={onAbvChange}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<View style={styles.actions}>
						<FormField
							label={t("add.caffeineField")}
							value={caffeineMg}
							onChangeText={onCaffeineMgChange}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label={t("add.energyField")}
							value={energyKcal}
							onChangeText={onEnergyKcalChange}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
				</View>
			) : (
				<>
					<AppText variant="label">{t("add.servingLabel")}</AppText>
					<View style={styles.wrap}>
						{servings.map((serving) => (
							<Button
								key={serving.id}
								label={serving.label}
								variant={servingId === serving.id ? "primary" : "secondary"}
								onPress={() => onServingChange(serving.id)}
							/>
						))}
					</View>
				</>
			)}
			<FormField
				label={t("add.quantityField")}
				value={quantity}
				onChangeText={onQuantityChange}
				keyboardType="decimal-pad"
			/>
			<View style={styles.actions}>
				<FormField
					label={t("add.dateField")}
					value={localDay}
					onChangeText={onLocalDayChange}
					placeholder={t("add.datePlaceholder")}
					containerStyle={styles.grow}
				/>
				<FormField
					label={t("add.timeField")}
					value={time}
					onChangeText={onTimeChange}
					placeholder={t("add.timePlaceholder")}
					containerStyle={styles.grow}
				/>
			</View>
			<Button
				label={t("add.lastNight")}
				variant="text"
				onPress={() => {
					onLocalDayChange(previousLocalDay(today));
					onTimeChange("20:00");
				}}
			/>
			<View style={styles.actions}>
				<Button
					label={t("add.cancel")}
					variant="text"
					disabled={busy}
					style={styles.grow}
					onPress={onCancel}
				/>
				<Button
					label={t("add.save")}
					loading={busy}
					disabled={saveDisabled}
					style={styles.grow}
					onPress={onSave}
				/>
			</View>
		</View>
	);
}

function DrinkBrowseRow({
	label,
	detail,
	accessibilityLabel,
	onPress,
}: {
	label: string;
	detail: string;
	accessibilityLabel: string;
	onPress: () => void;
}) {
	const { theme } = useUnistyles();

	return (
		<TouchableOpacity
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			onPress={onPress}
		>
			<Card style={styles.browseResult}>
				<View style={styles.grow}>
					<AppText variant="label">{label}</AppText>
					<AppText variant="caption" color="muted">
						{detail}
					</AppText>
				</View>
				<MaterialIcons name="add" color={theme.colors.textMuted} size={28} />
			</Card>
		</TouchableOpacity>
	);
}

export function DrinksScreen({ view = "overview", store }: DrinksScreenProps) {
	const { t } = useTranslation(["drinks", "common"]);
	const { theme } = useUnistyles();
	const { width: windowWidth } = useWindowDimensions();
	const headerSearchWidth = Math.max(180, Math.min(520, windowWidth - 96));
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [busy, setBusy] = useState(false);
	const confirmationSequence = useRef(0);
	const [recentConfirmation, setRecentConfirmation] = useState<{
		name: string;
		sequence: number;
	} | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [browseFilter, setBrowseFilter] = useState<BrowseFilter>("hydration");
	const [mode, setMode] = useState<AddMode>(null);
	const [catalogueId, setCatalogueId] = useState("");
	const [customId, setCustomId] = useState("");
	const [servingId, setServingId] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [label, setLabel] = useState("");
	const [servingLabel, setServingLabel] = useState("");
	const [volumeMl, setVolumeMl] = useState("");
	const [abv, setAbv] = useState("");
	const [caffeineMg, setCaffeineMg] = useState("");
	const [energyKcal, setEnergyKcal] = useState("");
	const [editingCustomId, setEditingCustomId] = useState<string | "new" | null>(
		null,
	);
	const [goalSlug, setGoalSlug] = useState<string | null>(null);
	const [goalTarget, setGoalTarget] = useState("");
	const [goalDate, setGoalDate] = useState("");
	const dismissRecentConfirmation = useCallback(
		() => setRecentConfirmation(null),
		[],
	);

	const {
		data: snapshot,
		error,
		loading,
		reload,
		setData: setSnapshot,
		setError,
	} = useFocusStoreLoad(
		useCallback(async () => {
			const next = await drinks.loadToday();
			// Seed the entry form the first time only, so a part-filled row
			// survives the refresh that follows a save.
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
			return next;
		}, [drinks]),
	);

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await drinks.loadToday());
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function repeatRecent(id: string, name: string) {
		if (await mutate(() => drinks.repeatEntry(id))) {
			confirmationSequence.current += 1;
			setRecentConfirmation({ name, sequence: confirmationSequence.current });
		}
	}

	function selectCatalogue(nextCatalogueId: string) {
		const drink = snapshot?.catalogue.find(
			(candidate) => candidate.id === nextCatalogueId,
		);
		Keyboard.dismiss();
		setMode("catalogue");
		setCatalogueId(nextCatalogueId);
		setServingId(drink?.servings[0]?.id ?? "");
	}

	function resetAddForm() {
		setMode(null);
		setCatalogueId("");
		setCustomId("");
		setServingId("");
		setQuantity("1");
		setLabel("");
		setServingLabel("");
		setVolumeMl("");
		setAbv("");
		setCaffeineMg("");
		setEnergyKcal("");
	}

	function selectCustom(nextCustomId: string) {
		const drink = snapshot?.customDrinks.find(
			(candidate) => candidate.id === nextCustomId,
		);
		Keyboard.dismiss();
		setMode("custom");
		setCustomId(nextCustomId);
		setServingId(drink?.servings[0]?.id ?? "");
	}

	function selectFree() {
		Keyboard.dismiss();
		resetAddForm();
		setMode("free");
	}

	function editCustom(id: string | null) {
		const drink = snapshot?.customDrinks.find(
			(candidate) => candidate.id === id,
		);
		const serving = drink?.servings[0];
		setEditingCustomId(id ?? "new");
		setLabel(drink?.label ?? "");
		setServingLabel(serving?.label ?? t("defaultServing"));
		setVolumeMl(
			serving?.volumeL == null ? "" : String(serving.volumeL * 1_000),
		);
		setAbv(
			serving?.volumeL && serving.ethanolKg != null
				? String((serving.ethanolKg / (serving.volumeL * 0.789_24)) * 100)
				: "",
		);
		setCaffeineMg(
			serving?.caffeineKg == null ? "" : String(serving.caffeineKg * 1_000_000),
		);
		setEnergyKcal(
			serving?.energyKcal == null ? "" : String(serving.energyKcal),
		);
	}

	async function saveCustomDrink() {
		const volumeL =
			optionalNumber(volumeMl) === null
				? null
				: (optionalNumber(volumeMl) ?? 0) / 1_000;
		const abvPercent = optionalNumber(abv);
		const saved = await mutate(() =>
			drinks.saveCustom({
				id:
					editingCustomId && editingCustomId !== "new"
						? editingCustomId
						: undefined,
				label,
				brand: null,
				servings: [
					{
						id:
							snapshot?.customDrinks.find(({ id }) => id === editingCustomId)
								?.servings[0]?.id ?? "default",
						label: servingLabel.trim() || t("defaultServing"),
						volumeL,
						ethanolKg:
							volumeL === null || abvPercent === null
								? null
								: ethanolKgFromVolumeAndAbv(volumeL, abvPercent),
						caffeineKg:
							optionalNumber(caffeineMg) === null
								? null
								: (optionalNumber(caffeineMg) ?? 0) / 1_000_000,
						energyKcal: optionalNumber(energyKcal),
						proteinG: null,
						carbsG: null,
						fatG: null,
					},
				],
			}),
		);
		if (saved) {
			setEditingCustomId(null);
			resetAddForm();
		}
	}

	async function saveCatalogue() {
		const savedDay = localDay;
		const saved = await mutate(async () => {
			await drinks.logCatalogue(catalogueId, servingId, Number(quantity), {
				localDay,
				time,
			});
		});
		if (!saved) return;
		resetAddForm();
		if (savedDay !== snapshot?.localDay) {
			router.push(`/drinks/${savedDay}` as Href);
		} else {
			router.replace("/drinks" as Href);
		}
	}

	async function saveFree() {
		const savedDay = localDay;
		const saved = await mutate(async () => {
			await drinks.logFree({
				label,
				servingLabel: servingLabel.trim() || null,
				quantity: Number(quantity),
				volumeMl: optionalNumber(volumeMl),
				abvPercent: optionalNumber(abv),
				caffeineMg: optionalNumber(caffeineMg),
				energyKcal: optionalNumber(energyKcal),
				localDay,
				time,
			});
		});
		if (!saved) return;
		resetAddForm();
		if (savedDay !== snapshot?.localDay) {
			router.push(`/drinks/${savedDay}` as Href);
		} else {
			router.replace("/drinks" as Href);
		}
	}

	async function saveCustomEntry() {
		const savedDay = localDay;
		const saved = await mutate(() =>
			drinks.logCustom(customId, servingId, Number(quantity), {
				localDay,
				time,
			}),
		);
		if (!saved) return;
		resetAddForm();
		if (savedDay !== snapshot?.localDay) {
			router.push(`/drinks/${savedDay}` as Href);
		} else {
			router.replace("/drinks" as Href);
		}
	}

	async function saveGoal() {
		if (!goalSlug) return;
		await mutate(async () => {
			await drinks.createGoal(goalSlug, goalTarget, goalDate.trim() || null);
			setGoalSlug(null);
			setGoalTarget("");
			setGoalDate("");
		});
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title={t("loadFailed")}
					body={error ?? t("loadFailedBody")}
					actionLabel={t("common:actions.tryAgain")}
					onAction={() => void reload()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const selectedDrink = snapshot.catalogue.find(
		(drink) => drink.id === catalogueId,
	);
	const selectedCustom = snapshot.customDrinks.find(
		(drink) => drink.id === customId,
	);
	const trackedMetrics = snapshot.metrics.filter((metric) => metric.tracked);
	const showingOverview = view === "overview";
	const customHasCanonicalQuantity = [volumeMl, caffeineMg, energyKcal].some(
		(value) => value.trim() !== "" && isOptionalNonNegativeNumber(value),
	);
	const customQuantitiesValid = [volumeMl, abv, caffeineMg, energyKcal].every(
		isOptionalNonNegativeNumber,
	);
	const customAbvValid =
		abv.trim() === "" || (volumeMl.trim() !== "" && Number(abv) <= 100);
	const query = searchQuery.trim().toLocaleLowerCase();
	const matchesQuery = (values: (string | null | undefined)[]) =>
		query === "" ||
		values.some((value) => value?.toLocaleLowerCase().includes(query));
	const searching = query !== "";
	const searchCustomDrinks = snapshot.customDrinks.filter((drink) =>
		matchesQuery([
			drink.label,
			drink.brand,
			...drink.servings.map((serving) => serving.label),
		]),
	);
	const searchCatalogue = snapshot.catalogue.filter((drink) =>
		matchesQuery([
			drink.label,
			...drink.servings.map((serving) => serving.label),
		]),
	);
	const noBrowseResults =
		searching &&
		searchCustomDrinks.length === 0 &&
		searchCatalogue.length === 0;
	const filteredCatalogue =
		browseFilter && browseFilter !== "custom"
			? snapshot.catalogue.filter((drink) => drink.kind === browseFilter)
			: [];
	const freeValuesValid = [volumeMl, abv, caffeineMg, energyKcal].every(
		isOptionalNonNegativeNumber,
	);
	const freeAbvValid =
		abv.trim() === "" || (volumeMl.trim() !== "" && Number(abv) <= 100);
	const selectedChoice = mode === "catalogue" ? selectedDrink : selectedCustom;
	const logSaveDisabled =
		!isPositiveNumber(quantity) ||
		(mode === "catalogue" && (!catalogueId || !servingId)) ||
		(mode === "custom" && (!customId || !servingId)) ||
		(mode === "free" && (!label.trim() || !freeValuesValid || !freeAbvValid));

	return (
		<>
			{view === "log" ? (
				<Stack.Screen
					options={{
						headerTitleAlign: "left",
						headerTitle: () => (
							<View style={[styles.headerSearch, { width: headerSearchWidth }]}>
								<MaterialIcons
									name="search"
									color={theme.colors.textMuted}
									size={24}
								/>
								<TextInput
									accessibilityLabel={t("browse.fieldA11y")}
									autoCapitalize="none"
									autoCorrect={false}
									placeholder={t("browse.headerPlaceholder")}
									placeholderTextColor={theme.colors.textSubtle}
									returnKeyType="search"
									style={styles.headerSearchInput}
									value={searchQuery}
									onChangeText={setSearchQuery}
								/>
								{searchQuery ? (
									<TouchableOpacity
										accessibilityRole="button"
										accessibilityLabel={t("browse.clearA11y")}
										hitSlop={8}
										style={styles.headerSearchClear}
										onPress={() => setSearchQuery("")}
									>
										<MaterialIcons
											name="close"
											color={theme.colors.textMuted}
											size={24}
										/>
									</TouchableOpacity>
								) : null}
							</View>
						),
					}}
				/>
			) : null}
			<Screen
				scroll
				padded
				gap="lg"
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior={
					view === "log" ? "automatic" : undefined
				}
			>
				{showingOverview ? (
					<Card style={styles.section}>
						<SectionHeader
							title={t("today.title")}
							eyebrow={snapshot.localDay}
							action={
								<TouchableOpacity
									accessibilityRole="button"
									onPress={() => router.push("/settings/drinks" as Href)}
								>
									<AppText variant="label" color="brand">
										{t("today.settings")}
									</AppText>
								</TouchableOpacity>
							}
						/>
						<View style={styles.totals}>
							{snapshot.metrics.map((metric) => (
								<View key={metric.metric.slug} style={styles.total}>
									<AppText variant="micro" color="subtle">
										{upperCaseForLanguage(metric.metric.label)}
									</AppText>
									<AppText variant="section">
										{metric.dayFormatted ?? t("common:emDash")}
									</AppText>
									<AppText variant="micro" color="muted">
										{t("today.weekTotal", {
											value: metric.weekFormatted ?? t("common:emDash"),
										})}
									</AppText>
								</View>
							))}
						</View>
						<AppText variant="caption" color="subtle">
							{t("today.disclaimer")}
						</AppText>
					</Card>
				) : null}

				{error ? <AppText color="danger">{error}</AppText> : null}

				{showingOverview ? (
					<View style={styles.section}>
						<SectionHeader title={t("overview.manageTitle")} />
						<ListRow
							title={t("overview.custom")}
							detail={t("overview.customDetail")}
							onPress={() => router.push("/drinks/custom" as Href)}
						/>
						<ListRow
							title={t("overview.goals")}
							detail={t("overview.goalsDetail")}
							onPress={() => router.push("/drinks/goals" as Href)}
						/>
					</View>
				) : null}

				{showingOverview ? (
					<View style={styles.section}>
						<SectionHeader
							title={t("quickAdd.title")}
							eyebrow={t("quickAdd.eyebrow")}
						/>
						{snapshot.recents.length === 0 ? (
							<AppText color="muted">{t("quickAdd.empty")}</AppText>
						) : (
							<View style={styles.wrap}>
								{snapshot.recents.map(({ entry }) => (
									<Button
										key={entry.id}
										label={t("quickAdd.option", {
											drink: entry.label,
											serving: entry.servingLabel ?? t("defaultServing"),
										})}
										variant="secondary"
										disabled={busy}
										onPress={() => void repeatRecent(entry.id, entry.label)}
									/>
								))}
							</View>
						)}
					</View>
				) : null}

				{view === "custom" ? (
					<View style={styles.section}>
						<SectionHeader
							title={t("custom.title")}
							action={
								<Button
									label={t("custom.create")}
									variant="text"
									onPress={() => editCustom(null)}
								/>
							}
						/>
						{snapshot.customDrinks.length === 0 ? (
							<AppText color="muted">{t("custom.empty")}</AppText>
						) : (
							snapshot.customDrinks.map((drink) => (
								<Card key={drink.id} style={styles.actions}>
									<View style={styles.grow}>
										<AppText variant="label">{drink.label}</AppText>
										<AppText variant="caption" color="muted">
											{drink.servings[0]?.label}
										</AppText>
									</View>
									<Button
										label={t("custom.edit")}
										variant="text"
										onPress={() => editCustom(drink.id)}
									/>
									<Button
										label={t("custom.delete")}
										variant="text"
										tone="danger"
										disabled={busy}
										onPress={() =>
											void mutate(() => drinks.deleteCustom(drink.id))
										}
									/>
								</Card>
							))
						)}
						{editingCustomId !== null ? (
							<Card style={styles.section}>
								<FormField
									label={t("custom.nameField")}
									value={label}
									onChangeText={setLabel}
								/>
								<SectionHeader title={t("custom.detailsTitle")} />
								<AppText variant="caption" color="muted">
									{t("custom.quantityHelp")}
								</AppText>
								<FormField
									label={t("custom.volumeField")}
									value={volumeMl}
									onChangeText={setVolumeMl}
									keyboardType="decimal-pad"
								/>
								<FormField
									label={t("custom.caffeineField")}
									value={caffeineMg}
									onChangeText={setCaffeineMg}
									keyboardType="decimal-pad"
								/>
								<FormField
									label={t("custom.energyField")}
									value={energyKcal}
									onChangeText={setEnergyKcal}
									keyboardType="decimal-pad"
								/>
								<FormField
									label={t("custom.abvField")}
									value={abv}
									onChangeText={setAbv}
									keyboardType="decimal-pad"
								/>
								<FormField
									label={t("custom.servingField")}
									value={servingLabel}
									onChangeText={setServingLabel}
								/>
								<View style={styles.actions}>
									<Button
										label={t("custom.cancel")}
										variant="text"
										style={styles.grow}
										onPress={() => {
											setEditingCustomId(null);
											resetAddForm();
										}}
									/>
									<Button
										label={t("custom.save")}
										loading={busy}
										disabled={
											!label.trim() ||
											!customHasCanonicalQuantity ||
											!customQuantitiesValid ||
											!customAbvValid
										}
										style={styles.grow}
										onPress={() => void saveCustomDrink()}
									/>
								</View>
							</Card>
						) : null}
					</View>
				) : null}

				{view === "log" ? (
					<>
						{!searching ? (
							<>
								<View style={styles.section}>
									<SectionHeader title={t("browse.recentTitle")} />
									{snapshot.recents.length === 0 ? (
										<AppText color="muted">{t("quickAdd.empty")}</AppText>
									) : (
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
											contentContainerStyle={styles.quickLogRow}
										>
											{snapshot.recents.map(({ entry }) => (
												<Button
													key={entry.id}
													label={t("quickAdd.option", {
														drink: entry.label,
														serving: entry.servingLabel ?? t("defaultServing"),
													})}
													accessibilityLabel={t("browse.logRecentA11y", {
														name: entry.label,
													})}
													variant="secondary"
													disabled={busy}
													style={styles.quickLogButton}
													onPress={() =>
														void repeatRecent(entry.id, entry.label)
													}
												/>
											))}
										</ScrollView>
									)}
								</View>

								<View style={styles.section}>
									<SectionHeader title={t("browse.catalogueTitle")} />
									<View style={styles.filterRow}>
										{snapshot.customDrinks.length > 0 ? (
											<Button
												label={t("browse.customTitle")}
												accessibilityState={{
													selected: browseFilter === "custom",
												}}
												variant={
													browseFilter === "custom" ? "primary" : "secondary"
												}
												style={styles.filterChip}
												onPress={() =>
													setBrowseFilter((current) =>
														current === "custom" ? null : "custom",
													)
												}
											/>
										) : null}
										{CATALOGUE_KINDS.map((kind) => (
											<Button
												key={kind}
												label={t(`browse.categories.${kind}`)}
												accessibilityState={{ selected: browseFilter === kind }}
												variant={
													browseFilter === kind ? "primary" : "secondary"
												}
												style={styles.filterChip}
												onPress={() =>
													setBrowseFilter((current) =>
														current === kind ? null : kind,
													)
												}
											/>
										))}
									</View>

									{browseFilter === null ? (
										<AppText color="muted">
											{t("browse.chooseCategory")}
										</AppText>
									) : browseFilter === "custom" ? (
										<View style={styles.section}>
											{snapshot.customDrinks.map((drink) => (
												<DrinkBrowseRow
													key={drink.id}
													label={drink.label}
													detail={
														drink.brand ??
														drink.servings[0]?.label ??
														t("defaultServing")
													}
													accessibilityLabel={t("browse.logA11y", {
														name: drink.label,
													})}
													onPress={() => selectCustom(drink.id)}
												/>
											))}
										</View>
									) : (
										<View style={styles.section}>
											{filteredCatalogue.map((drink) => (
												<DrinkBrowseRow
													key={drink.id}
													label={drink.label}
													detail={t("browse.servings", {
														count: drink.servings.length,
													})}
													accessibilityLabel={t("browse.logA11y", {
														name: drink.label,
													})}
													onPress={() => selectCatalogue(drink.id)}
												/>
											))}
										</View>
									)}
								</View>
							</>
						) : (
							<View style={styles.section}>
								<SectionHeader title={t("browse.searchResultsTitle")} />
								{searchCustomDrinks.map((drink) => (
									<DrinkBrowseRow
										key={drink.id}
										label={drink.label}
										detail={
											drink.brand ??
											drink.servings[0]?.label ??
											t("defaultServing")
										}
										accessibilityLabel={t("browse.logA11y", {
											name: drink.label,
										})}
										onPress={() => selectCustom(drink.id)}
									/>
								))}
								{searchCatalogue.map((drink) => (
									<DrinkBrowseRow
										key={drink.id}
										label={drink.label}
										detail={t("browse.servings", {
											count: drink.servings.length,
										})}
										accessibilityLabel={t("browse.logA11y", {
											name: drink.label,
										})}
										onPress={() => selectCatalogue(drink.id)}
									/>
								))}
								{noBrowseResults ? (
									<AppText color="muted">{t("browse.noResults")}</AppText>
								) : null}
							</View>
						)}

						<View style={styles.section}>
							<SectionHeader title={t("browse.manualTitle")} />
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel={t("browse.customLogA11y")}
								onPress={selectFree}
							>
								<Card style={styles.browseResult}>
									<View style={styles.grow}>
										<AppText variant="label">{t("add.chooseFree")}</AppText>
										<AppText variant="caption" color="muted">
											{t("browse.manualDetail")}
										</AppText>
									</View>
									<MaterialIcons
										name="add"
										color={theme.colors.brand}
										size={28}
									/>
								</Card>
							</TouchableOpacity>
						</View>
					</>
				) : null}

				{showingOverview ? (
					<View style={styles.section}>
						<SectionHeader title={t("entries.title")} />
						{snapshot.entries.length === 0 ? (
							<EmptyState
								title={t("entries.emptyTitle")}
								body={t("entries.emptyBody")}
							/>
						) : (
							snapshot.entries.map(({ entry, detail, contributions }) => (
								<TouchableOpacity
									key={entry.id}
									accessibilityRole="button"
									accessibilityLabel={t("entries.edit", { name: entry.label })}
									onPress={() =>
										router.push(`/drinks/${snapshot.localDay}` as Href)
									}
								>
									<Card style={styles.entry}>
										<AppText variant="label">{entry.label}</AppText>
										<AppText variant="caption" color="muted">
											{detail}
										</AppText>
										{contributions ? (
											<AppText variant="micro" color="subtle">
												{contributions}
											</AppText>
										) : null}
									</Card>
								</TouchableOpacity>
							))
						)}
					</View>
				) : null}

				{showingOverview && snapshot.recentLocalDays.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("entries.recentDays")} />
						<View style={styles.wrap}>
							{snapshot.recentLocalDays.map((day) => (
								<Button
									key={day}
									label={day}
									variant="secondary"
									onPress={() => router.push(`/drinks/${day}` as Href)}
								/>
							))}
						</View>
					</View>
				) : null}

				{view === "goals" ? (
					<View style={styles.section}>
						<SectionHeader title={t("goals.title")} />
						{trackedMetrics.length === 0 ? (
							<AppText color="muted">{t("goals.needMetrics")}</AppText>
						) : null}
						{trackedMetrics.map((metric) => {
							const activeGoal = metric.goals.find(
								(goal) => goal.status === "active",
							);
							return (
								<Card key={metric.metric.slug} style={styles.section}>
									<SectionHeader title={metric.metric.label} />
									{activeGoal ? (
										<>
											<AppText>
												{t("goals.summary", {
													target: activeGoal.targetFormatted,
													current:
														activeGoal.currentFormatted ?? t("common:emDash"),
												})}
											</AppText>
											{activeGoal.targetReached ? (
												<AppText variant="caption" color="brand">
													{t("goals.targetReached")}
												</AppText>
											) : activeGoal.progressPercent !== null ? (
												<AppText variant="caption" color="brand">
													{t("goals.percentComplete", {
														percent: activeGoal.progressPercent,
													})}
												</AppText>
											) : null}
											<View style={styles.actions}>
												<Button
													label={t("goals.achieve")}
													variant="secondary"
													disabled={busy}
													style={styles.grow}
													onPress={() =>
														void mutate(() =>
															drinks.achieveGoal(activeGoal.goal.id),
														)
													}
												/>
												<Button
													label={t("goals.abandon")}
													variant="text"
													disabled={busy}
													style={styles.grow}
													onPress={() =>
														void mutate(() =>
															drinks.abandonGoal(activeGoal.goal.id),
														)
													}
												/>
											</View>
										</>
									) : goalSlug === metric.metric.slug ? (
										<>
											<FormField
												label={t("goals.targetField", {
													unit: metric.displayUnit,
												})}
												value={goalTarget}
												onChangeText={setGoalTarget}
												keyboardType="decimal-pad"
											/>
											<FormField
												label={t("goals.targetDateField")}
												value={goalDate}
												onChangeText={setGoalDate}
												placeholder={t("add.datePlaceholder")}
											/>
											<Button
												label={t("goals.save")}
												loading={busy}
												onPress={() => void saveGoal()}
											/>
										</>
									) : metric.dayValue !== null ? (
										<Button
											label={t("goals.setFor", { name: metric.metric.label })}
											variant="secondary"
											onPress={() => setGoalSlug(metric.metric.slug)}
										/>
									) : (
										<AppText color="muted">{t("goals.needValue")}</AppText>
									)}
								</Card>
							);
						})}
					</View>
				) : null}
			</Screen>
			<LogConfirmationToast
				key={recentConfirmation?.sequence}
				message={
					recentConfirmation
						? t("quickAdd.added", { drink: recentConfirmation.name })
						: null
				}
				actionLabel={t("common:actions.viewLog")}
				onDismiss={dismissRecentConfirmation}
				onAction={() => router.push(`/drinks/${snapshot.localDay}` as Href)}
			/>
			{view === "log" && mode ? (
				<ModalSheet
					visible
					onClose={resetAddForm}
					closeAccessibilityLabel={t("browse.dismissA11y")}
				>
					<DrinkLogForm
						title={
							selectedChoice
								? t("browse.logTitle", { name: selectedChoice.label })
								: t("add.title")
						}
						mode={mode}
						servings={selectedChoice?.servings ?? []}
						servingId={servingId}
						onServingChange={setServingId}
						quantity={quantity}
						onQuantityChange={setQuantity}
						localDay={localDay}
						onLocalDayChange={setLocalDay}
						time={time}
						onTimeChange={setTime}
						label={label}
						onLabelChange={setLabel}
						servingLabel={servingLabel}
						onServingLabelChange={setServingLabel}
						volumeMl={volumeMl}
						onVolumeMlChange={setVolumeMl}
						abv={abv}
						onAbvChange={setAbv}
						caffeineMg={caffeineMg}
						onCaffeineMgChange={setCaffeineMg}
						energyKcal={energyKcal}
						onEnergyKcalChange={setEnergyKcal}
						today={snapshot.localDay}
						busy={busy}
						saveDisabled={logSaveDisabled}
						onCancel={resetAddForm}
						onSave={() =>
							void (mode === "catalogue"
								? saveCatalogue()
								: mode === "custom"
									? saveCustomEntry()
									: saveFree())
						}
					/>
				</ModalSheet>
			) : null}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	totals: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
	total: { minWidth: "44%", flexGrow: 1, gap: theme.spacing.xs },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	actions: { flexDirection: "row", gap: theme.spacing.md },
	grow: { flex: 1 },
	entry: { gap: theme.spacing.xs },
	browseResult: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	quickLogRow: { gap: theme.spacing.sm },
	quickLogButton: {
		minWidth: 168,
		maxWidth: 240,
		paddingHorizontal: theme.spacing.md,
	},
	filterRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.sm,
	},
	filterChip: { paddingHorizontal: theme.spacing.md },
	headerSearch: {
		height: 44,
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface,
	},
	headerSearchInput: {
		...theme.typography.body,
		flex: 1,
		paddingVertical: 0,
		color: theme.colors.text,
	},
	headerSearchClear: {
		width: 24,
		height: 24,
		alignItems: "center",
		justifyContent: "center",
	},
}));
