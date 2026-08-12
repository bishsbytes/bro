import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { auth, env } from "./env.js";

const app = createApp({ auth, corsOrigin: env.corsOrigin });

serve({ fetch: app.fetch, port: env.port }, ({ port }) => {
	console.log(`API listening on http://localhost:${port}`);
});
