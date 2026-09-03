import type { TapeSiteSlug } from "@bro/domain/metric-registry";
import {
	BlurMask,
	Canvas,
	Circle,
	DashPathEffect,
	Group,
	Line,
	Path,
	vec,
} from "@shopify/react-native-skia";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/app-text";
import { StyleSheet, useUnistyles } from "../../theme/unistyles";

export type TapeFigureSite = {
	slug: TapeSiteSlug;
	label: string;
	accessibilityLabel: string;
};

type TapeFigureProps = {
	sites: readonly TapeFigureSite[];
	selectedSlug: string | null;
	onSelect: (slug: TapeSiteSlug) => void;
};

const VIEW_WIDTH = 380;
const VIEW_HEIGHT = 520;
/**
 * Sized so the block and both label columns still fit inside a padded screen on
 * the narrowest phone we support, since the overlay's tap rows are positioned in
 * figure coordinates and cannot reflow.
 */
const FIGURE_HEIGHT = 370;
const SCALE = FIGURE_HEIGHT / VIEW_HEIGHT;
const ROW_HEIGHT = 44;

/** Where the label column starts on each side, in figure coordinates. */
const RIGHT_COLUMN = 240;
const RIGHT_LABEL = 282;
const LEFT_COLUMN = 150;
const LEFT_LABEL = 80;

function px(units: number): number {
	return units * SCALE;
}

/**
 * The pattern block a tailor works from: one fixed figure, the same for every
 * user. It is chart paper, so it draws in the grid's own hairline and never
 * takes its shape, size, or fill from anybody's numbers.
 */
const SITE_GEOMETRY = {
	neck: { y: 86, tape: [166, 214], leader: [216, 276], side: "right" },
	chest: { y: 150, tape: [146, 234], leader: [236, 276], side: "right" },
	bicep: { y: 178, tape: [102, 130], leader: [100, 86], side: "left" },
	waist: { y: 205, tape: [158, 222], leader: [224, 276], side: "right" },
	hip: { y: 262, tape: [150, 230], leader: [232, 276], side: "right" },
	thigh: { y: 345, tape: [156, 186], leader: [154, 86], side: "left" },
} as const satisfies Record<
	TapeSiteSlug,
	{
		y: number;
		tape: readonly [number, number];
		leader: readonly [number, number];
		side: "left" | "right";
	}
>;

const TORSO =
	"M140,100 C136,148 162,178 160,203 C157,232 154,238 154,264 C154,330 158,420 162,500 L182,500 C184,420 186,360 190,318 C194,360 196,420 198,500 L218,500 C222,420 226,330 226,264 C226,238 223,232 220,203 C218,178 244,148 240,100 C230,91 150,91 140,100 Z";
const LEFT_ARM = "M132,116 C118,162 114,210 112,256";
const RIGHT_ARM = "M248,116 C262,162 266,210 268,256";

export function TapeFigure({ sites, selectedSlug, onSelect }: TapeFigureProps) {
	const { theme } = useUnistyles();

	return (
		<View style={styles.figure}>
			<Canvas style={{ width: VIEW_WIDTH * SCALE, height: FIGURE_HEIGHT }}>
				<Group
					transform={[{ scale: SCALE }]}
					style="stroke"
					color={theme.colors.lineStrong}
					strokeWidth={11}
					strokeCap="round"
					strokeJoin="round"
				>
					<Circle cx={190} cy={46} r={24} />
					<Path path={TORSO} />
					<Path path={LEFT_ARM} />
					<Path path={RIGHT_ARM} />
				</Group>
				{sites.map((site) => {
					const geometry = SITE_GEOMETRY[site.slug];
					const selected = site.slug === selectedSlug;
					return (
						<Group key={site.slug} transform={[{ scale: SCALE }]}>
							<Line
								p1={vec(geometry.leader[0], geometry.y)}
								p2={vec(geometry.leader[1], geometry.y)}
								color={theme.colors.line}
								strokeWidth={1}
							/>
							{selected ? (
								<Line
									p1={vec(geometry.tape[0], geometry.y)}
									p2={vec(geometry.tape[1], geometry.y)}
									color={theme.colors.body}
									strokeWidth={6}
									opacity={0.65}
								>
									<BlurMask blur={6} style="solid" />
								</Line>
							) : null}
							<Line
								p1={vec(geometry.tape[0], geometry.y)}
								p2={vec(geometry.tape[1], geometry.y)}
								color={selected ? theme.colors.body : theme.colors.ink3}
								strokeWidth={selected ? 2 : 1.2}
							>
								{selected ? null : <DashPathEffect intervals={[4, 4]} />}
							</Line>
							{selected
								? geometry.tape.map((x) => (
										<Line
											key={x}
											p1={vec(x, geometry.y - 6)}
											p2={vec(x, geometry.y + 6)}
											color={theme.colors.body}
											strokeWidth={2}
										/>
									))
								: null}
						</Group>
					);
				})}
			</Canvas>
			{sites.map((site) => {
				const geometry = SITE_GEOMETRY[site.slug];
				const selected = site.slug === selectedSlug;
				const rightward = geometry.side === "right";
				return (
					<Pressable
						key={site.slug}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						accessibilityLabel={site.accessibilityLabel}
						onPress={() => onSelect(site.slug)}
						style={[
							styles.siteRow,
							{ top: px(geometry.y) - ROW_HEIGHT / 2 },
							rightward
								? {
										left: px(RIGHT_COLUMN),
										right: 0,
										paddingLeft: px(RIGHT_LABEL - RIGHT_COLUMN),
										alignItems: "flex-start" as const,
									}
								: {
										left: 0,
										width: px(LEFT_COLUMN),
										paddingRight: px(LEFT_COLUMN - LEFT_LABEL),
										alignItems: "flex-end" as const,
									},
						]}
					>
						<AppText
							variant="caption"
							color={selected ? "body" : "subtle"}
							style={selected ? styles.selectedLabel : undefined}
						>
							{site.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create((theme) => ({
	figure: {
		alignSelf: "center",
		width: VIEW_WIDTH * SCALE,
		height: FIGURE_HEIGHT,
	},
	siteRow: {
		position: "absolute",
		height: ROW_HEIGHT,
		justifyContent: "center",
	},
	selectedLabel: { fontFamily: theme.typography.label.fontFamily },
}));
