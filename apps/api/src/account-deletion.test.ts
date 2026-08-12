import { resolve } from "node:path";
import { createAuth } from "@bro/auth-api";
import { createApiDb, schema } from "@bro/database-api";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

let container: StartedPostgreSqlContainer;
let db: ReturnType<typeof createApiDb>;
let app: ReturnType<typeof createApp>;
let session: { userId: string; cookie: string };

async function cleanAuthTables() {
	await db.delete(schema.verification);
	await db.delete(schema.session);
	await db.delete(schema.account);
	await db.delete(schema.user);
}

function authHeaders(cookie?: string): Record<string, string> {
	return {
		"content-type": "application/json",
		"expo-origin": "app://",
		...(cookie ? { cookie } : {}),
	};
}

const PASSWORD = "correct horse battery staple";

async function register() {
	const email = `phase-two-${crypto.randomUUID()}@example.test`;
	const response = await app.request("/api/auth/sign-up/email", {
		method: "POST",
		headers: authHeaders(),
		body: JSON.stringify({ name: "Phase Two", email, password: PASSWORD }),
	});

	expect(response.status).toBe(200);
	const setCookie = response.headers.get("set-cookie");
	expect(
		setCookie,
		"registration should establish a session cookie",
	).toBeTruthy();
	if (!setCookie) {
		throw new Error("Registration did not establish a session cookie.");
	}

	const created = await db.query.user.findFirst({
		where: eq(schema.user.email, email),
	});
	if (!created) {
		throw new Error("Registration did not persist a user.");
	}

	return { userId: created.id, cookie: setCookie.split(";", 1)[0] };
}

function deleteUser(cookie: string, password: string) {
	return app.request("/api/auth/delete-user", {
		method: "POST",
		headers: authHeaders(cookie),
		body: JSON.stringify({ password }),
	});
}

function countsFor(userId: string) {
	return Promise.all([
		db.query.user.findFirst({ where: eq(schema.user.id, userId) }),
		db.$count(schema.account, eq(schema.account.userId, userId)),
		db.$count(schema.session, eq(schema.session.userId, userId)),
	]);
}

beforeAll(async () => {
	container = await new PostgreSqlContainer("postgres:16-alpine")
		.withDatabase("bro_test")
		.start();
	db = createApiDb(container.getConnectionUri());
	const auth = createAuth({
		db,
		secret: "phase-2-account-deletion-test-secret",
		baseURL: "http://api.test",
		trustedOrigins: ["app://"],
	});
	app = createApp({ auth, corsOrigin: "app://" });

	await migrate(db, {
		migrationsFolder: resolve(
			process.cwd(),
			"../../packages/database/api/drizzle",
		),
	});
}, 120_000);

beforeEach(async () => {
	await cleanAuthTables();
	session = await register();
});

afterAll(async () => {
	await db?.$client.end();
	await container?.stop();
}, 30_000);

describe("account deletion", () => {
	it("establishes a user, credential account, and session on registration", async () => {
		const [user, accounts, sessions] = await countsFor(session.userId);

		expect(user).toBeDefined();
		expect(accounts).toBe(1);
		expect(sessions).toBe(1);
	});

	it("rejects a wrong password and leaves every row in place", async () => {
		const rejected = await deleteUser(session.cookie, "wrong password");

		expect(rejected.status).toBe(400);

		const [user, accounts, sessions] = await countsFor(session.userId);
		expect(
			user,
			"a rejected deletion must leave the account intact",
		).toBeDefined();
		expect(accounts).toBe(1);
		expect(sessions).toBe(1);
	});

	it("removes the user, credential account, and sessions", async () => {
		const deleted = await deleteUser(session.cookie, PASSWORD);

		expect(deleted.status).toBe(200);
		await expect(deleted.json()).resolves.toEqual({
			success: true,
			message: "User deleted",
		});

		const [user, accounts, sessions] = await countsFor(session.userId);
		expect(user).toBeUndefined();
		expect(accounts).toBe(0);
		expect(sessions).toBe(0);
	});

	it("leaves the deleted session unusable", async () => {
		expect((await deleteUser(session.cookie, PASSWORD)).status).toBe(200);

		const restored = await app.request("/api/auth/get-session", {
			method: "GET",
			headers: authHeaders(session.cookie),
		});

		expect(restored.status).toBe(200);
		await expect(restored.json()).resolves.toBeNull();
	});
});
