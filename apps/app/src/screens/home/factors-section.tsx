import type { TagCategory } from "@bro/domain/metric-registry";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View } from "react-native";
import type { TodayCheckIn } from "../../check-in/check-in-store";
import { TAG_CATEGORY_KEYS } from "../../check-in/tag-categories";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FactorChip } from "../../components/factor-chip";
import { Icon } from "../../components/icon";
import { SectionHeader } from "../../components/section-header";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** Groups shown before the user asks for the rest, and how many of each. */
const PRIMARY_GROUPS: readonly TagCategory[] = ["body", "lifestyle", "mind"];
const PRIMARY_GROUP_SIZE = 3;

type FactorsSectionProps = {
	availableTags: TodayCheckIn["availableTags"];
	selectedTags: readonly string[];
	reviewing: boolean;
	onToggleTag: (slug: string) => void;
	onConfirm: () => void;
};

/** The day's factors. Selected chips always stay visible, whatever is collapsed. */
export function FactorsSection({
	availableTags,
	selectedTags,
	reviewing,
	onToggleTag,
	onConfirm,
}: FactorsSectionProps) {
	const { t } = useTranslation(["home", "checkIn"]);
	const { theme } = useUnistyles();
	const [allFactors, setAllFactors] = useState(false);

	if (availableTags.length === 0) return null;

	const groupedTags = Object.entries(TAG_CATEGORY_KEYS).map(
		([category, key]) => ({
			category: category as TagCategory,
			label: t(`checkIn:${key}` as const),
			tags: availableTags.filter((tag) => tag.category === category),
		}),
	);
	const hasMoreFactors = groupedTags.some((group) =>
		group.tags.some(
			(tag, index) =>
				!selectedTags.includes(tag.slug) &&
				(index >= PRIMARY_GROUP_SIZE ||
					!PRIMARY_GROUPS.includes(group.category)),
		),
	);

	return (
		<View style={styles.section}>
			<View style={styles.heading}>
				<SectionHeader title={t("tags.title")} />
				<AppText variant="caption" color="muted">
					{t("tags.hint")}
				</AppText>
			</View>
			{groupedTags.map(({ category, label, tags }) =>
				tags.length > 0 &&
				(allFactors ||
					PRIMARY_GROUPS.includes(category) ||
					tags.some((tag) => selectedTags.includes(tag.slug))) ? (
					<View key={category} style={styles.group}>
						<AppText variant="caption" color="subtle">
							{label}
						</AppText>
						<View style={styles.row}>
							{tags
								.filter(
									(tag, index) =>
										allFactors ||
										(index < PRIMARY_GROUP_SIZE &&
											PRIMARY_GROUPS.includes(category)) ||
										selectedTags.includes(tag.slug),
								)
								.map((tag) => (
									<FactorChip
										key={tag.slug}
										label={tag.label}
										selected={selectedTags.includes(tag.slug)}
										disabled={reviewing}
										onPress={() => onToggleTag(tag.slug)}
									/>
								))}
						</View>
					</View>
				) : null,
			)}
			{hasMoreFactors ? (
				<TouchableOpacity
					accessibilityRole="button"
					accessibilityLabel={t(allFactors ? "tags.fewer" : "tags.more")}
					accessibilityState={{ expanded: allFactors }}
					aria-expanded={allFactors}
					style={styles.more}
					onPress={() => setAllFactors(!allFactors)}
				>
					<AppText variant="label" color="brand">
						{t(allFactors ? "tags.fewer" : "tags.more")}
					</AppText>
					<Icon
						name={allFactors ? "chevron-down" : "chevron-right"}
						size={16}
						color={theme.colors.brand}
					/>
				</TouchableOpacity>
			) : null}
			{allFactors || !hasMoreFactors ? (
				<>
					<AppText variant="caption" color="muted">
						{t("tags.reviewHint")}
					</AppText>
					<Button
						label={t("tags.confirm")}
						loading={reviewing}
						variant="text"
						onPress={onConfirm}
					/>
				</>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	section: { marginBottom: theme.spacing.xl, gap: theme.spacing.md },
	heading: { gap: theme.spacing.xs },
	group: { gap: theme.spacing.xs },
	row: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
	more: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: theme.spacing.xs,
		minHeight: theme.control.minHitArea,
	},
}));
