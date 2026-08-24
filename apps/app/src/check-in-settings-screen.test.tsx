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
			metricSlug: "energy",
			label: "Energy",
			enabled: true,
			sensitive: false,
		},
		{
			metricSlug: "motivation",
			label: "Motivation",
			enabled: true,
			sensitive: false,
		},
		{
			metricSlug: "libido",
			label: "Libido",
			enabled: false,
			sensitive: true,
		},
	],
	tags: [
		{
			metricSlug: "training",
			label: "Training",
			enabled: true,
			sensitive: false,
			category: "body" as const,
		},
		{
			metricSlug: "masturbation",
			label: "Masturbation",
			enabled: false,
			sensitive: true,
			category: "sexual" as const,
		},
	],
};

describe("check-in settings screen", () => {
	it("labels sensitive prompts and lets Energy be removed", async () => {
		const store = {
			load: jest.fn(async () => initial),
			setEnabled: jest.fn(async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics.map((metric) =>
					metric.metricSlug === metricSlug ? { ...metric, enabled } : metric,
				),
				tags: initial.tags.map((tag) =>
					tag.metricSlug === metricSlug ? { ...tag, enabled } : tag,
				),
			})),
		};
		const view = await render(<CheckInSettingsScreen store={store} />);

		expect(
			await view.findByText("Sensitive · scored from 1 to 5"),
		).toBeTruthy();
		await fireEvent(
			view.getByLabelText("Remove Energy from check-ins"),
			"valueChange",
			false,
		);
		await waitFor(() =>
			expect(store.setEnabled).toHaveBeenCalledWith("energy", false),
		);
		expect(view.getByLabelText("Add Energy from check-ins")).toBeTruthy();
	});

	it("groups the panel tags by category and turns one on", async () => {
		const store = {
			load: jest.fn(async () => initial),
			setEnabled: jest.fn(async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics,
				tags: initial.tags.map((tag) =>
					tag.metricSlug === metricSlug ? { ...tag, enabled } : tag,
				),
			})),
		};
		const view = await render(<CheckInSettingsScreen store={store} />);

		expect(await view.findByText("Sexual")).toBeTruthy();
		expect(view.getByText("Body")).toBeTruthy();
		expect(view.getByLabelText("Remove Training tag")).toBeTruthy();

		await fireEvent(
			view.getByLabelText("Add Masturbation tag"),
			"valueChange",
			true,
		);
		await waitFor(() =>
			expect(store.setEnabled).toHaveBeenCalledWith("masturbation", true),
		);
		expect(view.getByLabelText("Remove Masturbation tag")).toBeTruthy();
	});
});
