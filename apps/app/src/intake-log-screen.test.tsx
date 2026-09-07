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
	it("keeps a decimal portion when stepping and saves the edited amount", async () => {
		const props = stores();
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Edit amount for Water"));
		await fireEvent.changeText(view.getByLabelText("How many"), "1.25");
		await fireEvent.press(view.getByLabelText("Increase amount"));
		expect(view.getByLabelText("How many").props.value).toBe("1.75");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.repeatEvent).toHaveBeenCalledWith(
			"earlier-water",
			expect.anything(),
			1.75,
		);
	});

	it("converts volume into a portion without changing the amount consumed", async () => {
		const props = stores();
		props.store.loadLog.mockResolvedValue({
			...snapshot,
			system: DRINK_CATALOGUE.filter((item) => item.key === "drink:water"),
		});
		const view = await render(<IntakeLogScreen {...props} />);
		await fireEvent.press(await view.findByLabelText("Log Water"));
		await fireEvent.press(view.getByLabelText("Use ml"));
		expect(view.getByLabelText("How many").props.value).toBe("250");
		await fireEvent.changeText(view.getByLabelText("How many"), "375");
		await fireEvent.press(view.getByLabelText("250 ml glass"));
		expect(view.getByLabelText("How many").props.value).toBe("1.5");
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
		await fireEvent.press(view.getByLabelText("Use ml"));
		await fireEvent.changeText(view.getByLabelText("How many"), "");
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
		await fireEvent.changeText(
			view.getByLabelText("What was it?"),
			"Homemade drink",
		);
		await fireEvent.changeText(view.getByLabelText("Volume (ml)"), "300");
		await fireEvent.press(view.getByLabelText("Add to intake"));
		expect(props.store.logFree).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "drink",
				name: "Homemade drink",
				volumeL: 0.3,
				constituents: { fluid: 0.3 },
			}),
		);
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
		expect(await view.findByLabelText("What was it?")).toBeTruthy();
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
