import { shiftLocalDay } from "@bro/domain";
import { useTranslation } from "react-i18next";
import { Pressable, useWindowDimensions, View } from "react-native";
import { AppText } from "../../components/app-text";
import { StyleSheet } from "../../theme/unistyles";

/** Seven days ending on the displayed day; arrows retain access to older dates. */
export function IntakeDateStrip({
	selectedDay,
	loggedDays,
	disabled,
	onSelectDay,
}: {
	selectedDay: string;
	loggedDays: readonly string[];
	disabled: boolean;
	onSelectDay: (day: string) => void;
}) {
	const { t, i18n } = useTranslation("intake");
	const { width } = useWindowDimensions();
	const days = Array.from({ length: 7 }, (_, index) => {
		const day = shiftLocalDay(selectedDay, index - 6);
		const date = new Date(`${day}T12:00:00Z`);
		return {
			day,
			selected: day === selectedDay,
			logged: loggedDays.includes(day),
			number: date.getUTCDate(),
			weekday: new Intl.DateTimeFormat(i18n.language, {
				weekday: "short",
				timeZone: "UTC",
			}).format(date),
			label: new Intl.DateTimeFormat(i18n.language, {
				dateStyle: "full",
				timeZone: "UTC",
			}).format(date),
		};
	});
	return (
		<View style={styles.week}>
			{days.map(({ day, selected, logged, number, weekday, label }) => {
				return (
					<Pressable
						key={day}
						accessibilityRole="button"
						accessibilityLabel={
							logged ? t("tab.loggedDay", { date: label }) : label
						}
						accessibilityState={{ selected, disabled }}
						disabled={disabled}
						onPress={() => onSelectDay(day)}
						style={({ pressed }) => [
							styles.day,
							width < 416 && styles.compactDay,
							selected && styles.selected,
							pressed && styles.pressed,
						]}
					>
						<AppText variant="micro" style={selected && styles.selectedText}>
							{weekday}
						</AppText>
						<AppText variant="label" style={selected && styles.selectedText}>
							{number}
						</AppText>
						<View style={styles.indicatorSpace}>
							{logged ? (
								<View style={[styles.dot, selected && styles.selectedDot]} />
							) : null}
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	week: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
	day: {
		flex: 1,
		minWidth: theme.control.minHitArea,
		minHeight: 72,
		paddingVertical: theme.spacing.sm,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface,
	},
	compactDay: { flexBasis: "23%", flexGrow: 0 },
	selected: { backgroundColor: theme.colors.brand },
	selectedText: { color: theme.colors.onBrand },
	pressed: { opacity: theme.opacity.disabled },
	indicatorSpace: { height: 6, marginTop: theme.spacing.xs },
	dot: {
		width: 5,
		height: 5,
		borderRadius: theme.radius.pill,
		backgroundColor: theme.colors.brand,
	},
	selectedDot: { backgroundColor: theme.colors.onBrand },
}));
