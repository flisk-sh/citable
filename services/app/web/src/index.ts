// Citable: can AI answers cite your site? Put the address after the domain (/example.com) and get a report.
//
// Settings (all optional):
//   PORT                     where to listen (4000 under Flisk, 10000 on Render)
//   CITABLE_PUBLIC_URL       the address people use, for links and the badge snippet; without it, each request's own
//                            address and the prefix a proxy stripped (X-Forwarded-Prefix, /api/web under `flisk up`)
//   CITABLE_PROXY            none | last-forwarded (Render) | cloudflare: which header names the client
//   CITABLE_CHECKS_PER_HOUR  new checks per client address per hour (30); cached reports do not count
//   CITABLE_MAX_CHECKS       checks running at once (8)
import { createApp } from "./app";
import { parseProxyMode } from "./guard";

const port = Number(process.env.PORT) || 4000;
const app = createApp({
	publicUrl: process.env.CITABLE_PUBLIC_URL || undefined,
	proxy: parseProxyMode(process.env.CITABLE_PROXY),
	checksPerHour: Number(process.env.CITABLE_CHECKS_PER_HOUR) || undefined,
	maxChecks: Number(process.env.CITABLE_MAX_CHECKS) || undefined,
});

console.log(`citable listening on http://localhost:${port}`);

export default { port, fetch: app.fetch, idleTimeout: 30 };
