import type { LucideIcon } from "lucide-react-native";
import Baby from "lucide-react-native/icons/baby";
import Briefcase from "lucide-react-native/icons/briefcase";
import Calendar from "lucide-react-native/icons/calendar";
import ChartLine from "lucide-react-native/icons/chart-line";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Circle from "lucide-react-native/icons/circle";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleDashed from "lucide-react-native/icons/circle-dashed";
import Compass from "lucide-react-native/icons/compass";
import CupSoda from "lucide-react-native/icons/cup-soda";
import FaceAngry from "lucide-react-native/icons/face-angry";
import FaceGrinning from "lucide-react-native/icons/face-grinning";
import FaceNeutral from "lucide-react-native/icons/face-neutral";
import FaceSlightlyFrowning from "lucide-react-native/icons/face-slightly-frowning";
import FaceSlightlySmiling from "lucide-react-native/icons/face-slightly-smiling";
import Heart from "lucide-react-native/icons/heart";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import House from "lucide-react-native/icons/house";
import HouseHeart from "lucide-react-native/icons/house-heart";
import Moon from "lucide-react-native/icons/moon";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import PartyPopper from "lucide-react-native/icons/party-popper";
import Plus from "lucide-react-native/icons/plus";
import Search from "lucide-react-native/icons/search";
import Settings from "lucide-react-native/icons/settings";
import Signpost from "lucide-react-native/icons/signpost";
import Sparkles from "lucide-react-native/icons/sparkles";
import Sprout from "lucide-react-native/icons/sprout";
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
	log: NotebookPen,
	"mood-high": FaceSlightlySmiling,
	"mood-highest": FaceGrinning,
	"mood-low": FaceSlightlyFrowning,
	"mood-lowest": FaceAngry,
	"mood-neutral": FaceNeutral,
	person: User,
	search: Search,
	settings: Settings,
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
