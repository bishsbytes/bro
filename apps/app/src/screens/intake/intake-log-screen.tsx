import type { Consumable } from "@bro/database-app";
import { localTimeOf, previousLocalDay } from "@bro/domain";
import type {
	ConsumableComposition,
	ConsumableKind,
} from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import type { PortionSelection } from "@bro/logic";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Keyboard,
	Pressable,
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
	type PresentedIntakeEvent,
} from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { showLoggedIntakeDay } from "../../navigation/intake-flow";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeRow, RowPanel } from "./intake-rows";

type IntakeLogScreenProps = {
	initialKind?: ConsumableKind;
	/** Log against this day rather than today; the sheet opens on Earlier. */
	initialLocalDay?: string;
	store?: Pick<IntakeStore, "loadLog" | "log" | "logFree" | "repeatEvent">;
	searchStore?: Pick<IntakeSearchStore, "loadCached" | "search">;
};

/** What the detail sheet is open for: something with a composition, or a recent. */
type Pick_ =
	| {
			type: "composition";
			source: LogSource;
			kind: ConsumableKind;
			name: string;
			brand: string | null;
			composition: ConsumableComposition;
			provenance: string | null;
	  }
	| { type: "recent"; presented: PresentedIntakeEvent };

type WhenMode = "now" | "earlier";

const SEARCH_DEBOUNCE_MS = 300;
const QUICK_QUANTITIES = [0.5, 1, 2] as const;

function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}

function formatQuantity(quantity: number): string {
	return quantity === 0.5 ? "½" : String(quantity);
}

/** A recent chip: one tap logs it at its remembered portion. */
function RecentChip({
	presented,
	disabled,
	onPress,
	onLongPress,
}: {
	presented: PresentedIntakeEvent;
	disabled: boolean;
	onPress: () => void;
	onLongPress: () => void;
}) {
	const { t } = useTranslation("intake");
	const { event } = presented;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={t("log.repeatA11y", { name: event.name })}
			accessibilityHint={t("log.recentHint")}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			onLongPress={onLongPress}
			style={({ pressed }) => [
				styles.chip,
				pressed && styles.chipPressed,
				disabled && styles.chipDisabled,
			]}
		>
			<AppText variant="label" numberOfLines={1}>
				{event.name}
			</AppText>
			<AppText variant="caption" color="muted" numberOfLines={1}>
				{t("log.option", {
					item: "",
					portion: event.portionLabel ?? t("event.defaultPortion"),
				}).trimStart()}
			</AppText>
		</Pressable>
	);
}

/**
 * One screen for everything, recents first. A recent chip logs in one tap at
 * the remembered portion, ranked by time of day so the evening things come
 * first at half six; the detail sheet — portion, stepper, now or earlier —
 * opens only on request. Then the library, the catalogue, search as the
 * fallback, and "something else". Entries carry a time, never a meal slot.
 */
export function IntakeLogScreen({
	initialKind,
	initialLocalDay,
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
	const [quantity, setQuantity] = useState(1);
	const [customQuantity, setCustomQuantity] = useState<string | null>(null);
	const [whenMode, setWhenMode] = useState<WhenMode>("now");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [freeOpen, setFreeOpen] = useState(false);
	const [freeName, setFreeName] = useState("");
	const [freePortion, setFreePortion] = useState("");
	const [freeQuantity, setFreeQuantity] = useState("1");
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
				intake.loadLog(initialLocalDay),
				search.loadCached(),
			]);
			// Seed the form once, so a part-typed row survives the refresh after a save.
			setSearchSnapshot((current) => current ?? cached);
			setLocalDay((current) => current || next.localDay);
			setTime((current) => current || next.defaultTime);
			if (next.localDay !== next.today) setWhenMode("earlier");
			return next;
		}, [initialLocalDay, intake, search]),
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

	/** The moment being logged: this minute, or the day and time chosen. */
	function occurrence(): { localDay: string; time: string } {
		if (whenMode === "now" && snapshot) {
			return { localDay: snapshot.today, time: localTimeOf(Date.now()) };
		}
		return { localDay, time };
	}

	async function mutate(
		work: () => Promise<{ name: string; localDay: string }>,
	) {
		if (busy) return false;
		setBusy(true);
		setError(null);
		try {
			const logged = await work();
			setSnapshot(await intake.loadLog(initialLocalDay));
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
		setPortionId(
			next.type === "composition" ? next.composition.defaultPortionId : null,
		);
		setAmount("");
		setQuantity(next.type === "recent" ? next.presented.event.quantity : 1);
		setCustomQuantity(null);
	}

	function openLibrary(consumable: Consumable) {
		open({
			type: "composition",
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
			type: "composition",
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

	function repeat(presented: PresentedIntakeEvent, chosenQuantity?: number) {
		const { event } = presented;
		return mutate(async () => {
			const repeated = await intake.repeatEvent(
				event.id,
				occurrence(),
				chosenQuantity,
			);
			return { name: event.name, localDay: repeated.localDay };
		});
	}

	function stepQuantity(direction: -1 | 1) {
		setCustomQuantity(null);
		setQuantity((current) =>
			direction < 0
				? current <= 1
					? 0.5
					: Math.max(1, Math.round(current) - 1)
				: current < 1
					? 1
					: Math.round(current) + 1,
		);
	}

	const effectiveQuantity =
		customQuantity === null ? quantity : Number(customQuantity);
	const quantityValid =
		customQuantity === null || isPositiveNumber(customQuantity);

	async function savePick() {
		if (!pick) return;
		const picked = pick;
		const when = occurrence();
		if (picked.type === "recent") {
			const saved = await repeat(picked.presented, effectiveQuantity);
			if (saved) setPick(null);
			return;
		}
		const { basis } = picked.composition;
		const selection: PortionSelection =
			amount.trim() && basis.type === "mass"
				? { type: "mass", massKg: Number(amount) / 1_000 }
				: amount.trim() && basis.type === "volume"
					? { type: "volume", volumeL: Number(amount) / 1_000 }
					: {
							type: "portion",
							portionId: portionId ?? "",
							quantity: effectiveQuantity,
						};
		const saved = await mutate(async () => {
			await intake.log(picked.source, selection, when, null);
			return { name: picked.name, localDay: when.localDay };
		});
		if (saved) setPick(null);
	}

	async function saveFree() {
		const freeKind = kind ?? "food";
		const when = occurrence();
		const saved = await mutate(async () => {
			const { constituents, volumeL } = compositionFromLabelInputs(freeInputs);
			await intake.logFree({
				kind: freeKind,
				name: freeName,
				portionLabel: freePortion.trim() || null,
				quantity: Number(freeQuantity),
				volumeL,
				constituents,
				context: null,
				...when,
			});
			return { name: freeName, localDay: when.localDay };
		});
		if (saved) {
			setFreeOpen(false);
			setFreeName("");
			setFreePortion("");
			setFreeInputs({});
			setFreeQuantity("1");
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
		isPositiveNumber(freeQuantity) &&
		labelInputsValid(freeInputs) &&
		labelInputsHaveValue(freeInputs);
	const pickComposition =
		pick?.type === "composition" ? pick.composition : null;
	const pickBasis = pickComposition?.basis;
	const amountUnit =
		pickBasis?.type === "mass"
			? "g"
			: pickBasis?.type === "volume"
				? "ml"
				: null;
	const byAmount = amountUnit !== null && amount.trim() !== "";
	const pickName =
		pick?.type === "recent" ? pick.presented.event.name : (pick?.name ?? "");
	const pickBrand =
		pick?.type === "recent"
			? pick.presented.event.brand
			: (pick?.brand ?? null);
	const portionWord =
		pick?.type === "recent"
			? (pick.presented.event.portionLabel ?? t("intake:event.defaultPortion"))
			: (pickComposition?.portions.find((portion) => portion.id === portionId)
					?.label ?? t("intake:event.defaultPortion"));
	const whenValid = whenMode === "now" || (localDay !== "" && time !== "");
	const pickValid =
		pick !== null &&
		whenValid &&
		(pick.type === "recent"
			? quantityValid
			: byAmount
				? isPositiveNumber(amount)
				: portionId !== null && quantityValid);

	return (
		<>
			<Stack.Screen
				options={{
					headerTitleAlign: "left",
					headerTitle: () => (
						<View style={[styles.headerSearch, { width: headerSearchWidth }]}>
							<Icon name="search" color={theme.colors.ink2} size={24} />
							<TextInput
								accessibilityLabel={t("intake:log.searchA11y")}
								autoCapitalize="none"
								autoCorrect={false}
								placeholder={t("intake:log.searchPlaceholder")}
								placeholderTextColor={theme.colors.ink3}
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
									<Icon name="close" color={theme.colors.ink2} size={24} />
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
							accessibilityState={{ selected: kind === candidate }}
							variant={kind === candidate ? "primary" : "secondary"}
							onPress={() =>
								setKind((current) => (current === candidate ? null : candidate))
							}
						/>
					))}
				</View>

				{error ? <AppText color="danger">{error}</AppText> : null}

				<View style={styles.section}>
					<AppText variant="caption" color="muted">
						{t("intake:log.recentsTitle")}
					</AppText>
					{recents.length === 0 ? (
						<AppText variant="caption" color="subtle">
							{t("intake:log.recentsEmpty")}
						</AppText>
					) : (
						<View style={styles.wrap}>
							{recents.map((presented) => (
								<RecentChip
									key={presented.event.id}
									presented={presented}
									disabled={busy}
									onPress={() => void repeat(presented)}
									onLongPress={() => open({ type: "recent", presented })}
								/>
							))}
						</View>
					)}
				</View>

				{library.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:log.libraryTitle")} />
						<RowPanel>
							{library.map((consumable, index) => (
								<IntakeRow
									key={consumable.id}
									title={consumable.name}
									meta={
										consumable.brand ?? t(`intake:kinds.${consumable.kind}`)
									}
									chevron
									last={index === library.length - 1}
									accessibilityLabel={t("intake:log.logA11y", {
										name: consumable.name,
									})}
									onPress={() => openLibrary(consumable)}
								/>
							))}
						</RowPanel>
					</View>
				) : null}

				{catalogue.length > 0 ? (
					<View style={styles.section}>
						<SectionHeader title={t("intake:log.catalogueTitle")} />
						<RowPanel>
							{catalogue.map((consumable, index) => (
								<IntakeRow
									key={consumable.key}
									title={consumable.name}
									meta={t(`intake:kinds.${consumable.kind}`)}
									chevron
									last={index === catalogue.length - 1}
									accessibilityLabel={t("intake:log.logA11y", {
										name: consumable.name,
									})}
									onPress={() =>
										open({
											type: "composition",
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
										onPress={() => openExternal(result)}
									/>
								))}
							</RowPanel>
						) : null}
						{!searchBusy && results.length === 0 && !searchSnapshot?.message ? (
							<AppText variant="caption" color="muted">
								{t("intake:log.noResults")}
							</AppText>
						) : null}
					</View>
				) : null}

				{freeOpen ? (
					<Card style={styles.section}>
						<SectionHeader title={t("intake:log.freeTitle")} />
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
						<AppText variant="label">{t("intake:free.nutritionTitle")}</AppText>
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
							value={freeQuantity}
							onChangeText={setFreeQuantity}
							keyboardType="decimal-pad"
						/>
						<WhenFields
							t={t}
							isToday={snapshot.localDay === snapshot.today}
							whenMode={whenMode}
							localDay={localDay}
							time={time}
							today={snapshot.today}
							onChangeMode={setWhenMode}
							onChangeDay={setLocalDay}
							onChangeTime={setTime}
						/>
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
								disabled={!freeValid || !whenValid}
								style={styles.grow}
								onPress={() => void saveFree()}
							/>
						</View>
					</Card>
				) : (
					<RowPanel>
						<IntakeRow
							title={t("intake:log.freeTitle")}
							meta={t("intake:log.freeDetail")}
							chevron
							last
							onPress={() => {
								Keyboard.dismiss();
								setFreeOpen(true);
							}}
						/>
					</RowPanel>
				)}
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
								{t("intake:log.portionTitle", { name: pickName })}
							</AppText>
							{pickBrand ? (
								<AppText variant="caption" color="muted">
									{pickBrand}
								</AppText>
							) : null}
							{pick.type === "composition" && pick.provenance ? (
								<AppText variant="micro" color="subtle">
									{pick.provenance}
								</AppText>
							) : null}
						</View>
						{pickComposition && pickComposition.portions.length > 0 ? (
							<>
								<AppText variant="label">{t("intake:log.portion")}</AppText>
								<View style={styles.wrap}>
									{pickComposition.portions.map((portion) => (
										<Button
											key={portion.id}
											label={portion.label}
											accessibilityState={{
												selected: portionId === portion.id && !byAmount,
											}}
											variant={
												portionId === portion.id && !byAmount
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
						{!byAmount ? (
							<>
								<AppText variant="label">{t("intake:log.quantity")}</AppText>
								<View style={styles.stepper}>
									<Button
										label="−"
										accessibilityLabel={t("intake:log.fewer")}
										variant="secondary"
										disabled={customQuantity === null && quantity <= 0.5}
										style={styles.stepButton}
										onPress={() => stepQuantity(-1)}
									/>
									<AppText
										variant="score"
										style={styles.stepValue}
										accessibilityLiveRegion="polite"
									>
										{t("intake:log.quantityValue", {
											quantity:
												customQuantity === null
													? formatQuantity(quantity)
													: customQuantity || "…",
											portion: portionWord,
										})}
									</AppText>
									<Button
										label="+"
										accessibilityLabel={t("intake:log.more")}
										variant="secondary"
										style={styles.stepButton}
										onPress={() => stepQuantity(1)}
									/>
								</View>
								<View style={styles.wrap}>
									{QUICK_QUANTITIES.map((quick) => (
										<Button
											key={quick}
											label={formatQuantity(quick)}
											accessibilityState={{
												selected: customQuantity === null && quantity === quick,
											}}
											variant={
												customQuantity === null && quantity === quick
													? "primary"
													: "secondary"
											}
											onPress={() => {
												setCustomQuantity(null);
												setQuantity(quick);
											}}
										/>
									))}
									<Button
										label={t("intake:log.custom")}
										accessibilityState={{ selected: customQuantity !== null }}
										variant={customQuantity !== null ? "primary" : "secondary"}
										onPress={() =>
											setCustomQuantity((current) =>
												current === null ? String(quantity) : current,
											)
										}
									/>
								</View>
								{customQuantity !== null ? (
									<FormField
										label={t("intake:log.customQuantity")}
										value={customQuantity}
										onChangeText={setCustomQuantity}
										keyboardType="decimal-pad"
										autoFocus
									/>
								) : null}
							</>
						) : null}
						<WhenFields
							t={t}
							isToday={snapshot.localDay === snapshot.today}
							whenMode={whenMode}
							localDay={localDay}
							time={time}
							today={snapshot.today}
							onChangeMode={setWhenMode}
							onChangeDay={setLocalDay}
							onChangeTime={setTime}
						/>
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
						showLoggedIntakeDay(confirmation.localDay);
					}
				}}
			/>
		</>
	);
}

type WhenFieldsProps = {
	t: ReturnType<typeof useTranslation<["intake", "common"]>>["t"];
	isToday: boolean;
	whenMode: WhenMode;
	localDay: string;
	time: string;
	today: string;
	onChangeMode: (mode: WhenMode) => void;
	onChangeDay: (localDay: string) => void;
	onChangeTime: (time: string) => void;
};

/** Now, or a day and time: an entry carries a timestamp, never a meal slot. */
function WhenFields({
	t,
	whenMode,
	localDay,
	time,
	today,
	onChangeMode,
	onChangeDay,
	onChangeTime,
}: WhenFieldsProps) {
	return (
		<>
			<AppText variant="label">{t("intake:log.when")}</AppText>
			<View
				style={styles.row}
				accessibilityRole="radiogroup"
				accessibilityLabel={t("intake:log.when")}
			>
				<Button
					label={t("intake:log.now")}
					accessibilityState={{ selected: whenMode === "now" }}
					variant={whenMode === "now" ? "primary" : "secondary"}
					style={styles.grow}
					onPress={() => onChangeMode("now")}
				/>
				<Button
					label={t("intake:log.earlier")}
					accessibilityState={{ selected: whenMode === "earlier" }}
					variant={whenMode === "earlier" ? "primary" : "secondary"}
					style={styles.grow}
					onPress={() => onChangeMode("earlier")}
				/>
			</View>
			{whenMode === "earlier" ? (
				<>
					<View style={styles.row}>
						<DateField
							label={t("intake:log.date")}
							value={localDay}
							onChangeDate={onChangeDay}
							containerStyle={styles.grow}
						/>
						<TimeField
							label={t("intake:log.time")}
							value={time}
							onChangeTime={onChangeTime}
							containerStyle={styles.grow}
						/>
					</View>
					<Button
						label={t("intake:log.yesterday")}
						variant="text"
						onPress={() => {
							onChangeDay(previousLocalDay(today));
							onChangeTime("20:00");
						}}
					/>
				</>
			) : null}
		</>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	row: { flexDirection: "row", gap: theme.spacing.md },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	grow: { flex: 1 },
	chip: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: theme.spacing.xs,
		minHeight: theme.control.buttonMinHeight,
		paddingHorizontal: theme.spacing.md,
		paddingVertical: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		// Chips take the smallest radius; the pill is reserved for switch-like
		// toggles, and a chip that logs on tap is not one.
		borderRadius: theme.radius.sm,
		backgroundColor: theme.colors.surface,
	},
	chipPressed: { backgroundColor: theme.colors.surfaceSunk },
	chipDisabled: { opacity: theme.opacity.disabled },
	stepper: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.md,
	},
	stepButton: { minWidth: theme.control.buttonMinHeight, paddingHorizontal: 0 },
	stepValue: { flex: 1, textAlign: "center" },
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
		color: theme.colors.ink,
		paddingVertical: 0,
	},
}));
