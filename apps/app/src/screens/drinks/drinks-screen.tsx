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
	createDrinksStore,
	type DrinkDaySnapshot,
	type DrinksStore,
	previousLocalDay,
} from "../../drinks/drinks-store";
import { StyleSheet } from "../../theme/unistyles";

type DrinksScreenProps = {
	store?: Pick<
		DrinksStore,
		| "loadToday"
		| "logCatalogue"
		| "logFree"
		| "repeatEntry"
		| "createGoal"
		| "achieveGoal"
		| "abandonGoal"
	>;
};

type AddMode = "catalogue" | "free" | null;

function optionalNumber(value: string): number | null {
	return value.trim() ? Number(value) : null;
}

export function DrinksScreen({ store }: DrinksScreenProps) {
	const drinks = useMemo(() => store ?? createDrinksStore(), [store]);
	const [snapshot, setSnapshot] = useState<DrinkDaySnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [mode, setMode] = useState<AddMode>(null);
	const [catalogueId, setCatalogueId] = useState("");
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
	const [goalSlug, setGoalSlug] = useState<string | null>(null);
	const [goalTarget, setGoalTarget] = useState("");
	const [goalDate, setGoalDate] = useState("");

	const load = useCallback(async () => {
		setError(null);
		try {
			const next = await drinks.loadToday();
			setSnapshot(next);
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [drinks]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load]),
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
			setError(caught instanceof Error ? caught.message : String(caught));
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
		setServingId("");
		setQuantity("1");
		setLabel("");
		setServingLabel("");
		setVolumeMl("");
		setAbv("");
		setCaffeineMg("");
		setEnergyKcal("");
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

	async function saveGoal() {
		if (!goalSlug) return;
		await mutate(async () => {
			await drinks.createGoal(
				goalSlug,
				goalTarget,
				goalDate.trim() || null,
			);
			setGoalSlug(null);
			setGoalTarget("");
			setGoalDate("");
		});
	}

	if (!snapshot && !error) {
		return (
			<Screen centered>
				<ActivityIndicator size="large" />
			</Screen>
		);
	}

	if (!snapshot) {
		return (
			<Screen centered padded>
				<EmptyState
					title="Drinks could not be loaded"
					body={error ?? "Try again."}
					actionLabel="Try again"
					onAction={() => void load()}
					tone="danger"
				/>
			</Screen>
		);
	}

	const selectedDrink = snapshot.catalogue.find(
		(drink) => drink.id === catalogueId,
	);
	const trackedMetrics = snapshot.metrics.filter((metric) => metric.tracked);

	return (
		<Screen scroll padded gap="lg" keyboardShouldPersistTaps="handled">
			<Card style={styles.section}>
				<SectionHeader
					title="Today"
					eyebrow={snapshot.localDay}
					action={
						<TouchableOpacity
							accessibilityRole="button"
							onPress={() => router.push("/settings/drinks" as Href)}
						>
							<AppText variant="label" color="brand">
								Drink settings
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
					Quantities are totals, not ratings or guideline comparisons.
				</AppText>
			</Card>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<View style={styles.section}>
				<SectionHeader title="Quick add" eyebrow="RECENT DRINKS" />
				{snapshot.recents.length === 0 ? (
					<AppText color="muted">
						Your usual drinks will appear here after the first log.
					</AppText>
				) : (
					<View style={styles.wrap}>
						{snapshot.recents.map(({ entry }) => (
							<Button
								key={entry.id}
								label={`${entry.label} · ${entry.servingLabel ?? "serving"}`}
								variant="secondary"
								disabled={busy}
								onPress={() => void mutate(() => drinks.repeatEntry(entry.id))}
							/>
						))}
					</View>
				)}
			</View>

			<Card style={styles.section}>
				<SectionHeader title="Log a drink" />
				{mode === null ? (
					<View style={styles.actions}>
						<Button
							label="Choose a drink"
							style={styles.grow}
							onPress={() => setMode("catalogue")}
						/>
						<Button
							label="Something else"
							variant="secondary"
							style={styles.grow}
							onPress={() => setMode("free")}
						/>
					</View>
				) : null}

				{mode === "catalogue" ? (
					<View style={styles.section}>
						<AppText variant="label">Drink</AppText>
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
								<AppText variant="label">Serving</AppText>
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

				{mode === "free" ? (
					<View style={styles.section}>
						<FormField label="Drink name" value={label} onChangeText={setLabel} />
						<FormField
							label="Serving label (optional)"
							value={servingLabel}
							onChangeText={setServingLabel}
							placeholder="glass, mug, can"
						/>
						<View style={styles.actions}>
							<FormField
								label="Volume per serving (ml)"
								value={volumeMl}
								onChangeText={setVolumeMl}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label="ABV % (optional)"
								value={abv}
								onChangeText={setAbv}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
						</View>
						<View style={styles.actions}>
							<FormField
								label="Caffeine per serving (mg)"
								value={caffeineMg}
								onChangeText={setCaffeineMg}
								keyboardType="decimal-pad"
								containerStyle={styles.grow}
							/>
							<FormField
								label="Energy per serving (kcal)"
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
							label="Last night"
							variant="text"
							onPress={() => {
								setLocalDay(previousLocalDay(snapshot.localDay));
								setTime("20:00");
							}}
						/>
						<View style={styles.actions}>
							<Button
								label="Cancel"
								variant="text"
								disabled={busy}
								style={styles.grow}
								onPress={resetAddForm}
							/>
							<Button
								label="Save drink"
								loading={busy}
								disabled={mode === "catalogue" && (!catalogueId || !servingId)}
								style={styles.grow}
								onPress={() =>
									void (mode === "catalogue" ? saveCatalogue() : saveFree())
								}
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
					<SectionHeader title="Recent days" />
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
				<SectionHeader title="Daily goals" />
				{trackedMetrics.length === 0 ? (
					<AppText color="muted">
						Turn on drink metrics in settings to add them to Trends and set
						daily goals.
					</AppText>
				) : null}
				{trackedMetrics.map((metric) => {
					const activeGoal = metric.goals.find((goal) => goal.status === "active");
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
												void mutate(() =>
													drinks.achieveGoal(activeGoal.goal.id),
												)
											}
										/>
										<Button
											label="Stop goal"
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
										onPress={() => void saveGoal()}
									/>
								</>
							) : metric.dayValue !== null ? (
								<Button
									label={`Set goal for ${metric.metric.label}`}
									variant="secondary"
									onPress={() => setGoalSlug(metric.metric.slug)}
								/>
							) : (
								<AppText color="muted">Log a value before setting a goal.</AppText>
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
