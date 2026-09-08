import type {
	ConsumableComposition,
	ConsumableKind,
} from "@bro/domain/consumable";
import type {
	LogSource,
	PresentedIntakeEvent,
} from "../../intake/intake-store";

/** What the detail sheet is open for: something with a composition, or a recent. */
export type IntakePick =
	| {
			type: "composition";
			source: LogSource;
			kind: ConsumableKind;
			name: string;
			brand: string | null;
			composition: ConsumableComposition;
			artworkRef?: string | null;
			provenance: string | null;
	  }
	| { type: "recent"; presented: PresentedIntakeEvent };

export function pickName(pick: IntakePick): string {
	return pick.type === "recent" ? pick.presented.event.name : pick.name;
}

export function pickBrand(pick: IntakePick): string | null {
	return pick.type === "recent" ? pick.presented.event.brand : pick.brand;
}

export function pickKind(pick: IntakePick): ConsumableKind {
	return pick.type === "recent" ? pick.presented.event.kind : pick.kind;
}

/** The image to draw: the recorded reference, or whichever source has one. */
export function pickArtworkRef(pick: IntakePick): string | null | undefined {
	if (pick.type === "recent") return pick.presented.event.sourceRef;
	if (pick.source.type === "system") return pick.source.key;
	if (pick.source.type === "external") return pick.source.consumable.ref;
	return pick.artworkRef;
}
