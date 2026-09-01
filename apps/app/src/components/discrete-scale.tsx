import {
	type ComponentProps,
	type ComponentType,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
	type GestureResponderEvent,
	type NativeSyntheticEvent,
	Pressable,
	View,
} from "react-native";
import { StyleSheet } from "../theme/unistyles";
import { AppText } from "./app-text";

type DiscreteScaleProps = {
	/** Names the measured thing, as in "Work & career". */
	accessibilityPrefix: string;
	scores: readonly number[];
	selected: number | null;
	onSelect: (score: number) => void;
	endLabels: Readonly<{ minimum: string; maximum: string }>;
	disabled?: boolean;
};

type KeyEvent = NativeSyntheticEvent<Readonly<{ key: string }>>;

// React Native Web forwards keyboard events, but the stable Pressable type does
// not expose the newer cross-platform key props yet.
const KeyboardPressable = Pressable as ComponentType<
	ComponentProps<typeof Pressable> & {
		onKeyDown?: (event: KeyEvent) => void;
	}
>;

/** React Native Web sends a MouseEvent to onPress, while native sends touch data. */
function pointerPosition(event: GestureResponderEvent): number | null {
	const location = event.nativeEvent.locationX;
	if (Number.isFinite(location)) return location;

	const mouseEvent = event.nativeEvent as typeof event.nativeEvent & {
		offsetX?: number;
	};
	return Number.isFinite(mouseEvent.offsetX)
		? (mouseEvent.offsetX ?? null)
		: null;
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
	const [width, setWidth] = useState(0);
	const widthRef = useRef(0);
	const [preview, setPreview] = useState<number | null>(null);
	const [focused, setFocused] = useState(false);
	const shownSelection = preview ?? selected;
	const minimum = scores[0];
	const maximum = scores.at(-1);
	const edgeInset = width / (scores.length * 2);

	if (minimum === undefined || maximum === undefined) {
		return null;
	}

	function scoreAt(position: number): number | null {
		const measuredWidth = widthRef.current;
		if (measuredWidth <= 0) return null;
		const bounded = Math.max(0, Math.min(position, measuredWidth));
		const index = Math.min(
			scores.length - 1,
			Math.floor((bounded / measuredWidth) * scores.length),
		);
		return scores[index] ?? null;
	}

	function adjust(direction: -1 | 1) {
		const currentIndex =
			selected === null
				? direction === 1
					? -1
					: scores.length
				: scores.indexOf(selected);
		const nextIndex = Math.max(
			0,
			Math.min(scores.length - 1, currentIndex + direction),
		);
		const next = scores[nextIndex];
		if (next !== undefined && next !== selected) onSelect(next);
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
				onLayout={(event) => {
					widthRef.current = event.nativeEvent.layout.width;
					setWidth(event.nativeEvent.layout.width);
				}}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onPressIn={(event) => {
					const position = pointerPosition(event);
					setPreview(position === null ? null : scoreAt(position));
				}}
				onTouchMove={(event) => {
					const position = pointerPosition(event);
					setPreview(position === null ? null : scoreAt(position));
				}}
				onPressOut={() => setPreview(null)}
				onPress={(event) => {
					const position = pointerPosition(event);
					const score = position === null ? null : scoreAt(position);
					if (score !== null) onSelect(score);
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
						onSelect(minimum);
					}
					if (key === "End") {
						event.preventDefault();
						onSelect(maximum);
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
			<View style={styles.endLabels}>
				<AppText variant="micro" color="subtle">
					{endLabels.minimum}
				</AppText>
				<AppText variant="micro" color="subtle">
					{endLabels.maximum}
				</AppText>
			</View>
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
	endLabels: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
}));
