import type { CreateCustomConsumableComponent } from "@bro/database-app";
import type { FoodSearchResult } from "@bro/domain/food-search";
import { type Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	createFoodSearchStore,
	type FoodSearchSnapshot,
	type FoodSearchStore,
} from "../../food/food-search-store";
import {
	type CustomFood,
	createFoodStore,
	type FoodDaySnapshot,
	type FoodStore,
	previousFoodLocalDay,
} from "../../food/food-store";
import { StyleSheet } from "../../theme/unistyles";

type FoodScreenProps = {
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

function optionalNumber(value: string): number | null {
	return value.trim() ? Number(value) : null;
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
	const serving = initial?.consumable.servings[0];
	const [label, setLabel] = useState(initial?.consumable.label ?? "");
	const [brand, setBrand] = useState(initial?.consumable.brand ?? "");
	const [isRecipe, setIsRecipe] = useState(
		initial?.consumable.isRecipe ?? false,
	);
	const [servingLabel, setServingLabel] = useState(serving?.label ?? "serving");
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
			<SectionHeader title={initial ? "Edit custom food" : "New custom food"} />
			<View style={styles.wrap}>
				<Button
					label="Custom food"
					variant={!isRecipe ? "primary" : "secondary"}
					onPress={() => setIsRecipe(false)}
				/>
				<Button
					label="Recipe"
					variant={isRecipe ? "primary" : "secondary"}
					onPress={() => setIsRecipe(true)}
				/>
			</View>
			<FormField label="Name" value={label} onChangeText={setLabel} />
			<FormField
				label="Brand (optional)"
				value={brand}
				onChangeText={setBrand}
			/>
			<FormField
				label="Serving"
				value={servingLabel}
				onChangeText={setServingLabel}
			/>
			{isRecipe ? (
				<View style={styles.section}>
					<AppText variant="label">Recipe components</AppText>
					{components.map((component, index) => (
						<View
							key={`${component.position}:${component.label}`}
							style={styles.componentRow}
						>
							<AppText style={styles.grow}>
								{component.quantity} × {component.label}
							</AppText>
							<Button
								label="Remove"
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
						label="Component name"
						value={componentLabel}
						onChangeText={setComponentLabel}
					/>
					<FormField
						label="Component quantity"
						value={componentQuantity}
						onChangeText={setComponentQuantity}
						keyboardType="decimal-pad"
					/>
					<View style={styles.actions}>
						<FormField
							label="Component kcal"
							value={componentEnergy}
							onChangeText={setComponentEnergy}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label="Protein (g)"
							value={componentProtein}
							onChangeText={setComponentProtein}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<View style={styles.actions}>
						<FormField
							label="Carbs (g)"
							value={componentCarbs}
							onChangeText={setComponentCarbs}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label="Fat (g)"
							value={componentFat}
							onChangeText={setComponentFat}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<Button
						label="Add component"
						variant="secondary"
						disabled={!componentLabel.trim()}
						onPress={addComponent}
					/>
				</View>
			) : (
				<>
					<View style={styles.actions}>
						<FormField
							label="Energy (kcal)"
							value={energy}
							onChangeText={setEnergy}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label="Protein (g)"
							value={protein}
							onChangeText={setProtein}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					<View style={styles.actions}>
						<FormField
							label="Carbs (g)"
							value={carbs}
							onChangeText={setCarbs}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label="Fat (g)"
							value={fat}
							onChangeText={setFat}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
				</>
			)}
			<View style={styles.actions}>
				<Button
					label="Cancel"
					variant="text"
					disabled={busy}
					style={styles.grow}
					onPress={onCancel}
				/>
				<Button
					label="Save custom food"
					loading={busy}
					disabled={!label.trim() || (isRecipe && components.length === 0)}
					style={styles.grow}
					onPress={save}
				/>
			</View>
		</Card>
	);
}

export function FoodScreen({ store, searchStore }: FoodScreenProps) {
	const food = useMemo(() => store ?? createFoodStore(), [store]);
	const foodSearch = useMemo(
		() => searchStore ?? createFoodSearchStore(),
		[searchStore],
	);
	const [snapshot, setSnapshot] = useState<FoodDaySnapshot | null>(null);
	const [searchSnapshot, setSearchSnapshot] =
		useState<FoodSearchSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [searchBusy, setSearchBusy] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSearchRef, setSelectedSearchRef] = useState("");
	const [searchServingId, setSearchServingId] = useState("");
	const [mode, setMode] = useState<AddMode>(null);
	const [customId, setCustomId] = useState("");
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

	const load = useCallback(async () => {
		setError(null);
		try {
			const [next, cached] = await Promise.all([
				food.loadToday(),
				foodSearch.loadCached(),
			]);
			setSnapshot(next);
			setSearchSnapshot((current) => current ?? cached);
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [food, foodSearch]);

	useFocusEffect(useCallback(() => void load(), [load]));

	async function mutate(work: () => Promise<unknown>): Promise<boolean> {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			await work();
			setSnapshot(await food.loadToday());
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	function selectCustom(nextId: string) {
		const selected = snapshot?.customFoods.find(
			({ consumable }) => consumable.id === nextId,
		)?.consumable;
		setCustomId(nextId);
		setServingId(selected?.servings[0]?.id ?? "");
	}

	function resetAdd() {
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
	}

	async function runSearch() {
		if (searchBusy) return;
		setSearchBusy(true);
		setError(null);
		try {
			setSearchSnapshot(await foodSearch.search(searchQuery));
			setSelectedSearchRef("");
			setSearchServingId("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSearchBusy(false);
		}
	}

	function selectSearchResult(result: FoodSearchResult) {
		setSelectedSearchRef(result.ref);
		setSearchServingId(result.servings[0]?.id ?? "");
		setMode(null);
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
		if (savedDay !== snapshot?.localDay)
			router.push(`/food/${savedDay}` as Href);
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
		if (savedDay !== snapshot?.localDay)
			router.push(`/food/${savedDay}` as Href);
	}

	if (!snapshot && !error)
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Food could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const selectedCustom = snapshot.customFoods.find(
		({ consumable }) => consumable.id === customId,
	)?.consumable;
	const trackedMetrics = snapshot.metrics.filter((metric) => metric.tracked);
	const selectedSearchResult = searchSnapshot?.results.find(
		(result) => result.ref === selectedSearchRef,
	);

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader
					title="Today"
					eyebrow={snapshot.localDay}
					action={
						<TouchableOpacity
							accessibilityRole="button"
							onPress={() => router.push("/settings/food" as Href)}
						>
							<AppText variant="label" color="brand">
								Food settings
							</AppText>
						</TouchableOpacity>
					}
				/>
				<View style={styles.totals}>
					{snapshot.metrics.map((metric) => (
						<View key={metric.metric.slug} style={styles.total}>
							<AppText variant="micro" color="subtle">
								{metric.metric.label.toUpperCase()}
							</AppText>
							<AppText variant="section">{metric.dayFormatted ?? "—"}</AppText>
							<AppText variant="micro" color="muted">
								7 days {metric.weekFormatted ?? "—"}
							</AppText>
						</View>
					))}
				</View>
				<AppText variant="caption" color="subtle">
					Totals are stated without targets, allowances, or ratings.
				</AppText>
			</Card>
			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title="Quick add" eyebrow="RECENT FOODS" />
				{snapshot.recents.length === 0 ? (
					<AppText color="muted">
						Your usual foods will appear here after the first log.
					</AppText>
				) : (
					<View style={styles.wrap}>
						{snapshot.recents.map(({ entry }) => (
							<Button
								key={entry.id}
								label={`${entry.label} · ${entry.servingLabel ?? "serving"}`}
								variant="secondary"
								disabled={busy}
								onPress={() => void mutate(() => food.repeatEntry(entry.id))}
							/>
						))}
					</View>
				)}
			</View>

			<View style={styles.section}>
				<SectionHeader
					title="Custom foods and recipes"
					action={
						<Button
							label="Create"
							variant="text"
							onPress={() => setCustomEditor("new")}
						/>
					}
				/>
				{snapshot.customFoods.length === 0 ? (
					<AppText color="muted">
						Save foods and recipes you use often. They stay available offline.
					</AppText>
				) : (
					snapshot.customFoods.map((custom) => (
						<Card key={custom.consumable.id} style={styles.componentRow}>
							<View style={styles.grow}>
								<AppText variant="label">{custom.consumable.label}</AppText>
								<AppText variant="caption" color="muted">
									{custom.consumable.isRecipe
										? `${custom.components.length} recipe components`
										: custom.consumable.servings[0]?.label}
								</AppText>
							</View>
							<Button
								label="Edit"
								variant="text"
								onPress={() => setCustomEditor(custom)}
							/>
							<Button
								label="Delete"
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
						key={customEditor === "new" ? "new" : customEditor.consumable.id}
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

			<Card style={styles.section}>
				<SectionHeader
					title="Search foods"
					eyebrow={
						searchSnapshot?.fromCache && searchSnapshot.results.length > 0
							? "SAVED FOR OFFLINE"
							: undefined
					}
				/>
				<FormField
					label="Food search"
					value={searchQuery}
					onChangeText={setSearchQuery}
					placeholder="Chicken thighs"
					onSubmitEditing={() => void runSearch()}
				/>
				<Button
					label="Search"
					loading={searchBusy}
					disabled={searchQuery.trim().length < 2}
					onPress={() => void runSearch()}
				/>
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
								{result.source} · {result.licence}
							</AppText>
						</View>
						<Button
							label="Choose"
							variant="secondary"
							accessibilityLabel={`Choose ${result.label}`}
							onPress={() => selectSearchResult(result)}
						/>
					</Card>
				))}
				{selectedSearchResult ? (
					<View style={styles.section}>
						<AppText variant="label">Serving</AppText>
						<View style={styles.wrap}>
							{selectedSearchResult.servings.map((serving) => (
								<Button
									key={serving.id}
									label={serving.label}
									variant={
										searchServingId === serving.id ? "primary" : "secondary"
									}
									onPress={() => setSearchServingId(serving.id)}
								/>
							))}
						</View>
						<FormField
							label="Number of servings"
							value={quantity}
							onChangeText={setQuantity}
							keyboardType="decimal-pad"
						/>
						<View style={styles.actions}>
							<FormField
								label="Date"
								value={localDay}
								onChangeText={setLocalDay}
								placeholder="YYYY-MM-DD"
								containerStyle={styles.grow}
							/>
							<FormField
								label="Time"
								value={time}
								onChangeText={setTime}
								placeholder="HH:mm"
								containerStyle={styles.grow}
							/>
						</View>
						<View style={styles.actions}>
							<Button
								label="Cancel"
								variant="text"
								style={styles.grow}
								onPress={() => setSelectedSearchRef("")}
							/>
							<Button
								label="Save searched food"
								loading={busy}
								disabled={!searchServingId}
								style={styles.grow}
								onPress={() => void saveSearchResult()}
							/>
						</View>
					</View>
				) : null}
				<TouchableOpacity
					accessibilityRole="button"
					onPress={() => router.push("/settings/licences" as Href)}
				>
					<AppText variant="caption" color="brand">
						Food data from Open Food Facts under ODbL 1.0 · Licence details
					</AppText>
				</TouchableOpacity>
			</Card>

			<Card style={styles.section}>
				<SectionHeader title="Log food" />
				{mode === null ? (
					<View style={styles.actions}>
						<Button
							label="Choose custom food"
							style={styles.grow}
							disabled={snapshot.customFoods.length === 0}
							onPress={() => setMode("custom")}
						/>
						<Button
							label="Something else"
							variant="secondary"
							style={styles.grow}
							onPress={() => setMode("free")}
						/>
					</View>
				) : null}
				{mode === "custom" ? (
					<View style={styles.section}>
						<AppText variant="label">Food or recipe</AppText>
						<View style={styles.wrap}>
							{snapshot.customFoods.map(({ consumable }) => (
								<Button
									key={consumable.id}
									label={consumable.label}
									variant={customId === consumable.id ? "primary" : "secondary"}
									onPress={() => selectCustom(consumable.id)}
								/>
							))}
						</View>
						{selectedCustom ? (
							<>
								<AppText variant="label">Serving</AppText>
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
							label="Food name"
							value={label}
							onChangeText={setLabel}
						/>
						<FormField
							label="Serving label (optional)"
							value={servingLabel}
							onChangeText={setServingLabel}
							placeholder="portion, bowl, slice"
						/>
						<View style={styles.actions}>
							<FormField
								label="Energy per serving (kcal)"
								value={energy}
								onChangeText={setEnergy}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label="Protein per serving (g)"
								value={protein}
								onChangeText={setProtein}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
						</View>
						<View style={styles.actions}>
							<FormField
								label="Carbs per serving (g)"
								value={carbs}
								onChangeText={setCarbs}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label="Fat per serving (g)"
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
							label="Number of servings"
							value={quantity}
							onChangeText={setQuantity}
							keyboardType="decimal-pad"
						/>
						<View style={styles.actions}>
							<FormField
								label="Date"
								value={localDay}
								onChangeText={setLocalDay}
								placeholder="YYYY-MM-DD"
								containerStyle={styles.grow}
							/>
							<FormField
								label="Time"
								value={time}
								onChangeText={setTime}
								placeholder="HH:mm"
								containerStyle={styles.grow}
							/>
						</View>
						<Button
							label="Yesterday"
							variant="text"
							onPress={() => {
								setLocalDay(previousFoodLocalDay(snapshot.localDay));
								setTime("20:00");
							}}
						/>
						<View style={styles.actions}>
							<Button
								label="Cancel"
								variant="text"
								disabled={busy}
								style={styles.grow}
								onPress={resetAdd}
							/>
							<Button
								label="Save food"
								loading={busy}
								disabled={
									mode === "custom" ? !customId || !servingId : !label.trim()
								}
								style={styles.grow}
								onPress={() => void saveEntry()}
							/>
						</View>
					</>
				) : null}
			</Card>

			<View style={styles.section}>
				<SectionHeader title="Today's entries" />
				{snapshot.entries.length === 0 ? (
					<EmptyState
						title="Nothing logged"
						body="Log only when it is useful. An empty day stays empty."
					/>
				) : (
					snapshot.entries.map(({ entry, detail, contributions }) => (
						<TouchableOpacity
							key={entry.id}
							accessibilityRole="button"
							accessibilityLabel={`Edit ${entry.label}`}
							onPress={() => router.push(`/food/${snapshot.localDay}` as Href)}
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
			{snapshot.recentLocalDays.length > 0 ? (
				<View style={styles.section}>
					<SectionHeader title="Recent days" />
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

			<View style={styles.section}>
				<SectionHeader title="Daily goals" />
				{trackedMetrics.length === 0 ? (
					<AppText color="muted">
						Turn on food metrics in settings to add them to Trends and set daily
						goals.
					</AppText>
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
										Target {activeGoal.targetFormatted} · Latest{" "}
										{activeGoal.currentFormatted ?? "—"}
									</AppText>
									{activeGoal.progressPercent !== null ? (
										<AppText variant="caption" color="brand">
											{activeGoal.progressPercent}% of the way
										</AppText>
									) : null}
									<View style={styles.actions}>
										<Button
											label="Mark achieved"
											variant="secondary"
											disabled={busy}
											style={styles.grow}
											onPress={() =>
												void mutate(() => food.achieveGoal(activeGoal.goal.id))
											}
										/>
										<Button
											label="Stop goal"
											variant="text"
											disabled={busy}
											style={styles.grow}
											onPress={() =>
												void mutate(() => food.abandonGoal(activeGoal.goal.id))
											}
										/>
									</View>
								</>
							) : goalSlug === metric.metric.slug ? (
								<>
									<FormField
										label={`Target (${metric.displayUnit})`}
										value={goalTarget}
										onChangeText={setGoalTarget}
										keyboardType="decimal-pad"
									/>
									<FormField
										label="Target date (optional)"
										value={goalDate}
										onChangeText={setGoalDate}
										placeholder="YYYY-MM-DD"
									/>
									<Button
										label="Save goal"
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
									label={`Set goal for ${metric.metric.label}`}
									variant="secondary"
									onPress={() => setGoalSlug(metric.metric.slug)}
								/>
							) : (
								<AppText color="muted">
									Log a value before setting a goal.
								</AppText>
							)}
						</Card>
					);
				})}
			</View>
		</Screen>
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
	grow: { flex: 1 },
	entry: { gap: theme.spacing.xs },
}));
