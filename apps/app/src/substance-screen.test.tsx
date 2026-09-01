import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { SubstanceScreen } from "./screens/substances/substance-screen";
import { NICOTINE_DESCRIPTOR } from "./substances/nicotine";
import type { SubstanceDaySnapshot } from "./substances/substance-store";

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

describe("substance screen", () => {
	it("links to previous logged days for corrections", async () => {
		const snapshot: SubstanceDaySnapshot<"nicotine_intake"> = {
			localDay: "2026-09-01",
			defaultTime: "12:00",
			weekFromLocalDay: "2026-08-26",
			metrics: [],
			entries: [],
			recents: [],
			recentLocalDays: ["2026-08-31"],
			catalogue: [],
		};
		const view = await render(
			<SubstanceScreen
				descriptor={NICOTINE_DESCRIPTOR}
				store={{
					loadToday: async () => snapshot,
					repeatEntry: jest.fn(),
				}}
			/>,
		);

		await fireEvent.press(await view.findByText("2026-08-31"));

		expect(router.push).toHaveBeenCalledWith("/nicotine/2026-08-31");
	});
});
