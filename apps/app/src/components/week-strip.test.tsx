import {
	act,
	fireEvent,
	render,
	waitFor,
	within,
} from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import * as themeModule from "../theme/unistyles";
import { WeekStrip, type WeekStripDayIndicator } from "./week-strip";

let mockThemeOverride: unknown;

jest.mock("../theme/unistyles", () => {
	const actual = jest.requireActual("../theme/unistyles");
	return {
		...actual,
		useUnistyles: () =>
			mockThemeOverride
				? { theme: mockThemeOverride, rt: {} }
				: actual.useUnistyles(),
	};
});

const TODAY = "2026-08-20";

function indicators() {
	return new Map<string, WeekStripDayIndicator>([
		[
			"2026-08-17",
			{ hasCheckIn: false, habitsScheduled: 0, habitsCompleted: 0 },
		],
		[
			"2026-08-18",
			{ hasCheckIn: false, habitsScheduled: 3, habitsCompleted: 0 },
		],
		[
			"2026-08-19",
			{ hasCheckIn: true, habitsScheduled: 3, habitsCompleted: 2 },
		],
		[
			"2026-08-20",
			{ hasCheckIn: true, habitsScheduled: 3, habitsCompleted: 3 },
		],
	]);
}

async function renderStrip(
	overrides: { onSelectDay?: jest.Mock; onVisibleRangeChange?: jest.Mock } = {},
) {
	const onSelectDay = overrides.onSelectDay ?? jest.fn();
	const onVisibleRangeChange = overrides.onVisibleRangeChange ?? jest.fn();
	return {
		onSelectDay,
		onVisibleRangeChange,
		view: await render(
			<WeekStrip
				todayLocalDay={TODAY}
				selectedDay="2026-08-19"
				weekStart="monday"
				indicators={indicators()}
				onSelectDay={onSelectDay}
				onVisibleRangeChange={onVisibleRangeChange}
			/>,
		),
	};
}

describe("WeekStrip", () => {
	beforeEach(() => {
		mockThemeOverride = undefined;
	});

	it("renders the current week and reports its inclusive visible range", async () => {
		const { view, onVisibleRangeChange } = await renderStrip();

		await waitFor(() =>
			expect(onVisibleRangeChange).toHaveBeenCalledWith(
				"2026-08-17",
				"2026-08-23",
			),
		);
		expect(view.getByTestId("week-strip-day-2026-08-17")).toBeTruthy();
		expect(view.getByTestId("week-strip-day-2026-08-23")).toBeTruthy();
		expect(view.getAllByText("Mo").length).toBeGreaterThan(0);
		expect(view.getByTestId("week-strip").props.accessibilityLabel).toMatch(
			/^Week of /,
		);
	});

	it("selects enabled days and exposes selection accessibly", async () => {
		const themed = {
			...themeModule.lightTheme,
			colors: {
				...themeModule.lightTheme.colors,
				text: "neutral-text",
				brand: "accent-colour",
				accent: "accent-colour",
			},
		} as unknown as typeof themeModule.lightTheme;
		mockThemeOverride = themed;
		const { view, onSelectDay } = await renderStrip();
		const yesterday = view.getByTestId("week-strip-day-2026-08-19");

		expect(yesterday.props.accessibilityLabel).toBe(
			"Yesterday, check-in logged, 2 of 3 habits done",
		);
		expect(yesterday.props.accessibilityState).toMatchObject({
			selected: true,
			disabled: false,
		});
		expect(
			NativeStyleSheet.flatten(within(yesterday).getByText("19").props.style)
				.color,
		).toBe("accent-colour");
		await fireEvent.press(view.getByTestId("week-strip-day-2026-08-18"));
		expect(onSelectDay).toHaveBeenCalledWith("2026-08-18");
	});

	it("disables future days in the current week", async () => {
		const { view, onSelectDay } = await renderStrip();
		const tomorrow = view.getByTestId("week-strip-day-2026-08-21");

		expect(tomorrow.props.accessibilityState).toMatchObject({ disabled: true });
		await fireEvent.press(tomorrow);
		expect(onSelectDay).not.toHaveBeenCalled();
	});

	it("renders empty, partial, complete, and unscheduled indicator states", async () => {
		const { view } = await renderStrip();

		expect(
			view.getByTestId("week-strip-day-2026-08-17").props.accessibilityLabel,
		).toMatch(/no check-in, no habits scheduled$/);
		expect(view.queryByTestId("week-strip-adherence-2026-08-17")).toBeNull();
		expect(
			view.getByTestId("week-strip-day-2026-08-18").props.accessibilityLabel,
		).toMatch(/no check-in, 0 of 3 habits done$/);
		expect(
			view.getByTestId("week-strip-day-2026-08-19").props.accessibilityLabel,
		).toMatch(/check-in logged, 2 of 3 habits done$/);
		expect(
			view.getByTestId("week-strip-day-2026-08-20").props.accessibilityLabel,
		).toMatch(/check-in logged, 3 of 3 habits done$/);
		expect(view.getByTestId("week-strip-check-in-2026-08-20")).toBeTruthy();
		expect(view.getByTestId("week-strip-adherence-2026-08-18")).toBeTruthy();
		expect(view.getByTestId("week-strip-adherence-2026-08-19")).toBeTruthy();
		expect(view.getByTestId("week-strip-adherence-2026-08-20")).toBeTruthy();
	});

	it("reveals earlier pages with a rightward swipe and extends backward", async () => {
		const { view, onVisibleRangeChange } = await renderStrip();
		const list = view.getByTestId("week-strip");
		expect(list.props.inverted).toBe(true);
		const initialCount = list.props.data.length;
		const initialLabel = list.props.accessibilityLabel;
		const previousWeekOffset = list.props.getItemLayout(null, 1).offset;

		fireEvent(list, "momentumScrollEnd", {
			nativeEvent: { contentOffset: { x: previousWeekOffset, y: 0 } },
		});
		expect(onVisibleRangeChange).toHaveBeenCalledWith(
			"2026-08-10",
			"2026-08-16",
		);
		await waitFor(() =>
			expect(view.getByTestId("week-strip").props.accessibilityLabel).not.toBe(
				initialLabel,
			),
		);

		await act(async () => list.props.onEndReached());
		await waitFor(() =>
			expect(view.getByTestId("week-strip").props.data).toHaveLength(
				initialCount + 8,
			),
		);
	});

	it("keeps a newly selected week visible", async () => {
		const { view, onSelectDay, onVisibleRangeChange } = await renderStrip();

		await view.rerender(
			<WeekStrip
				todayLocalDay={TODAY}
				selectedDay="2026-08-16"
				weekStart="monday"
				indicators={indicators()}
				onSelectDay={onSelectDay}
				onVisibleRangeChange={onVisibleRangeChange}
			/>,
		);

		await waitFor(() =>
			expect(onVisibleRangeChange).toHaveBeenCalledWith(
				"2026-08-10",
				"2026-08-16",
			),
		);
		expect(view.getByTestId("week-strip").props.accessibilityLabel).toMatch(
			/^Week of .*10.*2026$/,
		);
	});
});
