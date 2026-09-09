import type { ConsumableKind } from "@bro/domain/consumable";
import type { DrinkCatalogueEntry } from "@bro/domain/drink-catalogue";
import type { FoodCatalogueEntry } from "@bro/domain/food-catalogue";
import { Image, type ImageSourcePropType, View } from "react-native";
import { Icon } from "../../components/icon";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

/** ImageSourcePropType also accepts `{ uri }`, so this manifest can move to a CDN. */
const systemArtwork = {
	"drink:lager-4_5": require("../../../assets/intake/lager.png"),
	"drink:cider-4_5": require("../../../assets/intake/cider.png"),
	"drink:wine-red-13": require("../../../assets/intake/red-wine.png"),
	"drink:wine-white-12": require("../../../assets/intake/white-wine.png"),
	"drink:spirit-40": require("../../../assets/intake/spirit.png"),
	"drink:water": require("../../../assets/intake/water.png"),
	"drink:filter-coffee": require("../../../assets/intake/filter-coffee.png"),
	"drink:tea": require("../../../assets/intake/tea.png"),
	"drink:espresso": require("../../../assets/intake/espresso.png"),
	"drink:energy-drink": require("../../../assets/intake/energy-drink.png"),
	"drink:cola": require("../../../assets/intake/cola.png"),
	"food:eggs-on-toast": require("../../../assets/intake/eggs-on-toast.png"),
	"food:porridge": require("../../../assets/intake/porridge.png"),
} satisfies Record<
	DrinkCatalogueEntry["key"] | FoodCatalogueEntry["key"],
	ImageSourcePropType
>;

const namedArtwork: Record<string, ImageSourcePropType> = {
	water: require("../../../assets/intake/water.png"),
	"filter coffee": require("../../../assets/intake/filter-coffee.png"),
	"flat white": require("../../../assets/intake/flat-white.png"),
	"eggs on toast": require("../../../assets/intake/eggs-on-toast.png"),
	porridge: require("../../../assets/intake/porridge.png"),
};

function systemArtworkFor(key: string): ImageSourcePropType | undefined {
	return key in systemArtwork
		? systemArtwork[key as keyof typeof systemArtwork]
		: undefined;
}

/** Artwork is decorative. It never supplies a portion or nutrition value. */
export function IntakeArtwork({
	name,
	kind,
	sourceRef,
	brand,
	hero = false,
}: {
	name: string;
	kind?: ConsumableKind;
	sourceRef?: string | null;
	brand?: string | null;
	hero?: boolean;
}) {
	const { theme } = useUnistyles();
	const key = sourceRef?.startsWith("system:")
		? sourceRef.slice("system:".length)
		: sourceRef;
	// Only exact names of the illustrated dishes get food art. Unrecognised
	// and branded/provider items keep a neutral fallback, not a guessed photo.
	const source =
		key && !key.startsWith("library:")
			? systemArtworkFor(key)
			: !brand && (kind === "food" || kind === "drink")
				? namedArtwork[name.trim().toLowerCase()]
				: undefined;
	return (
		<View
			accessible={false}
			importantForAccessibility="no-hide-descendants"
			style={[styles.thumbnail, hero && styles.hero]}
		>
			{source ? (
				<Image source={source} resizeMode="contain" style={styles.image} />
			) : (
				<Icon
					name={kind === "drink" ? "drink" : kind === "food" ? "food" : "list"}
					size={hero ? 48 : 24}
					color={theme.colors.ink2}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	thumbnail: {
		width: 64,
		height: 64,
		flexShrink: 0,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: theme.radius.control,
		backgroundColor: theme.colors.surface,
	},
	hero: {
		width: 176,
		height: 176,
		alignSelf: "center",
		backgroundColor: "transparent",
	},
	image: { width: "100%", height: "100%" },
}));
