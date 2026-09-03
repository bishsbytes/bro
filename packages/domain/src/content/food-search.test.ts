import { externalConsumableSource } from "./consumable";
import {
	type ExternalConsumable,
	FOOD_DATA_LICENCE,
	FOOD_DATA_SOURCE,
	isExternalConsumable,
	isExternalConsumableResponse,
} from "./food-search";

const chicken: ExternalConsumable = {
	ref: "off:12345678",
	name: "Chicken thighs",
	brand: "Example",
	barcode: "12345678",
	kind: "food",
	basis: { type: "mass", massKg: 0.1 },
	constituents: { energy: 210, protein: 0.026, carbohydrate: 0 },
	portions: [
		{
			id: "serving",
			label: "120 g",
			massKg: 0.12,
			volumeL: null,
			basisUnits: null,
		},
	],
	defaultPortionId: "serving",
	source: FOOD_DATA_SOURCE,
	licence: FOOD_DATA_LICENCE,
};

describe("external consumable contract", () => {
	it("accepts the consumable shape the provider returns and nothing looser", () => {
		expect(isExternalConsumable(chicken)).toBe(true);
		expect(isExternalConsumableResponse({ results: [chicken] })).toBe(true);
		expect(isExternalConsumable({ ...chicken, ref: "12345678" })).toBe(false);
		expect(isExternalConsumable({ ...chicken, name: " " })).toBe(false);
		expect(isExternalConsumable({ ...chicken, kind: "snack" })).toBe(false);
		expect(
			isExternalConsumable({ ...chicken, constituents: { energy: -1 } }),
		).toBe(false);
		expect(isExternalConsumable({ ...chicken, portions: [{}] })).toBe(false);
		// A product with no declared serving is still loggable by weight.
		expect(
			isExternalConsumable({
				...chicken,
				portions: [],
				defaultPortionId: null,
			}),
		).toBe(true);
		expect(isExternalConsumableResponse({ results: [{}] })).toBe(false);
	});

	it("reads the provider source a library row records", () => {
		expect(externalConsumableSource(chicken)).toEqual({
			type: "provider",
			provider: "off",
			externalId: "12345678",
		});
		expect(() =>
			externalConsumableSource({ ref: "system:drink:water" }),
		).toThrow("not a provider ref");
	});
});
