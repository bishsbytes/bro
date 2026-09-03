/**
 * The intake calculation layer: pure functions over intake events and the
 * constituent catalogue. Composition scaling and recipe arithmetic live in
 * `@bro/domain/composition` — the consumable repository needs them inside its
 * transaction and data access may not depend on this package — and are
 * re-exported here so callers find the whole layer in one place.
 */
export {
	addConstituents,
	calculateRecipeComposition,
	type PortionSelection,
	PortionSelectionError,
	type PortionSelectionField,
	portionFactor,
	type RecipeComposition,
	type RecipeIngredientSnapshot,
	type ScaledComposition,
	scaleComposition,
	scaleConstituents,
} from "@bro/domain/composition";
export {
	INTAKE_BASELINE_MIN_LOGGED_DAYS,
	INTAKE_BASELINE_WINDOW_DAYS,
	type IntakeProjectionGroup,
	type IntakeProjectionRow,
	intakeBaseline,
	intakeProjections,
} from "./projections";
export {
	type IntakeDayTotal,
	type IntakePeriodTotals,
	intakeDayTotal,
	intakePeriodTotals,
	intakeTrailingDailyMean,
} from "./totals";
