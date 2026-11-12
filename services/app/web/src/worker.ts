// Cloudflare Worker entry: the same Hono app as index.ts, served from the edge instead of a Render container.
// Settings come from [vars] in wrangler.toml. The how-it-works clip is too big for a Worker bundle, so
// `bun run worker:assets` writes it to public/ and Cloudflare serves it as static assets (byte ranges included).
import { createApp } from "./app";
import { parseProxyMode } from "./guard";
import { safeFetch } from "./net";
import { rangeResponse } from "./range";

interface Env {
	/** The static assets (public/); wrangler.toml sends /demo.mp4 here first so this Worker can answer byte ranges. */
	ASSETS?: { fetch(request: Request): Promise<Response> };
	CITABLE_PUBLIC_URL?: string;
	CITABLE_PROXY?: string;
	CITABLE_CHECKS_PER_HOUR?: string;
	CITABLE_MAX_CHECKS?: string;
}

/** Static files this Worker answers itself, because Cloudflare's asset server ignores Range. */
export const RANGED_FILES = ["demo.mp4"];

/** The files `bun run worker:assets` writes to public/: the keys of VIDEO in video.generated.ts. */
export const STATIC_FILES = ["demo.mp4", "demo.jpg"];

let app: ReturnType<typeof createApp> | undefined;

export default {
	fetch(
		request: Request,
		env: Env,
		ctx: unknown,
	): Response | Promise<Response> {
		const name = new URL(request.url).pathname.slice(1);
		if (env.ASSETS && RANGED_FILES.includes(name))
			return ranged(request, env.ASSETS);
		app ??= createApp({
			publicUrl: env.CITABLE_PUBLIC_URL || undefined,
			proxy: parseProxyMode(env.CITABLE_PROXY),
			checksPerHour: Number(env.CITABLE_CHECKS_PER_HOUR) || undefined,
			maxChecks: Number(env.CITABLE_MAX_CHECKS) || undefined,
			staticFiles: STATIC_FILES,
			// Every hop is still checked against private addresses; the Worker has no TLS server name to pin with.
			fetcher: (url, options) => safeFetch(url, { ...options, pin: false }),
		});
		return app.fetch(request, env, ctx as never);
	},
};

async function ranged(
	request: Request,
	assets: NonNullable<Env["ASSETS"]>,
): Promise<Response> {
	const file = await assets.fetch(new Request(request.url));
	if (!file.ok) return file;
	const body = new Uint8Array(await file.arrayBuffer());
	return rangeResponse(
		body,
		file.headers.get("content-type") ?? "application/octet-stream",
		request.headers.get("range"),
	);
}
