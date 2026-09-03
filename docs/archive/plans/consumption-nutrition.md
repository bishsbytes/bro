# High-Level Proposal: Intake, Nutrition & Consumption Domain

## Objective

Build a general-purpose intake system that allows users to record anything they consume, including:

- Food
- Drinks
- Water
- Recipes
- Meals
- Caffeine
- Alcohol
- Nicotine
- Vitamins
- Minerals
- Supplements
- Medication
- Other substances

The system should support:

- Offline-first logging
- Nutritional tracking
- Substance/compound tracking
- Recipes and mixed drinks
- Saved meals
- Meal plans
- Community content
- Downloadable content
- Versioning and forks
- Future external data providers
- Future AI-assisted logging

The domain should not assume that everything consumed is food or that everything meaningful is a nutrient.

---

# 1. Core Domain

Use three fundamental concepts:

```text
Consumable
    ↓ contains
Constituent
    ↓ consumed through
IntakeEvent
```

Everything else builds around these.

---

# 2. Consumable

A `Consumable` represents something a user can consume.

Examples:

```text
Banana

Coffee

Beer

Vitamin D tablet

Nicotine pouch

Protein powder

Prescription tablet

Protein shake
```

Suggested model:

```ts
type Consumable = {
  id: string

  name: string

  kind: ConsumableKind

  brand?: string
  barcode?: string

  composition: Composition

  portions: Portion[]

  source: ContentSource

  createdAt: string
  updatedAt: string
}
```

---

# 3. Consumable Kinds

Start with:

```ts
type ConsumableKind =
  | "food"
  | "drink"
  | "supplement"
  | "medication"
  | "nicotine"
  | "other"
```

Do not make behaviour heavily dependent upon these categories.

They should primarily support:

- UI
- discovery
- filtering
- default logging experiences

The underlying composition model should remain generic.

For example, coffee does not need a special `Coffee` entity.

It is simply:

```text
Consumable

kind = drink

contains:
- caffeine
- energy
- carbohydrate
...
```

---

# 4. Constituents

A `Constituent` represents something contained in a consumable that may be useful to track.

Examples:

```text
protein
fat
carbohydrate
fibre

vitamin-c
vitamin-d
iron
magnesium

caffeine
nicotine
ethanol

creatine
```

Suggested definition:

```ts
type ConstituentDefinition = {
  code: string

  name: string

  category: ConstituentCategory

  canonicalUnit: Unit
}
```

---

# 5. Constituent Categories

Start with broad categories:

```ts
type ConstituentCategory =
  | "energy"
  | "macronutrient"
  | "micronutrient"
  | "stimulant"
  | "alcohol"
  | "supplement"
  | "medication"
  | "other"
```

This prevents caffeine, nicotine or medication compounds from having to masquerade as nutrients.

---

# 6. Composition

A consumable's `Composition` describes what it contains.

```ts
type ConstituentAmount = {
  constituentCode: string

  amount: number

  unit: Unit
}
```

The important architectural change is that compositions may be expressed in different ways.

Support:

```text
Per mass

Per volume

Per portion/dose
```

---

# 7. Composition Basis

Example:

```ts
type CompositionBasis =
  | {
      type: "mass"
      grams: number
    }
  | {
      type: "volume"
      millilitres: number
    }
  | {
      type: "portion"
      portionId: string
    }
```

Composition:

```ts
type Composition = {
  basis: CompositionBasis

  constituents: ConstituentAmount[]
}
```

Examples:

### Banana

```text
per 100 g

energy
carbohydrate
sugar
fibre
potassium
...
```

### Orange juice

```text
per 100 ml

energy
sugar
vitamin C
...
```

### Vitamin D tablet

```text
per 1 tablet

vitamin D: 25 µg
```

### Nicotine pouch

```text
per 1 pouch

nicotine: 6 mg
```

---

# 8. Portions

Portions provide user-friendly ways of expressing quantity.

```ts
type Portion = {
  id: string

  name: string

  quantity: number

  grams?: number
  millilitres?: number
}
```

Examples:

```text
Egg
1 egg = 50 g

Bread
1 slice = 42 g

Beer
1 bottle = 330 ml

Coffee
1 mug = 300 ml

Nicotine pouch
1 pouch
```

Portions should translate into a composition basis wherever possible.

---

# 9. Intake Event

An `IntakeEvent` records what the user actually consumed.

This becomes the fundamental event instead of `FoodLog`.

```ts
type IntakeEvent = {
  id: string

  userId: string

  consumedAt: string

  consumableId?: string

  quantity: number

  portionId?: string

  context?: IntakeContext

  snapshot: IntakeSnapshot

  notes?: string

  createdAt: string
  updatedAt: string
}
```

---

# 10. Intake Context

Context should remain independent from the actual substance.

For example:

```ts
type IntakeContext =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "drink"
  | "supplement"
  | "medication"
  | "other"
```

Do not require every intake event to belong to a meal.

For example:

```text
10:30
Coffee

11:45
Nicotine pouch

13:00
Lunch

15:30
Vitamin D
```

are all perfectly valid intake events.

---

# 11. Intake Snapshots

Intake events must preserve what was consumed at that moment.

```ts
type IntakeSnapshot = {
  name: string

  kind: ConsumableKind

  quantityDescription?: string

  grams?: number
  millilitres?: number

  constituents: ConstituentAmount[]
}
```

Historical events must not change if:

- the original consumable changes
- a recipe changes
- a community item updates
- an external provider changes its nutritional data

---

# 12. Recipes

A recipe is a composition of consumables.

```ts
type Recipe = {
  id: string

  name: string
  description?: string

  ingredients: RecipeIngredient[]

  yield: RecipeYield

  source: ContentSource
}
```

Ingredient:

```ts
type RecipeIngredient = {
  consumableId?: string

  quantity: number

  portionId?: string

  grams?: number
  millilitres?: number

  snapshot: IngredientSnapshot
}
```

---

# 13. Recipe Yield

Do not restrict recipes to `"servings"`.

Support:

```ts
type RecipeYield = {
  quantity: number

  unit:
    | "serving"
    | "portion"
    | "glass"
    | "ml"
    | "g"
}
```

Examples:

```text
Chicken curry
4 servings

Smoothie
2 glasses

Soup
1500 ml

Cocktail pitcher
6 glasses
```

---

# 14. Mixed Foods and Drinks

Recipes should be agnostic about whether their ingredients are foods, drinks or supplements.

Example:

```text
Protein smoothie

250 ml milk
1 banana
30 g whey protein
5 g creatine
1 shot espresso
```

Calculated composition could contain:

```text
energy
protein
carbohydrate
fat
calcium
caffeine
creatine
```

No special smoothie implementation is required.

---

# 15. Cocktails

Cocktails should simply be recipes.

Example:

```text
Espresso Martini

50 ml vodka
25 ml coffee liqueur
30 ml espresso
10 ml syrup
```

The resulting recipe can produce:

```text
energy
sugar
ethanol
caffeine
```

The recipe system therefore does not need separate cocktail-specific logic.

---

# 16. Saved Meals

A saved meal groups consumables and recipes together without combining them into a single recipe.

```text
Usual breakfast

2 eggs
2 slices toast
coffee
vitamin tablet
```

Suggested model:

```ts
type SavedMeal = {
  id: string

  name: string

  items: SavedMealItem[]

  source: ContentSource
}
```

Adding a saved meal should create independent intake events so the user can modify individual items.

---

# 17. Meal Plans

Meal plans remain separate from actual consumption.

```text
MealPlan
    ↓
PlannedIntake
    ↓
user confirms
    ↓
IntakeEvent
```

A plan can therefore include:

```text
Breakfast

Lunch

Dinner

Snacks

Drinks

Supplements
```

without requiring all planned intake to be food.

---

# 18. Planned Intake

Introduce:

```ts
type PlannedIntake = {
  id: string

  plannedAt?: string

  mealType?: string

  consumableId?: string
  recipeId?: string
  savedMealId?: string

  quantity?: number

  status:
    | "planned"
    | "consumed"
    | "skipped"
    | "replaced"
}
```

Actual consumption still creates `IntakeEvent` records.

---

# 19. Calculations

Create a dedicated calculation layer:

```ts
calculateConsumableComposition()

calculatePortionComposition()

calculateRecipeComposition()

calculateRecipeServing()

calculateSavedMealComposition()

calculateIntakeEvent()

calculateDailyTotals()

calculatePeriodTotals()
```

The calculation layer should know nothing about React, database persistence or sync.

---

# 20. Aggregation

Because everything becomes constituents, the same intake events can power multiple views.

For example:

```text
Today's IntakeEvents
        │
        ├──── Nutrition
        │       calories
        │       protein
        │       fibre
        │       vitamins
        │
        ├──── Caffeine
        │       total today
        │
        ├──── Nicotine
        │       total today
        │
        ├──── Alcohol
        │       total today
        │
        └──── Supplements
                vitamin D
                magnesium
                creatine
```

This is one of the major benefits of the model.

There is no separate caffeine tracker or supplement tracker.

They are different projections over the same intake stream.

---

# 21. Tracking Definitions

Do not hard-code tracking goals onto consumables.

Instead introduce a future separate concept:

```ts
type TrackingMetric = {
  constituentCode: string

  aggregation:
    | "daily_total"
    | "weekly_total"
    | "event_count"

  displayUnit: Unit
}
```

That could eventually drive:

```text
Caffeine today
145 / 300 mg

Protein
93 / 140 g

Fibre
22 / 30 g
```

The intake domain should calculate values.

A separate goals/tracking domain should decide what targets mean.

---

# 22. Medication

Medication can technically fit this model:

```text
Consumable
kind = medication

portion = tablet

constituent = active ingredient
```

However, keep medication-specific functionality separate from general nutrition behaviour.

For example, future:

- schedules
- dose reminders
- contraindications
- adherence
- prescribing information

should live in a dedicated medication domain.

The intake system can still record that something was taken.

---

# 23. Substance Tracking

Likewise, the intake model can technically represent a broad range of substances.

Do not embed substance-specific assumptions into the core schema.

Model simply:

```text
Consumable
    ↓
contains constituents
    ↓
IntakeEvent
```

Different product experiences can then decide which categories they expose.

---

# 24. Community Content

Community content should support:

```text
Consumables
Recipes
Saved meals
Meal plans
```

Potential examples:

```text
Community recipe

Community cocktail

Community protein shake

Community meal plan
```

I would be more conservative about community publishing for medication or other substance-related items.

The architecture can technically represent them without necessarily allowing public discovery or sharing.

---

# 25. Community Architecture

Maintain the boundary:

```text
COMMUNITY CATALOGUE
        │
        ↓
   versioned item
        │
      download
        ↓
   USER LIBRARY
        │
        ↓
     Intake
        │
        ↓
 immutable snapshots
```

Downloaded community content should not remain a live mutable dependency.

---

# 26. Content Provenance

Reusable content should carry:

```ts
type ContentSource =
  | {
      type: "user"
    }
  | {
      type: "community"
      contentId: string
      version: number
    }
  | {
      type: "system"
      key: string
    }
  | {
      type: "provider"
      provider: string
      externalId: string
    }
```

Editing community content creates a fork.

---

# 27. External Providers

Eventually support different providers through adapters.

For example:

```text
Open Food Facts
USDA
Supplement databases
Product databases
```

Use:

```ts
interface ConsumableProvider {
  search(query: string): Promise<ExternalConsumable[]>

  getById(id: string): Promise<ExternalConsumable | null>

  getByBarcode?(
    barcode: string
  ): Promise<ExternalConsumable | null>
}
```

Then:

```text
External provider
       ↓
normalisation
       ↓
Consumable
```

Provider-specific schemas must not leak into the rest of the application.

---

# 28. User Library

The user's local library should contain reusable content such as:

```text
Consumables

Recipes

Saved meals

Meal plans
```

Sources may include:

```text
Created by user

Downloaded from community

Imported from provider

System supplied
```

The logging experience should primarily operate against this local library.

---

# 29. Offline-First Boundary

Must work offline:

```text
Log intake

Create custom consumable

Edit consumable

Log previous consumables

Use recipes

Create recipes

Use saved meals

Follow downloaded meal plans

View intake history

Calculate totals
```

Connectivity may be required for:

```text
Community browsing

Downloads

Publishing

External product search

Barcode lookup

Community updates
```

---

# 30. High-Level Architecture

```text
                    EXTERNAL SOURCES

             Community      Providers
                 │              │
                 └──────┬───────┘
                        ↓
                  Normalisation
                        ↓

                  USER LIBRARY
                 ┌──────┼───────┐
                 │      │       │
          Consumables Recipes Meal Plans
                 │      │
                 └──┬───┘
                    ↓
               Planned Intake
                    │
                    ↓
                IntakeEvent
                    │
                    ↓
             Immutable Snapshot
                    │
          ┌─────────┼───────────┐
          ↓         ↓           ↓
      Nutrition  Caffeine    Nicotine
          ↓         ↓           ↓
       Vitamins   Alcohol     Other
```

---

# 31. Suggested Implementation Phases

## Phase 1 — Intake Foundation

Implement:

- `Consumable`
- `ConstituentDefinition`
- `ConstituentAmount`
- units
- composition
- portions
- calculation engine

Seed common constituent definitions.

---

## Phase 2 — Intake Events

Implement:

- `IntakeEvent`
- immutable snapshots
- daily intake
- intake history
- totals by constituent
- recent consumables

At this stage the app should already be able to track:

```text
food
drinks
caffeine
nicotine
supplements
```

through the same event model.

---

## Phase 3 — Food & Drink Experience

Build the dedicated UI experience for:

- meals
- foods
- drinks
- portions
- nutrition

The UI can say:

```text
Food & Drink
```

while the underlying domain remains `Intake`.

---

## Phase 4 — Recipes

Implement:

- recipe ingredients
- composition calculation
- yields
- serving scaling
- food recipes
- shakes
- cocktails
- mixed consumables

---

## Phase 5 — Saved Meals

Implement:

- reusable meal combinations
- quick logging
- favourites
- recent meals

---

## Phase 6 — Meal Plans

Implement:

- meal plan
- days
- planned intake
- scheduling
- completion
- skip/replace flows

---

## Phase 7 — Supplement & Other Intake UX

Add dedicated presentation for:

- vitamins
- supplements
- caffeine
- nicotine

These should remain projections over the same intake model rather than new persistence systems.

---

## Phase 8 — Community Content

Implement:

- published content
- versions
- catalogue
- downloading
- provenance
- dependency resolution
- offline copies

Initially prioritise:

```text
foods
drinks
recipes
cocktails
meal plans
```

---

## Phase 9 — Forks & Updates

Implement:

- update detection
- explicit upgrades
- fork-on-edit
- dependency updates
- historical integrity

---

## Phase 10 — Providers

Add provider adapters as needed.

Likely start with food/product lookup.

Keep external integration independent from the intake domain.

---

# 32. Recommended Naming

I would use these domain names:

```text
Consumable
Constituent
Composition
Portion

Recipe
SavedMeal

MealPlan
PlannedIntake

IntakeEvent
IntakeSnapshot
```

At the UI level, use friendlier terms:

```text
Food & Drink

Meals

Nutrition

Supplements

Caffeine

Nicotine

Today's intake
```

The user should never need to know what a `Constituent` or `IntakeEvent` is.

---

# 33. Most Important Design Rule

Avoid:

```text
Food tracker
Caffeine tracker
Water tracker
Supplement tracker
Nicotine tracker
Alcohol tracker
```

each having its own storage and logging model.

Instead build:

```text
                 IntakeEvent
                      │
                what did I take?
                      │
              ┌───────┼───────┐
              ↓       ↓       ↓
             Food   Coffee   Supplement
              │       │       │
              └───────┼───────┘
                      ↓
                Constituents
                      │
        ┌─────────────┼──────────────┐
        ↓             ↓              ↓
     Nutrition     Caffeine       Vitamins
```

Then individual product features become views and workflows built on top of a single consistent intake history.

That should be the foundational architecture for the feature.