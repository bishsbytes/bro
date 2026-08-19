// Expo Crypto's native AES classes are unavailable in Jest's native shim.
// Database tests only consume random bytes for UUIDv7 identifiers.
let mockRandomByte = 0;
jest.mock("expo-crypto", () => ({
	getRandomBytes: jest.fn((length: number) => {
		const bytes = new Uint8Array(length);
		mockRandomByte = (mockRandomByte + 1) % 256;
		bytes.fill(mockRandomByte);
		return bytes;
	}),
}));
