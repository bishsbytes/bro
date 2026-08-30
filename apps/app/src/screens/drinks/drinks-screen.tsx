import { previousLocalDay } from "@bro/domain";
import { ethanolKgFromVolumeAndAbv } from "@bro/domain/drink-catalogue";
import { type Href, router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { LoadingScreen, StackScreen as Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import { createDrinksStore, type DrinksStore } from "../../drinks/drinks-store";
import { upperCaseForLanguage } from "../../i18n";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet } from "../../theme/unistyles";

type DrinksScreenProps = {
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

function optionalNumber(value: string): number | null {
	return value.trim() ? Number(value) : null;
}

export function DrinksScreen({ store }: DrinksScreenProps) {
	const { t } = useTranslation(["drinks", "common"]);
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [busy, setBusy] = useState(false);
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

	function selectCatalogue(nextCatalogueId: string) {
		const drink = snapshot?.catalogue.find(
			(candidate) => candidate.id === nextCatalogueId,
		);
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
		setCustomId(nextCustomId);
		setServingId(drink?.servings[0]?.id ?? "");
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
		if (savedDay !== snapshot?.localDay)
			router.push(`/drinks/${savedDay}` as Href);
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

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
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

			{error ? <AppText color="danger">{error}</AppText> : null}

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
								onPress={() => void mutate(() => drinks.repeatEntry(entry.id))}
							/>
						))}
					</View>
				)}
			</View>

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
								onPress={() => void mutate(() => drinks.deleteCustom(drink.id))}
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
						<FormField
							label={t("custom.servingField")}
							value={servingLabel}
							onChangeText={setServingLabel}
						/>
						<View style={styles.actions}>
							<FormField
								label={t("custom.volumeField")}
								value={volumeMl}
								onChangeText={setVolumeMl}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label={t("custom.abvField")}
								value={abv}
								onChangeText={setAbv}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
						</View>
						<View style={styles.actions}>
							<FormField
								label={t("custom.caffeineField")}
								value={caffeineMg}
								onChangeText={setCaffeineMg}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label={t("custom.energyField")}
								value={energyKcal}
								onChangeText={setEnergyKcal}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
						</View>
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
								disabled={!label.trim()}
								style={styles.grow}
								onPress={() => void saveCustomDrink()}
							/>
						</View>
					</Card>
				) : null}
			</View>

			<Card style={styles.section}>
				<SectionHeader title={t("add.title")} />
				{mode === null ? (
					<View style={styles.actions}>
						<Button
							label={t("add.chooseCatalogue")}
							style={styles.grow}
							onPress={() => setMode("catalogue")}
						/>
						<Button
							label={t("add.chooseCustom")}
							variant="secondary"
							style={styles.grow}
							disabled={snapshot.customDrinks.length === 0}
							onPress={() => setMode("custom")}
						/>
						<Button
							label={t("add.chooseFree")}
							variant="secondary"
							style={styles.grow}
							onPress={() => setMode("free")}
						/>
					</View>
				) : null}

				{mode === "catalogue" ? (
					<View style={styles.section}>
						<AppText variant="label">{t("add.drinkLabel")}</AppText>
						<View style={styles.wrap}>
							{snapshot.catalogue.map((drink) => (
								<Button
									key={drink.id}
									label={drink.label}
									variant={catalogueId === drink.id ? "primary" : "secondary"}
									onPress={() => selectCatalogue(drink.id)}
								/>
							))}
						</View>
						{selectedDrink ? (
							<>
								<AppText variant="label">{t("add.servingLabel")}</AppText>
								<View style={styles.wrap}>
									{selectedDrink.servings.map((serving) => (
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

				{mode === "custom" ? (
					<View style={styles.section}>
						<AppText variant="label">{t("add.customLabel")}</AppText>
						<View style={styles.wrap}>
							{snapshot.customDrinks.map((drink) => (
								<Button
									key={drink.id}
									label={drink.label}
									variant={customId === drink.id ? "primary" : "secondary"}
									onPress={() => selectCustom(drink.id)}
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
								label={t("add.volumeField")}
								value={volumeMl}
								onChangeText={setVolumeMl}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label={t("add.abvField")}
								value={abv}
								onChangeText={setAbv}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
						</View>
						<View style={styles.actions}>
							<FormField
								label={t("add.caffeineField")}
								value={caffeineMg}
								onChangeText={setCaffeineMg}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label={t("add.energyField")}
								value={energyKcal}
								onChangeText={setEnergyKcal}
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
							<FormField
								label={t("add.dateField")}
								value={localDay}
								onChangeText={setLocalDay}
								placeholder={t("add.datePlaceholder")}
								containerStyle={styles.grow}
							/>
							<FormField
								label={t("add.timeField")}
								value={time}
								onChangeText={setTime}
								placeholder={t("add.timePlaceholder")}
								containerStyle={styles.grow}
							/>
						</View>
						<Button
							label={t("add.lastNight")}
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
								onPress={resetAddForm}
							/>
							<Button
								label={t("add.save")}
								loading={busy}
								disabled={
									(mode === "catalogue" && (!catalogueId || !servingId)) ||
									(mode === "custom" && (!customId || !servingId))
								}
								style={styles.grow}
								onPress={() =>
									void (mode === "catalogue"
										? saveCatalogue()
										: mode === "custom"
											? saveCustomEntry()
											: saveFree())
								}
							/>
						</View>
					</>
				) : null}
			</Card>

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

			{snapshot.recentLocalDays.length > 0 ? (
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
		</Screen>
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
}));
