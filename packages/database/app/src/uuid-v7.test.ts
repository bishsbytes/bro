import { createUuidV7 } from "./index";

jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => new Uint8Array(length)),
}));

const zeroRandomness = (length: number) => new Uint8Array(length);

describe("UUIDv7", () => {
	it("encodes the timestamp, version, and RFC variant", () => {
		const timestamp = 1_786_723_200_123;
		const uuid = createUuidV7(timestamp, zeroRandomness);
		const hex = uuid.replaceAll("-", "");

		expect(uuid).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(Number.parseInt(hex.slice(0, 12), 16)).toBe(timestamp);
	});

	it("sorts by creation millisecond", () => {
		const earlier = createUuidV7(1_000, zeroRandomness);
		const later = createUuidV7(1_001, zeroRandomness);

		expect(earlier < later).toBe(true);
	});

	it("rejects invalid timestamps and randomness", () => {
		expect(() => createUuidV7(-1, zeroRandomness)).toThrow(RangeError);
		expect(() => createUuidV7(1, () => new Uint8Array(9))).toThrow(
			"exactly 10 bytes",
		);
	});
});
