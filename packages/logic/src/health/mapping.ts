import { toCanonical } from "@bro/domain";
import type { HealthPlatform } from "@bro/mobile-model";
import { type HealthMetricSlug, isHealthMetricSlug } from "./policy";

export type HealthSampleUnit =
	| "second"
	| "minute"
	| "hour"
	| "count"
	| "bpm"
	| "kg"
	| "lb"
	| "fraction"
	| "percent";

export type PlatformHealthSample = {
	metricSlug: HealthMetricSlug;
	value: number;
	unit: HealthSampleUnit;
	startedAt: number;
	endedAt: number;
	source: HealthPlatform;
	sourceRecordId: string;
	/** Recording app/device within the platform (package or bundle id). */
	origin?: string | null;
};

export type CanonicalHealthSample = Omit<
	PlatformHealthSample,
	"unit" | "origin"
> & {
	localDay: string;
	origin: string | null;
};

function assertFiniteNonNegative(value: number): void {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(
			"Health sample values must be finite and non-negative.",
		);
	}
}

function canonicalValue(sample: PlatformHealthSample): number {
	assertFiniteNonNegative(sample.value);

	if (sample.metricSlug === "sleep_duration") {
		if (sample.unit === "second") return sample.value;
		if (sample.unit === "minute") return sample.value * 60;
		if (sample.unit === "hour") return sample.value * 3_600;
	}
	if (sample.metricSlug === "steps") {
		if (sample.unit !== "count") {
			throw new TypeError("Step samples must use count units.");
		}
		if (!Number.isInteger(sample.value)) {
			throw new TypeError("Step samples must be whole counts.");
		}
		return sample.value;
	}
	if (sample.metricSlug === "resting_heart_rate" && sample.unit === "bpm") {
		return sample.value;
	}
	if (sample.metricSlug === "weight") {
		if (sample.unit === "kg") return sample.value;
		if (sample.unit === "lb") {
			return toCanonical(sample.value, "mass", "lb");
		}
	}
	if (sample.metricSlug === "body_fat") {
		const value =
			sample.unit === "fraction"
				? sample.value
				: sample.unit === "percent"
					? toCanonical(sample.value, "fraction", "%")
					: null;
		if (value !== null) {
			if (value > 1) {
				throw new RangeError("Body fat samples must be between zero and one.");
			}
			return value;
		}
	}

	throw new TypeError(
		`Unit ${sample.unit} is not valid for ${sample.metricSlug}.`,
	);
}

/** Resolves an epoch millisecond to a calendar day in a named device zone. */
export function localDayAt(timestamp: number, timeZone: string): string {
	if (!Number.isInteger(timestamp)) {
		throw new TypeError("Health sample times must be epoch milliseconds.");
	}
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(timestamp));
	const values = new Map(parts.map((part) => [part.type, part.value]));
	const year = values.get("year");
	const month = values.get("month");
	const day = values.get("day");
	if (!year || !month || !day) {
		throw new Error("Could not resolve the health sample's local day.");
	}
	return `${year}-${month}-${day}`;
}

/** Converts platform units and applies the signed-off local-day policy. */
export function mapPlatformSample(
	sample: PlatformHealthSample,
	timeZone: string,
): CanonicalHealthSample {
	if (!isHealthMetricSlug(sample.metricSlug)) {
		throw new TypeError(`Unsupported health metric: ${sample.metricSlug}`);
	}
	if (
		!Number.isInteger(sample.startedAt) ||
		!Number.isInteger(sample.endedAt)
	) {
		throw new TypeError("Health sample times must be epoch milliseconds.");
	}
	if (sample.endedAt < sample.startedAt) {
		throw new RangeError("Health samples cannot end before they start.");
	}
	if (!sample.sourceRecordId.trim()) {
		throw new TypeError("Health sample source record id must not be empty.");
	}

	return {
		metricSlug: sample.metricSlug,
		value: canonicalValue(sample),
		startedAt: sample.startedAt,
		endedAt: sample.endedAt,
		localDay: localDayAt(
			sample.metricSlug === "sleep_duration"
				? sample.endedAt
				: sample.startedAt,
			timeZone,
		),
		source: sample.source,
		sourceRecordId: sample.sourceRecordId.trim(),
		origin: sample.origin?.trim() || null,
	};
}
