import type { Consumable } from "@bro/database-app";
import { localTimeOf } from "@bro/domain";
import type {
	ConsumableComposition,
	ConsumableKind,
} from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import {
	type PortionSelection,
	scaleComposition,
	scaleConstituents,
} from "@bro/logic";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Keyboard,
	Pressable,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { FormField } from "../../components/form-field";
import { Icon } from "../../components/icon";
import { LoadingIndicator } from "../../components/loading-indicator";
import { LogConfirmationToast } from "../../components/log-confirmation-toast";
import { LoadingScreen, Screen } from "../../components/screen";
import { SectionHeader } from "../../components/section-header";
import {
	compositionFromLabelInputs,
	type LabelInputs,
	labelInputsFromComposition,
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
import { IntakeArtwork } from "./intake-artwork";
import { IntakeFormSheet } from "./intake-form-sheet";
import { IntakeQuantityField } from "./intake-quantity-field";
import { IntakeRow, RowPanel } from "./intake-rows";
import { IntakeWhenFields } from "./intake-when-fields";

type IntakeLogScreenProps = {
	initialKind?: ConsumableKind;
	/** Log against this day rather than today; the sheet opens on Earlier. */
	initialLocalDay?: string;
	store?: Pick<IntakeStore, "loadLog" | "log" | "logFree" | "repeatEvent"> &
		Partial<Pick<IntakeStore, "deleteEvent">>;
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
			artworkRef?: string | null;
			provenance: string | null;
	  }
	| { type: "recent"; presented: PresentedIntakeEvent };

type WhenMode = "now" | "earlier";

const SEARCH_DEBOUNCE_MS = 300;
const PORTION_SUGGESTIONS = {
	food: [
		"portion",
		"serving",
		"piece",
		"slice",
		"bowl",
		"plate",
		"cup",
		"tablespoon",
		"teaspoon",
		"handful",
		"bar",
		"pot",
	],
	drink: [
		"portion",
		"glass",
		"mug",
		"cup",
		"bottle",
		"can",
		"carton",
		"pint",
		"shot",
	],
	supplement: ["portion", "tablet", "capsule", "scoop", "drop"],
	medication: ["portion", "tablet", "capsule", "drop"],
	nicotine: ["portion", "cigarette", "puff"],
	other: ["portion", "serving", "piece"],
} as const satisfies Record<ConsumableKind, readonly string[]>;
const NUTRITION_UNITS = {
	energyKcal: "kcal",
	proteinG: "g",
	carbohydrateG: "g",
	fatG: "g",
	fluidMl: "ml",
	abvPercent: "%",
	caffeineMg: "mg",
	nicotineMg: "mg",
} as const;
const NUTRITION_LABELS = {
	energyKcal: "energy",
	proteinG: "protein",
	carbohydrateG: "carbohydrate",
	fatG: "fat",
	fluidMl: "fluid",
	abvPercent: "abv",
	caffeineMg: "caffeine",
	nicotineMg: "nicotine",
} as const;

function isPositiveNumber(value: string): boolean {
	const number = Number(value);
	return value.trim() !== "" && Number.isFinite(number) && number > 0;
}

/** Tap the row to edit the next amount, or plus to repeat the displayed portion. */
function RecentIntakeRow({
	presented,
	disabled,
	onRepeat,
	onEdit,
}: {
	presented: PresentedIntakeEvent;
	disabled: boolean;
	onRepeat: () => void;
	onEdit: () => void;
}) {
	const { t } = useTranslation("intake");
	const { event } = presented;

	const { theme } = useUnistyles();
	return (
		<View style={styles.recentRow}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("log.editAmountA11y", { name: event.name })}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onEdit}
				style={styles.recentCopy}
			>
				<IntakeArtwork
					name={event.name}
					brand={event.brand}
					kind={event.kind}
					sourceRef={event.sourceRef}
				/>
				<View style={styles.grow}>
					<AppText variant="label">{event.name}</AppText>
					<AppText variant="caption" color="muted">
						{t("entry.portion", {
							quantity: event.quantity,
							portion: event.portionLabel ?? t("event.defaultPortion"),
						})}
					</AppText>
				</View>
			</Pressable>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={t("log.repeatA11y", { name: event.name })}
				accessibilityHint={t("log.recentHint")}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={onRepeat}
				style={styles.repeatButton}
			>
				<Icon name="add" size={24} color={theme.colors.brand} />
			</Pressable>
		</View>
	);
}

/** Recent rows edit an amount; their separate plus repeats the displayed portion. */
export function IntakeLogScreen({
	initialKind,
	initialLocalDay,
	store,
	searchStore,
}: IntakeLogScreenProps) {
	const { t } = useTranslation(["intake", "common"]);
	const { theme } = useUnistyles();
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
	const submitting = useRef(false);
	const [pick, setPick] = useState<Pick_ | null>(null);
	const [portionId, setPortionId] = useState<string | null>(null);
	const [amount, setAmount] = useState("");
	const [amountMode, setAmountMode] = useState(false);
	const [quantity, setQuantity] = useState(1);
	const [customQuantity, setCustomQuantity] = useState<string | null>(null);
	const [whenMode, setWhenMode] = useState<WhenMode>("now");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [freeOpen, setFreeOpen] = useState(false);
	const [freeKind, setFreeKind] = useState<ConsumableKind>(
		initialKind ?? "food",
	);
	const [freeMore, setFreeMore] = useState(false);
	const [nutritionOpen, setNutritionOpen] = useState(false);
	const [freeName, setFreeName] = useState("");
	const [freePortion, setFreePortion] = useState("");
	const [freeQuantity, setFreeQuantity] = useState("1");
	const [freeInputs, setFreeInputs] = useState<LabelInputs>({});
	const [confirmation, setConfirmation] = useState<{
		name: string;
		localDay: string;
		id?: string;
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
			searchRequestId.current += 1;
			setSearchBusy(false);
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
		return () => {
			clearTimeout(timeout);
			searchRequestId.current += 1;
		};
	}, [query, search, setError]);

	/** The moment being logged: this minute, or the day and time chosen. */
	function occurrence(): { localDay: string; time: string } {
		if (whenMode === "now" && snapshot) {
			return { localDay: snapshot.today, time: localTimeOf(Date.now()) };
		}
		return { localDay, time };
	}

	async function mutate(
		work: () => Promise<{ name: string; localDay: string; id?: string }>,
	) {
		if (submitting.current) return false;
		submitting.current = true;
		setBusy(true);
		setError(null);
		try {
			const logged = await work();
			setConfirmation(logged);
			// The local write is complete even if refreshing the list fails.
			try {
				setSnapshot(await intake.loadLog(initialLocalDay));
			} catch (caught) {
				setError(toMessage(caught));
			}
			return true;
		} catch (caught) {
			setError(toMessage(caught));
			return false;
		} finally {
			submitting.current = false;
			setBusy(false);
		}
	}

	function prepareTime() {
		if (whenMode === "now" && snapshot) {
			setLocalDay(snapshot.today);
			setTime(localTimeOf(Date.now()));
			setWhenMode("earlier");
		}
	}

	function open(next: Pick_) {
		prepareTime();
		Keyboard.dismiss();
		setPick(next);
		setNutritionOpen(false);
		setError(null);
		setPortionId(
			next.type === "composition" ? next.composition.defaultPortionId : null,
		);
		setAmount("");
		setAmountMode(false);
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
			artworkRef:
				consumable.source.type === "system"
					? consumable.source.key
					: consumable.source.type === "user"
						? null
						: consumable.id,
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
			return { name: event.name, localDay: repeated.localDay, id: repeated.id };
		});
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
			amountMode && basis.type === "mass"
				? { type: "mass", massKg: Number(amount) / 1_000 }
				: amountMode && basis.type === "volume"
					? { type: "volume", volumeL: Number(amount) / 1_000 }
					: {
							type: "portion",
							portionId: portionId ?? "",
							quantity: effectiveQuantity,
						};
		const saved = await mutate(async () => {
			const logged = await intake.log(picked.source, selection, when, null);
			return { name: picked.name, localDay: when.localDay, id: logged?.id };
		});
		if (saved) setPick(null);
	}

	async function saveFree() {
		const when = occurrence();
		const saved = await mutate(async () => {
			const { constituents, volumeL } = compositionFromLabelInputs(freeInputs);
			const logged = await intake.logFree({
				kind: freeKind,
				name: freeName,
				portionLabel: freePortion.trim() || null,
				quantity: Number(freeQuantity),
				volumeL,
				constituents,
				context: null,
				...when,
			});
			return { name: freeName, localDay: when.localDay, id: logged?.id };
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
	const freePortionSuggestions = [
		...PORTION_SUGGESTIONS[freeKind].map((portion) =>
			t(`intake:free.portions.${portion}`),
		),
		...snapshot.recents
			.filter(({ event }) => event.kind === freeKind)
			.map(({ event }) => event.portionLabel ?? ""),
		...snapshot.library
			.filter((item) => item.kind === freeKind)
			.flatMap((item) => item.portions.map((portion) => portion.label)),
	]
		.map((portion) => portion.trim())
		.filter(
			(portion, index, all) =>
				portion !== "" &&
				all.findIndex(
					(candidate) =>
						candidate.toLocaleLowerCase() === portion.toLocaleLowerCase(),
				) === index,
		);
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
		normalizedQuery.length >= 2 &&
		searchSnapshot?.query.toLocaleLowerCase() === normalizedQuery
			? (searchSnapshot?.results ?? []).filter((result) => ofKind(result.kind))
			: [];
	const freeFields =
		freeKind === "nicotine"
			? (["nicotineMg"] as const)
			: freeMore
				? ([
						"energyKcal",
						"proteinG",
						"carbohydrateG",
						"fatG",
						"fluidMl",
						"abvPercent",
						"caffeineMg",
					] as const)
				: freeKind === "drink"
					? (["energyKcal", "fluidMl"] as const)
					: (["energyKcal"] as const);

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
	const byAmount = amountUnit !== null && amountMode;
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

	function selectPortion(id: string) {
		if (!pickComposition) return;
		const portion = pickComposition.portions.find(
			(candidate) => candidate.id === id,
		);
		const current = pickComposition.portions.find(
			(candidate) => candidate.id === portionId,
		);
		const sizeOf = (value: typeof portion) =>
			pickBasis?.type === "mass"
				? value?.massKg
				: pickBasis?.type === "volume"
					? value?.volumeL
					: value?.basisUnits;
		const size = sizeOf(portion);
		const oldSize = sizeOf(current);
		if (byAmount)
			setCustomQuantity(
				size && isPositiveNumber(amount)
					? String(Number((Number(amount) / 1000 / size).toFixed(6)))
					: "",
			);
		else if (id !== portionId)
			setCustomQuantity(
				size && oldSize && quantityValid
					? String(Number(((effectiveQuantity * oldSize) / size).toFixed(6)))
					: "",
			);
		setPortionId(id);
		setAmount("");
		setAmountMode(false);
	}

	function selectAmount() {
		if (byAmount || !pickComposition) return;
		const portion = pickComposition.portions.find(
			(candidate) => candidate.id === portionId,
		);
		const base = amountUnit === "g" ? portion?.massKg : portion?.volumeL;
		setAmount(
			base != null && quantityValid
				? String(Number((base * effectiveQuantity * 1000).toFixed(6)))
				: "",
		);
		setAmountMode(true);
	}

	let pickNutrition: LabelInputs = {};
	let compositionError: string | null = null;
	try {
		if (pick && pickValid) {
			if (pick.type === "recent") {
				pickNutrition = labelInputsFromComposition(
					scaleConstituents(
						pick.presented.event.constituents,
						effectiveQuantity / pick.presented.event.quantity,
					),
				);
			} else {
				const selection: PortionSelection =
					byAmount && pickBasis?.type === "mass"
						? { type: "mass", massKg: Number(amount) / 1000 }
						: byAmount && pickBasis?.type === "volume"
							? { type: "volume", volumeL: Number(amount) / 1000 }
							: {
									type: "portion",
									portionId: portionId ?? "",
									quantity: effectiveQuantity,
								};
				pickNutrition = labelInputsFromComposition(
					scaleComposition(pick.composition, selection).constituents,
				);
			}
		}
	} catch (caught) {
		compositionError = toMessage(caught);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: "",
					headerBackVisible: false,
					headerLeft: () => (
						<Button
							label={t("intake:log.close")}
							variant="text"
							onPress={() => router.back()}
						/>
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
				<AppText variant="largeTitle">{t("intake:log.heading")}</AppText>
				<View style={styles.headerSearch}>
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
							style={styles.clearSearch}
							onPress={() => setQuery("")}
						>
							<Icon name="close" color={theme.colors.ink2} size={24} />
						</TouchableOpacity>
					) : null}
				</View>
				{whenMode === "earlier" ? (
					<AppText variant="caption" color="muted">
						{localDay} · {time}
					</AppText>
				) : null}

				<View style={styles.wrap}>
					<Button
						label={t("intake:log.all")}
						accessibilityState={{ selected: kind === null }}
						variant={kind === null ? "primary" : "secondary"}
						style={styles.filter}
						onPress={() => setKind(null)}
					/>
					{snapshot.enabledKinds.map((candidate) => (
						<Button
							key={candidate}
							style={styles.filter}
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
									onRepeat={() => void repeat(presented)}
									onEdit={() => open({ type: "recent", presented })}
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
													: consumable.source.type === "user" &&
															!consumable.brand
														? null
														: consumable.id
											}
										/>
									}
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
										onPress={() => openExternal(result)}
									/>
								))}
							</RowPanel>
						) : null}
						{!searchBusy &&
						results.length === 0 &&
						recents.length === 0 &&
						library.length === 0 &&
						catalogue.length === 0 &&
						!searchSnapshot?.message ? (
							<AppText variant="caption" color="muted">
								{t("intake:log.noResults")}
							</AppText>
						) : null}
					</View>
				) : null}
			</Screen>
			<SafeAreaView
				edges={["bottom"]}
				style={{ backgroundColor: theme.colors.background }}
			>
				<View style={styles.footer}>
					<Button
						label={t("intake:log.freeTitle")}
						onPress={() => {
							Keyboard.dismiss();
							if (!freeName.trim()) setFreeKind(kind ?? "food");
							prepareTime();
							setError(null);
							setFreeOpen(true);
						}}
					/>
					<AppText variant="caption" color="muted" style={styles.centered}>
						{t("intake:log.rowHint")}
					</AppText>
				</View>
			</SafeAreaView>

			<IntakeFormSheet
				visible={freeOpen}
				onClose={() => {
					if (!busy) setFreeOpen(false);
				}}
				busy={busy}
				title={t("intake:library.newTitle")}
				footer={
					<View style={styles.actions}>
						<Button
							label={t("intake:free.save")}
							loading={busy}
							disabled={!freeValid || !whenValid}
							onPress={() => void saveFree()}
						/>
						<Button
							label={t("intake:log.cancel")}
							variant="secondary"
							disabled={busy}
							onPress={() => setFreeOpen(false)}
						/>
					</View>
				}
			>
				<View style={styles.sheet}>
					<AppText variant="largeTitle">{t("intake:free.title")}</AppText>
					<FormField
						label={t("intake:free.name")}
						placeholder={t("intake:free.namePlaceholder")}
						value={freeName}
						editable={!busy}
						onChangeText={setFreeName}
					/>
					<View style={styles.section}>
						<AppText variant="label">{t("intake:free.type")}</AppText>
						<View
							style={styles.typeOptions}
							accessibilityRole="radiogroup"
							accessibilityLabel={t("intake:free.type")}
						>
							{snapshot.enabledKinds.map((candidate) => (
								<Button
									key={candidate}
									accessibilityRole="radio"
									style={styles.typeOption}
									label={t(`intake:kinds.${candidate}`)}
									accessibilityState={{
										selected: freeKind === candidate,
										checked: freeKind === candidate,
									}}
									variant={freeKind === candidate ? "primary" : "secondary"}
									disabled={busy}
									onPress={() => setFreeKind(candidate)}
								/>
							))}
						</View>
					</View>

					<IntakeQuantityField
						label={t("intake:log.amount")}
						value={freeQuantity}
						onChange={setFreeQuantity}
						unit={t("intake:event.defaultPortion")}
						unitInput={{
							value: freePortion,
							onChange: setFreePortion,
							suggestions: freePortionSuggestions,
						}}
						step={0.5}
						disabled={busy}
					/>
					<View style={styles.nutritionSection}>
						<AppText variant="label">{t("intake:free.nutritionTitle")}</AppText>
						{freeFields.map((field) => (
							<View key={field} style={styles.nutritionField}>
								<AppText variant="caption" style={styles.grow}>
									{t(`intake:nutrition.${NUTRITION_LABELS[field]}`)}
								</AppText>
								<FormField
									label={t(`intake:free.${NUTRITION_LABELS[field]}`)}
									showLabel={false}
									value={freeInputs[field] ?? ""}
									onChangeText={(value) =>
										setFreeInputs((current) => ({ ...current, [field]: value }))
									}
									keyboardType="decimal-pad"
									editable={!busy}
									containerStyle={styles.nutritionInput}
								/>
								<AppText
									variant="caption"
									color="muted"
									style={styles.nutritionUnit}
								>
									{NUTRITION_UNITS[field]}
								</AppText>
							</View>
						))}
						{freeKind !== "nicotine" ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={t(
									freeMore
										? "intake:free.fewerDetails"
										: "intake:free.moreDetails",
								)}
								accessibilityState={{ expanded: freeMore, disabled: busy }}
								disabled={busy}
								onPress={() => setFreeMore((current) => !current)}
								style={styles.moreDetails}
							>
								<Icon
									name={freeMore ? "chevron-down" : "add"}
									size={16}
									color={theme.colors.brand}
								/>
								<AppText
									variant="caption"
									style={{ color: theme.colors.brand }}
								>
									{t(
										freeMore
											? "intake:free.fewerDetails"
											: "intake:free.moreDetails",
									)}
								</AppText>
							</Pressable>
						) : null}
						<AppText variant="caption" color="muted">
							{t("intake:free.detailsHint")}
						</AppText>
					</View>
					<IntakeWhenFields
						localDay={localDay}
						time={time}
						today={snapshot.today}
						disabled={busy}
						onChangeDay={(day) => {
							setLocalDay(day);
							setWhenMode("earlier");
						}}
						onChangeTime={(value) => {
							setTime(value);
							setWhenMode("earlier");
						}}
					/>

					{error ? (
						<AppText accessibilityRole="alert" color="danger">
							{error}
						</AppText>
					) : null}
				</View>
			</IntakeFormSheet>

			<IntakeFormSheet
				visible={pick !== null}
				onClose={() => {
					if (!busy) setPick(null);
				}}
				busy={busy}
				title={t("intake:log.addEntry")}
				footer={
					<View style={styles.actions}>
						<Button
							label={t("intake:log.save")}
							loading={busy}
							disabled={!pickValid || compositionError !== null}
							onPress={() => void savePick()}
						/>
						<Button
							label={t("intake:log.cancel")}
							variant="secondary"
							disabled={busy}
							onPress={() => setPick(null)}
						/>
					</View>
				}
			>
				{pick ? (
					<View style={styles.sheet}>
						<View>
							<AppText variant="largeTitle">{pickName}</AppText>
							{pickBrand ? (
								<AppText variant="caption" color="muted">
									{pickBrand}
								</AppText>
							) : null}
							{pick.type === "composition" && pick.provenance ? (
								<AppText variant="footnote" color="subtle">
									{pick.provenance}
								</AppText>
							) : null}
						</View>
						<IntakeArtwork
							hero
							name={pickName}
							brand={pickBrand}
							kind={
								pick.type === "recent" ? pick.presented.event.kind : pick.kind
							}
							sourceRef={
								pick.type === "recent"
									? pick.presented.event.sourceRef
									: pick.source.type === "system"
										? pick.source.key
										: pick.source.type === "external"
											? pick.source.consumable.ref
											: pick.artworkRef
							}
						/>
						<AppText variant="caption" color="muted" style={styles.sourceBadge}>
							{t(
								pick.type === "recent"
									? "intake:log.recordedItem"
									: pick.source.type === "system"
										? "intake:log.broItem"
										: "intake:log.savedItem",
							)}
						</AppText>
						<IntakeQuantityField
							label={t("intake:log.amount")}
							value={byAmount ? amount : (customQuantity ?? String(quantity))}
							onChange={byAmount ? setAmount : setCustomQuantity}
							unit={byAmount ? (amountUnit ?? "") : portionWord}
							step={
								byAmount
									? amountUnit === "ml"
										? 25
										: 10
									: (pick.type === "recent"
												? pick.presented.event.kind
												: pick.kind) === "nicotine"
										? 1
										: 0.5
							}
							disabled={busy}
							options={
								pickComposition &&
								(pickComposition.portions.length > 1 || amountUnit)
									? [
											...pickComposition.portions.map((portion) => ({
												id: portion.id,
												label: portion.label,
												selected: !byAmount && portionId === portion.id,
												onSelect: () => selectPortion(portion.id),
											})),
											...(amountUnit
												? [
														{
															id: "amount",
															label: amountUnit,
															accessibilityLabel: t("intake:log.useUnit", {
																unit: amountUnit,
															}),
															selected: byAmount,
															onSelect: selectAmount,
														},
													]
												: []),
										]
									: undefined
							}
						/>

						<AppText variant="caption" color="muted">
							{t("intake:log.amountHint")}
						</AppText>

						<IntakeWhenFields
							localDay={localDay}
							time={time}
							today={snapshot.today}
							disabled={busy}
							onChangeDay={(day) => {
								setLocalDay(day);
								setWhenMode("earlier");
							}}
							onChangeTime={(value) => {
								setTime(value);
								setWhenMode("earlier");
							}}
						/>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={t("intake:log.nutritionDetails")}
							accessibilityState={{ expanded: nutritionOpen, disabled: busy }}
							disabled={busy}
							onPress={() => setNutritionOpen((current) => !current)}
							style={styles.detailRow}
						>
							<AppText style={styles.grow}>
								{t("intake:log.nutritionDetails")}
							</AppText>
							<Icon
								name={nutritionOpen ? "chevron-down" : "chevron-right"}
								size={20}
								color={theme.colors.ink2}
							/>
						</Pressable>
						{compositionError ? (
							<AppText color="danger" accessibilityRole="alert">
								{compositionError}
							</AppText>
						) : null}
						{nutritionOpen && pickValid ? (
							<View style={styles.section}>
								<AppText variant="caption" color="muted">
									{t("intake:log.forAmount")}
								</AppText>
								{Object.keys(pickNutrition).length ? (
									Object.entries(pickNutrition).map(([field, value]) => (
										<IntakeRow
											key={field}
											title={t(
												`intake:free.${NUTRITION_LABELS[field as keyof LabelInputs]}`,
											)}
											value={value}
										/>
									))
								) : (
									<AppText color="muted">
										{t("intake:log.nutritionUnknown")}
									</AppText>
								)}
							</View>
						) : null}
						{error ? (
							<AppText accessibilityRole="alert" color="danger">
								{error}
							</AppText>
						) : null}
					</View>
				) : null}
			</IntakeFormSheet>

			<LogConfirmationToast
				message={
					confirmation
						? t("intake:log.added", { name: confirmation.name })
						: null
				}
				secondaryActionLabel={
					confirmation?.id && intake.deleteEvent
						? t("common:actions.undo")
						: undefined
				}
				onSecondaryAction={async () => {
					if (!confirmation?.id || !intake.deleteEvent || submitting.current)
						return;
					submitting.current = true;
					setBusy(true);
					try {
						await intake.deleteEvent(confirmation.id);
						setConfirmation(null);
						setSnapshot(await intake.loadLog(initialLocalDay));
					} catch (caught) {
						setError(toMessage(caught));
					} finally {
						submitting.current = false;
						setBusy(false);
					}
				}}
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

const styles = StyleSheet.create((theme) => ({
	section: { gap: theme.spacing.md },
	footer: {
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.md,
		paddingBottom: theme.spacing.md,
		gap: theme.spacing.sm,
		backgroundColor: theme.colors.background,
	},
	sheet: { gap: theme.spacing.lg },
	sourceBadge: {
		alignSelf: "center",
		textAlign: "center",
		paddingHorizontal: theme.spacing.xl,
		paddingVertical: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface,
	},
	typeOptions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: theme.spacing.xs,
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.pill,
	},
	typeOption: {
		flexGrow: 1,
		borderWidth: 0,
		minWidth: "40%",
	},
	nutritionSection: { gap: theme.spacing.sm },
	nutritionField: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		borderWidth: 1,
		borderColor: theme.colors.line,
		borderRadius: theme.radius.control,
		padding: theme.spacing.sm,
	},
	nutritionInput: { flex: 1, minWidth: 0 },
	nutritionUnit: { width: 32 },
	moreDetails: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.xs,
		minHeight: theme.control.minHitArea,
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		minHeight: theme.control.buttonMinHeight,
		paddingVertical: theme.spacing.md,
		borderTopWidth: 1,
		borderBottomWidth: 1,
		borderColor: theme.colors.line,
	},
	centered: { textAlign: "center" },
	actions: { flexDirection: "column", gap: theme.spacing.sm },
	filter: {
		borderWidth: 0,
		minHeight: theme.control.minHitArea,
	},
	clearSearch: {
		minWidth: theme.control.minHitArea,
		minHeight: theme.control.minHitArea,
		alignItems: "center",
		justifyContent: "center",
	},
	recentRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.card,
		width: "100%",
	},
	recentCopy: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		padding: theme.spacing.sm,
		gap: theme.spacing.md,
		minHeight: theme.control.minHitArea,
	},
	repeatButton: {
		minWidth: theme.control.minHitArea,
		minHeight: theme.control.minHitArea,
		alignItems: "center",
		justifyContent: "center",
		marginRight: theme.spacing.sm,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.surface3,
	},
	row: { flexDirection: "row", gap: theme.spacing.md },
	wrap: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	grow: { flex: 1 },
	headerSearch: {
		flexDirection: "row",
		alignItems: "center",
		gap: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
		minHeight: theme.control.minHitArea,
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface,
	},
	headerSearchInput: {
		flex: 1,
		...theme.typography.body,
		color: theme.colors.ink,
		paddingVertical: 0,
	},
}));
