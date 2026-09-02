import { KILOGRAMS_PER_POUND } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import { type StyleProp, StyleSheet, type TextStyle } from "react-native";
import type {
	BodyMetricBaseline,
	BodyMetricSummary,
	BodyOverview,
} from "./body/body-store";
import { i18n } from "./i18n";
import { BodyScreen } from "./screens/body/body-screen";
import { lightTheme } from "./theme/unistyles";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
	router: { push: (...args: unknown[]) => mockPush(...args) },
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

jest.mock("react-native-safe-area-context", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const { View } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
		SafeAreaView: ({
			edges = [],
			...props
		}: {
			edges?: readonly string[];
			children?: React.ReactNode;
		}) =>
			React.createElement(View, {
				...props,
				testID: `safe-area-${edges.join("-")}`,
			}),
	};
});

const EMPTY_BASELINE: BodyMetricBaseline = {
	current: null,
	previous: null,
	direction: "none",
	changeFormatted: null,
	usualRange: null,
	rail: null,
	readingCount: 0,
};

/** A waist taped twice, a centimetre and a half down, inside its own range. */
const TAPED_WAIST: BodyMetricBaseline = {
	current: {
		value: 0.865,
		formatted: "86.5 cm",
		observedAt: Date.parse("2026-09-02T08:00:00.000Z"),
		localDay: "2026-09-02",
	},
	previous: {
		value: 0.88,
		formatted: "88.0 cm",
		observedAt: Date.parse("2026-08-03T08:00:00.000Z"),
		localDay: "2026-08-03",
	},
	direction: "down",
	changeFormatted: "1.5 cm",
	usualRange: {
		min: 0.85,
		max: 0.88,
		minFormatted: "85.0 cm",
		maxFormatted: "88.0 cm",
	},
	rail: {
		min: 0.84,
		max: 0.89,
		minFormatted: "84.0 cm",
		maxFormatted: "89.0 cm",
	},
	readingCount: 6,
};

/** A bicep taped twice, four millimetres up. */
const TAPED_BICEP: BodyMetricBaseline = {
	current: {
		value: 0.368,
		formatted: "36.8 cm",
		observedAt: Date.parse("2026-09-02T08:00:00.000Z"),
		localDay: "2026-09-02",
	},
	previous: {
		value: 0.364,
		formatted: "36.4 cm",
		observedAt: Date.parse("2026-08-03T08:00:00.000Z"),
		localDay: "2026-08-03",
	},
	direction: "up",
	changeFormatted: "0.4 cm",
	usualRange: null,
	rail: {
		min: 0.36,
		max: 0.372,
		minFormatted: "36.0 cm",
		maxFormatted: "37.2 cm",
	},
	readingCount: 2,
};

function metric(overrides: Partial<BodyMetricSummary>): BodyMetricSummary {
	return {
		metricSlug: "waist",
		label: "Waist",
		dimension: "length",
		displayUnit: "cm",
		userEnterable: true,
		editablePresentation: {
			metricSlug: "waist",
			label: "Waist",
			dimension: "length",
			displayUnit: "cm",
		},
		tracked: true,
		visible: true,
		hasImportedData: false,
		position: 1,
		latest: null,
		latestFormatted: null,
		series: { observedDayCount: 0 },
		baseline: EMPTY_BASELINE,
		activeGoal: null,
		...overrides,
	} as unknown as BodyMetricSummary;
}

function weightMetric(tracked: boolean): BodyMetricSummary {
	return metric({
		metricSlug: "weight",
		label: "Weight",
		dimension: "mass",
		displayUnit: "st",
		editablePresentation: {
			metricSlug: "weight",
			label: "Weight",
			dimension: "mass",
			displayUnit: "st",
		},
		tracked,
		position: 0,
	});
}

function overviewOf(metrics: BodyMetricSummary[]): BodyOverview {
	return { inputLocale: "en-GB", metrics };
}

function mountedWith(
	overview: BodyOverview,
	store: Partial<Parameters<typeof BodyScreen>[0]["store"]> = {},
) {
	return render(
		<BodyScreen
			store={{
				loadOverview: jest.fn(async () => overview),
				setTracked: jest.fn(),
				recordMeasurement: jest.fn(),
				...store,
			}}
		/>,
	);
}

describe("Body screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("records a tracked measurement in canonical units", async () => {
		const overview = overviewOf([weightMetric(true)]);
		const recordMeasurement = jest.fn(async () => overview);
		const screen = await mountedWith(overview, { recordMeasurement });

		expect(screen.queryByLabelText("Weight (stones)")).toBeNull();
		await fireEvent.press(await screen.findByLabelText("Log Weight"));
		await fireEvent.changeText(screen.getByLabelText("Weight (stones)"), "12");
		await fireEvent.changeText(screen.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(screen.getByLabelText("Save measurement"));

		expect(recordMeasurement).toHaveBeenCalledWith(
			"weight",
			172 * KILOGRAMS_PER_POUND,
		);
		expect(screen.queryByLabelText("Weight (stones)")).toBeNull();
	});

	it("shows a field error and writes nothing for unparseable input", async () => {
		i18n.addResourceBundle(
			"en",
			"validation",
			{ measurement: { invalid: "Use a translated measurement value." } },
			true,
			true,
		);
		const recordMeasurement = jest.fn();
		try {
			const screen = await mountedWith(overviewOf([weightMetric(true)]), {
				recordMeasurement,
			});

			await fireEvent.press(await screen.findByLabelText("Log Weight"));
			await fireEvent.changeText(
				screen.getByLabelText("Weight (stones)"),
				"heavy",
			);
			await fireEvent.press(screen.getByLabelText("Save measurement"));

			expect(recordMeasurement).not.toHaveBeenCalled();
			expect(
				screen.getByText("Use a translated measurement value."),
			).toBeTruthy();
		} finally {
			i18n.addResourceBundle(
				"en",
				"validation",
				{ measurement: { invalid: "Enter a valid measurement." } },
				true,
				true,
			);
		}
	});

	it("leaves an untracked site off the screen until it is added", async () => {
		const setTracked = jest.fn(async () =>
			overviewOf([
				metric({ metricSlug: "chest", label: "Chest", position: 15 }),
			]),
		);
		const screen = await mountedWith(
			overviewOf([
				metric({
					metricSlug: "chest",
					label: "Chest",
					position: 15,
					tracked: false,
					visible: false,
				}),
			]),
			{ setTracked },
		);

		expect(await screen.findByText("Nothing taped yet")).toBeTruthy();
		expect(screen.queryByLabelText("Chest. Nothing logged yet")).toBeNull();
		expect(screen.queryByLabelText("Log Chest")).toBeNull();

		await fireEvent.press(screen.getAllByLabelText("Manage measurements")[0]);
		await fireEvent.press(screen.getByLabelText("Track Chest"));

		expect(setTracked).toHaveBeenCalledWith("chest", true);
		// A site with nothing taped yet still lists: it is where the first
		// reading gets entered.
		expect(
			await screen.findByLabelText("Chest. Nothing logged yet"),
		).toBeTruthy();
		expect(screen.getByLabelText("Log Chest")).toBeTruthy();
		expect(screen.queryByLabelText("Chest (cm)")).toBeNull();
	});

	it("reads a taped site against the user's own range without a verdict", async () => {
		const screen = await mountedWith(
			overviewOf([metric({ baseline: TAPED_WAIST })]),
		);

		expect(
			await screen.findByLabelText(
				"Waist, 86.5 cm. Inside your usual 85.0 cm–88.0 cm. 1.5 cm down since 3 Aug.",
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				"Inside your usual 85.0 cm–88.0 cm. 1.5 cm down since 3 Aug.",
			),
		).toBeTruthy();
		expect(screen.getByText("−1.5 cm")).toBeTruthy();
		expect(screen.getByText("since 3 Aug")).toBeTruthy();
		expect(
			screen.getByLabelText("Waist. 1.5 cm down since 3 Aug."),
		).toBeTruthy();
		expect(screen.getByTestId("gauge-unit").props.children).toBe(" cm");
	});

	it("keeps body fat in the change list without making it a tape-site gauge", async () => {
		const bodyFat = metric({
			metricSlug: "body_fat",
			label: "Body fat",
			dimension: "fraction",
			displayUnit: "%",
			editablePresentation: {
				metricSlug: "body_fat",
				label: "Body fat",
				dimension: "fraction",
				displayUnit: "%",
			},
			position: 2,
		});
		const screen = await mountedWith(overviewOf([bodyFat]));

		const row = await screen.findByLabelText("Body fat. Nothing logged yet");
		expect(row.props.accessibilityState.selected).toBeUndefined();
		expect(screen.queryByLabelText("Body fat (%)")).toBeNull();
		expect(screen.getByText("Nothing taped yet")).toBeTruthy();

		await fireEvent.press(row);
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/body/[slug]",
			params: { slug: "body_fat" },
		});
	});

	it("moves the gauge to the measurement the user taps", async () => {
		const screen = await mountedWith(
			overviewOf([
				metric({ baseline: TAPED_WAIST }),
				metric({
					metricSlug: "neck",
					label: "Neck",
					position: 14,
					editablePresentation: {
						metricSlug: "neck",
						label: "Neck",
						dimension: "length",
						displayUnit: "cm",
					},
				}),
			]),
		);

		// The list reads down the body, so the neck is selected before the waist.
		expect(await screen.findByLabelText("Log Neck")).toBeTruthy();
		await fireEvent.press(
			screen.getByLabelText("Waist. 1.5 cm down since 3 Aug."),
		);

		expect(screen.getByLabelText("Log Waist")).toBeTruthy();
		expect(screen.queryByLabelText("Log Neck")).toBeNull();
	});

	it("marks the selected row and colours neither direction of change", async () => {
		const screen = await mountedWith(
			overviewOf([
				metric({ baseline: TAPED_WAIST }),
				metric({
					metricSlug: "bicep",
					label: "Bicep",
					position: 16,
					baseline: TAPED_BICEP,
				}),
			]),
		);

		const bicepRow = "Bicep. 0.4 cm up since 3 Aug.";
		const waistRow = "Waist. 1.5 cm down since 3 Aug.";
		// The bicep is taped above the waist, so the list opens on it.
		expect(
			(await screen.findByLabelText(bicepRow)).props.accessibilityState,
		).toMatchObject({ selected: true });
		expect(
			screen.getByLabelText(waistRow).props.accessibilityState,
		).toMatchObject({ selected: false });

		await fireEvent.press(screen.getByLabelText(waistRow));
		expect(
			screen.getByLabelText(waistRow).props.accessibilityState,
		).toMatchObject({ selected: true });

		const inkOf = (style: StyleProp<TextStyle>) =>
			StyleSheet.flatten(style)?.color;
		expect(inkOf(screen.getByText("−1.5 cm").props.style)).toBe(
			lightTheme.colors.ink,
		);
		expect(inkOf(screen.getByText("+0.4 cm").props.style)).toBe(
			lightTheme.colors.ink,
		);
	});

	it("opens a measurement's own history from its panel", async () => {
		const screen = await mountedWith(
			overviewOf([metric({ baseline: TAPED_WAIST })]),
		);

		await fireEvent.press(await screen.findByText("Open Waist"));

		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/body/[slug]",
			params: { slug: "waist" },
		});
	});

	it("sends the user to the measuring guide rather than drawing a body", async () => {
		const screen = await mountedWith(
			overviewOf([metric({ baseline: TAPED_WAIST })]),
		);

		await fireEvent.press(await screen.findByText("How to measure"));

		expect(mockPush).toHaveBeenCalledWith("/body/measuring");
	});

	it("leaves the bottom safe area to the tab navigator", async () => {
		const screen = await mountedWith(overviewOf([]));

		expect(await screen.findByTestId("safe-area-")).toBeTruthy();
		expect(screen.queryByTestId("safe-area-bottom")).toBeNull();
	});
});
