import { KILOGRAMS_PER_POUND } from "@bro/domain";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet as NativeStyleSheet } from "react-native";
import { BodyLogSurfaceProvider } from "./body/body-log-surface-context";
import type {
	BodyMetricBaseline,
	BodyMetricSummary,
	BodyOverview,
} from "./body/body-store";
import { QuickLogFab } from "./components/quick-log-fab";
import { i18n } from "./i18n";
import { BodyScreen } from "./screens/body/body-screen";

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

function metric(overrides: Partial<BodyMetricSummary>): BodyMetricSummary {
	return {
		metricSlug: "waist",
		label: "Waist",
		dimension: "length",
		displayUnit: "cm",
		bodyGroup: "measurements",
		manualCapture: "measurement_session",
		healthImport: false,
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
		manualCapture: "both",
		healthImport: true,
	});
}

function restingHeartRateMetric(tracked: boolean): BodyMetricSummary {
	return metric({
		metricSlug: "resting_heart_rate",
		label: "Resting heart rate",
		dimension: "rate_bpm",
		displayUnit: null,
		editablePresentation: {
			metricSlug: "resting_heart_rate",
			label: "Resting heart rate",
			dimension: "rate_bpm",
			displayUnit: "bpm",
		},
		tracked,
		position: 5,
		bodyGroup: "health_fitness",
		manualCapture: "standalone",
		healthImport: true,
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
		<BodyLogSurfaceProvider>
			<QuickLogFab
				bottom={24}
				bodyActive
				isNicotineEnabled={async () => false}
			/>
			<BodyScreen
				store={{
					loadOverview: jest.fn(async () => overview),
					setTracked: jest.fn(),
					recordMeasurements: jest.fn(),
					...store,
				}}
			/>
		</BodyLogSurfaceProvider>,
	);
}

async function openBodyLog(screen: Awaited<ReturnType<typeof mountedWith>>) {
	await fireEvent.press(await screen.findByLabelText("Log"));
	await fireEvent.press(screen.getByLabelText("Body"));
}

describe("Body screen", () => {
	beforeEach(() => jest.clearAllMocks());

	it("records a tracked measurement in canonical units", async () => {
		const overview = overviewOf([weightMetric(true)]);
		const recordMeasurements = jest.fn(async () => overview);
		const screen = await mountedWith(overview, { recordMeasurements });

		expect(screen.queryByLabelText("Weight (stones)")).toBeNull();
		await openBodyLog(screen);
		await fireEvent.press(screen.getByLabelText("Weight"));
		await fireEvent.changeText(screen.getByLabelText("Weight (stones)"), "12");
		await fireEvent.changeText(screen.getByLabelText("Weight (pounds)"), "4");
		await fireEvent.press(screen.getByLabelText("Save reading"));

		expect(recordMeasurements).toHaveBeenCalledWith([
			{
				metricSlug: "weight",
				canonicalValue: 172 * KILOGRAMS_PER_POUND,
			},
		]);
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
		const recordMeasurements = jest.fn();
		try {
			const screen = await mountedWith(overviewOf([weightMetric(true)]), {
				recordMeasurements,
			});

			await openBodyLog(screen);
			await fireEvent.press(screen.getByLabelText("Weight"));
			await fireEvent.changeText(
				screen.getByLabelText("Weight (stones)"),
				"heavy",
			);
			await fireEvent.press(screen.getByLabelText("Save reading"));

			expect(recordMeasurements).not.toHaveBeenCalled();
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

	it("saves a partial tape and body-fat session in one store call", async () => {
		const overview = overviewOf([
			weightMetric(true),
			metric({
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
			}),
			metric({ metricSlug: "waist", label: "Waist" }),
		]);
		const recordMeasurements = jest.fn(async () => overview);
		const screen = await mountedWith(overview, { recordMeasurements });

		await openBodyLog(screen);
		await fireEvent.press(screen.getByLabelText("Take measurements"));
		await fireEvent.changeText(screen.getByLabelText("Body fat (%)"), "18");
		await fireEvent.changeText(screen.getByLabelText("Waist (cm)"), "86");
		await fireEvent.press(screen.getByLabelText("Save measurements"));

		expect(recordMeasurements).toHaveBeenCalledWith([
			{ metricSlug: "body_fat", canonicalValue: 0.18 },
			{ metricSlug: "waist", canonicalValue: 0.86 },
		]);
	});

	it("logs resting heart rate manually under heart and fitness", async () => {
		const overview = overviewOf([restingHeartRateMetric(true)]);
		const recordMeasurements = jest.fn(async () => overview);
		const screen = await mountedWith(overview, { recordMeasurements });

		expect(
			await screen.findByLabelText("Resting heart rate. Nothing logged yet"),
		).toBeTruthy();
		await openBodyLog(screen);
		await fireEvent.press(screen.getByLabelText("Resting heart rate"));
		await fireEvent.changeText(
			screen.getByLabelText("Resting heart rate (bpm)"),
			"58",
		);
		await fireEvent.press(screen.getByLabelText("Save reading"));

		expect(recordMeasurements).toHaveBeenCalledWith([
			{ metricSlug: "resting_heart_rate", canonicalValue: 58 },
		]);
	});

	it("places resting heart rate in its own compact-gauge card", async () => {
		const heartRate = restingHeartRateMetric(true);
		heartRate.baseline = {
			current: {
				value: 58,
				formatted: "58 bpm",
				observedAt: Date.parse("2026-09-02T08:00:00.000Z"),
				localDay: "2026-09-02",
			},
			previous: null,
			direction: "none",
			changeFormatted: null,
			usualRange: null,
			rail: {
				min: 54,
				max: 62,
				minFormatted: "54 bpm",
				maxFormatted: "62 bpm",
			},
			readingCount: 1,
		};
		const screen = await mountedWith(overviewOf([heartRate]));

		expect(
			await screen.findByLabelText("Resting heart rate. First reading."),
		).toBeTruthy();
		expect(screen.getByTestId("body-health-fitness-card")).toBeTruthy();
		expect(screen.queryByTestId("baseline-gauge")).toBeNull();
	});

	it("groups sleep and steps with resting heart rate under Health & fitness", async () => {
		const sleep = metric({
			metricSlug: "sleep_duration",
			label: "Sleep",
			dimension: "time",
			displayUnit: null,
			bodyGroup: "health_fitness",
			manualCapture: null,
			userEnterable: false,
			editablePresentation: null,
			tracked: false,
			position: 3,
		});
		const steps = metric({
			metricSlug: "steps",
			label: "Steps",
			dimension: "count",
			displayUnit: null,
			bodyGroup: "health_fitness",
			manualCapture: null,
			userEnterable: false,
			editablePresentation: null,
			tracked: false,
			position: 4,
		});
		const screen = await mountedWith(
			overviewOf([sleep, steps, restingHeartRateMetric(true)]),
		);

		expect(await screen.findByText("Health & fitness")).toBeTruthy();
		expect(screen.getByLabelText("Sleep. Nothing logged yet")).toBeTruthy();
		expect(screen.getByLabelText("Steps. Nothing logged yet")).toBeTruthy();
		expect(
			screen.getByLabelText("Resting heart rate. Nothing logged yet"),
		).toBeTruthy();
		expect(screen.getByTestId("body-health-fitness-card")).toBeTruthy();
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

		expect(await screen.findByText("No measurements tracked")).toBeTruthy();
		expect(screen.queryByLabelText("Chest. Nothing logged yet")).toBeNull();
		expect(screen.queryByLabelText("Chest (cm)")).toBeNull();

		await fireEvent.press(screen.getAllByLabelText("Manage body data")[0]);
		await fireEvent.press(screen.getByLabelText("Track Chest"));
		await fireEvent.press(
			screen.getByTestId("modal-sheet-backdrop", {
				includeHiddenElements: true,
			}),
		);

		expect(setTracked).toHaveBeenCalledWith("chest", true);
		// A site with nothing taped yet still has a compact row so it is included
		// in the next measuring session and its detail page remains reachable.
		expect(
			await screen.findByLabelText("Chest. Nothing logged yet"),
		).toBeTruthy();
		await openBodyLog(screen);
		await fireEvent.press(screen.getByLabelText("Take measurements"));
		expect(screen.getByLabelText("Chest (cm)")).toBeTruthy();
	});

	it("summarises a taped site in a compact baseline-change row", async () => {
		const screen = await mountedWith(
			overviewOf([metric({ baseline: TAPED_WAIST })]),
		);

		expect(
			await screen.findByLabelText("Waist. 1.5 cm down since 3 Aug."),
		).toBeTruthy();
		expect(screen.getByText("−1.5 cm")).toBeTruthy();
		expect(screen.getByText("since 3 Aug")).toBeTruthy();
		expect(screen.getByTestId("body-measurements-card")).toBeTruthy();
	});

	it("shows body fat as a compact measurement row", async () => {
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
		expect(screen.queryByLabelText("Body fat (%)")).toBeNull();
		expect(screen.getByTestId("body-measurements-card")).toBeTruthy();

		await fireEvent.press(row);
		expect(mockPush).toHaveBeenCalledWith({
			pathname: "/body/[slug]",
			params: { slug: "body_fat" },
		});
	});

	it("opens a tape site's measurement page when its compact row is pressed", async () => {
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

		expect(screen.queryByTestId("baseline-gauge")).toBeNull();
		const waistRow = await screen.findByLabelText(
			"Waist. 1.5 cm down since 3 Aug.",
		);
		const neckRow = screen.getByLabelText("Neck. Nothing logged yet");
		expect(
			NativeStyleSheet.flatten(neckRow.props.style).borderBottomWidth,
		).toBe(1);
		expect(
			NativeStyleSheet.flatten(waistRow.props.style).borderBottomWidth,
		).toBe(0);
		await fireEvent.press(waistRow);

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
