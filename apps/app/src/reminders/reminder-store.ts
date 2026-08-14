import {
	getDb,
	type Reminder,
	ReminderRepository,
	type ReminderSchedule,
} from "@bro/database-app";
import type { SQLiteDatabase } from "expo-sqlite";
import {
	ensureReminderPermission,
	notificationGateway,
	type NotificationPermissionStatus,
	type ReminderNotificationGateway,
} from "./notification-gateway";
import { materialiseReminderNotifications } from "./reminder-materialiser";

export type ReminderScreenState = {
	reminders: Reminder[];
	permission: NotificationPermissionStatus;
};

export class ReminderStore {
	private readonly repository: ReminderRepository;

	constructor(
		private readonly db: SQLiteDatabase,
		private readonly gateway: ReminderNotificationGateway = notificationGateway,
	) {
		this.repository = new ReminderRepository(db);
	}

	async load(): Promise<ReminderScreenState> {
		const [reminders, permission] = await Promise.all([
			this.repository.listAll(),
			this.gateway.getPermissionStatus(),
		]);
		return { reminders, permission };
	}

	async create(schedule: ReminderSchedule): Promise<Reminder> {
		await ensureReminderPermission(this.gateway);
		const reminder = await this.repository.create(schedule);
		await this.materialise();
		return reminder;
	}

	async update(id: string, schedule: ReminderSchedule): Promise<void> {
		await this.repository.update(id, schedule);
		await this.materialise();
	}

	async setEnabled(id: string, enabled: boolean): Promise<void> {
		if (enabled) {
			await ensureReminderPermission(this.gateway);
		}
		await this.repository.setEnabled(id, enabled);
		await this.materialise();
	}

	async delete(id: string): Promise<void> {
		await this.repository.delete(id);
		await this.materialise();
	}

	private async materialise(): Promise<void> {
		await materialiseReminderNotifications({
			db: this.db,
			gateway: this.gateway,
		});
	}
}

export function createReminderStore(): ReminderStore {
	return new ReminderStore(getDb());
}
