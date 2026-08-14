import { getRandomBytes } from "expo-crypto";

const MAX_UUID_V7_TIMESTAMP = 2 ** 48 - 1;

export type RandomBytes = (length: number) => Uint8Array;

/**
 * Creates a time-ordered UUIDv7 using epoch milliseconds and secure randomness.
 * Ordering within one millisecond is deliberately unspecified.
 */
export function createUuidV7(
	timestamp = Date.now(),
	randomBytes: RandomBytes = getRandomBytes,
): string {
	if (
		!Number.isInteger(timestamp) ||
		timestamp < 0 ||
		timestamp > MAX_UUID_V7_TIMESTAMP
	) {
		throw new RangeError(
			"UUIDv7 timestamp must be an unsigned 48-bit integer.",
		);
	}

	const random = randomBytes(10);
	if (random.length !== 10) {
		throw new RangeError(
			"UUIDv7 randomness source must return exactly 10 bytes.",
		);
	}

	const bytes = new Uint8Array(16);
	for (let index = 5; index >= 0; index -= 1) {
		bytes[index] = Math.floor(timestamp / 2 ** ((5 - index) * 8)) & 0xff;
	}

	bytes[6] = 0x70 | (random[0] & 0x0f);
	bytes[7] = random[1];
	bytes[8] = 0x80 | (random[2] & 0x3f);
	bytes.set(random.subarray(3), 9);

	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
