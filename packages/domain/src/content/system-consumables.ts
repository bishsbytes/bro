import type { ConsumableKind, SystemConsumable } from "./consumable";
import { DRINK_CATALOGUE } from "./drink-catalogue";
import { NICOTINE_CATALOGUE } from "./nicotine-catalogue";

/**
 * Every authored consumable, across catalogues, behind one lookup. The log
 * screen presents these beside the library through one read model; a system
 * key is what an event's `sourceRef` records as `system:<key>`.
 */
export const SYSTEM_CONSUMABLES: readonly SystemConsumable[] = [
	...DRINK_CATALOGUE,
	...NICOTINE_CATALOGUE,
];

const byKey = new Map<string, SystemConsumable>(
	SYSTEM_CONSUMABLES.map((consumable) => [consumable.key, consumable]),
);

/** Unknown keys resolve to null forever, so removed content never throws. */
export function resolveSystemConsumable(key: string): SystemConsumable | null {
	return byKey.get(key) ?? null;
}

export function listSystemConsumables(
	kind?: ConsumableKind,
): SystemConsumable[] {
	return SYSTEM_CONSUMABLES.filter(
		(consumable) => kind === undefined || consumable.kind === kind,
	);
}
