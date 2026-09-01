import type { CreateCustomConsumableComponent } from "@bro/database-app";
import { previousLocalDay } from "@bro/domain";
import type { FoodSearchResult } from "@bro/domain/food-search";
import { type Href, router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Keyboard,
	TextInput,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { DateField } from "../../components/date-field";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { Icon } from "../../components/icon";
import { ListRow } from "../../components/list-row";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LogConfirmationToast } from "../../components/log-confirmation-toast";
import { ModalSheet } from "../../components/modal-sheet";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { TimeField } from "../../components/time-field";
import {
	createFoodSearchStore,
	type FoodSearchSnapshot,
	type FoodSearchStore,
} from "../../food/food-search-store";
import {
	type CustomFood,
	createFoodStore,
	type FoodStore,
} from "../../food/food-store";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type FoodScreenProps = {
	view?: "overview" | "custom" | "log" | "goals";
	initialCustomId?: string;
	store?: Pick<
		FoodStore,
		| "loadToday"
		| "logFree"
		| "logCustom"
		| "logSearchResult"
		| "repeatEntry"
		| "saveCustom"
		| "deleteCustom"
		| "createGoal"
		| "achieveGoal"
		| "abandonGoal"
	>;
	searchStore?: Pick<FoodSearchStore, "loadCached" | "search">;
};

type AddMode = "custom" | "free" | null;

const SEARCH_DEBOUNCE_MS = 300;

function optionalNumber(value: string): number | null {
	return value.trim() ? Number(value) : null;
}

function isNonNegativeNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number >= 0;
}

function areOptionalNonNegativeNumbers(...values: string[]): boolean {
	return values.every(
		(value) => value.trim() === "" || isNonNegativeNumber(value),
	);
}

function hasCanonicalFoodQuantity(...values: string[]): boolean {
	return values.some(isNonNegativeNumber);
}

function CustomFoodEditor({
	initial,
	busy,
	onSave,
	onCancel,
}: {
	initial: CustomFood | null;
	busy: boolean;
	onSave: (draft: Parameters<FoodStore["saveCustom"]>[0]) => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation("food");
	const serving = initial?.consumable.servings[0];
	const [label, setLabel] = useState(initial?.consumable.label ?? "");
	const [brand, setBrand] = useState(initial?.consumable.brand ?? "");
	const [isRecipe, setIsRecipe] = useState(
		initial?.consumable.isRecipe ?? false,
	);
	const [servingLabel, setServingLabel] = useState(
		serving?.label ?? t("defaultServing"),
	);
	const [energy, setEnergy] = useState(
		serving?.energyKcal == null ? "" : String(serving.energyKcal),
	);
	const [protein, setProtein] = useState(
		serving?.proteinG == null ? "" : String(serving.proteinG),
	);
	const [carbs, setCarbs] = useState(
		serving?.carbsG == null ? "" : String(serving.carbsG),
	);
	const [fat, setFat] = useState(
		serving?.fatG == null ? "" : String(serving.fatG),
	);
	const [components, setComponents] = useState<
		CreateCustomConsumableComponent[]
	>(
		initial?.components.map(
			({
				id: _id,
				consumableId: _consumableId,
				createdAt: _createdAt,
				updatedAt: _updatedAt,
				...component
			}) => component,
		) ?? [],
	);
	const [componentLabel, setComponentLabel] = useState("");
	const [componentQuantity, setComponentQuantity] = useState("1");
	const [componentEnergy, setComponentEnergy] = useState("");
	const [componentProtein, setComponentProtein] = useState("");
	const [componentCarbs, setComponentCarbs] = useState("");
	const [componentFat, setComponentFat] = useState("");
	const hasServingQuantity = hasCanonicalFoodQuantity(
		energy,
		protein,
		carbs,
		fat,
	);
	const hasComponentQuantity = hasCanonicalFoodQuantity(
		componentEnergy,
		componentProtein,
		componentCarbs,
		componentFat,
	);
	const servingQuantitiesValid = areOptionalNonNegativeNumbers(
		energy,
		protein,
		carbs,
		fat,
	);
	const componentQuantitiesValid = areOptionalNonNegativeNumbers(
		componentEnergy,
		componentProtein,
		componentCarbs,
		componentFat,
	);
	const componentServingQuantity = Number(componentQuantity);

	function addComponent() {
		setComponents((current) => [
			...current,
			{
				position: current.length,
				label: componentLabel,
				quantity: Number(componentQuantity),
				energyKcal: optionalNumber(componentEnergy),
				proteinG: optionalNumber(componentProtein),
				carbsG: optionalNumber(componentCarbs),
				fatG: optionalNumber(componentFat),
			},
		]);
		setComponentLabel("");
		setComponentQuantity("1");
		setComponentEnergy("");
		setComponentProtein("");
		setComponentCarbs("");
		setComponentFat("");
	}

	function save() {
		const total = (field: "energyKcal" | "proteinG" | "carbsG" | "fatG") => {
			const values = components.map((component) => component[field]);
			return values.every((value) => value === null)
				? null
				: values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
		};
		onSave({
			id: initial?.consumable.id,
			label,
			brand: brand.trim() || null,
			isRecipe,
			servings: [
				{
					id: serving?.id ?? "default",
					label: servingLabel,
					volumeL: null,
					ethanolKg: null,
					caffeineKg: null,
					energyKcal: isRecipe ? total("energyKcal") : optionalNumber(energy),
					proteinG: isRecipe ? total("proteinG") : optionalNumber(protein),
					carbsG: isRecipe ? total("carbsG") : optionalNumber(carbs),
					fatG: isRecipe ? total("fatG") : optionalNumber(fat),
				},
			],
			components: isRecipe ? components : [],
		});
	}

	return (
		<Card style={styles.section}>
			<SectionHeader
				title={initial ? t("custom.editorTitle") : t("custom.newTitle")}
			/>
			<View style={styles.wrap}>
				<Button
					label={t("custom.kindFood")}
					variant={!isRecipe ? "primary" : "secondary"}
					onPress={() => setIsRecipe(false)}
				/>
				<Button
					label={t("custom.kindRecipe")}
					variant={isRecipe ? "primary" : "secondary"}
					onPress={() => setIsRecipe(true)}
				/>
			</View>
			<FormField
				label={t("custom.nameField")}
				value={label}
				onChangeText={setLabel}
			/>
			<FormField
				label={t("custom.brandField")}
				value={brand}
				onChangeText={setBrand}
			/>
			{isRecipe ? (
				<View style={styles.section}>
					<FormField
						label={t("custom.servingField")}
						value={servingLabel}
						onChangeText={setServingLabel}
					/>
					<AppText variant="label">{t("custom.componentsLabel")}</AppText>
					{components.map((component, index) => (
						<View
							key={`${component.position}:${component.label}`}
							style={styles.componentRow}
						>
							<AppText style={styles.grow}>
								{t("custom.component", {
									quantity: component.quantity,
									name: component.label,
								})}
							</AppText>
							<Button
								label={t("custom.removeComponent")}
								variant="text"
								tone="danger"
								onPress={() =>
									setComponents((current) =>
										current
											.filter((_, candidate) => candidate !== index)
											.map((item, position) => ({ ...item, position })),
									)
								}
							/>
						</View>
					))}
					<FormField
						label={t("custom.componentNameField")}
						value={componentLabel}
						onChangeText={setComponentLabel}
					/>
					<FormField
						label={t("custom.componentQuantityField")}
						value={componentQuantity}
						onChangeText={setComponentQuantity}
						keyboardType="decimal-pad"
					/>
					<View style={styles.actions}>
						<FormField
							label={t("custom.componentEnergyField")}
							value={componentEnergy}
							onChangeText={setComponentEnergy}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label={t("custom.proteinField")}
							value={componentProtein}
							onChangeText={setComponentProtein}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<View style={styles.actions}>
						<FormField
							label={t("custom.carbsField")}
							value={componentCarbs}
							onChangeText={setComponentCarbs}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label={t("custom.fatField")}
							value={componentFat}
							onChangeText={setComponentFat}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<Button
						label={t("custom.addComponent")}
						variant="secondary"
						disabled={
							!componentLabel.trim() ||
							!hasComponentQuantity ||
							!componentQuantitiesValid ||
							!Number.isFinite(componentServingQuantity) ||
							componentServingQuantity <= 0
						}
						onPress={addComponent}
					/>
					<AppText variant="caption" color="muted">
						{t("custom.componentQuantityHelp")}
					</AppText>
				</View>
			) : (
				<>
					<SectionHeader title={t("custom.nutritionTitle")} />
					<AppText variant="caption" color="muted">
						{t("custom.quantityHelp")}
					</AppText>
					<FormField
						label={t("custom.energyField")}
						value={energy}
						onChangeText={setEnergy}
						keyboardType="decimal-pad"
					/>
					<FormField
						label={t("custom.proteinField")}
						value={protein}
						onChangeText={setProtein}
						keyboardType="decimal-pad"
					/>
					<FormField
						label={t("custom.carbsField")}
						value={carbs}
						onChangeText={setCarbs}
						keyboardType="decimal-pad"
					/>
					<FormField
						label={t("custom.fatField")}
						value={fat}
						onChangeText={setFat}
						keyboardType="decimal-pad"
					/>
					<FormField
						label={t("custom.servingField")}
						value={servingLabel}
						onChangeText={setServingLabel}
					/>
				</>
			)}
			<View style={styles.actions}>
				<Button
					label={t("custom.cancel")}
					variant="text"
					disabled={busy}
					style={styles.grow}
					onPress={onCancel}
				/>
				<Button
					label={t("custom.save")}
					loading={busy}
					disabled={
						!label.trim() ||
						(isRecipe
							? components.length === 0
							: !hasServingQuantity || !servingQuantitiesValid)
					}
					style={styles.grow}
					onPress={save}
				/>
			</View>
		</Card>
	);
}

function SearchedFoodLogForm({
	result,
	servingId,
	onServingChange,
	quantity,
	onQuantityChange,
	localDay,
	onLocalDayChange,
	time,
	onTimeChange,
	busy,
	onCancel,
	onSave,
}: {
	result: FoodSearchResult;
	servingId: string;
	onServingChange: (servingId: string) => void;
	quantity: string;
	onQuantityChange: (quantity: string) => void;
	localDay: string;
	onLocalDayChange: (localDay: string) => void;
	time: string;
	onTimeChange: (time: string) => void;
	busy: boolean;
	onCancel: () => void;
	onSave: () => void;
}) {
	const { t } = useTranslation("food");

	return (
		<View style={styles.section}>
			<View style={styles.section}>
				<AppText variant="section">
					{t("search.logTitle", { name: result.label })}
				</AppText>
				{result.brand ? (
					<AppText variant="caption" color="muted">
						{result.brand}
					</AppText>
				) : null}
				<AppText variant="micro" color="subtle">
					{t("search.provenance", {
						source: result.source,
						licence: result.licence,
					})}
				</AppText>
			</View>
			<AppText variant="label">{t("search.servingLabel")}</AppText>
			<View style={styles.wrap}>
				{result.servings.map((serving) => (
					<Button
						key={serving.id}
						label={serving.label}
						variant={servingId === serving.id ? "primary" : "secondary"}
						onPress={() => onServingChange(serving.id)}
					/>
				))}
			</View>
			<FormField
				label={t("search.quantityField")}
				value={quantity}
				onChangeText={onQuantityChange}
				keyboardType="decimal-pad"
			/>
			<View style={styles.actions}>
				<DateField
					label={t("search.dateField")}
					value={localDay}
					onChangeDate={onLocalDayChange}
					containerStyle={styles.grow}
				/>
				<TimeField
					label={t("search.timeField")}
					value={time}
					onChangeTime={onTimeChange}
					containerStyle={styles.grow}
				/>
			</View>
			<View style={styles.actions}>
				<Button
					label={t("search.cancel")}
					variant="text"
					style={styles.grow}
					onPress={onCancel}
				/>
				<Button
					label={t("search.save")}
					loading={busy}
					disabled={!servingId}
					style={styles.grow}
					onPress={onSave}
				/>
			</View>
		</View>
	);
}

export function FoodScreen({
	view = "overview",
	initialCustomId,
	store,
	searchStore,
}: FoodScreenProps) {
	const { t } = useTranslation(["food", "common"]);
	const { theme } = useUnistyles();
	const { width: windowWidth } = useWindowDimensions();
	const headerSearchWidth = Math.max(180, Math.min(520, windowWidth - 96));
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const foodSearch = useMemo(
		() => searchStore ?? createFoodSearchStore(),
		[searchStore],
	);
	const [searchSnapshot, setSearchSnapshot] =
		useState<FoodSearchSnapshot | null>(null);
	const searchRequestId = useRef(0);
	const confirmationSequence = useRef(0);
	const [busy, setBusy] = useState(false);
	const [recentConfirmation, setRecentConfirmation] = useState<{
		name: string;
		sequence: number;
	} | null>(null);
	const [searchBusy, setSearchBusy] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [submittedSearchQuery, setSubmittedSearchQuery] = useState("");
	const [selectedSearchRef, setSelectedSearchRef] = useState("");
	const [searchServingId, setSearchServingId] = useState("");
	const [mode, setMode] = useState<AddMode>(initialCustomId ? "custom" : null);
	const [customId, setCustomId] = useState(initialCustomId ?? "");
	const [servingId, setServingId] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [label, setLabel] = useState("");
	const [servingLabel, setServingLabel] = useState("");
	const [energy, setEnergy] = useState("");
	const [protein, setProtein] = useState("");
	const [carbs, setCarbs] = useState("");
	const [fat, setFat] = useState("");
	const [customEditor, setCustomEditor] = useState<CustomFood | "new" | null>(
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
			const [next, cached] = await Promise.all([
				food.loadToday(),
				foodSearch.loadCached(),
			]);
			// The cached search results and the entry form are seeded once, so a
			// part-typed search or row survives the refresh that follows a save.
			setSearchSnapshot((current) => current ?? cached);
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
			if (initialCustomId) {
				const selected = next.customFoods.find(
					({ consumable }) => consumable.id === initialCustomId,
				)?.consumable;
				setServingId((current) => current || selected?.servings[0]?.id || "");
			}
			return next;
		}, [food, foodSearch, initialCustomId]),
	);

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await food.loadToday());
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	async function repeatRecent(id: string, name: string) {
		if (await mutate(() => food.repeatEntry(id))) {
			confirmationSequence.current += 1;
			setRecentConfirmation({ name, sequence: confirmationSequence.current });
		}
	}

	function selectCustom(nextId: string) {
		const selected = snapshot?.customFoods.find(
			({ consumable }) => consumable.id === nextId,
		)?.consumable;
		setCustomId(nextId);
		setServingId(selected?.servings[0]?.id ?? "");
	}

	const resetAdd = useCallback(() => {
		setMode(null);
		setCustomId("");
		setServingId("");
		setQuantity("1");
		setLabel("");
		setServingLabel("");
		setEnergy("");
		setProtein("");
		setCarbs("");
		setFat("");
	}, []);

	useEffect(() => {
		if (view !== "log") return;
		const requestId = ++searchRequestId.current;
		const query = searchQuery.trim();
		if (query.length < 2) {
			setSubmittedSearchQuery("");
			setSelectedSearchRef("");
			setSearchServingId("");
			setSearchBusy(false);
			return;
		}

		const timeout = setTimeout(() => {
			resetAdd();
			setSubmittedSearchQuery(query);
			setSearchBusy(true);
			setError(null);
			void foodSearch
				.search(query)
				.then((next) => {
					if (requestId !== searchRequestId.current) return;
					setSearchSnapshot(next);
					setSelectedSearchRef("");
					setSearchServingId("");
				})
				.catch((caught) => {
					if (requestId === searchRequestId.current) {
						setError(toMessage(caught));
					}
				})
				.finally(() => {
					if (requestId === searchRequestId.current) {
						setSearchBusy(false);
					}
				});
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			clearTimeout(timeout);
			if (requestId === searchRequestId.current) {
				searchRequestId.current += 1;
			}
		};
	}, [foodSearch, resetAdd, searchQuery, setError, view]);

	function updateSearchQuery(query: string) {
		searchRequestId.current += 1;
		setSearchQuery(query);
		setSubmittedSearchQuery("");
		setSelectedSearchRef("");
		setSearchServingId("");
		setSearchBusy(false);
		setError(null);
	}

	function clearSearch() {
		updateSearchQuery("");
	}

	function selectSearchResult(result: FoodSearchResult) {
		Keyboard.dismiss();
		resetAdd();
		setSelectedSearchRef(result.ref);
		setSearchServingId(result.servings[0]?.id ?? "");
	}

	function closeSearchResult() {
		setSelectedSearchRef("");
		setSearchServingId("");
		setQuantity("1");
	}

	async function saveSearchResult() {
		const result = searchSnapshot?.results.find(
			(candidate) => candidate.ref === selectedSearchRef,
		);
		if (!result) return;
		const savedDay = localDay;
		const saved = await mutate(() =>
			food.logSearchResult(result, searchServingId, Number(quantity), {
				localDay,
				time,
			}),
		);
		if (!saved) return;
		setSelectedSearchRef("");
		setSearchServingId("");
		setQuantity("1");
		if (savedDay !== snapshot?.localDay) {
			router.push(`/food/${savedDay}` as Href);
		} else {
			router.replace("/food" as Href);
		}
	}

	async function saveEntry() {
		const savedDay = localDay;
		const saved = await mutate(() =>
			mode === "custom"
				? food.logCustom(customId, servingId, Number(quantity), {
						localDay,
						time,
					})
				: food.logFree({
						label,
						servingLabel: servingLabel.trim() || null,
						quantity: Number(quantity),
						energyKcal: optionalNumber(energy),
						proteinG: optionalNumber(protein),
						carbsG: optionalNumber(carbs),
						fatG: optionalNumber(fat),
						localDay,
						time,
					}),
		);
		if (!saved) return;
		resetAdd();
		if (savedDay !== snapshot?.localDay) {
			router.push(`/food/${savedDay}` as Href);
		} else {
			router.replace("/food" as Href);
		}
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

	const selectedCustom = snapshot.customFoods.find(
		({ consumable }) => consumable.id === customId,
	)?.consumable;
	const selectedSearchResult = searchSnapshot?.results.find(
		(result) => result.ref === selectedSearchRef,
	);
	const trackedMetrics = snapshot.metrics.filter((metric) => metric.tracked);
	const showingOverview = view === "overview";
	const showingSearchResults =
		view === "log" && submittedSearchQuery.trim().length >= 2;

	return (
		<>
			{view === "log" ? (
				<Stack.Screen
					options={{
						headerTitleAlign: "left",
						headerTitle: () => (
							<View style={[styles.headerSearch, { width: headerSearchWidth }]}>
								<Icon name="search" color={theme.colors.textMuted} size={24} />
								<TextInput
									accessibilityLabel={t("search.fieldA11y")}
									autoCapitalize="none"
									autoCorrect={false}
									enterKeyHint="search"
									placeholder={t("search.headerPlaceholder")}
									placeholderTextColor={theme.colors.textSubtle}
									returnKeyType="search"
									style={styles.headerSearchInput}
									value={searchQuery}
									onChangeText={updateSearchQuery}
								/>
								{searchQuery ? (
									<TouchableOpacity
										accessibilityRole="button"
										accessibilityLabel={t("search.clearA11y")}
										hitSlop={8}
										style={styles.headerSearchClear}
										onPress={clearSearch}
									>
										<Icon
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
									onPress={() => router.push("/settings/food" as Href)}
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
							onPress={() => router.push("/food/custom" as Href)}
						/>
						<ListRow
							title={t("overview.goals")}
							detail={t("overview.goalsDetail")}
							onPress={() => router.push("/food/goals" as Href)}
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
											food: entry.label,
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
									onPress={() => setCustomEditor("new")}
								/>
							}
						/>
						{snapshot.customFoods.length === 0 ? (
							<AppText color="muted">{t("custom.empty")}</AppText>
						) : (
							snapshot.customFoods.map((custom) => (
								<Card key={custom.consumable.id} style={styles.componentRow}>
									<View style={styles.grow}>
										<AppText variant="label">{custom.consumable.label}</AppText>
										<AppText variant="caption" color="muted">
											{custom.consumable.isRecipe
												? t("custom.components", {
														count: custom.components.length,
													})
												: custom.consumable.servings[0]?.label}
										</AppText>
									</View>
									<Button
										label={t("custom.edit")}
										variant="text"
										onPress={() => setCustomEditor(custom)}
									/>
									<Button
										label={t("custom.delete")}
										variant="text"
										tone="danger"
										disabled={busy}
										onPress={() =>
											void mutate(() => food.deleteCustom(custom.consumable.id))
										}
									/>
								</Card>
							))
						)}
						{customEditor ? (
							<CustomFoodEditor
								key={
									customEditor === "new" ? "new" : customEditor.consumable.id
								}
								initial={customEditor === "new" ? null : customEditor}
								busy={busy}
								onCancel={() => setCustomEditor(null)}
								onSave={(draft) =>
									void mutate(() => food.saveCustom(draft)).then((saved) => {
										if (saved) setCustomEditor(null);
									})
								}
							/>
						) : null}
					</View>
				) : null}

				{view === "log" && !showingSearchResults && mode === null ? (
					<>
						<View style={styles.section}>
							<SectionHeader title={t("search.customTitle")} />
							{snapshot.customFoods.length === 0 ? (
								<AppText color="muted">{t("search.customEmpty")}</AppText>
							) : (
								snapshot.customFoods.map(({ consumable }) => (
									<TouchableOpacity
										key={consumable.id}
										accessibilityRole="button"
										accessibilityLabel={t("search.logCustomA11y", {
											name: consumable.label,
										})}
										onPress={() => {
											selectCustom(consumable.id);
											setMode("custom");
										}}
									>
										<Card style={styles.searchResult}>
											<View style={styles.grow}>
												<AppText variant="label">{consumable.label}</AppText>
												<AppText variant="caption" color="muted">
													{consumable.brand ??
														consumable.servings[0]?.label ??
														t("defaultServing")}
												</AppText>
											</View>
											<Icon
												name="add"
												color={theme.colors.textMuted}
												size={28}
											/>
										</Card>
									</TouchableOpacity>
								))
							)}
							<TouchableOpacity
								accessibilityRole="button"
								accessibilityLabel={t("search.customLogA11y")}
								style={styles.customLogButton}
								onPress={() => setMode("free")}
							>
								<Icon name="add" color={theme.colors.brand} size={24} />
								<AppText variant="label" color="brand">
									{t("search.customLog")}
								</AppText>
							</TouchableOpacity>
						</View>

						<View style={styles.section}>
							<SectionHeader title={t("search.recentTitle")} />
							{snapshot.recents.length === 0 ? (
								<AppText color="muted">{t("quickAdd.empty")}</AppText>
							) : (
								snapshot.recents.map(({ entry, detail, contributions }) => (
									<TouchableOpacity
										key={entry.id}
										accessibilityRole="button"
										accessibilityLabel={t("search.logRecentA11y", {
											name: entry.label,
										})}
										disabled={busy}
										onPress={() => void repeatRecent(entry.id, entry.label)}
									>
										<Card style={styles.searchResult}>
											<View style={styles.grow}>
												<AppText variant="label">{entry.label}</AppText>
												<AppText variant="caption" color="muted">
													{detail}
												</AppText>
												{contributions ? (
													<AppText variant="micro" color="subtle">
														{contributions}
													</AppText>
												) : null}
											</View>
											<Icon
												name="add"
												color={theme.colors.textMuted}
												size={28}
											/>
										</Card>
									</TouchableOpacity>
								))
							)}
						</View>
					</>
				) : null}

				{showingSearchResults ? (
					<View style={styles.section}>
						<SectionHeader
							title={t("search.resultsTitle")}
							eyebrow={
								searchSnapshot?.fromCache && searchSnapshot.results.length > 0
									? t("search.cachedEyebrow")
									: undefined
							}
						/>
						{searchBusy ? <LoadingIndicator /> : null}
						{searchSnapshot?.message ? (
							<AppText color={searchSnapshot.offline ? "muted" : "subtle"}>
								{searchSnapshot.message}
							</AppText>
						) : null}
						{searchSnapshot?.results.map((result) => (
							<Card key={result.ref} style={styles.searchResult}>
								<View style={styles.grow}>
									<AppText variant="label">{result.label}</AppText>
									{result.brand ? (
										<AppText variant="caption" color="muted">
											{result.brand}
										</AppText>
									) : null}
									<AppText variant="micro" color="subtle">
										{t("search.provenance", {
											source: result.source,
											licence: result.licence,
										})}
									</AppText>
								</View>
								<Button
									label={t("search.choose")}
									variant="secondary"
									accessibilityLabel={t("search.chooseA11y", {
										name: result.label,
									})}
									onPress={() => selectSearchResult(result)}
								/>
							</Card>
						))}
						<TouchableOpacity
							accessibilityRole="button"
							onPress={() => router.push("/settings/data/licences" as Href)}
						>
							<AppText variant="caption" color="brand">
								{t("search.licenceNotice")}
							</AppText>
						</TouchableOpacity>
					</View>
				) : null}

				{view === "log" && mode ? (
					<Card style={styles.section}>
						<SectionHeader title={t("add.title")} />
						{mode === "custom" ? (
							<View style={styles.section}>
								<AppText variant="label">{t("add.customLabel")}</AppText>
								<View style={styles.wrap}>
									{snapshot.customFoods.map(({ consumable }) => (
										<Button
											key={consumable.id}
											label={consumable.label}
											variant={
												customId === consumable.id ? "primary" : "secondary"
											}
											onPress={() => selectCustom(consumable.id)}
										/>
									))}
								</View>
								{selectedCustom ? (
									<>
										<AppText variant="label">{t("add.servingLabel")}</AppText>
										<View style={styles.wrap}>
											{selectedCustom.servings.map((serving) => (
												<Button
													key={serving.id}
													label={serving.label}
													variant={
														servingId === serving.id ? "primary" : "secondary"
													}
													onPress={() => setServingId(serving.id)}
												/>
											))}
										</View>
									</>
								) : null}
							</View>
						) : null}
						{mode === "free" ? (
							<View style={styles.section}>
								<FormField
									label={t("add.nameField")}
									value={label}
									onChangeText={setLabel}
								/>
								<FormField
									label={t("add.servingNameField")}
									value={servingLabel}
									onChangeText={setServingLabel}
									placeholder={t("add.servingNamePlaceholder")}
								/>
								<View style={styles.actions}>
									<FormField
										label={t("add.energyField")}
										value={energy}
										onChangeText={setEnergy}
										keyboardType="decimal-pad"
										containerStyle={styles.grow}
									/>
									<FormField
										label={t("add.proteinField")}
										value={protein}
										onChangeText={setProtein}
										keyboardType="decimal-pad"
										containerStyle={styles.grow}
									/>
								</View>
								<View style={styles.actions}>
									<FormField
										label={t("add.carbsField")}
										value={carbs}
										onChangeText={setCarbs}
										keyboardType="decimal-pad"
										containerStyle={styles.grow}
									/>
									<FormField
										label={t("add.fatField")}
										value={fat}
										onChangeText={setFat}
										keyboardType="decimal-pad"
										containerStyle={styles.grow}
									/>
								</View>
							</View>
						) : null}
						{mode ? (
							<>
								<FormField
									label={t("add.quantityField")}
									value={quantity}
									onChangeText={setQuantity}
									keyboardType="decimal-pad"
								/>
								<View style={styles.actions}>
									<DateField
										label={t("add.dateField")}
										value={localDay}
										onChangeDate={setLocalDay}
										containerStyle={styles.grow}
									/>
									<TimeField
										label={t("add.timeField")}
										value={time}
										onChangeTime={setTime}
										containerStyle={styles.grow}
									/>
								</View>
								<Button
									label={t("add.yesterday")}
									variant="text"
									onPress={() => {
										setLocalDay(previousLocalDay(snapshot.localDay));
										setTime("20:00");
									}}
								/>
								<View style={styles.actions}>
									<Button
										label={t("add.cancel")}
										variant="text"
										disabled={busy}
										style={styles.grow}
										onPress={resetAdd}
									/>
									<Button
										label={t("add.save")}
										loading={busy}
										disabled={
											mode === "custom"
												? !customId || !servingId
												: !label.trim()
										}
										style={styles.grow}
										onPress={() => void saveEntry()}
									/>
								</View>
							</>
						) : null}
					</Card>
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
										router.push(`/food/${snapshot.localDay}` as Href)
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
									onPress={() => router.push(`/food/${day}` as Href)}
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
															food.achieveGoal(activeGoal.goal.id),
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
															food.abandonGoal(activeGoal.goal.id),
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
											<DateField
												label={t("goals.targetDateField")}
												value={goalDate}
												onChangeDate={setGoalDate}
												allowClear
											/>
											<Button
												label={t("goals.save")}
												loading={busy}
												onPress={() =>
													void mutate(() =>
														food.createGoal(
															metric.metric.slug,
															goalTarget,
															goalDate.trim() || null,
														),
													).then((saved) => {
														if (saved) {
															setGoalSlug(null);
															setGoalTarget("");
															setGoalDate("");
														}
													})
												}
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
						? t("quickAdd.added", { food: recentConfirmation.name })
						: null
				}
				actionLabel={t("common:actions.viewLog")}
				onDismiss={dismissRecentConfirmation}
				onAction={() => router.push(`/food/${snapshot.localDay}` as Href)}
			/>
			{selectedSearchResult ? (
				<ModalSheet
					visible
					onClose={closeSearchResult}
					closeAccessibilityLabel={t("search.dismissA11y")}
				>
					<SearchedFoodLogForm
						result={selectedSearchResult}
						servingId={searchServingId}
						onServingChange={setSearchServingId}
						quantity={quantity}
						onQuantityChange={setQuantity}
						localDay={localDay}
						onLocalDayChange={setLocalDay}
						time={time}
						onTimeChange={setTime}
						busy={busy}
						onCancel={closeSearchResult}
						onSave={() => void saveSearchResult()}
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
	componentRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
	searchResult: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
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
	customLogButton: {
		minHeight: theme.control.buttonMinHeight,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.lg,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface,
	},
	grow: { flex: 1 },
	entry: { gap: theme.spacing.xs },
}));
