import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CheckInSettingsScreen } from "./screens/settings/check-in-settings-screen";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

// The sheet reads insets; the screen itself still needs the real SafeAreaView.
jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

const initial = {
	metrics: [
		{
			metricSlug: "energy",
			label: "Energy",
			enabled: true,
			sensitive: false,
			checkInSlots: "morning" as const,
		},
		{
			metricSlug: "motivation",
			label: "Motivation",
			enabled: true,
			sensitive: false,
			checkInSlots: "morning" as const,
		},
		{
			metricSlug: "libido",
			label: "Libido",
			enabled: false,
			sensitive: true,
			checkInSlots: "evening" as const,
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
			metricSlug: "illness",
			label: "Illness",
			enabled: false,
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

function storeWith(
	overrides: Partial<{
		setEnabled: jest.Mock;
		setCheckInSlots: jest.Mock;
	}> = {},
) {
	return {
		load: jest.fn(async () => initial),
		setEnabled: jest.fn(async () => initial),
		setCheckInSlots: jest.fn(async () => initial),
		...overrides,
	};
}

describe("check-in settings screen", () => {
	it("glimpses each score's sitting on its row, off included", async () => {
		const view = await render(<CheckInSettingsScreen store={storeWith()} />);

		expect(await view.findByText("Energy")).toBeTruthy();
		expect(view.getByText("Sensitive · scored from 1 to 5")).toBeTruthy();
		// Two scores sit in the morning; Libido is off, so it reads as off rather
		// than showing the sitting it would return to.
		expect(view.getAllByText("Morning")).toHaveLength(2);
		expect(view.getByText("Off")).toBeTruthy();
		expect(view.queryByText("Evening")).toBeNull();
	});

	it("moves a score to another sitting from its sheet", async () => {
		const setCheckInSlots = jest.fn(
			async (
				metricSlug: string,
				checkInSlots: "morning" | "evening" | "both",
			) => ({
				metrics: initial.metrics.map((metric) =>
					metric.metricSlug === metricSlug
						? { ...metric, checkInSlots }
						: metric,
				),
				tags: initial.tags,
			}),
		);
		const store = storeWith({ setCheckInSlots });
		const view = await render(<CheckInSettingsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose when Energy is asked"),
		);
		expect(
			view.getByLabelText("Ask Energy in the Morning check-in").props
				.accessibilityState.selected,
		).toBe(true);

		await fireEvent.press(
			view.getByLabelText("Ask Energy in the Evening check-in"),
		);

		await waitFor(() =>
			expect(setCheckInSlots).toHaveBeenCalledWith("energy", "evening"),
		);
		// The sheet answered the row and closed, leaving the new sitting on it.
		expect(
			view.queryByLabelText("Ask Energy in the Evening check-in"),
		).toBeNull();
		expect(view.getByText("Evening")).toBeTruthy();
	});

	it("turns a score off from the same sheet that sets its sitting", async () => {
		const setEnabled = jest.fn(
			async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics.map((metric) =>
					metric.metricSlug === metricSlug ? { ...metric, enabled } : metric,
				),
				tags: initial.tags,
			}),
		);
		const store = storeWith({ setEnabled });
		const view = await render(<CheckInSettingsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose when Energy is asked"),
		);
		await fireEvent.press(view.getByLabelText("Do not ask Energy"));

		await waitFor(() =>
			expect(setEnabled).toHaveBeenCalledWith("energy", false),
		);
		expect(store.setCheckInSlots).not.toHaveBeenCalled();
		expect(view.getAllByText("Off")).toHaveLength(2);
	});

	it("turns a score back on into the sitting it already had", async () => {
		const setEnabled = jest.fn(
			async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics.map((metric) =>
					metric.metricSlug === metricSlug ? { ...metric, enabled } : metric,
				),
				tags: initial.tags,
			}),
		);
		const store = storeWith({ setEnabled });
		const view = await render(<CheckInSettingsScreen store={store} />);

		await fireEvent.press(
			await view.findByLabelText("Choose when Libido is asked"),
		);
		await fireEvent.press(
			view.getByLabelText("Ask Libido in the Evening check-in"),
		);

		await waitFor(() =>
			expect(setEnabled).toHaveBeenCalledWith("libido", true),
		);
		// Its stored sitting already matched, so nothing had to be written twice.
		expect(store.setCheckInSlots).not.toHaveBeenCalled();
	});

	it("counts the tags a group has on and toggles them without leaving the sheet", async () => {
		const setEnabled = jest.fn(
			async (metricSlug: string, enabled: boolean) => ({
				metrics: initial.metrics,
				tags: initial.tags.map((tag) =>
					tag.metricSlug === metricSlug ? { ...tag, enabled } : tag,
				),
			}),
		);
		const store = storeWith({ setEnabled });
		const view = await render(<CheckInSettingsScreen store={store} />);

		expect(await view.findByText("Body")).toBeTruthy();
		expect(view.getByText("Sexual")).toBeTruthy();
		expect(view.getByText("1 of 2 on")).toBeTruthy();

		await fireEvent.press(view.getByLabelText("Choose Body tags"));
		expect(view.getByLabelText("Remove Training tag")).toBeTruthy();

		await fireEvent.press(view.getByLabelText("Add Illness tag"));

		await waitFor(() =>
			expect(setEnabled).toHaveBeenCalledWith("illness", true),
		);
		// A group is set in one visit, so the sheet is still open afterwards.
		expect(view.getByLabelText("Remove Illness tag")).toBeTruthy();
		expect(view.getByText("2 of 2 on")).toBeTruthy();
	});
});
