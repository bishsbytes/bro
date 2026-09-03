// bro — icons (Lucide, via lucide-react-native)
// Lucide stays. Its 24-grid, 2px round-capped strokes match Helm's instrument
// language; at strokeWidth 1.75 on dark it sits exactly between the hairlines
// and the mono numerals. Every icon in the app comes from this map so agents
// can't reach for a random glyph.

import type { LucideProps } from 'lucide-react-native';
import {
  Sun, Utensils, Scale, Compass,           // tabs
  Briefcase, Wallet, HeartPulse, Heart, House, Users, Sprout, PartyPopper, // life areas
  NotebookPen, CupSoda, ClipboardCheck,    // log sheet
  Moon, Activity, Footprints, Dumbbell, Beer, Coffee, Cigarette, Pill, Droplets, // streams & readings
  Plus, ChevronRight, ChevronLeft, Check, X, Settings, Calendar, LineChart, Ruler, Target,
} from 'lucide-react-native';

/** Default props — set once via a wrapper, never per-call. */
export const iconDefaults: Partial<LucideProps> = {
  strokeWidth: 1.75,
  absoluteStrokeWidth: true,
};

/** Sizes: tab bar 22, list/tile 20, inline 16. Nothing else. */
export const iconSize = { tab: 22, tile: 20, inline: 16 } as const;

export const icons = {
  // Tab bar — order is fixed: Journal, Intake, Body, Life
  tab: { journal: Sun, intake: Utensils, body: Scale, life: Compass },

  // Life wheel vertices (clockwise from top)
  life: { work: Briefcase, money: Wallet, health: HeartPulse, love: Heart, home: House, family: Users, growth: Sprout, fun: PartyPopper },

  // "What would you like to log?" — tile colour = domain of what it logs
  log: { note: NotebookPen, food: Utensils, drink: CupSoda, body: Scale, checkin: ClipboardCheck },

  // Readings and streams
  reading: { sleep: Moon, restingHeartRate: Activity, steps: Footprints, weight: Scale, tape: Ruler, load: Dumbbell },
  stream: { alcohol: Beer, caffeine: Coffee, smoking: Cigarette, supplements: Pill, medication: Pill, fluid: Droplets },

  // Chrome
  ui: { add: Plus, chevron: ChevronRight, back: ChevronLeft, check: Check, close: X, settings: Settings, calendar: Calendar, trends: LineChart, heading: Target },
} as const;

/* Colour rules for icons (see DESIGN.md):
   - Chrome icons: ink2; active tab: accent.
   - Icon tiles (log sheet, life areas): icon in the domain colour on theme.tint(domain).
   - Never an icon in the accent unless it is the active/selected state.
   - No filled variants; no emoji.

   If you ever want filled or two-tone icons for tiles, Phosphor (duotone weight)
   is the only set worth switching to — it keeps the same 24-grid discipline.
   Not recommended now: consistency across 60+ existing icons beats the gain. */
