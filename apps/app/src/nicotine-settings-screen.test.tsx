import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { NicotineSettingsScreen } from "./screens/settings/nicotine-settings-screen";
import type { SubstanceSettingsSnapshot } from "./substances/substance-store";

jest.mock("expo-router", () => ({
	router: { push: jest.fn() },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

const off: SubstanceSettingsSnapshot<"nicotine_intake"> = {
	metrics: [
		{ metricSlug: "nicotine_intake", label: "Nicotine", tracked: false },
	],
};

const on: SubstanceSettingsSnapshot<"nicotine_intake"> = {
	metrics: [
		{ metricSlug: "nicotine_intake", label: "Nicotine", tracked: true },
	],
};

describe("nicotine settings screen", () => {
	it("turns the stream on and only then offers the log", async () => {
		const store = {
			loadSettings: jest.fn(async () => off),
			setTracked: jest.fn(async () => on),
		};
		const view = await render(<NicotineSettingsScreen store={store} />);

		// Nothing links into the log while the stream is off.
		expect(await view.findByLabelText("Nicotine")).toBeTruthy();
		expect(view.queryByText("Smoking & vaping")).toBeNull();

		await fireEvent(view.getByLabelText("Nicotine"), "valueChange", true);

		await waitFor(() =>
			expect(store.setTracked).toHaveBeenCalledWith("nicotine_intake", true),
		);
		expect(await view.findByText("Smoking & vaping")).toBeTruthy();
	});
});
