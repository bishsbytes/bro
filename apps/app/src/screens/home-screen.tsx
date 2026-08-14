import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { StyleSheet } from "react-native-unistyles";
import {
	type CheckInEntry,
	type CheckInStore,
	createCheckInStore,
	type TodayCheckIn,
} from "../check-in/check-in-store";
import { type FactorCategory, resolveMetric } from "../content/metric-registry";

type HomeScreenProps = {
	store?: Pick<CheckInStore, "loadToday" | "save">;
};

const SCORES = [1, 2, 3, 4, 5] as const;
const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;
const CATEGORY_LABELS: Record<FactorCategory, string> = {
	body: "Body",
	lifestyle: "Lifestyle",
	mind: "Mind",
	social: "Social",
};
const NAVIGATION_LINKS = [
	["History", "/history"],
	["Trends", "/trends"],
	["Settings", "/settings"],
] as const;

export function HomeScreen({ store }: HomeScreenProps) {
	const checkIns = useMemo(() => store ?? createCheckInStore(), [store]);
	const [today, setToday] = useState<TodayCheckIn | null>(null);
	const [mood, setMood] = useState<number | null>(null);
	const [energy, setEnergy] = useState<number | null>(null);
	const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
	const [note, setNote] = useState("");
	const [editing, setEditing] = useState<CheckInEntry | null>(null);
	const [formOpen, setFormOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const loaded = await checkIns.loadToday();
			setToday(loaded);
			setSelectedFactors(loaded.selectedFactorSlugs);
			setNote(loaded.note);
			setFormOpen(loaded.entries.length === 0);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		}
	}, [checkIns]);

	useEffect(() => {
		void load();
	}, [load]);

	function toggleFactor(slug: string) {
		setSelectedFactors((current) =>
			current.includes(slug)
				? current.filter((selected) => selected !== slug)
				: [...current, slug],
		);
	}

	function startAnother() {
		setMood(null);
		setEnergy(null);
		setEditing(null);
		setError(null);
		setFormOpen(true);
	}

	function startEditing(entry: CheckInEntry) {
		setMood(entry.mood.value);
		setEnergy(entry.energy.value);
		setEditing(entry);
		setError(null);
		setFormOpen(true);
	}

	async function save() {
		if (mood === null || energy === null || saving) {
			return;
		}

		setSaving(true);
		setError(null);
		try {
			const saved = await checkIns.save(
				{ mood, energy, selectedFactorSlugs: selectedFactors, note },
				editing,
			);
			setToday(saved);
			setSelectedFactors(saved.selectedFactorSlugs);
			setNote(saved.note);
			setMood(null);
			setEnergy(null);
			setEditing(null);
			setFormOpen(false);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setSaving(false);
		}
	}

	if (!today && !error) {
		return (
			<View style={styles.loading}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!today) {
		return (
			<View style={styles.loading}>
				<Text style={styles.errorTitle}>Today could not be loaded</Text>
				<Text style={styles.errorText}>{error}</Text>
				<TouchableOpacity style={styles.secondaryButton} onPress={load}>
					<Text style={styles.secondaryButtonText}>Try again</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const groupedFactors = Object.entries(CATEGORY_LABELS).map(
		([category, label]) => ({
			category: category as FactorCategory,
			label,
			factors: today.availableFactors.filter(
				(factor) => factor.category === category,
			),
		}),
	);
	const selectedFactorLabels = today.selectedFactorSlugs.map((slug) => {
		const resolved = resolveMetric(slug);
		return resolved.kind === "known" ? resolved.metric.label : slug;
	});

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.header}>
				<View>
					<Text style={styles.eyebrow}>TODAY</Text>
					<Text style={styles.title}>How are you?</Text>
				</View>
				<TouchableOpacity onPress={() => router.push("/account")}>
					<Text style={styles.headerLink}>Account</Text>
				</TouchableOpacity>
			</View>

			{today.entries.length > 0 ? (
				<View style={styles.section}>
					<View style={styles.sectionHeadingRow}>
						<Text style={styles.sectionTitle}>Logged today</Text>
						<Text style={styles.count}>
							{today.entries.length} check-in
							{today.entries.length === 1 ? "" : "s"}
						</Text>
					</View>
					{today.entries.map((entry) => (
						<View key={entry.id} style={styles.entryCard}>
							<View>
								<Text style={styles.entryValue}>
									Mood {entry.mood.value} · Energy {entry.energy.value}
								</Text>
								<Text style={styles.entryTime}>
									{new Date(entry.observedAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</Text>
							</View>
							<TouchableOpacity onPress={() => startEditing(entry)}>
								<Text style={styles.editLink}>Edit</Text>
							</TouchableOpacity>
						</View>
					))}
					{selectedFactorLabels.length > 0 ? (
						<Text style={styles.summaryText}>
							Factors: {selectedFactorLabels.join(", ")}
						</Text>
					) : null}
					{today.note ? (
						<Text style={styles.summaryText}>Note: {today.note}</Text>
					) : null}
					{!formOpen ? (
						<TouchableOpacity
							style={styles.secondaryButton}
							onPress={startAnother}
						>
							<Text style={styles.secondaryButtonText}>
								Add another check-in
							</Text>
						</TouchableOpacity>
					) : null}
				</View>
			) : null}

			{formOpen ? (
				<View style={styles.form}>
					<Text style={styles.sectionTitle}>
						{editing ? "Edit check-in" : "Check in"}
					</Text>

					<Text style={styles.prompt}>Mood</Text>
					<View style={styles.scoreRow}>
						{SCORES.map((score, index) => {
							const selected = mood === score;
							return (
								<TouchableOpacity
									key={score}
									accessibilityRole="button"
									accessibilityLabel={`Mood ${score}`}
									accessibilityState={{ selected }}
									style={[
										styles.scoreButton,
										selected && styles.choiceSelected,
									]}
									onPress={() => setMood(score)}
								>
									<Text style={styles.face}>{MOOD_FACES[index]}</Text>
									<Text
										style={[
											styles.scoreLabel,
											selected && styles.choiceSelectedText,
										]}
									>
										{score}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					<Text style={styles.prompt}>Energy</Text>
					<View style={styles.scoreRow}>
						{SCORES.map((score) => {
							const selected = energy === score;
							return (
								<TouchableOpacity
									key={score}
									accessibilityRole="button"
									accessibilityLabel={`Energy ${score}`}
									accessibilityState={{ selected }}
									style={[
										styles.scoreButton,
										selected && styles.choiceSelected,
									]}
									onPress={() => setEnergy(score)}
								>
									<Text
										style={[
											styles.energyValue,
											selected && styles.choiceSelectedText,
										]}
									>
										{score}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>

					<Text style={styles.prompt}>What applied today?</Text>
					{groupedFactors.map(({ category, label, factors }) =>
						factors.length > 0 ? (
							<View key={category} style={styles.factorGroup}>
								<Text style={styles.categoryLabel}>{label}</Text>
								<View style={styles.factorRow}>
									{factors.map((factor) => {
										const selected = selectedFactors.includes(factor.slug);
										return (
											<TouchableOpacity
												key={factor.slug}
												accessibilityRole="button"
												accessibilityLabel={factor.label}
												accessibilityState={{ selected }}
												style={[
													styles.factorButton,
													selected && styles.choiceSelected,
												]}
												onPress={() => toggleFactor(factor.slug)}
											>
												<Text
													style={[
														styles.factorText,
														selected && styles.choiceSelectedText,
													]}
												>
													{factor.label}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							</View>
						) : null,
					)}

					<Text style={styles.prompt}>Note (optional)</Text>
					<TextInput
						style={styles.noteInput}
						value={note}
						onChangeText={setNote}
						placeholder="Anything worth remembering?"
						placeholderTextColor={styles.notePlaceholder.color}
						multiline
					/>

					{error ? <Text style={styles.errorText}>{error}</Text> : null}
					<TouchableOpacity
						accessibilityRole="button"
						accessibilityState={{
							disabled: mood === null || energy === null || saving,
						}}
						style={[
							styles.saveButton,
							(mood === null || energy === null || saving) &&
								styles.buttonDisabled,
						]}
						disabled={mood === null || energy === null || saving}
						onPress={save}
					>
						<Text style={styles.saveButtonText}>
							{saving
								? "Saving…"
								: editing
									? "Update check-in"
									: "Save check-in"}
						</Text>
					</TouchableOpacity>
				</View>
			) : null}

			<View style={styles.navigation}>
				{NAVIGATION_LINKS.map(([label, path]) => (
					<TouchableOpacity key={path} onPress={() => router.push(path)}>
						<Text style={styles.navigationLink}>{label}</Text>
					</TouchableOpacity>
				))}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create((theme) => ({
	container: { flex: 1, backgroundColor: theme.colors.background },
	content: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xxl * 2 },
	loading: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: theme.spacing.xl,
		backgroundColor: theme.colors.background,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: theme.spacing.xl,
	},
	eyebrow: {
		fontSize: theme.typography.caption.fontSize,
		fontWeight: "600",
		color: theme.colors.brand,
		letterSpacing: theme.typography.eyebrow.letterSpacing,
	},
	title: {
		fontSize: theme.typography.title.fontSize,
		fontWeight: theme.typography.title.fontWeight,
		color: theme.colors.text,
	},
	headerLink: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
	},
	section: { marginBottom: theme.spacing.xl },
	sectionHeadingRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: theme.spacing.md,
	},
	sectionTitle: {
		fontSize: theme.typography.section.fontSize,
		lineHeight: theme.typography.section.lineHeight,
		fontWeight: theme.typography.section.fontWeight,
		color: theme.colors.text,
		marginBottom: theme.spacing.md,
	},
	count: {
		color: theme.colors.textSubtle,
		fontSize: theme.typography.caption.fontSize,
	},
	entryCard: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: theme.colors.surface,
		borderRadius: theme.radius.md,
		padding: theme.spacing.lg,
		marginBottom: theme.spacing.sm,
	},
	entryValue: {
		color: theme.colors.text,
		fontSize: theme.typography.label.fontSize,
	},
	entryTime: {
		color: theme.colors.textSubtle,
		fontSize: theme.typography.caption.fontSize,
	},
	editLink: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
	},
	summaryText: {
		color: theme.colors.textMuted,
		fontSize: theme.typography.caption.fontSize,
		marginTop: theme.spacing.xs,
	},
	form: { marginBottom: theme.spacing.xl },
	prompt: {
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
		color: theme.colors.text,
		marginTop: theme.spacing.lg,
		marginBottom: theme.spacing.sm,
	},
	scoreRow: { flexDirection: "row", gap: theme.spacing.sm },
	scoreButton: {
		flex: 1,
		minHeight: theme.control.scoreMinHeight,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
	},
	choiceSelected: {
		borderColor: theme.colors.brand,
		backgroundColor: theme.colors.selected,
	},
	choiceSelectedText: { color: theme.colors.onSelected },
	face: {
		fontSize: theme.typography.face.fontSize,
		lineHeight: theme.typography.face.lineHeight,
	},
	scoreLabel: {
		color: theme.colors.textSubtle,
		fontSize: theme.typography.micro.fontSize,
		lineHeight: theme.typography.micro.lineHeight,
	},
	energyValue: {
		color: theme.colors.text,
		fontSize: theme.typography.score.fontSize,
		lineHeight: theme.typography.score.lineHeight,
		fontWeight: theme.typography.score.fontWeight,
	},
	factorGroup: { marginBottom: theme.spacing.md },
	categoryLabel: {
		fontSize: theme.typography.caption.fontSize,
		color: theme.colors.textSubtle,
		marginBottom: theme.spacing.xs,
	},
	factorRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	factorButton: {
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		backgroundColor: theme.colors.surface,
		paddingVertical: theme.spacing.sm,
		paddingHorizontal: theme.spacing.md,
	},
	factorText: {
		color: theme.colors.textMuted,
		fontSize: theme.typography.caption.fontSize,
	},
	noteInput: {
		minHeight: theme.control.noteMinHeight,
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		color: theme.colors.text,
		backgroundColor: theme.colors.surface,
		textAlignVertical: "top",
		fontSize: theme.typography.label.fontSize,
	},
	notePlaceholder: { color: theme.colors.textSubtle },
	saveButton: {
		alignItems: "center",
		backgroundColor: theme.colors.brand,
		borderRadius: theme.radius.md,
		padding: theme.spacing.lg,
		marginTop: theme.spacing.lg,
	},
	buttonDisabled: { opacity: theme.opacity.disabled },
	saveButtonText: {
		color: theme.colors.onBrand,
		fontSize: theme.typography.label.fontSize,
		fontWeight: "600",
	},
	secondaryButton: {
		alignItems: "center",
		borderWidth: 1,
		borderColor: theme.colors.border,
		borderRadius: theme.radius.md,
		padding: theme.spacing.md,
		marginTop: theme.spacing.md,
	},
	secondaryButtonText: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
	},
	errorTitle: {
		color: theme.colors.text,
		fontSize: theme.typography.score.fontSize,
		lineHeight: theme.typography.score.lineHeight,
		fontWeight: theme.typography.score.fontWeight,
	},
	errorText: {
		color: theme.colors.danger,
		fontSize: theme.typography.caption.fontSize,
		marginTop: theme.spacing.sm,
	},
	navigation: {
		flexDirection: "row",
		justifyContent: "space-around",
		borderTopWidth: 1,
		borderTopColor: theme.colors.border,
		paddingTop: theme.spacing.lg,
	},
	navigationLink: {
		color: theme.colors.brand,
		fontSize: theme.typography.label.fontSize,
	},
}));
