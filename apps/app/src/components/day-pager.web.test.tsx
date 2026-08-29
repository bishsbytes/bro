import { act, fireEvent, render } from "@testing-library/react-native";
import { FlatList, StyleSheet, Text } from "react-native";
import { DayPager } from "./day-pager.web";

describe("web day pager", () => {
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("constrains horizontal cells to the pager height", async () => {
		const view = await render(
			<DayPager
				days={["2026-08-28", "2026-08-29"]}
				selectedDay="2026-08-29"
				onPreviewDay={jest.fn()}
				onSelectDay={jest.fn()}
				renderDay={(localDay) => <Text>{localDay}</Text>}
			/>,
		);

		const page = view.getByTestId("today-day-page-2026-08-29");
		expect(StyleSheet.flatten(page.parent?.props.style)).toMatchObject({
			height: "100%",
			minHeight: 0,
		});
	});

	it("commits a day after web scrolling settles", async () => {
		jest.useFakeTimers();
		const onPreviewDay = jest.fn();
		const onSelectDay = jest.fn();
		const view = await render(
			<DayPager
				days={["2026-08-28", "2026-08-29"]}
				selectedDay="2026-08-29"
				onPreviewDay={onPreviewDay}
				onSelectDay={onSelectDay}
				renderDay={(localDay) => <Text>{localDay}</Text>}
			/>,
		);
		const pager = view.getByTestId("today-day-pager");

		await fireEvent.scroll(pager, {
			nativeEvent: { contentOffset: { x: 0, y: 0 } },
		});
		expect(onPreviewDay).toHaveBeenCalledWith("2026-08-28");
		expect(onSelectDay).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(200);
		});
		expect(onSelectDay).toHaveBeenCalledWith("2026-08-28");
	});

	it("recentres the existing pager before painting a new day window", async () => {
		const scrollToIndex = jest
			.spyOn(FlatList.prototype, "scrollToIndex")
			.mockImplementation(() => undefined);
		const props = {
			onPreviewDay: jest.fn(),
			onSelectDay: jest.fn(),
			renderDay: (localDay: string) => <Text>{localDay}</Text>,
		};
		const view = await render(
			<DayPager
				{...props}
				days={["2026-08-28", "2026-08-29"]}
				selectedDay="2026-08-29"
			/>,
		);
		const pager = view.getByTestId("today-day-pager");
		scrollToIndex.mockClear();

		await view.rerender(
			<DayPager
				{...props}
				days={["2026-08-27", "2026-08-28", "2026-08-29"]}
				selectedDay="2026-08-28"
			/>,
		);

		expect(view.getByTestId("today-day-pager")).toBe(pager);
		expect(scrollToIndex).toHaveBeenCalledWith({ animated: false, index: 1 });
	});
});
