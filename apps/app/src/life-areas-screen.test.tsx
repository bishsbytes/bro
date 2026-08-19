import type { ResolvedTrackedMetric, TrackedMetric } from "@bro/database-app";
import { DEFAULT_LIFE_AREA_METRICS } from "@bro/domain/life-area-catalogue";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { LifeAreasScreen } from "./screens/settings/life-areas-screen";

jest.mock("expo-router", () => ({
	useFocusEffect: (effect: () => undefined | (() => void)) => {
		const React = jest.requireActual("react");
		React.useEffect(effect, [effect]);
	},
}));

function trackedMetric(row: ResolvedTrackedMetric): TrackedMetric {
	return {
		id: row.overlayId ?? `overlay-${row.metricSlug}`,
		metricSlug: row.metricSlug,
		position: row.position,
		addedAt: row.enabled ? 1 : null,
		removedAt: row.enabled ? null : 1,
		customLabel: row.customLabel,
		createdAt: 1,
		updatedAt: 1,
	};
}

describe("life areas screen", () => {
	it("reorders, disables, and relabels future wheel areas offline", async () => {
		let overlays: ResolvedTrackedMetric[] = DEFAULT_LIFE_AREA_METRICS.map(
			(area) => ({
				...area,
				enabled: area.enabled ?? true,
				overlayId: null,
				addedAt: null,
				removedAt: null,
				customLabel: null,
			}),
		);
		const repository = {
			listResolved: jest.fn(async () => overlays),
			configure: jest.fn(
				async (metricSlug: string, position: number, enabled: boolean) => {
					overlays = overlays.map((row) =>
						row.metricSlug === metricSlug
							? {
									...row,
									position,
									enabled,
									overlayId: row.overlayId ?? `overlay-${metricSlug}`,
								}
							: row,
					);
					const updated = overlays.find((row) => row.metricSlug === metricSlug);
					if (!updated) {
						throw new Error(`Unknown area: ${metricSlug}`);
					}
					return trackedMetric(updated);
				},
			),
			configureMany: jest.fn(
				async (
					entries: readonly {
						metricSlug: string;
						position: number;
						enabled: boolean;
					}[],
				) => {
					const configured: TrackedMetric[] = [];
					for (const entry of entries) {
						overlays = overlays.map((row) =>
							row.metricSlug === entry.metricSlug
								? {
										...row,
										position: entry.position,
										enabled: entry.enabled,
										overlayId: row.overlayId ?? `overlay-${entry.metricSlug}`,
									}
								: row,
						);
						const updated = overlays.find(
							(row) => row.metricSlug === entry.metricSlug,
						);
						if (!updated) {
							throw new Error(`Unknown area: ${entry.metricSlug}`);
						}
						configured.push(trackedMetric(updated));
					}
					return configured;
				},
			),
			relabel: jest.fn(
				async (
					metricSlug: string,
					customLabel: string | null,
					_fallback: { position: number; enabled?: boolean },
				) => {
					const normalizedLabel = customLabel?.trim() || null;
					overlays = overlays.map((row) =>
						row.metricSlug === metricSlug
							? {
									...row,
									customLabel: normalizedLabel,
									overlayId: row.overlayId ?? `overlay-${metricSlug}`,
								}
							: row,
					);
					const updated = overlays.find((row) => row.metricSlug === metricSlug);
					if (!updated) {
						throw new Error(`Unknown area: ${metricSlug}`);
					}
					return trackedMetric(updated);
				},
			),
		};
		const view = await render(<LifeAreasScreen repository={repository} />);

		await waitFor(() => expect(view.getByText("Work & career")).toBeTruthy());
		await fireEvent(
			view.getByLabelText("Disable Work & career"),
			"valueChange",
			false,
		);
		await waitFor(() =>
			expect(view.getByLabelText("Enable Work & career")).toBeTruthy(),
		);

		await fireEvent.press(view.getByLabelText("Move Work & career down"));
		await waitFor(() =>
			expect(repository.configureMany).toHaveBeenLastCalledWith([
				{ metricSlug: "wheel:career", position: 1, enabled: false },
				{ metricSlug: "wheel:money", position: 0, enabled: true },
			]),
		);

		await fireEvent.press(
			view.getByLabelText("Change label for Work & career"),
		);
		await fireEvent.changeText(
			view.getByLabelText("Label for Work & career"),
			"Business",
		);
		await fireEvent.press(view.getByText("Save label"));
		await waitFor(() => expect(view.getByText("Business")).toBeTruthy());
		expect(view.getByText("Default: Work & career")).toBeTruthy();
		expect(repository.relabel).toHaveBeenCalledWith(
			"wheel:career",
			"Business",
			{
				position: 1,
				enabled: false,
			},
		);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("caps active areas at ten and explains the refusal", async () => {
		let overlays: ResolvedTrackedMetric[] = DEFAULT_LIFE_AREA_METRICS.map(
			(area) => ({
				...area,
				enabled: area.enabled ?? true,
				overlayId: null,
				addedAt: null,
				removedAt: null,
				customLabel: null,
			}),
		);
		const repository = {
			listResolved: jest.fn(async () => overlays),
			configure: jest.fn(
				async (metricSlug: string, position: number, enabled: boolean) => {
					overlays = overlays.map((row) =>
						row.metricSlug === metricSlug ? { ...row, position, enabled } : row,
					);
					const updated = overlays.find((row) => row.metricSlug === metricSlug);
					if (!updated) {
						throw new Error(`Unknown area: ${metricSlug}`);
					}
					return trackedMetric(updated);
				},
			),
			configureMany: jest.fn(),
			relabel: jest.fn(),
		};
		const view = await render(<LifeAreasScreen repository={repository} />);

		await waitFor(() =>
			expect(view.getByText("Home & environment")).toBeTruthy(),
		);
		await fireEvent(
			view.getByLabelText("Enable Home & environment"),
			"valueChange",
			true,
		);
		await fireEvent(
			view.getByLabelText("Enable Purpose & direction"),
			"valueChange",
			true,
		);
		await waitFor(() =>
			expect(view.getByLabelText("Disable Purpose & direction")).toBeTruthy(),
		);
		expect(repository.configure).toHaveBeenCalledTimes(2);

		await fireEvent(
			view.getByLabelText("Enable Fatherhood"),
			"valueChange",
			true,
		);
		expect(
			view.getByText("Choose up to 10 active life areas — disable one first."),
		).toBeTruthy();
		expect(repository.configure).toHaveBeenCalledTimes(2);
		expect(view.getByLabelText("Enable Fatherhood")).toBeTruthy();
	});
});
