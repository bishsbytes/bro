import {
	assertConsumableComposition,
	type ConsumableComposition,
	isCompositionBasis,
	isContentSource,
	isIntakeContext,
	isOptionalStreamKind,
	isPortion,
	isRecipeYield,
	isSensitiveConsumableKind,
	OPTIONAL_STREAM_KINDS,
	PER_100_G,
	PUBLISHABLE_CONSUMABLE_KINDS,
	providerSourceOf,
	SENSITIVE_CONSUMABLE_KINDS,
	sourceRefOf,
} from "./consumable";

const banana: ConsumableComposition = {
	basis: PER_100_G,
	constituents: { energy: 89, carbohydrate: 0.0228, potassium: 0.000_358 },
	portions: [
		{
			id: "medium",
			label: "1 medium",
			massKg: 0.118,
			volumeL: null,
			basisUnits: null,
		},
	],
	defaultPortionId: "medium",
};

describe("consumable shape", () => {
	it("fixes which kinds are optional, sensitive whole, and publishable", () => {
		expect(OPTIONAL_STREAM_KINDS).toEqual([
			"supplement",
			"medication",
			"nicotine",
			"other",
		]);
		expect(SENSITIVE_CONSUMABLE_KINDS).toEqual(["medication", "other"]);
		expect(PUBLISHABLE_CONSUMABLE_KINDS).toEqual([
			"food",
			"drink",
			"supplement",
		]);
		expect(isOptionalStreamKind("food")).toBe(false);
		expect(isOptionalStreamKind("nicotine")).toBe(true);
		expect(isSensitiveConsumableKind("medication")).toBe(true);
		expect(isSensitiveConsumableKind("nicotine")).toBe(false);
		expect(isIntakeContext("breakfast")).toBe(true);
		expect(isIntakeContext("brunch")).toBe(false);
	});

	it("guards the shapes that cross a JSON boundary", () => {
		expect(isCompositionBasis(PER_100_G)).toBe(true);
		expect(isCompositionBasis({ type: "mass", massKg: 0 })).toBe(false);
		expect(isCompositionBasis({ type: "portion", portionId: "" })).toBe(false);
		expect(isPortion(banana.portions[0])).toBe(true);
		expect(
			isPortion({
				id: "x",
				label: "x",
				massKg: null,
				volumeL: null,
				basisUnits: null,
			}),
		).toBe(false);
		expect(isContentSource({ type: "user" })).toBe(true);
		expect(isContentSource({ type: "system", key: "drink:water" })).toBe(true);
		expect(
			isContentSource({ type: "provider", provider: "off", externalId: "1" }),
		).toBe(true);
		expect(
			isContentSource({ type: "community", contentId: "c", version: 0 }),
		).toBe(false);
		expect(isRecipeYield({ quantity: 4, unit: "serving" })).toBe(true);
		expect(isRecipeYield({ quantity: 0, unit: "serving" })).toBe(false);
	});

	it("accepts a sound composition and names what is wrong with an unsound one", () => {
		expect(() => assertConsumableComposition(banana)).not.toThrow();
		expect(() =>
			assertConsumableComposition({ ...banana, defaultPortionId: "large" }),
		).toThrow("Default portion large is not one of the portions.");
		expect(() =>
			assertConsumableComposition({
				...banana,
				portions: [...banana.portions, ...banana.portions],
			}),
		).toThrow("Portion ids must be unique: medium.");
		expect(() =>
			assertConsumableComposition({
				...banana,
				basis: { type: "portion", portionId: "tablet" },
			}),
		).toThrow("Basis portion tablet is not one of the portions.");
		expect(() =>
			assertConsumableComposition({
				basis: { type: "portion", portionId: "tablet" },
				constituents: { vitamin_d: 2.5e-8 },
				portions: [
					{
						id: "tablet",
						label: "tablet",
						massKg: null,
						volumeL: null,
						basisUnits: 2,
					},
				],
				defaultPortionId: "tablet",
			}),
		).toThrow("Basis portion tablet must be exactly one of itself.");
		expect(() =>
			assertConsumableComposition({
				...banana,
				constituents: { energy: -1 },
			}),
		).toThrow("Consumable constituent energy must be finite and non-negative.");
	});

	it("writes and reads source refs without inventing one for a user row", () => {
		expect(sourceRefOf({ type: "system", key: "drink:lager-4_5" })).toBe(
			"system:drink:lager-4_5",
		);
		expect(
			sourceRefOf({ type: "provider", provider: "off", externalId: "5000" }),
		).toBe("off:5000");
		expect(
			sourceRefOf({ type: "community", contentId: "abc", version: 3 }),
		).toBe("community:abc@3");
		expect(sourceRefOf({ type: "user" })).toBeNull();
		expect(sourceRefOf({ type: "user" }, "row-1")).toBe("library:row-1");
		expect(providerSourceOf("off:5000")).toEqual({
			type: "provider",
			provider: "off",
			externalId: "5000",
		});
		expect(providerSourceOf("system:drink:water")).toBeNull();
		expect(providerSourceOf("library:row-1")).toBeNull();
		expect(providerSourceOf("no-namespace")).toBeNull();
	});
});
