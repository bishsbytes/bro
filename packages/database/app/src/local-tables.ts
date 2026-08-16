/** Every disposable health-import table in bro-local.db. */
export const LOCAL_TABLE_NAMES = {
	healthConnections: "health_connections",
	rawSamples: "raw_samples",
} as const;

export type LocalTableName =
	(typeof LOCAL_TABLE_NAMES)[keyof typeof LOCAL_TABLE_NAMES];

export const LOCAL_TABLES: readonly LocalTableName[] = Object.freeze(
	Object.values(LOCAL_TABLE_NAMES),
);
