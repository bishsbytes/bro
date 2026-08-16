const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable application namespace reserved for daily metric identities. */
export const DAILY_METRIC_UUID_NAMESPACE =
	"ba76f3ee-2e2f-4ed6-9f39-92feca3c18e7";

function rotateLeft(value: number, bits: number): number {
	return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

/** Minimal SHA-1 implementation used only for RFC 9562 UUIDv5 names. */
function sha1(input: Uint8Array): Uint8Array {
	const bitLength = input.length * 8;
	const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
	const bytes = new Uint8Array(paddedLength);
	bytes.set(input);
	bytes[input.length] = 0x80;

	const view = new DataView(bytes.buffer);
	const highBits = Math.floor(bitLength / 2 ** 32);
	const lowBits = bitLength >>> 0;
	view.setUint32(paddedLength - 8, highBits, false);
	view.setUint32(paddedLength - 4, lowBits, false);

	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;
	const words = new Uint32Array(80);

	for (let offset = 0; offset < paddedLength; offset += 64) {
		for (let index = 0; index < 16; index += 1) {
			words[index] = view.getUint32(offset + index * 4, false);
		}
		for (let index = 16; index < 80; index += 1) {
			words[index] = rotateLeft(
				words[index - 3] ^
					words[index - 8] ^
					words[index - 14] ^
					words[index - 16],
				1,
			);
		}

		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;

		for (let index = 0; index < 80; index += 1) {
			let f: number;
			let k: number;
			if (index < 20) {
				f = (b & c) | (~b & d);
				k = 0x5a827999;
			} else if (index < 40) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			} else if (index < 60) {
				f = (b & c) | (b & d) | (c & d);
				k = 0x8f1bbcdc;
			} else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}

			const next = (rotateLeft(a, 5) + (f >>> 0) + e + k + words[index]) >>> 0;
			e = d;
			d = c;
			c = rotateLeft(b, 30);
			b = a;
			a = next;
		}

		h0 = (h0 + a) >>> 0;
		h1 = (h1 + b) >>> 0;
		h2 = (h2 + c) >>> 0;
		h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0;
	}

	const digest = new Uint8Array(20);
	const digestView = new DataView(digest.buffer);
	for (const [index, value] of [h0, h1, h2, h3, h4].entries()) {
		digestView.setUint32(index * 4, value, false);
	}
	return digest;
}

function uuidBytes(uuid: string): Uint8Array {
	if (!UUID_PATTERN.test(uuid)) {
		throw new TypeError("UUIDv5 namespace must be a valid UUID.");
	}

	const hex = uuid.replaceAll("-", "");
	return Uint8Array.from({ length: 16 }, (_, index) =>
		Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
	);
}

function formatUuid(bytes: Uint8Array): string {
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
	return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
		.slice(6, 8)
		.join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/** Creates a deterministic UUIDv5 from a UTF-8 name and UUID namespace. */
export function createUuidV5(name: string, namespace: string): string {
	const namespaceBytes = uuidBytes(namespace);
	const nameBytes = new TextEncoder().encode(name);
	const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
	input.set(namespaceBytes);
	input.set(nameBytes, namespaceBytes.length);

	const bytes = sha1(input).slice(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	return formatUuid(bytes);
}

/** Natural-key identity shared by every device computing the same rollup. */
export function createDailyMetricId(
	metricSlug: string,
	localDay: string,
	source: string,
): string {
	return createUuidV5(
		JSON.stringify([metricSlug, localDay, source]),
		DAILY_METRIC_UUID_NAMESPACE,
	);
}
