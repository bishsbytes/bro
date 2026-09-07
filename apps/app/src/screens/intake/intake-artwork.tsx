import type { ConsumableKind } from "@bro/domain/consumable";
import { Image, type ImageSourcePropType, View } from "react-native";
import { Icon } from "../../components/icon";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

const artwork: Record<string, ImageSourcePropType> = {
	water: require("../../../assets/intake/water.png"),
	"filter coffee": require("../../../assets/intake/filter-coffee.png"),
	"drink:water": require("../../../assets/intake/water.png"),
	"drink:filter-coffee": require("../../../assets/intake/filter-coffee.png"),
	"flat white": require("../../../assets/intake/flat-white.png"),
	"eggs on toast": require("../../../assets/intake/eggs-on-toast.png"),
	porridge: require("../../../assets/intake/porridge.png"),
};

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
			? artwork[key]
			: !brand && (kind === "food" || kind === "drink")
				? artwork[name.trim().toLowerCase()]
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
