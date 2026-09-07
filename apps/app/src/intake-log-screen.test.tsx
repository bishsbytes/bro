import { DRINK_CATALOGUE } from "@bro/domain/drink-catalogue";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type {
	IntakeLogSnapshot,
	PresentedIntakeEvent,
} from "./intake/intake-store";
import { IntakeLogScreen } from "./screens/intake/intake-log-screen";

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	router: { push: jest.fn(), replace: jest.fn() },
	useFocusEffect: (effect: () => void) => {
		const React = jest.requireActual<typeof import("react")>("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const recent = {
	event: {
		id: "earlier-water",
		name: "Water",
		kind: "drink",
		brand: null,
		quantity: 2,
		portionLabel: "250 ml glass",
		localDay: "2026-09-07",
		constituents: {},
	},
	detail: "",
	contributions: "",
} as PresentedIntakeEvent;

const snapshot: IntakeLogSnapshot = {
	localDay: "2026-09-07",
	today: "2026-09-07",
	defaultTime: "12:00",
	enabledKinds: ["food", "drink"],
	recents: [recent],
	library: [],
	system: [],
};

function stores() {
	return {
		store: {
			loadLog: jest.fn(async () => snapshot),
			repeatEvent: jest.fn(async () => ({ ...recent.event, id: "new-water" })),
			deleteEvent: jest.fn(async () => undefined),
			log: jest.fn(),
			logFree: jest.fn(),
		},
		searchStore: {
			loadCached: jest.fn(async () => ({
				query: "",
				results: [],
				fromCache: true,
				offline: true,
				message: null,
			})),
			search: jest.fn(),
		},
	};
}

describe("recent intake actions", () => {
	it("saves the chosen date and time from the detail rows", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Edit amount for Water"));
		await fireEvent.press(view.getByLabelText("Date"));
		await fireEvent(
			view.getByTestId("date-picker"),
			"valueChange",
			{ type: "set" },
			new Date(2026, 8, 6, 12),
		);
		await fireEvent.press(view.getByText("Done"));
		await fireEvent.press(view.getByLabelText("Time"));
		await fireEvent(
			view.getByTestId("time-picker"),
			"valueChange",
			{ type: "set" },
			new Date(2026, 8, 6, 8, 15),
		);
		await fireEvent.press(view.getByText("Done"));
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.repeatEvent).toHaveBeenCalledWith(
			"earlier-water",
			{ localDay: "2026-09-06", time: "08:15" },
			2,
		);
	});

	it("keeps a decimal portion when stepping and saves the edited amount", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Edit amount for Water"));
		await fireEvent.changeText(view.getByLabelText("Amount"), "1.25");
		await fireEvent.press(view.getByLabelText("Increase amount"));
		expect(view.getByLabelText("Amount").props.value).toBe("1.75");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.repeatEvent).toHaveBeenCalledWith(
			"earlier-water",
			expect.anything(),
			1.75,
		);
	});

	it("chooses known portions in a sheet and converts volume without changing the amount consumed", async () => {
		const props = stores();
		props.store.loadLog.mockResolvedValue({
			...snapshot,
			system: DRINK_CATALOGUE.filter((item) => item.key === "drink:water"),
		});
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Log Water"));
		await fireEvent.press(view.getByLabelText("Choose amount unit"));
		expect(view.getByTestId("bottom-sheet")).toBeTruthy();
		expect(
			view.getByRole("radio", { name: "250 ml glass" }).props.accessibilityState
				.checked,
		).toBe(true);
		await fireEvent.press(
			view.getByRole("button", { name: "Close portion picker" }),
		);
		expect(view.getByLabelText("Amount").props.value).toBe("1");
		await fireEvent.press(view.getByLabelText("Choose amount unit"));
		await fireEvent.press(view.getByLabelText("Use ml"));
		expect(view.queryByTestId("bottom-sheet")).toBeNull();
		expect(view.getByLabelText("Amount").props.value).toBe("250");
		await fireEvent.changeText(view.getByLabelText("Amount"), "375");
		await fireEvent.press(view.getByLabelText("Choose amount unit"));
		expect(
			view.getByRole("radio", { name: "Use ml" }).props.accessibilityState
				.checked,
		).toBe(true);
		await fireEvent.press(view.getByLabelText("250 ml glass"));
		expect(view.getByLabelText("Amount").props.value).toBe("1.5");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.log).toHaveBeenCalledWith(
			{ type: "system", key: "drink:water" },
			{ type: "portion", portionId: "glass-250ml", quantity: 1.5 },
			expect.anything(),
			null,
		);
	});

	it("requires a new valid amount after clearing a volume and keeps cancellation unsaved", async () => {
		const props = stores();
		props.store.loadLog.mockResolvedValue({
			...snapshot,
			system: DRINK_CATALOGUE.filter((item) => item.key === "drink:water"),
		});
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Log Water"));
		await fireEvent.press(view.getByLabelText("Choose amount unit"));
		await fireEvent.press(view.getByLabelText("Use ml"));
		await fireEvent.changeText(view.getByLabelText("Amount"), "");
		expect(view.getByLabelText("Add to intake")).toBeDisabled();
		expect(view.getByText("Enter an amount greater than zero.")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Cancel"));
		expect(props.store.log).not.toHaveBeenCalled();
	});

	it("logs a custom drink with known volume and leaves unknown nutrition absent", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Add something else"));
		await fireEvent.press(view.getByLabelText("Drink"));
		await fireEvent.changeText(view.getByLabelText("Name"), "Homemade drink");
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		const portion = view.getByLabelText("Search or add a portion");
		expect(view.getByRole("radio", { name: "mug" })).toBeTruthy();
		expect(view.queryByRole("radio", { name: "slice" })).toBeNull();
		await fireEvent.changeText(portion, "GLA");
		expect(view.queryByRole("radio", { name: "mug" })).toBeNull();
		await fireEvent.press(view.getByRole("radio", { name: "glass" }));
		expect(view.queryByLabelText("Search or add a portion")).toBeNull();
		expect(
			view.getByRole("button", { name: "Choose portion" }).props
				.accessibilityValue.text,
		).toBe("glass");
		expect(view.getByLabelText("Add to intake")).toBeDisabled();
		await fireEvent.changeText(view.getByLabelText("Volume (ml)"), "300");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.logFree).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "drink",
				name: "Homemade drink",
				portionLabel: "glass",
				volumeL: 0.3,
				constituents: { fluid: 0.3 },
			}),
		);
	});

	it("adds a custom portion beside the amount and saves both", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Add something else"));
		await fireEvent.changeText(view.getByLabelText("Name"), "Homemade bites");
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		const portion = view.getByLabelText("Search or add a portion");
		expect(view.getByRole("radio", { name: "slice" })).toBeTruthy();
		expect(view.queryByRole("radio", { name: "mug" })).toBeNull();
		await fireEvent.changeText(portion, "  snack bag  ");
		// Filtering to a custom label must not create a smaller native snap point.
		expect(view.getByTestId("bottom-sheet").props.enableDynamicSizing).toBe(
			false,
		);
		expect(view.getByTestId("bottom-sheet").props.snapPoints).toEqual(["90%"]);
		await fireEvent.press(
			view.getByRole("button", { name: "Add “snack bag”" }),
		);
		expect(
			view.getByRole("button", { name: "Choose portion" }).props
				.accessibilityValue.text,
		).toBe("snack bag");
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		expect(
			view.getByRole("radio", { name: "snack bag" }).props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent.press(
			view.getByRole("button", { name: "Close portion picker" }),
		);
		await fireEvent.changeText(view.getByLabelText("Amount"), "1.5");
		await fireEvent.changeText(view.getByLabelText("Energy (kcal)"), "120");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.logFree).toHaveBeenCalledWith(
			expect.objectContaining({
				portionLabel: "snack bag",
				quantity: 1.5,
			}),
		);
	});

	it("suggests previous portions and cancels a search without changing the selection or amount", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Add something else"));
		await fireEvent.press(view.getByLabelText("Drink"));
		await fireEvent.changeText(view.getByLabelText("Amount"), "1.5");
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		await fireEvent.changeText(
			view.getByLabelText("Search or add a portion"),
			"250 ML",
		);
		await fireEvent.press(view.getByRole("radio", { name: "250 ml glass" }));
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		expect(view.getByLabelText("Search or add a portion").props.value).toBe("");
		expect(
			view.getByRole("radio", { name: "250 ml glass" }).props.accessibilityState
				.selected,
		).toBe(true);
		await fireEvent.changeText(
			view.getByLabelText("Search or add a portion"),
			"travel cup",
		);
		await fireEvent.press(
			view.getByRole("button", { name: "Close portion picker" }),
		);
		expect(
			view.getByRole("button", { name: "Choose portion" }).props
				.accessibilityValue.text,
		).toBe("250 ml glass");
		expect(view.getByLabelText("Amount").props.value).toBe("1.5");
		await fireEvent.changeText(view.getByLabelText("Name"), "Tea");
		await fireEvent.changeText(view.getByLabelText("Volume (ml)"), "400");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.logFree).toHaveBeenCalledWith(
			expect.objectContaining({
				portionLabel: "250 ml glass",
				quantity: 1.5,
			}),
		);
	});

	it("accepts a portion with the keyboard and avoids duplicate custom options", async () => {
		const view = await render(<IntakeLogScreen {...stores()} />);
		await fireEvent.press(await view.findByLabelText("Add something else"));
		expect(view.queryByLabelText("Search or add a portion")).toBeNull();
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		const search = view.getByLabelText("Search or add a portion");
		await fireEvent.changeText(search, " SLICE ");
		expect(view.getByRole("radio", { name: "slice" })).toBeTruthy();
		expect(view.queryByRole("button", { name: "Add “SLICE”" })).toBeNull();
		await fireEvent(search, "submitEditing");
		expect(view.queryByLabelText("Search or add a portion")).toBeNull();
		expect(
			view.getByRole("button", { name: "Choose portion" }).props
				.accessibilityValue.text,
		).toBe("slice");
		await fireEvent.press(view.getByRole("button", { name: "Choose portion" }));
		await fireEvent.changeText(
			view.getByLabelText("Search or add a portion"),
			"snack bag",
		);
		await fireEvent(
			view.getByLabelText("Search or add a portion"),
			"submitEditing",
		);
		expect(
			view.getByRole("button", { name: "Choose portion" }).props
				.accessibilityValue.text,
		).toBe("snack bag");
	});

	it("edits before saving when the row is tapped", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Edit amount for Water"));
		expect(props.store.repeatEvent).not.toHaveBeenCalled();
		expect(view.getByLabelText("Add to intake")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Add to intake"));
		await waitFor(() =>
			expect(props.store.repeatEvent).toHaveBeenCalledWith(
				"earlier-water",
				expect.objectContaining({ localDay: "2026-09-07" }),
				2,
			),
		);
	});

	it("repeats the displayed portion and Undo removes only the new event", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		expect(await view.findByText("2 × 250 ml glass")).toBeTruthy();
		await fireEvent.press(view.getByLabelText("Log Water again"));
		await waitFor(() =>
			expect(view.getByLabelText("Log Water again")).toBeEnabled(),
		);
		expect(props.store.repeatEvent).toHaveBeenCalledWith(
			"earlier-water",
			expect.objectContaining({ localDay: "2026-09-07" }),
			undefined,
		);
		await fireEvent.press(await view.findByLabelText("Undo"));
		await waitFor(() =>
			expect(props.store.deleteEvent).toHaveBeenCalledWith("new-water"),
		);
		await fireEvent.press(view.getByLabelText("Add something else"));
		expect(await view.findByLabelText("Name")).toBeTruthy();
	});

	it("keeps a successful save and Undo when refreshing the list fails", async () => {
		const props = stores();
		props.store.loadLog
			.mockResolvedValueOnce(snapshot)
			.mockRejectedValueOnce(new Error("Could not refresh"));
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Log Water again"));
		expect(await view.findByText("Water added")).toBeTruthy();
		expect(await view.findByText("Could not refresh")).toBeTruthy();
		expect(view.getByLabelText("Undo")).toBeTruthy();
		expect(props.store.repeatEvent).toHaveBeenCalledTimes(1);
	});
});
