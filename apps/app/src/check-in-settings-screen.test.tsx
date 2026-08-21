import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CheckInSettingsScreen } from "./screens/settings/check-in-settings-screen";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

const initial = {
	metrics: [
		{
			metricSlug: "motivation",
			label: "Motivation",
			enabled: false,
			sensitive: false,
		},
		{
			metricSlug: "libido",
			label: "Libido",
			enabled: false,
			sensitive: true,
		},
	],
};

describe("check-in settings screen", () => {
	it("labels sensitive prompts and persists an enabled prompt", async () => {
		const store = {
			load: jest.fn(async () => initial),
			setEnabled: jest.fn(async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics.map((metric) =>
					metric.metricSlug === metricSlug ? { ...metric, enabled } : metric,
				),
			})),
		};
		const view = await render(<CheckInSettingsScreen store={store} />);

		expect(
			await view.findByText("Sensitive · scored from 1 to 5"),
		).toBeTruthy();
		await fireEvent(
			view.getByLabelText("Add Motivation from check-ins"),
			"valueChange",
			true,
		);
		await waitFor(() =>
			expect(store.setEnabled).toHaveBeenCalledWith("motivation", true),
		);
		expect(
			view.getByLabelText("Remove Motivation from check-ins"),
		).toBeTruthy();
	});
});
