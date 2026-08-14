import {
	getDb,
	ObservationRepository,
	ReminderRepository,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	notificationGateway,
	type ReminderNotificationGateway,
} from "./notification-gateway";
import {
	localDayOf,
	planReminderNotifications,
	REMINDER_NOTIFICATION_PREFIX,
} from "./reminder-planner";

export type MaterialiseResult = {
	permission: "granted" | "denied" | "undetermined";
	scheduled: string[];
	cancelled: string[];
};

export async function materialiseReminderNotifications({
	db = getDb(),
	gateway = notificationGateway,
	now = new Date(),
}: {
	db?: SQLiteDatabase;
	gateway?: ReminderNotificationGateway;
	now?: Date;
} = {}): Promise<MaterialiseResult> {
	const permission = await gateway.getPermissionStatus();
	if (permission !== "granted") {
		return { permission, scheduled: [], cancelled: [] };
	}

	const localDay = localDayOf(now);
	const [reminders, todayObservations, scheduledRequests] = await Promise.all([
		new ReminderRepository(db).listAll(),
		new ObservationRepository(db).listByDay(localDay),
		gateway.listScheduled(),
	]);
	const plan = planReminderNotifications(
		reminders,
		now,
		localDay,
		todayObservations.length > 0,
	);
	const plannedIds = new Set(plan.map(({ identifier }) => identifier));
	const scheduledIds = new Set(
		scheduledRequests.map(({ identifier }) => identifier),
	);
	const stale = [...scheduledIds]
		.filter(
			(identifier) =>
				identifier.startsWith(REMINDER_NOTIFICATION_PREFIX) &&
				!plannedIds.has(identifier),
		)
		.sort();
	const missing = plan.filter(
		({ identifier }) => !scheduledIds.has(identifier),
	);

	for (const identifier of stale) {
		await gateway.cancel(identifier);
	}
	for (const notification of missing) {
		await gateway.schedule(notification.identifier, notification.fireAt);
	}

	return {
		permission,
		scheduled: missing.map(({ identifier }) => identifier),
		cancelled: stale,
	};
}

export async function cancelAllReminderNotifications(
	gateway: ReminderNotificationGateway = notificationGateway,
): Promise<string[]> {
	const identifiers = (await gateway.listScheduled())
		.map(({ identifier }) => identifier)
		.filter((identifier) => identifier.startsWith(REMINDER_NOTIFICATION_PREFIX))
		.sort();
	for (const identifier of identifiers) {
		await gateway.cancel(identifier);
	}
	return identifiers;
}

let refreshQueue = Promise.resolve<MaterialiseResult | undefined>(undefined);

export function refreshReminderNotifications(): Promise<
	MaterialiseResult | undefined
> {
	refreshQueue = refreshQueue
		.catch(() => undefined)
		.then(() => materialiseReminderNotifications());
	return refreshQueue;
}
