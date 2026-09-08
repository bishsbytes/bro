import type { Consumable } from "@bro/database-app";
import { localTimeOf } from "@bro/domain";
import type { ConsumableKind } from "@bro/domain/consumable";
import type { ExternalConsumable } from "@bro/domain/food-search";
import {
	type PortionSelection,
	scaleComposition,
	scaleConstituents,
} from "@bro/logic";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/empty-state";
import { LogConfirmationToast } from "../../components/log-confirmation-toast";
import { LoadingScreen, Screen } from "../../components/screen";
import {
	compositionFromLabelInputs,
	type LabelInputs,
	labelInputsFromComposition,
} from "../../intake/free-entry";
import {
	createIntakeSearchStore,
	type IntakeSearchSnapshot,
	type IntakeSearchStore,
} from "../../intake/intake-search-store";
import {
	createIntakeStore,
	type IntakeStore,
	type PresentedIntakeEvent,
} from "../../intake/intake-store";
import { toMessage } from "../../lib/errors";
import { useFocusStoreLoad } from "../../lib/use-store-load";
import { showLoggedIntakeDay } from "../../navigation/intake-flow";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";
import { IntakeBrowse } from "./intake-browse";
import {
	EMPTY_FREE_ENTRY,
	type FreeEntryDraft,
	IntakeFreeEntrySheet,
} from "./intake-free-entry-sheet";
import { isPositiveNumber, PORTION_SUGGESTIONS } from "./intake-nutrition";
import type { IntakePick } from "./intake-pick";
import { IntakePickSheet } from "./intake-pick-sheet";
import type { IntakeQuantityOption } from "./intake-quantity-field";

type IntakeLogScreenProps = {
	initialKind?: ConsumableKind;
	/** Log against this day rather than today; the sheet opens on Earlier. */
	initialLocalDay?: string;
	store?: Pick<IntakeStore, "loadLog" | "log" | "logFree" | "repeatEvent"> &
		Partial<Pick<IntakeStore, "deleteEvent">>;
	searchStore?: Pick<IntakeSearchStore, "loadCached" | "search">;
};

type WhenMode = "now" | "earlier";

const SEARCH_DEBOUNCE_MS = 300;

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
	const [pick, setPick] = useState<IntakePick | null>(null);
	const [portionId, setPortionId] = useState<string | null>(null);
	const [amount, setAmount] = useState("");
	const [amountMode, setAmountMode] = useState(false);
	const [quantity, setQuantity] = useState(1);
	const [customQuantity, setCustomQuantity] = useState<string | null>(null);
	const [whenMode, setWhenMode] = useState<WhenMode>("now");
	const [localDay, setLocalDay] = useState("");
	const [time, setTime] = useState("");
	const [freeOpen, setFreeOpen] = useState(false);
	const [nutritionOpen, setNutritionOpen] = useState(false);
	const [free, setFree] = useState<FreeEntryDraft>({
		kind: initialKind ?? "food",
		...EMPTY_FREE_ENTRY,
	});
	const changeFree = useCallback(
		(patch: Partial<FreeEntryDraft>) =>
			setFree((current) => ({ ...current, ...patch })),
		[],
	);
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

	function open(next: IntakePick) {
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
			const { constituents, volumeL } = compositionFromLabelInputs(free.inputs);
			const logged = await intake.logFree({
				kind: free.kind,
				name: free.name,
				portionLabel: free.portion.trim() || null,
				quantity: Number(free.quantity),
				volumeL,
				constituents,
				context: null,
				...when,
			});
			return { name: free.name, localDay: when.localDay, id: logged?.id };
		});
		if (saved) {
			setFreeOpen(false);
			setFree((current) => ({ kind: current.kind, ...EMPTY_FREE_ENTRY }));
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
		...PORTION_SUGGESTIONS[free.kind].map((portion) =>
			t(`intake:free.portions.${portion}`),
		),
		...snapshot.recents
			.filter(({ event }) => event.kind === free.kind)
			.map(({ event }) => event.portionLabel ?? ""),
		...snapshot.library
			.filter((item) => item.kind === free.kind)
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

	const amountOptions: IntakeQuantityOption[] | undefined =
		pickComposition && (pickComposition.portions.length > 1 || amountUnit)
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
			: undefined;
	const pickKind =
		pick === null
			? null
			: pick.type === "recent"
				? pick.presented.event.kind
				: pick.kind;
	const amountStep = byAmount
		? amountUnit === "ml"
			? 25
			: 10
		: pickKind === "nicotine"
			? 1
			: 0.5;

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
				<IntakeBrowse
					query={query}
					onQueryChange={setQuery}
					normalizedQuery={normalizedQuery}
					kind={kind}
					enabledKinds={snapshot.enabledKinds}
					onKindChange={setKind}
					whenLabel={whenMode === "earlier" ? `${localDay} · ${time}` : null}
					error={error}
					busy={busy}
					recents={recents}
					library={library}
					catalogue={catalogue}
					results={results}
					searchBusy={searchBusy}
					searchSnapshot={searchSnapshot}
					onRepeatRecent={(presented) => void repeat(presented)}
					onEditRecent={(presented) => open({ type: "recent", presented })}
					onOpenLibrary={openLibrary}
					onOpenCatalogue={(consumable) =>
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
					onOpenExternal={openExternal}
				/>
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
							if (!free.name.trim()) changeFree({ kind: kind ?? "food" });
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

			<IntakeFreeEntrySheet
				visible={freeOpen}
				busy={busy}
				error={error}
				draft={free}
				onChange={changeFree}
				enabledKinds={snapshot.enabledKinds}
				portionSuggestions={freePortionSuggestions}
				today={snapshot.today}
				localDay={localDay}
				time={time}
				whenValid={whenValid}
				onChangeDay={(day) => {
					setLocalDay(day);
					setWhenMode("earlier");
				}}
				onChangeTime={(value) => {
					setTime(value);
					setWhenMode("earlier");
				}}
				onClose={() => {
					if (!busy) setFreeOpen(false);
				}}
				onSave={() => void saveFree()}
			/>

			<IntakePickSheet
				pick={pick}
				busy={busy}
				error={error}
				compositionError={compositionError}
				valid={pickValid}
				amount={{
					value: byAmount ? amount : (customQuantity ?? String(quantity)),
					onChange: byAmount ? setAmount : setCustomQuantity,
					unit: byAmount ? (amountUnit ?? "") : portionWord,
					step: amountStep,
					options: amountOptions,
				}}
				nutrition={pickNutrition}
				nutritionOpen={nutritionOpen}
				onToggleNutrition={() => setNutritionOpen((current) => !current)}
				today={snapshot.today}
				localDay={localDay}
				time={time}
				onChangeDay={(day) => {
					setLocalDay(day);
					setWhenMode("earlier");
				}}
				onChangeTime={(value) => {
					setTime(value);
					setWhenMode("earlier");
				}}
				onClose={() => {
					if (!busy) setPick(null);
				}}
				onSave={() => void savePick()}
			/>

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
	footer: {
		paddingHorizontal: theme.spacing.gutter,
		paddingTop: theme.spacing.md,
		paddingBottom: theme.spacing.md,
		gap: theme.spacing.sm,
		backgroundColor: theme.colors.background,
	},
	centered: { textAlign: "center" },
}));
