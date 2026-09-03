import type { LucideIcon } from "lucide-react-native";
import Baby from "lucide-react-native/icons/baby";
import Bold from "lucide-react-native/icons/bold";
import Briefcase from "lucide-react-native/icons/briefcase";
import Calendar from "lucide-react-native/icons/calendar";
import ChartLine from "lucide-react-native/icons/chart-line";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Circle from "lucide-react-native/icons/circle";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleDashed from "lucide-react-native/icons/circle-dashed";
import Clock from "lucide-react-native/icons/clock";
import Compass from "lucide-react-native/icons/compass";
import CupSoda from "lucide-react-native/icons/cup-soda";
import Heart from "lucide-react-native/icons/heart";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import House from "lucide-react-native/icons/house";
import HouseHeart from "lucide-react-native/icons/house-heart";
import Italic from "lucide-react-native/icons/italic";
import List from "lucide-react-native/icons/list";
import Moon from "lucide-react-native/icons/moon";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import PartyPopper from "lucide-react-native/icons/party-popper";
import Plus from "lucide-react-native/icons/plus";
import Ruler from "lucide-react-native/icons/ruler";
import Scale from "lucide-react-native/icons/scale";
import Search from "lucide-react-native/icons/search";
import Settings from "lucide-react-native/icons/settings";
import Signpost from "lucide-react-native/icons/signpost";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sprout from "lucide-react-native/icons/sprout";
import Square from "lucide-react-native/icons/square";
import SquareCheck from "lucide-react-native/icons/square-check";
import Sun from "lucide-react-native/icons/sun";
import SunMoon from "lucide-react-native/icons/sun-moon";
import User from "lucide-react-native/icons/user";
import Users from "lucide-react-native/icons/users";
import UtensilsCrossed from "lucide-react-native/icons/utensils-crossed";
import Wallet from "lucide-react-native/icons/wallet";
import WineOff from "lucide-react-native/icons/wine-off";
import X from "lucide-react-native/icons/x";
import type { ColorValue } from "react-native";
import { View } from "react-native";

/** Semantic names keep call sites decoupled from the icon set. */
const ICONS = {
	add: Plus,
	body: Scale,
	bold: Bold,
	calendar: Calendar,
	check: Check,
	"check-circle": CircleCheck,
	"check-in": NotebookPen,
	"chevron-down": ChevronDown,
	"chevron-left": ChevronLeft,
	"chevron-right": ChevronRight,
	circle: Circle,
	clock: Clock,
	close: X,
	drink: CupSoda,
	explore: Compass,
	food: UtensilsCrossed,
	insights: ChartLine,
	italic: Italic,
	journal: Sun,
	list: List,
	note: NotebookPen,
	"life-area": CircleDashed,
	"life-career": Briefcase,
	"life-environment": House,
	"life-faith": Sparkles,
	"life-family": HouseHeart,
	"life-fatherhood": Baby,
	"life-friends": Users,
	"life-fun": PartyPopper,
	"life-growth": Sprout,
	"life-health": HeartPulse,
	"life-money": Wallet,
	"life-partner": Heart,
	"life-purpose": Signpost,
	"life-sobriety": WineOff,
	person: User,
	measure: Ruler,
	search: Search,
	settings: Settings,
	square: Square,
	"square-check": SquareCheck,
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
	size = 20,
	strokeWidth = 1.75,
	testID,
}: IconProps) {
	const Glyph = ICONS[name];
	const glyph = (
		<Glyph
			absoluteStrokeWidth
			color={color}
			size={size}
			strokeWidth={strokeWidth}
		/>
	);
	// Lucide rewrites `testID` to `data-testid`, which RN Testing Library
	// cannot query, so a queryable View carries it instead.
	return testID ? <View testID={testID}>{glyph}</View> : glyph;
}
