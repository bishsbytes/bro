import {
	type ComponentProps,
	type ComponentType,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { type NativeSyntheticEvent, Pressable, View } from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";
import { type EndLabels, ScaleEndLabels } from "./scale-end-labels";

/**
 * How a score arrived. A pointer names one stop outright, so the caller can
 * treat it as the whole answer; an adjustment steps through neighbours on the
 * way somewhere, so the caller has to leave room for the next step.
 */
export type ScaleInput = "pointer" | "adjust";

type DiscreteScaleProps = {
	/** Names the measured thing, as in "Work & career". */
	accessibilityPrefix: string;
	scores: readonly number[];
	selected: number | null;
	onSelect: (score: number, input: ScaleInput) => void;
	endLabels: EndLabels;
	disabled?: boolean;
};

type KeyEvent = NativeSyntheticEvent<Readonly<{ key: string }>>;

/**
 * A press, a touch drag, or a mouse drag. A keyboard press reaches the same
 * handlers from a bare DOM listener, so `nativeEvent` is genuinely absent
 * there rather than merely empty.
 */
type PointerEvent = Readonly<{
	nativeEvent?: Readonly<{ locationX?: number; offsetX?: number }>;
}>;

// React Native Web forwards keyboard and mouse events, but the stable Pressable
// type does not expose the newer cross-platform key props yet.
const KeyboardPressable = Pressable as ComponentType<
	ComponentProps<typeof Pressable> & {
		onKeyDown?: (event: KeyEvent) => void;
		onMouseMove?: (event: PointerEvent) => void;
	}
>;

/**
 * Where along the control a press landed, or null when it did not come from a
 * pointer at all. React Native Web sends a MouseEvent to onPress and native
 * sends touch data, but Enter arrives from a document-level keyup listener
 * carrying no coordinates to aim with.
 */
function pointerPosition(event: PointerEvent): number | null {
	const { locationX, offsetX } = event.nativeEvent ?? {};
	if (Number.isFinite(locationX)) return locationX ?? null;
	return Number.isFinite(offsetX) ? (offsetX ?? null) : null;
}

/**
 * A compact, adjustable rail for scales too long to remain thumb-sized as
 * individual buttons. The visual stops are one control, so ten values do not
 * become ten narrow touch targets.
 */
export function DiscreteScale({
	accessibilityPrefix,
	scores,
	selected,
	onSelect,
	endLabels,
	disabled = false,
}: DiscreteScaleProps) {
	const { t } = useTranslation("common");
	// The stops sit inside the control's padding and border, so the rail they
	// span is narrower than the pressable and starts a few pixels in. Mapping a
	// touch against the pressable instead would put every boundary off centre.
	const [track, setTrack] = useState({ left: 0, width: 0 });
	const trackRef = useRef(track);
	const [preview, setPreview] = useState<number | null>(null);
	const dragging = useRef(false);
	const [focused, setFocused] = useState(false);
	const shownSelection = preview ?? selected;
	const minimum = scores[0];
	const maximum = scores.at(-1);
	const edgeInset = track.width / (scores.length * 2);

	if (minimum === undefined || maximum === undefined) {
		return null;
	}

	function scoreAt(position: number): number | null {
		const { left, width } = trackRef.current;
		if (width <= 0) return null;
		const bounded = Math.max(0, Math.min(position - left, width));
		const index = Math.min(
			scores.length - 1,
			Math.floor((bounded / width) * scores.length),
		);
		return scores[index] ?? null;
	}

	function trackPointer(event: PointerEvent) {
		if (!dragging.current) return;
		const position = pointerPosition(event);
		if (position !== null) setPreview(scoreAt(position));
	}

	/**
	 * One step along the scale, the way a slider's own increment behaves: the
	 * score is reported, but as an adjustment, so a screen reader or arrow key
	 * can walk past it to the value it was actually aiming for.
	 */
	function adjust(direction: -1 | 1) {
		const at = selected === null ? -1 : scores.indexOf(selected);
		const from = at === -1 ? (direction === 1 ? -1 : scores.length) : at;
		const nextIndex = Math.max(
			0,
			Math.min(scores.length - 1, from + direction),
		);
		const next = scores[nextIndex];
		if (next !== undefined && next !== selected) onSelect(next, "adjust");
	}

	return (
		<View style={styles.container}>
			<KeyboardPressable
				accessibilityRole="adjustable"
				accessibilityLabel={t("a11y.scale", {
					prefix: accessibilityPrefix,
				})}
				accessibilityState={{ disabled }}
				accessibilityValue={{
					min: minimum,
					max: maximum,
					...(selected === null ? {} : { now: selected }),
				}}
				accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
				disabled={disabled}
				focusable={!disabled}
				style={[
					styles.scale,
					focused && styles.focused,
					disabled && styles.disabled,
				]}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onPressIn={(event) => {
					const position = pointerPosition(event);
					// Enter and a screen reader's activate arrive without coordinates,
					// and have nothing to aim at; only a real pointer starts a drag.
					if (position === null) return;
					dragging.current = true;
					setPreview(scoreAt(position));
				}}
				onTouchMove={trackPointer}
				onMouseMove={trackPointer}
				onPressOut={() => {
					dragging.current = false;
					setPreview(null);
				}}
				onPress={(event) => {
					const position = pointerPosition(event);
					// Enter names no stop, so it settles on the one the arrows have
					// already walked to — the keyboard's equivalent of lifting a
					// finger, and the only press that can arrive without a pointer.
					if (position === null) {
						if (selected !== null) onSelect(selected, "pointer");
						return;
					}
					const score = scoreAt(position);
					if (score !== null) onSelect(score, "pointer");
				}}
				onAccessibilityAction={(event) => {
					if (event.nativeEvent.actionName === "increment") adjust(1);
					if (event.nativeEvent.actionName === "decrement") adjust(-1);
				}}
				onKeyDown={(event) => {
					const key = event.nativeEvent.key;
					if (key === "ArrowRight" || key === "ArrowUp") {
						event.preventDefault();
						adjust(1);
					}
					if (key === "ArrowLeft" || key === "ArrowDown") {
						event.preventDefault();
						adjust(-1);
					}
					if (key === "Home") {
						event.preventDefault();
						onSelect(minimum, "adjust");
					}
					if (key === "End") {
						event.preventDefault();
						onSelect(maximum, "adjust");
					}
				}}
			>
				<View
					accessible={false}
					aria-hidden
					importantForAccessibility="no-hide-descendants"
					pointerEvents="none"
					style={styles.points}
					testID="discrete-scale-points"
					onLayout={(event) => {
						const { x, width } = event.nativeEvent.layout;
						trackRef.current = { left: x, width };
						setTrack({ left: x, width });
					}}
				>
					<View style={[styles.rail, { left: edgeInset, right: edgeInset }]} />
					{scores.map((score) => {
						const isSelected = shownSelection === score;
						return (
							<View key={score} style={styles.point}>
								<View style={styles.tickSlot}>
									<View
										style={[styles.tick, isSelected && styles.selectedTick]}
									/>
								</View>
								<View
									style={[styles.value, isSelected && styles.selectedValue]}
								>
									<AppText
										variant="caption"
										color={isSelected ? "default" : "muted"}
									>
										{score}
									</AppText>
								</View>
							</View>
						);
					})}
				</View>
			</KeyboardPressable>
			<ScaleEndLabels {...endLabels} />
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { gap: theme.spacing.xs },
	scale: {
		minHeight: theme.spacing.huge,
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.lineStrong,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
		paddingHorizontal: theme.spacing.xs,
		paddingVertical: theme.spacing.sm,
	},
	focused: {
		outlineWidth: 2,
		outlineColor: theme.colors.accent,
		outlineOffset: 2,
		outlineStyle: "solid",
	},
	disabled: { opacity: theme.opacity.disabled },
	points: { flexDirection: "row", position: "relative" },
	rail: {
		position: "absolute",
		top: theme.spacing.sm,
		height: 1,
		backgroundColor: theme.colors.lineStrong,
	},
	point: { flex: 1, alignItems: "center", gap: theme.spacing.xs },
	tickSlot: {
		height: theme.spacing.lg,
		justifyContent: "center",
		backgroundColor: theme.colors.surface,
	},
	tick: {
		width: 1,
		height: theme.spacing.sm,
		backgroundColor: theme.colors.lineStrong,
	},
	selectedTick: {
		width: 2,
		height: theme.spacing.lg,
		backgroundColor: theme.colors.accent,
	},
	value: {
		minWidth: theme.spacing.xl,
		height: theme.spacing.xl,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.surface,
		borderRadius: theme.radius.xs,
	},
	selectedValue: {
		borderColor: theme.colors.accent,
		backgroundColor: theme.colors.accentTint,
	},
}));
