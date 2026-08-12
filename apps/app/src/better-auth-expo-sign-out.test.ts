import { expoClient } from "@better-auth/expo/client";

jest.mock("expo-linking", () => ({ createURL: () => "app://" }));
jest.mock("expo-constants", () => ({
	__esModule: true,
	default: { expoConfig: { scheme: "app" }, platform: {} },
}));
jest.mock("expo-network", () => ({
	addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
jest.mock("react-native", () => ({
	AppState: { addEventListener: jest.fn() },
	Platform: { OS: "ios" },
}));

describe("@better-auth/expo offline sign-out contract", () => {
	it("clears persisted and in-memory session state before fetching", async () => {
		const values = new Map<string, string>([
			["bro_cookie", '{"better-auth.session_token":{"value":"secret"}}'],
			["bro_session_data", '{"user":{"id":"user-a"}}'],
		]);
		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: async (key: string, value: string) => {
				values.set(key, value);
			},
		};
		let sessionState: {
			data: { user: { id: string } } | null;
			error: null;
			isPending: boolean;
		} = {
			data: { user: { id: "user-a" } },
			error: null,
			isPending: false,
		};
		const store = {
			atoms: {
				session: {
					get: () => sessionState,
					set: (next: typeof sessionState) => {
						sessionState = next;
					},
				},
			},
			notify: jest.fn(),
		};
		const plugin = expoClient({
			scheme: "app",
			storagePrefix: "bro",
			storage,
		});

		plugin.getActions(jest.fn() as never, store as never);
		const initialized = await plugin.fetchPlugins[0].init?.(
			"http://example.test/api/auth/sign-out",
			{} as never,
		);

		expect(initialized?.options.credentials).toBe("omit");
		expect(values.get("bro_cookie")).toBe("{}");
		expect(values.get("bro_session_data")).toBe("{}");
		expect(sessionState.data).toBeNull();
	});
});
