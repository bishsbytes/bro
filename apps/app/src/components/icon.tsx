import type { LucideIcon } from "lucide-react-native";
import Calendar from "lucide-react-native/icons/calendar";
import ChartLine from "lucide-react-native/icons/chart-line";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Circle from "lucide-react-native/icons/circle";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Compass from "lucide-react-native/icons/compass";
import CupSoda from "lucide-react-native/icons/cup-soda";
import FaceSlightlySmiling from "lucide-react-native/icons/face-slightly-smiling";
import Moon from "lucide-react-native/icons/moon";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Sun from "lucide-react-native/icons/sun";
import SunMoon from "lucide-react-native/icons/sun-moon";
import User from "lucide-react-native/icons/user";
import UtensilsCrossed from "lucide-react-native/icons/utensils-crossed";
import X from "lucide-react-native/icons/x";
import type { ColorValue } from "react-native";
import { View } from "react-native";

/** Semantic names keep call sites decoupled from the icon set. */
const ICONS = {
	add: Plus,
	calendar: Calendar,
	check: Check,
	"check-circle": CircleCheck,
	"check-in": FaceSlightlySmiling,
	"chevron-right": ChevronRight,
	circle: Circle,
	close: X,
	drink: CupSoda,
	explore: Compass,
	food: UtensilsCrossed,
	insights: ChartLine,
	journal: Sun,
	log: NotebookPen,
	person: User,
	search: Search,
	"theme-dark": Moon,
	"theme-light": Sun,
	"theme-system": SunMoon,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = {
	name: IconName;
	color: ColorValue;
	size?: number;
	strokeWidth?: number;
	testID?: string;
};

export function Icon({
	name,
	color,
	size = 24,
	strokeWidth = 2,
	testID,
}: IconProps) {
	const Glyph = ICONS[name];
	const glyph = <Glyph color={color} size={size} strokeWidth={strokeWidth} />;
	// Lucide rewrites `testID` to `data-testid`, which RN Testing Library
	// cannot query, so a queryable View carries it instead.
	return testID ? <View testID={testID}>{glyph}</View> : glyph;
}
