import type { Consumable } from "@bro/database-app";
import { previousLocalDay } from "@bro/domain";
import {
	type ConsumableComposition,
	type ConsumableKind,
	INTAKE_CONTEXTS,
	type IntakeContext,
} from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import type { PortionSelection } from "@bro/logic";
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
	compositionFromLabelInputs,
	type LabelInputs,
	labelInputsHaveValue,
	labelInputsValid,
} from "../../intake/free-entry";
import {
	createIntakeSearchStore,
	type IntakeSearchSnapshot,
	type IntakeSearchStore,
} from "../../intake/intake-search-store";
import {
	createIntakeStore,
	type IntakeStore,
	type LogSource,
} from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

type IntakeLogScreenProps = {
	initialKind?: ConsumableKind;
	store?: Pick<IntakeStore, "loadLog" | "log" | "logFree" | "repeatEvent">;
	searchStore?: Pick<IntakeSearchStore, "loadCached" | "search">;
};

/** What the portion sheet is open for. */
type Pick_ = {
	source: LogSource;
	kind: ConsumableKind;
	name: string;
	brand: string | null;
	composition: ConsumableComposition;
	provenance: string | null;
};

const SEARCH_DEBOUNCE_MS = 300;

function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}

/** The meal the clock suggests; a chip, never a stored default. */
function suggestedContext(
	kind: ConsumableKind,
	time: string,
): IntakeContext | null {
	if (kind === "drink") return "drink";
	if (kind === "supplement") return "supplement";
	if (kind === "medication") return "medication";
	if (kind !== "food") return null;
	const hour = Number(time.slice(0, 2));
	if (!Number.isFinite(hour)) return null;
	if (hour < 10) return "breakfast";
	if (hour >= 12 && hour < 14) return "lunch";
	if (hour >= 18 && hour < 21) return "dinner";
	return "snack";
}

/**
 * One screen for everything: recents first, then the library, then the
 * catalogue, then search, then "something else". Pick an item, pick a portion,
 * save; the toast confirms and the screen stays for the next item, because a
 * meal is several events. Kind chips are limited to the streams that are on.
 */
export function IntakeLogScreen({
	initialKind,
	store,
	searchStore,
}: IntakeLogScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
	const { width: windowWidth } = useWindowDimensions();
	const headerSearchWidth = Math.max(180, Math.min(520, windowWidth - 96));
	const intake = useMemo(() => store ?? createIntakeStore(), [store]);
	const search = useMemo(
		() => searchStore ?? createIntakeSearchStore(),
		[searchStore],
	);
	const [kind, setKind] = useState<ConsumableKind | null>(initialKind ?? null);
	const [query, setQuery] = useState("");
	const [searchSnapshot, setSearchSnapshot] =
		useState<IntakeSearchSnapshot | null>(null);
	const [searchBusy, setSearchBusy] = useState(false);
	const searchRequestId = useRef(0);
	const [busy, setBusy] = useState(false);
	const [pick, setPick] = useState<Pick_ | null>(null);
	const [portionId, setPortionId] = useState<string | null>(null);
	const [amount, setAmount] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [context, setContext] = useState<IntakeContext | null>(null);
	const [freeOpen, setFreeOpen] = useState(false);
	const [freeName, setFreeName] = useState("");
	const [freePortion, setFreePortion] = useState("");
	const [freeInputs, setFreeInputs] = useState<LabelInputs>({});
	const [confirmation, setConfirmation] = useState<{
		name: string;
		localDay: string;
	} | null>(null);
	const dismissConfirmation = useCallback(() => setConfirmation(null), []);

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
				intake.loadLog(),
				search.loadCached(),
			]);
			// Seed the form once, so a part-typed row survives the refresh after a save.
			setSearchSnapshot((current) => current ?? cached);
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
			return next;
		}, [intake, search]),
	);

	useEffect(() => {
		const trimmed = query.trim();
		if (trimmed.length < 2) {
			return;
		}
		const requestId = ++searchRequestId.current;
		setSearchBusy(true);
		const timeout = setTimeout(() => {
			void search
				.search(trimmed)
				.then((result) => {
					if (searchRequestId.current === requestId) setSearchSnapshot(result);
				})
				.catch((caught) => {
					if (searchRequestId.current === requestId) {
						setError(toMessage(caught));
					}
				})
				.finally(() => {
					if (searchRequestId.current === requestId) setSearchBusy(false);
				});
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [query, search, setError]);

	async function mutate(
		work: () => Promise<{ name: string; localDay: string }>,
	) {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			const logged = await work();
			setSnapshot(await intake.loadLog());
			setConfirmation(logged);
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			setBusy(false);
		}
	}

	function open(next: Pick_) {
		Keyboard.dismiss();
		setPick(next);
		setPortionId(next.composition.defaultPortionId);
		setAmount("");
		setQuantity("1");
		setContext(suggestedContext(next.kind, time));
	}

	function openLibrary(consumable: Consumable) {
		open({
			source: { type: "library", id: consumable.id },
			kind: consumable.kind,
			name: consumable.name,
			brand: consumable.brand,
			composition: consumable,
			provenance: null,
		});
	}

	function openExternal(consumable: ExternalConsumable) {
		open({
			source: { type: "external", consumable },
			kind: consumable.kind,
			name: consumable.name,
			brand: consumable.brand,
			composition: consumable,
			provenance: t("intake:log.provenance", {
				source: consumable.source,
				licence: consumable.licence,
			}),
		});
	}

	async function savePick() {
		if (!pick) return;
		const { basis } = pick.composition;
		const selection: PortionSelection =
			amount.trim() && basis.type === "mass"
				? { type: "mass", massKg: Number(amount) / 1_000 }
				: amount.trim() && basis.type === "volume"
					? { type: "volume", volumeL: Number(amount) / 1_000 }
					: {
							type: "portion",
							portionId: portionId ?? "",
							quantity: Number(quantity),
						};
		const picked = pick;
		const savedDay = localDay;
		const saved = await mutate(async () => {
			await intake.log(picked.source, selection, { localDay, time }, context);
			return { name: picked.name, localDay: savedDay };
		});
		if (saved) setPick(null);
	}

	async function saveFree() {
		const freeKind = kind ?? "food";
		const savedDay = localDay;
		const saved = await mutate(async () => {
			const { constituents, volumeL } = compositionFromLabelInputs(freeInputs);
			await intake.logFree({
				kind: freeKind,
				name: freeName,
				portionLabel: freePortion.trim() || null,
				quantity: Number(quantity),
				volumeL,
				constituents,
				context: suggestedContext(freeKind, time),
				localDay,
				time,
			});
			return { name: freeName, localDay: savedDay };
		});
		if (saved) {
			setFreeOpen(false);
			setFreeName("");
			setFreePortion("");
			setFreeInputs({});
			setQuantity("1");
		}
	}

	if (loading) {
		return <LoadingScreen />;
	}

	if (!snapshot) {
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

	const normalizedQuery = query.trim().toLocaleLowerCase();
	const matches = (...values: (string | null | undefined)[]) =>
		normalizedQuery === "" ||
		values.some((value) =>
			value?.toLocaleLowerCase().includes(normalizedQuery),
		);
	const ofKind = (candidate: ConsumableKind) =>
		kind === null || candidate === kind;
	const recents = snapshot.recents.filter(
		({ event }) => ofKind(event.kind) && matches(event.name, event.brand),
	);
	const library = snapshot.library.filter(
		(consumable) =>
			ofKind(consumable.kind) && matches(consumable.name, consumable.brand),
	);
	const catalogue = snapshot.system.filter(
		(consumable) => ofKind(consumable.kind) && matches(consumable.name),
	);
	const results =
		normalizedQuery.length >= 2
			? (searchSnapshot?.results ?? []).filter((result) => ofKind(result.kind))
			: [];
	const freeKind = kind ?? "food";
	const freeValid =
		freeName.trim() !== "" &&
		isPositiveNumber(quantity) &&
		labelInputsValid(freeInputs) &&
		labelInputsHaveValue(freeInputs);
	const pickBasis = pick?.composition.basis;
	const amountUnit =
		pickBasis?.type === "mass"
			? "g"
			: pickBasis?.type === "volume"
				? "ml"
				: null;
	const pickValid =
		pick !== null &&
		((amount.trim() !== "" && isPositiveNumber(amount)) ||
			(portionId !== null && isPositiveNumber(quantity)));

	return (
		<>
			<Stack.Screen
				options={{
					headerTitleAlign: "left",
					headerTitle: () => (
						<View style={[styles.headerSearch, { width: headerSearchWidth }]}>
							<Icon name="search" color={theme.colors.textMuted} size={24} />
							<TextInput
								accessibilityLabel={t("intake:log.searchA11y")}
								autoCapitalize="none"
								autoCorrect={false}
								placeholder={t("intake:log.searchPlaceholder")}
								placeholderTextColor={theme.colors.textSubtle}
								returnKeyType="search"
								style={styles.headerSearchInput}
								value={query}
								onChangeText={setQuery}
							/>
							{query ? (
								<TouchableOpacity
									accessibilityRole="button"
									accessibilityLabel={t("intake:log.clearA11y")}
									hitSlop={8}
									onPress={() => setQuery("")}
								>
									<Icon name="close" color={theme.colors.textMuted} size={24} />
								</TouchableOpacity>
							) : null}
						</View>
					),
				}}
			/>
			<Screen
				scroll
				padded
				gap="lg"
				keyboardShouldPersistTaps="handled"
				contentInsetAdjustmentBehavior="automatic"
			>
				<View style={styles.wrap}>
					{snapshot.enabledKinds.map((candidate) => (
						<Button
							key={candidate}
							label={t(`intake:kinds.${candidate}`)}
							accessibilityLabel={t("intake:log.kindA11y", {
								name: t(`intake:kinds.${candidate}`),
							})}
							variant={kind === candidate ? "primary" : "secondary"}
							onPress={() =>
								setKind((current) => (current === candidate ? null : candidate))
							}
						/>
					))}
				</View>

				{error ? <AppText color="danger">{error}</AppText> : null}

				<View style={styles.section}>
					<SectionHeader title={t("intake:log.recentsTitle")} />
					{recents.length === 0 ? (
						<AppText variant="caption" color="muted">
							{t("intake:log.recentsEmpty")}
						</AppText>
					) : (
						recents.map(({ event, detail }) => (
							<ListRow
								key={event.id}
								title={event.name}
								detail={t("intake:log.option", {
									item: event.brand ?? t(`intake:kinds.${event.kind}`),
									portion:
										event.portionLabel ?? t("intake:event.defaultPortion"),
								})}
								value={detail}
								accessibilityLabel={t("intake:log.repeatA11y", {
									name: event.name,
								})}
								disabled={busy}
								onPress={() =>
									void mutate(async () => {
										const repeated = await intake.repeatEvent(event.id, {
											localDay,
											time,
										});
										return { name: event.name, localDay: repeated.localDay };
									})
								}
							/>
						))
					)}
				</View>

				{library.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:log.libraryTitle")} />
						{library.map((consumable) => (
							<ListRow
								key={consumable.id}
								title={consumable.name}
								detail={
									consumable.brand ?? t(`intake:kinds.${consumable.kind}`)
								}
								accessibilityLabel={t("intake:log.logA11y", {
									name: consumable.name,
								})}
								onPress={() => openLibrary(consumable)}
							/>
						))}
					</View>
				) : null}

				{catalogue.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:log.catalogueTitle")} />
						{catalogue.map((consumable) => (
							<ListRow
								key={consumable.key}
								title={consumable.name}
								detail={t(`intake:kinds.${consumable.kind}`)}
								accessibilityLabel={t("intake:log.logA11y", {
									name: consumable.name,
								})}
								onPress={() =>
									open({
										source: { type: "system", key: consumable.key },
										kind: consumable.kind,
										name: consumable.name,
										brand: null,
										composition: consumable,
										provenance: null,
									})
								}
							/>
						))}
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
						{results.map((result) => (
							<ListRow
								key={result.ref}
								title={result.name}
								detail={t("intake:log.provenance", {
									source: result.brand ?? result.source,
									licence: result.licence,
								})}
								accessibilityLabel={t("intake:log.logA11y", {
									name: result.name,
								})}
								onPress={() => openExternal(result)}
							/>
						))}
						{!searchBusy && results.length === 0 && !searchSnapshot?.message ? (
							<AppText variant="caption" color="muted">
								{t("intake:log.noResults")}
							</AppText>
						) : null}
					</View>
				) : null}

				<Card style={styles.section}>
					<SectionHeader title={t("intake:log.freeTitle")} />
					{freeOpen ? (
						<>
							<FormField
								label={t("intake:free.name")}
								placeholder={t("intake:free.namePlaceholder")}
								value={freeName}
								onChangeText={setFreeName}
							/>
							<FormField
								label={t("intake:free.portionLabel")}
								placeholder={t("intake:free.portionPlaceholder")}
								value={freePortion}
								onChangeText={setFreePortion}
							/>
							<AppText variant="label">
								{t("intake:free.nutritionTitle")}
							</AppText>
							{freeKind === "nicotine" ? (
								<FormField
									label={t("intake:free.nicotine")}
									value={freeInputs.nicotineMg ?? ""}
									onChangeText={(nicotineMg) =>
										setFreeInputs((current) => ({ ...current, nicotineMg }))
									}
									keyboardType="decimal-pad"
								/>
							) : (
								<>
									<View style={styles.row}>
										<FormField
											label={t("intake:free.energy")}
											value={freeInputs.energyKcal ?? ""}
											onChangeText={(energyKcal) =>
												setFreeInputs((current) => ({ ...current, energyKcal }))
											}
											keyboardType="decimal-pad"
											containerStyle={styles.grow}
										/>
										<FormField
											label={t("intake:free.protein")}
											value={freeInputs.proteinG ?? ""}
											onChangeText={(proteinG) =>
												setFreeInputs((current) => ({ ...current, proteinG }))
											}
											keyboardType="decimal-pad"
											containerStyle={styles.grow}
										/>
									</View>
									<View style={styles.row}>
										<FormField
											label={t("intake:free.carbohydrate")}
											value={freeInputs.carbohydrateG ?? ""}
											onChangeText={(carbohydrateG) =>
												setFreeInputs((current) => ({
													...current,
													carbohydrateG,
												}))
											}
											keyboardType="decimal-pad"
											containerStyle={styles.grow}
										/>
										<FormField
											label={t("intake:free.fat")}
											value={freeInputs.fatG ?? ""}
											onChangeText={(fatG) =>
												setFreeInputs((current) => ({ ...current, fatG }))
											}
											keyboardType="decimal-pad"
											containerStyle={styles.grow}
										/>
									</View>
									{freeKind === "drink" ? (
										<View style={styles.row}>
											<FormField
												label={t("intake:free.fluid")}
												value={freeInputs.fluidMl ?? ""}
												onChangeText={(fluidMl) =>
													setFreeInputs((current) => ({ ...current, fluidMl }))
												}
												keyboardType="decimal-pad"
												containerStyle={styles.grow}
											/>
											<FormField
												label={t("intake:free.abv")}
												value={freeInputs.abvPercent ?? ""}
												onChangeText={(abvPercent) =>
													setFreeInputs((current) => ({
														...current,
														abvPercent,
													}))
												}
												keyboardType="decimal-pad"
												containerStyle={styles.grow}
											/>
										</View>
									) : null}
									<FormField
										label={t("intake:free.caffeine")}
										value={freeInputs.caffeineMg ?? ""}
										onChangeText={(caffeineMg) =>
											setFreeInputs((current) => ({ ...current, caffeineMg }))
										}
										keyboardType="decimal-pad"
									/>
								</>
							)}
							<FormField
								label={t("intake:log.quantity")}
								value={quantity}
								onChangeText={setQuantity}
								keyboardType="decimal-pad"
							/>
							<View style={styles.row}>
								<DateField
									label={t("intake:log.date")}
									value={localDay}
									onChangeDate={setLocalDay}
									containerStyle={styles.grow}
								/>
								<TimeField
									label={t("intake:log.time")}
									value={time}
									onChangeTime={setTime}
									containerStyle={styles.grow}
								/>
							</View>
							<AppText variant="caption" color="muted">
								{t("intake:free.hint")}
							</AppText>
							<View style={styles.row}>
								<Button
									label={t("intake:log.cancel")}
									variant="text"
									disabled={busy}
									style={styles.grow}
									onPress={() => setFreeOpen(false)}
								/>
								<Button
									label={t("intake:free.save")}
									loading={busy}
									disabled={!freeValid}
									style={styles.grow}
									onPress={() => void saveFree()}
								/>
							</View>
						</>
					) : (
						<ListRow
							title={t("intake:log.freeTitle")}
							detail={t("intake:log.freeDetail")}
							onPress={() => {
								Keyboard.dismiss();
								setFreeOpen(true);
							}}
						/>
					)}
				</Card>
			</Screen>

			<ModalSheet
				visible={pick !== null}
				onClose={() => setPick(null)}
				closeAccessibilityLabel={t("intake:log.dismissA11y")}
			>
				{pick ? (
					<View style={styles.section}>
						<View>
							<AppText variant="section">
								{t("intake:log.portionTitle", { name: pick.name })}
							</AppText>
							{pick.brand ? (
								<AppText variant="caption" color="muted">
									{pick.brand}
								</AppText>
							) : null}
							{pick.provenance ? (
								<AppText variant="micro" color="subtle">
									{pick.provenance}
								</AppText>
							) : null}
						</View>
						{pick.composition.portions.length > 0 ? (
							<>
								<AppText variant="label">{t("intake:log.portion")}</AppText>
								<View style={styles.wrap}>
									{pick.composition.portions.map((portion) => (
										<Button
											key={portion.id}
											label={portion.label}
											variant={
												portionId === portion.id && !amount.trim()
													? "primary"
													: "secondary"
											}
											onPress={() => {
												setPortionId(portion.id);
												setAmount("");
											}}
										/>
									))}
								</View>
							</>
						) : null}
						{amountUnit ? (
							<FormField
								label={
									amountUnit === "g"
										? t("intake:log.byWeight", { unit: amountUnit })
										: t("intake:log.byVolume", { unit: amountUnit })
								}
								value={amount}
								onChangeText={setAmount}
								keyboardType="decimal-pad"
							/>
						) : null}
						{!amount.trim() ? (
							<FormField
								label={t("intake:log.quantity")}
								value={quantity}
								onChangeText={setQuantity}
								keyboardType="decimal-pad"
							/>
						) : null}
						<View style={styles.row}>
							<DateField
								label={t("intake:log.date")}
								value={localDay}
								onChangeDate={setLocalDay}
								containerStyle={styles.grow}
							/>
							<TimeField
								label={t("intake:log.time")}
								value={time}
								onChangeTime={setTime}
								containerStyle={styles.grow}
							/>
						</View>
						<Button
							label={t("intake:log.yesterday")}
							variant="text"
							onPress={() => {
								setLocalDay(previousLocalDay(snapshot.localDay));
								setTime("20:00");
							}}
						/>
						<AppText variant="label">{t("intake:log.context")}</AppText>
						<View style={styles.wrap}>
							<Button
								label={t("intake:log.contextNone")}
								variant={context === null ? "primary" : "secondary"}
								onPress={() => setContext(null)}
							/>
							{INTAKE_CONTEXTS.map((candidate) => (
								<Button
									key={candidate}
									label={t(`intake:contexts.${candidate}`)}
									variant={context === candidate ? "primary" : "secondary"}
									onPress={() => setContext(candidate)}
								/>
							))}
						</View>
						<View style={styles.row}>
							<Button
								label={t("intake:log.cancel")}
								variant="text"
								disabled={busy}
								style={styles.grow}
								onPress={() => setPick(null)}
							/>
							<Button
								label={t("intake:log.save")}
								loading={busy}
								disabled={!pickValid}
								style={styles.grow}
								onPress={() => void savePick()}
							/>
						</View>
					</View>
				) : null}
			</ModalSheet>

			<LogConfirmationToast
				message={
					confirmation
						? t("intake:log.added", { name: confirmation.name })
						: null
				}
				actionLabel={t("intake:log.viewDay")}
				onDismiss={dismissConfirmation}
				onAction={() => {
					if (confirmation) {
						router.push(`/intake/${confirmation.localDay}` as Href);
					}
				}}
			/>
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	grow: { flex: 1 },
	headerSearch: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		minHeight: 44,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface,
	},
	headerSearchInput: {
		flex: 1,
		...theme.typography.body,
		color: theme.colors.text,
		paddingVertical: 0,
	},
}));
