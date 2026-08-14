import {
	type DayNote,
	DayNoteRepository,
	getDb,
	type Observation,
	ObservationRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import { resolveMetric } from "../content/metric-registry";

export type HistoricalCheckIn = {
	id: string;
	observedAt: number;
	mood: Observation;
	energy: Observation;
};

export type HistoryDay = {
	localDay: string;
	checkIns: HistoricalCheckIn[];
	unpairedScored: Observation[];
	factors: Observation[];
	unknown: Observation[];
	notes: DayNote[];
};

export type HistoryDaySummary = {
	localDay: string;
	moodValues: number[];
	energyValues: number[];
	factorLabels: string[];
	noteBodies: string[];
};

function pairCheckIns(observations: readonly Observation[]): HistoricalCheckIn[] {
	const moods = observations.filter((row) => row.metricSlug === "mood");
	const energies = observations.filter((row) => row.metricSlug === "energy");
	const pairCount = Math.min(moods.length, energies.length);
	const checkIns: HistoricalCheckIn[] = [];

	for (let index = 0; index < pairCount; index += 1) {
		const mood = moods[index];
		const energy = energies[index];
		checkIns.push({
			id: mood.id,
			observedAt: Math.max(mood.observedAt, energy.observedAt),
			mood,
			energy,
		});
	}

	return checkIns;
}

export function assembleHistoryDay(
	localDay: string,
	observations: readonly Observation[],
	notes: readonly DayNote[],
): HistoryDay {
	const checkIns = pairCheckIns(observations);
	const pairedIds = new Set(
		checkIns.flatMap((checkIn) => [checkIn.mood.id, checkIn.energy.id]),
	);
	const unpairedScored: Observation[] = [];
	const factors: Observation[] = [];
	const unknown: Observation[] = [];

	for (const observation of observations) {
		const resolved = resolveMetric(observation.metricSlug);
		if (resolved.kind === "unknown") {
			unknown.push(observation);
		} else if (resolved.metric.kind === "factor") {
			factors.push(observation);
		} else if (!pairedIds.has(observation.id)) {
			unpairedScored.push(observation);
		}
	}

	return {
		localDay,
		checkIns,
		unpairedScored,
		factors,
		unknown,
		notes: [...notes],
	};
}

export class HistoryStore {
	private readonly observations: ObservationRepository;
	private readonly notes: DayNoteRepository;

	constructor(private readonly db: SQLiteDatabase) {
		this.observations = new ObservationRepository(db);
		this.notes = new DayNoteRepository(db);
	}

	async loadHistory(): Promise<HistoryDaySummary[]> {
		const [observations, notes] = await Promise.all([
			this.observations.listAll(),
			this.notes.listAll(),
		]);
		const localDays = new Set([
			...observations.map((row) => row.localDay),
			...notes.map((note) => note.localDay),
		]);

		return [...localDays]
			.sort((left, right) => right.localeCompare(left))
			.map((localDay) => {
				const dayObservations = observations.filter(
					(row) => row.localDay === localDay,
				);
				const factors = dayObservations.flatMap((row) => {
					const resolved = resolveMetric(row.metricSlug);
					return resolved.kind === "known" && resolved.metric.kind === "factor"
						? [resolved.metric.label]
						: [];
				});

				return {
					localDay,
					moodValues: dayObservations
						.filter((row) => row.metricSlug === "mood")
						.map((row) => row.value),
					energyValues: dayObservations
						.filter((row) => row.metricSlug === "energy")
						.map((row) => row.value),
					factorLabels: [...new Set(factors)],
					noteBodies: notes
						.filter((note) => note.localDay === localDay)
						.map((note) => note.body),
				};
			});
	}

	async loadDay(localDay: string): Promise<HistoryDay> {
		const [observations, notes] = await Promise.all([
			this.observations.listByDay(localDay),
			this.notes.listByDay(localDay),
		]);
		return assembleHistoryDay(localDay, observations, notes);
	}

	async updateCheckIn(
		checkIn: HistoricalCheckIn,
		mood: number,
		energy: number,
	): Promise<HistoryDay> {
		await this.db.withTransactionAsync(async () => {
			await this.observations.update(checkIn.mood.id, {
				value: mood,
				scaleMin: checkIn.mood.scaleMin,
				scaleMax: checkIn.mood.scaleMax,
				observedAt: checkIn.mood.observedAt,
				localDay: checkIn.mood.localDay,
				tzOffsetMinutes: checkIn.mood.tzOffsetMinutes,
			});
			await this.observations.update(checkIn.energy.id, {
				value: energy,
				scaleMin: checkIn.energy.scaleMin,
				scaleMax: checkIn.energy.scaleMax,
				observedAt: checkIn.energy.observedAt,
				localDay: checkIn.energy.localDay,
				tzOffsetMinutes: checkIn.energy.tzOffsetMinutes,
			});
		});
		return await this.loadDay(checkIn.mood.localDay);
	}

	async deleteCheckIn(checkIn: HistoricalCheckIn): Promise<HistoryDay> {
		await this.db.withTransactionAsync(async () => {
			await this.observations.delete(checkIn.mood.id);
			await this.observations.delete(checkIn.energy.id);
		});
		return await this.loadDay(checkIn.mood.localDay);
	}

	async deleteObservation(observation: Observation): Promise<HistoryDay> {
		await this.observations.delete(observation.id);
		return await this.loadDay(observation.localDay);
	}

	async updateNote(note: DayNote, body: string): Promise<HistoryDay> {
		await this.notes.update(note.id, body);
		return await this.loadDay(note.localDay);
	}

	async deleteNote(note: DayNote): Promise<HistoryDay> {
		await this.notes.delete(note.id);
		return await this.loadDay(note.localDay);
	}
}

export function createHistoryStore(): HistoryStore {
	return new HistoryStore(getDb());
}
