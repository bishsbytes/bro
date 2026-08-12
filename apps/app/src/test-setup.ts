// Prevent Expo's lazy native fetch polyfill from loading after a test finishes.
globalThis.fetch = jest.fn(async () => {
	throw new Error("Unexpected network request in test.");
}) as typeof fetch;
