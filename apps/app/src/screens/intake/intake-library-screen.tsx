import type { Consumable } from "@bro/database-app";
import {
	type ConsumableKind,
	RECIPE_YIELD_UNITS,
	type RecipeYieldUnit,
} from "@bro/domain/consumable";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	compositionFromLabelInputs,
	type LabelInputs,
	labelInputsHaveValue,
	labelInputsValid,
} from "../../intake/free-entry";
import {
	createIntakeSettingsStore,
	type IntakeSettingsStore,
} from "../../intake/intake-settings-store";
import {
	createLibraryStore,
	type LibraryStore,
	type RecipeIngredientDraft,
} from "../../intake/library-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";
import { IntakeRow, RowPanel } from "./intake-rows";

type IntakeLibraryScreenProps = {
	store?: Pick<LibraryStore, "list" | "saveItem" | "saveRecipe" | "delete">;
	settingsStore?: Pick<IntakeSettingsStore, "enabledKinds">;
};

type EditorMode = "item" | "recipe";

type IngredientDraft = RecipeIngredientDraft;

function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}

function NutritionFields({
	inputs,
	onChange,
	kind,
}: {
	inputs: LabelInputs;
	onChange: (inputs: LabelInputs) => void;
	kind: ConsumableKind;
}) {
	const { t } = useTranslation("intake");
	const [more, setMore] = useState(false);
	const set = (patch: LabelInputs) => onChange({ ...inputs, ...patch });
	if (kind === "nicotine") {
		return (
			<FormField
				label={t("free.nicotine")}
				value={inputs.nicotineMg ?? ""}
				onChangeText={(nicotineMg) => set({ nicotineMg })}
				keyboardType="decimal-pad"
			/>
		);
	}
	return (
		<>
			<View style={styles.row}>
				<FormField
					label={t("free.energy")}
					value={inputs.energyKcal ?? ""}
					onChangeText={(energyKcal) => set({ energyKcal })}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<FormField
					label={t("free.protein")}
					value={inputs.proteinG ?? ""}
					onChangeText={(proteinG) => set({ proteinG })}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
			</View>
			<View style={styles.row}>
				<FormField
					label={t("free.carbohydrate")}
					value={inputs.carbohydrateG ?? ""}
					onChangeText={(carbohydrateG) => set({ carbohydrateG })}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
				<FormField
					label={t("free.fat")}
					value={inputs.fatG ?? ""}
					onChangeText={(fatG) => set({ fatG })}
					keyboardType="decimal-pad"
					containerStyle={styles.grow}
				/>
			</View>
			{/* A drink's volume and strength are its first facts, and units are
			    worked out from them rather than typed; anything else waits behind
			    the disclosure so a quick custom food stays quick. */}
			{kind === "drink" || more ? (
				<>
					<View style={styles.row}>
						<FormField
							label={t("free.fluid")}
							value={inputs.fluidMl ?? ""}
							onChangeText={(fluidMl) => set({ fluidMl })}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
						<FormField
							label={t("free.abv")}
							value={inputs.abvPercent ?? ""}
							onChangeText={(abvPercent) => set({ abvPercent })}
							keyboardType="decimal-pad"
							containerStyle={styles.grow}
						/>
					</View>
					{kind === "drink" ? (
						<AppText variant="caption" color="muted">
							{t("library.abvHelp")}
						</AppText>
					) : null}
				</>
			) : null}
			{more ? (
				<FormField
					label={t("free.caffeine")}
					value={inputs.caffeineMg ?? ""}
					onChangeText={(caffeineMg) => set({ caffeineMg })}
					keyboardType="decimal-pad"
				/>
			) : null}
			<Button
				label={more ? t("library.fewerNutrients") : t("library.moreNutrients")}
				variant="text"
				onPress={() => setMore((current) => !current)}
			/>
		</>
	);
}

/**
 * The library, first cut: items you have often (a name, a portion, and the
 * numbers you have) and recipes whose numbers come from their ingredients.
 * The composition editor with a chosen basis, the fork banner, and provider
 * import are the next phases.
 */
export function IntakeLibraryScreen({
	store,
	settingsStore,
}: IntakeLibraryScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const library = useMemo(() => store ?? createLibraryStore(), [store]);
	const settings = useMemo(
		() => settingsStore ?? createIntakeSettingsStore(),
		[settingsStore],
	);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState<{
		mode: EditorMode;
		id: string | null;
	} | null>(null);
	const [kind, setKind] = useState<ConsumableKind>("food");
	const [name, setName] = useState("");
	const [brand, setBrand] = useState("");
	const [portionLabel, setPortionLabel] = useState("");
	const [inputs, setInputs] = useState<LabelInputs>({});
	const [yieldQuantity, setYieldQuantity] = useState("1");
	const [yieldUnit, setYieldUnit] = useState<RecipeYieldUnit>("serving");
	const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
	const [ingredientName, setIngredientName] = useState("");
	const [ingredientQuantity, setIngredientQuantity] = useState("1");
	const [ingredientInputs, setIngredientInputs] = useState<LabelInputs>({});
	const { data, error, loading, reload, setData, setError } = useFocusStoreLoad(
		useCallback(async () => {
			const [items, enabledKinds] = await Promise.all([
				library.list(),
				settings.enabledKinds(),
			]);
			return { items, enabledKinds };
		}, [library, settings]),
	);

	function reset() {
		setEditing(null);
		setName("");
		setBrand("");
		setPortionLabel("");
		setInputs({});
		setYieldQuantity("1");
		setYieldUnit("serving");
		setIngredients([]);
		setIngredientName("");
		setIngredientQuantity("1");
		setIngredientInputs({});
	}

	function startEdit(mode: EditorMode, consumable: Consumable | null) {
		reset();
		setEditing({ mode, id: consumable?.id ?? null });
		if (consumable) {
			setKind(consumable.kind);
			setName(consumable.name);
			setBrand(consumable.brand ?? "");
			setPortionLabel(consumable.portions[0]?.label ?? "");
			if (consumable.recipe) {
				setYieldQuantity(String(consumable.recipe.yield.quantity));
				setYieldUnit(consumable.recipe.yield.unit);
			}
		}
	}

	async function mutate(work: () => Promise<unknown>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await work();
			setData({
				items: await library.list(),
				enabledKinds: data?.enabledKinds ?? ["food", "drink"],
			});
			reset();
		} catch (caught) {
			setError(toMessage(caught));
		} finally {
			setBusy(false);
		}
	}

	function addIngredient() {
		const { constituents, volumeL } =
			compositionFromLabelInputs(ingredientInputs);
		setIngredients((current) => [
			...current,
			{
				name: ingredientName,
				quantity: Number(ingredientQuantity),
				constituents,
				volumeL,
			},
		]);
		setIngredientName("");
		setIngredientQuantity("1");
		setIngredientInputs({});
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!data) {
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

	const itemValid =
		name.trim() !== "" &&
		labelInputsValid(inputs) &&
		labelInputsHaveValue(inputs);
	const ingredientValid =
		ingredientName.trim() !== "" &&
		isPositiveNumber(ingredientQuantity) &&
		labelInputsValid(ingredientInputs) &&
		labelInputsHaveValue(ingredientInputs);
	const recipeValid =
		name.trim() !== "" &&
		isPositiveNumber(yieldQuantity) &&
		ingredients.length > 0;

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			{error ? <AppText color="danger">{error}</AppText> : null}

			{editing ? (
				<Card style={styles.section}>
					<SectionHeader
						title={
							editing.id
								? t("intake:library.editorTitle")
								: t("intake:library.newTitle")
						}
					/>
					{editing.id === null ? (
						<View style={styles.wrap}>
							<Button
								label={t("intake:library.itemToggle")}
								variant={editing.mode === "item" ? "primary" : "secondary"}
								onPress={() => setEditing({ mode: "item", id: null })}
							/>
							<Button
								label={t("intake:library.recipeToggle")}
								variant={editing.mode === "recipe" ? "primary" : "secondary"}
								onPress={() => setEditing({ mode: "recipe", id: null })}
							/>
						</View>
					) : null}
					<AppText variant="label">{t("intake:library.kind")}</AppText>
					<View style={styles.wrap}>
						{data.enabledKinds.map((candidate) => (
							<Button
								key={candidate}
								label={t(`intake:kinds.${candidate}`)}
								variant={kind === candidate ? "primary" : "secondary"}
								onPress={() => setKind(candidate)}
							/>
						))}
					</View>
					<FormField
						label={t("intake:library.name")}
						value={name}
						onChangeText={setName}
					/>
					<FormField
						label={t("intake:library.brand")}
						value={brand}
						onChangeText={setBrand}
					/>
					{editing.mode === "item" ? (
						<>
							<FormField
								label={t("intake:library.portionLabel")}
								placeholder={t("intake:library.portionPlaceholder")}
								value={portionLabel}
								onChangeText={setPortionLabel}
							/>
							<SectionHeader title={t("intake:library.nutritionTitle")} />
							<AppText variant="caption" color="muted">
								{t("intake:library.quantityHelp")}
							</AppText>
							<NutritionFields
								inputs={inputs}
								onChange={setInputs}
								kind={kind}
							/>
						</>
					) : (
						<>
							<SectionHeader title={t("intake:library.yieldTitle")} />
							<View style={styles.row}>
								<FormField
									label={t("intake:library.yieldQuantity")}
									value={yieldQuantity}
									onChangeText={setYieldQuantity}
									keyboardType="decimal-pad"
									containerStyle={styles.grow}
								/>
							</View>
							<View style={styles.wrap}>
								{RECIPE_YIELD_UNITS.map((unit) => (
									<Button
										key={unit}
										label={t(`intake:library.yieldUnits.${unit}`)}
										variant={yieldUnit === unit ? "primary" : "secondary"}
										onPress={() => setYieldUnit(unit)}
									/>
								))}
							</View>
							<SectionHeader title={t("intake:library.ingredientsTitle")} />
							{ingredients.length === 0 ? (
								<AppText variant="caption" color="muted">
									{t("intake:library.ingredientsEmpty")}
								</AppText>
							) : (
								ingredients.map((ingredient, index) => (
									<View
										key={`${index}:${ingredient.name}`}
										style={styles.ingredientRow}
									>
										<AppText style={styles.grow}>
											{t("intake:library.ingredient", {
												quantity: ingredient.quantity,
												name: ingredient.name,
											})}
										</AppText>
										<Button
											label={t("intake:library.removeIngredient")}
											variant="text"
											tone="danger"
											onPress={() =>
												setIngredients((current) =>
													current.filter((_, candidate) => candidate !== index),
												)
											}
										/>
									</View>
								))
							)}
							<FormField
								label={t("intake:library.ingredientName")}
								value={ingredientName}
								onChangeText={setIngredientName}
							/>
							<FormField
								label={t("intake:library.ingredientQuantity")}
								value={ingredientQuantity}
								onChangeText={setIngredientQuantity}
								keyboardType="decimal-pad"
							/>
							<AppText variant="caption" color="muted">
								{t("intake:library.ingredientNutrition")}
							</AppText>
							<NutritionFields
								inputs={ingredientInputs}
								onChange={setIngredientInputs}
								kind={kind}
							/>
							<Button
								label={t("intake:library.addIngredient")}
								variant="secondary"
								disabled={!ingredientValid}
								onPress={addIngredient}
							/>
						</>
					)}
					<View style={styles.row}>
						<Button
							label={t("intake:library.cancel")}
							variant="text"
							disabled={busy}
							style={styles.grow}
							onPress={reset}
						/>
						<Button
							label={t("intake:library.save")}
							loading={busy}
							disabled={editing.mode === "item" ? !itemValid : !recipeValid}
							style={styles.grow}
							onPress={() =>
								void mutate(() =>
									editing.mode === "item"
										? library.saveItem({
												id: editing.id ?? undefined,
												kind,
												name,
												brand: brand.trim() || null,
												portionLabel,
												constituents:
													compositionFromLabelInputs(inputs).constituents,
											})
										: library.saveRecipe({
												id: editing.id ?? undefined,
												kind,
												name,
												brand: brand.trim() || null,
												yield: {
													quantity: Number(yieldQuantity),
													unit: yieldUnit,
												},
												ingredients,
											}),
								)
							}
						/>
					</View>
					{editing.id ? (
						<Button
							label={t("intake:library.delete")}
							accessibilityLabel={t("intake:library.deleteA11y", { name })}
							variant="text"
							tone="danger"
							disabled={busy}
							onPress={() => {
								const { id } = editing;
								if (id) void mutate(() => library.delete(id));
							}}
						/>
					) : null}
				</Card>
			) : (
				<View style={styles.section}>
					<SectionHeader
						title={t("intake:library.title")}
						action={
							<Button
								label={t("intake:library.create")}
								variant="text"
								onPress={() => startEdit("item", null)}
							/>
						}
					/>
					{data.items.length === 0 ? (
						<AppText color="muted">{t("intake:library.empty")}</AppText>
					) : (
						<RowPanel testID="intake-library">
							{data.items.map((consumable, index) => {
								const sourceNote =
									consumable.source.type !== "user" || consumable.forkedFrom
										? consumable.source.type === "provider"
											? t("intake:library.source.provider", {
													name: consumable.source.provider,
												})
											: consumable.forkedFrom?.type === "system"
												? t("intake:library.source.system")
												: t(`intake:library.source.${consumable.source.type}`)
										: null;
								const meta = [
									consumable.recipe
										? t("intake:library.recipeToggle")
										: (consumable.brand ??
											t(`intake:kinds.${consumable.kind}`)),
									sourceNote,
								]
									.filter(Boolean)
									.join(" · ");
								// A recipe has no editor yet, so its row keeps a delete
								// control; an item opens its editor, where delete lives.
								return consumable.recipe === null ? (
									<IntakeRow
										key={consumable.id}
										title={consumable.name}
										meta={meta}
										chevron
										last={index === data.items.length - 1}
										disabled={busy}
										accessibilityLabel={t("intake:library.editA11y", {
											name: consumable.name,
										})}
										onPress={() => startEdit("item", consumable)}
									/>
								) : (
									<IntakeRow
										key={consumable.id}
										title={consumable.name}
										meta={meta}
										last={index === data.items.length - 1}
										action={
											<Button
												label={t("intake:library.delete")}
												accessibilityLabel={t("intake:library.deleteA11y", {
													name: consumable.name,
												})}
												variant="text"
												tone="danger"
												disabled={busy}
												onPress={() =>
													void mutate(() => library.delete(consumable.id))
												}
											/>
										}
									/>
								);
							})}
						</RowPanel>
					)}
					<AppText variant="micro" color="subtle">
						{t("intake:library.licenceNotice")}
					</AppText>
				</View>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	grow: { flex: 1 },
	ingredientRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
	},
}));
