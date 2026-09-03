import type {
	Consumable,
	IntakeEvent,
	IntakeStream,
	RecipeIngredient,
} from "@bro/mobile-model";
import type { CheckInExportInput } from "../check-in-export";

/**
 * The records behind `check-in-export.json`. Kept beside the fixture so the
 * golden file can be regenerated from the same input the test compares to,
 * rather than retyped by hand when the format moves.
 */
export const goldenYoghurt: Consumable = {
	id: "library-yoghurt",
	kind: "food",
	name: "Greek yoghurt",
	brand: "Corner shop",
	barcode: null,
	basis: { type: "mass", massKg: 0.1 },
	constituents: { energy: 97, protein: 0.009, carbohydrate: 0.004 },
	portions: [
		{ id: "pot", label: "1 pot", massKg: 0.17, volumeL: null, basisUnits: null },
	],
	defaultPortionId: "pot",
	recipe: null,
	source: { type: "user" },
	forkedFrom: null,
	archivedAt: null,
	createdAt: 1_786_620_000_000,
	updatedAt: 1_786_620_000_000,
};

export const goldenChickenRiceRecipe: Consumable = {
	id: "library-chicken-rice",
	kind: "food",
	name: "Chicken and rice",
	brand: null,
	barcode: null,
	basis: { type: "portion", portionId: "serving" },
	constituents: { energy: 430, protein: 0.038, carbohydrate: 0 },
	portions: [
		{ id: "serving", label: "serving", massKg: 0.35, volumeL: null, basisUnits: 1 },
	],
	defaultPortionId: "serving",
	recipe: { yield: { quantity: 2, unit: "serving" } },
	source: { type: "user" },
	forkedFrom: null,
	archivedAt: null,
	createdAt: 1_786_620_100_000,
	updatedAt: 1_786_620_100_000,
};

export const goldenChickenIngredient: RecipeIngredient = {
	id: "ingredient-chicken",
	recipeId: goldenChickenRiceRecipe.id,
	position: 0,
	consumableId: null,
	sourceRef: "off:5000112637922",
	name: "Chicken thigh",
	portionLabel: "thigh",
	quantity: 2,
	massKg: 0.24,
	volumeL: null,
	constituents: { energy: 520, protein: 0.052, carbohydrate: 0 },
	createdAt: 1_786_620_100_100,
	updatedAt: 1_786_620_100_100,
};

export const goldenFoodEvent: IntakeEvent = {
	id: "intake-chicken-rice",
	kind: "food",
	consumableId: goldenChickenRiceRecipe.id,
	sourceRef: `library:${goldenChickenRiceRecipe.id}`,
	name: "Chicken and rice",
	brand: null,
	portionLabel: "serving",
	quantity: 1,
	massKg: 0.35,
	volumeL: null,
	constituents: { energy: 430, protein: 0.038, carbohydrate: 0 },
	context: "dinner",
	notes: null,
	occurredAt: 1_786_621_800_000,
	localDay: "2026-08-13",
	tzOffsetMinutes: -60,
	createdAt: 1_786_621_800_100,
	updatedAt: 1_786_621_800_100,
};

export const goldenSupplementStream: IntakeStream = {
	id: "stream-supplement",
	kind: "supplement",
	enabledAt: 1_786_620_000_000,
	disabledAt: null,
	createdAt: 1_786_620_000_000,
	updatedAt: 1_786_620_000_000,
};

export const goldenInput: CheckInExportInput = {
	observations: [],
	dayNotes: [],
	trackedMetrics: [],
	reminders: [],
	assessments: [],
	goals: [],
	unitPreferences: [],
	dailyMetrics: [],
	habits: [],
	habitCompletions: [],
	challengeEnrolments: [],
	challengeProgress: [],
	intakeEvents: [goldenFoodEvent],
	consumables: [goldenChickenRiceRecipe, goldenYoghurt],
	recipeIngredients: [goldenChickenIngredient],
	intakeStreams: [goldenSupplementStream],
	registry: [],
};

export const goldenOptions = {
	appVersion: "1.0.0",
	exportedAt: 1_786_708_800_000,
} as const;
