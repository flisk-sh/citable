// Routes. Any path that is not one of Citable's own is a site to check: /example.com, /example.com/pricing.
import { Hono } from "hono";
import { ASSETS } from "./assets.generated";
import { checkSite, type Report } from "./checks";
import {
	clientIp,
	type ProxyMode,
	RateLimiter,
	Slots,
	securityHeaders,
	TtlCache,
} from "./guard";
import { handleMcp } from "./mcp";
import { type Fetcher, normalizeTarget, safeFetch } from "./net";
import { ICONS, robotsTxt, securityTxt, sitemapXml, webManifest } from "./seo";
import { aboutPage, badge, EXAMPLES, homePage, reportPage } from "./ui";

export interface AppOptions {
	fetcher?: Fetcher;
	publicUrl?: string;
	proxy?: ProxyMode;
	/** New checks (not served from the cache) per client per hour. */
	checksPerHour?: number;
	/** Checks running at once, for the whole server. */
	maxChecks?: number;
}

const RESERVED = new Set([
	"",
	"check",
	"about",
	"badge",
	"api",
	"mcp",
	"health",
	"ready",
	"robots.txt",
	"llms.txt",
	"sitemap.xml",
	"site.webmanifest",
	".well-known",
	...Object.values(ICONS),
]);

export function createApp(options: AppOptions = {}) {
	const fetcher = options.fetcher ?? safeFetch;
	const proxy = options.proxy ?? "none";
	const cache = new TtlCache<Report>(60 * 60 * 1000, 2000);
	const inFlight = new Map<string, Promise<Report | undefined>>();
	const checkLimit = new RateLimiter(
		options.checksPerHour ?? 30,
		60 * 60 * 1000,
	);
	const mcpLimit = new RateLimiter(120, 60 * 1000);
	const slots = new Slots(options.maxChecks ?? 8);
	/** The date sitemap.xml gives as lastmod: when this server started. */
	const startedOn = new Date().toISOString().slice(0, 10);
	const app = new Hono<{
		Bindings: { requestIP?: (r: Request) => { address: string } | null };
	}>();

	/**
	 * The address people use, ending in a slash: CITABLE_PUBLIC_URL when set (online), else this request's own origin and
	 * the prefix a proxy stripped (X-Forwarded-Prefix, /api/web behind Flisk's local proxy).
	 */
	const siteOf = (c: {
		req: { url: string; header: (name: string) => string | undefined };
	}) => {
		if (options.publicUrl) return options.publicUrl;
		const prefix = c.req.header("x-forwarded-prefix") ?? "";
		const proto =
			c.req.header("x-forwarded-proto") ??
			new URL(c.req.url).protocol.replace(":", "");
		const host = c.req.header("x-forwarded-host") ?? new URL(c.req.url).host;
		return `${proto}://${host}${/^(\/[\w.-]+)+$/.test(prefix) ? prefix : ""}/`;
	};
	const rootOf = (c: Parameters<typeof siteOf>[0]) =>
		new URL(siteOf(c)).pathname.replace(/\/$/, "");

	const ipOf = (c: { req: { raw: Request }; env: unknown }) => {
		const env = c.env as
			| { requestIP?: (r: Request) => { address: string } | null }
			| undefined;
		return clientIp(
			c.req.raw.headers,
			env?.requestIP?.(c.req.raw)?.address,
			proxy,
		);
	};

	/** A report from the cache, or a new check when the client may run one. */
	async function report(
		target: URL,
		ip: string,
		fresh: boolean,
	): Promise<Report | { error: string; status: number }> {
		const key = target.href;
		if (!fresh) {
			const cached = cache.get(key);
			if (cached) return cached;
		}
		const pending = inFlight.get(key);
		if (pending) {
			const shared = await pending;
			if (shared) return shared;
		}
		const wait = checkLimit.hit(ip);
		if (wait > 0)
			return {
				error: `Too many checks from your address. Try again in ${Math.ceil(wait / 60)} minutes.`,
				status: 429,
			};
		const running = slots.run(() => checkSite(target, fetcher));
		inFlight.set(key, running);
		try {
			const result = await running;
			if (!result)
				return {
					error: "Citable is busy checking other sites. Try again in a minute.",
					status: 503,
				};
			cache.set(key, result);
			return result;
		} finally {
			inFlight.delete(key);
		}
	}

	app.use("*", async (c, next) => {
		await next();
		for (const [k, v] of Object.entries(securityHeaders()))
			if (!c.res.headers.has(k)) c.res.headers.set(k, v);
	});

	app.get("/health", (c) => c.json({ status: "ok", service: "citable" }));
	app.get("/ready", (c) => c.json({ ready: true }));
	app.get("/", (c) => c.html(homePage(siteOf(c))));
	app.get("/about", (c) => c.html(aboutPage(siteOf(c))));
	app.get("/robots.txt", (c) =>
		c.text(robotsTxt(siteOf(c).replace(/\/$/, ""))),
	);
	app.get("/sitemap.xml", (c) =>
		c.body(
			sitemapXml(
				siteOf(c).replace(/\/$/, ""),
				["", "about", ...EXAMPLES],
				startedOn,
			),
			200,
			{ "content-type": "application/xml; charset=utf-8" },
		),
	);
	app.get("/site.webmanifest", (c) =>
		c.body(webManifest(siteOf(c).replace(/\/$/, "")), 200, {
			"content-type": "application/manifest+json",
		}),
	);
	app.get("/.well-known/security.txt", (c) =>
		c.text(securityTxt(siteOf(c).replace(/\/$/, ""))),
	);
	for (const name of Object.values(ICONS)) {
		const asset = ASSETS[name];
		const body = Buffer.from(asset.base64, "base64");
		app.get(`/${name}`, (c) =>
			c.body(body, 200, {
				"content-type": asset.type,
				"cache-control": "public, max-age=604800",
			}),
		);
	}
	app.get("/llms.txt", (c) => {
		const base = siteOf(c).replace(/\/$/, "");
		return c.text(
			`# Citable\n\n> Checks whether AI answer engines (ChatGPT, Claude, Perplexity, Google AI Overviews) can crawl, read and cite a web page, and how to fix what keeps them out. No signup, no model, nothing stored.\n\n- [Check a site](${base}/example.com): put the address after the domain\n- [JSON API](${base}/api/check?url=example.com): the same report as JSON\n- [MCP server](${base}/mcp): Streamable HTTP, one read-only tool, check_site\n- [About the checker](${base}/about): what it fetches and how\n- [Source](https://github.com/flisk-sh/citable)\n`,
		);
	});

	app.get("/check", (c) => {
		const target = normalizeTarget(c.req.query("url") ?? "");
		if (!target) return c.redirect(`${rootOf(c)}/`, 303);
		return c.redirect(
			`${rootOf(c)}/${target.hostname}${target.pathname === "/" ? "" : target.pathname}${target.search}`,
			303,
		);
	});

	app.get("/api/check", async (c) => {
		const target = normalizeTarget(c.req.query("url") ?? "");
		if (!target)
			return c.json({ error: "Give ?url=, for example ?url=example.com" }, 400);
		const result = await report(target, ipOf(c), c.req.query("fresh") === "1");
		if ("status" in result && !("checks" in result))
			return c.json({ error: result.error }, result.status as 429 | 503);
		return c.json(result, 200, { "access-control-allow-origin": "*" });
	});

	app.get("/badge/:file", async (c) => {
		const target = normalizeTarget(c.req.param("file").replace(/\.svg$/, ""));
		let score: number | undefined;
		if (target) {
			const result = await report(target, ipOf(c), false);
			if ("checks" in result && !result.error) score = result.score;
		}
		return c.body(badge(score), 200, {
			"content-type": "image/svg+xml; charset=utf-8",
			"cache-control":
				score === undefined ? "no-store" : "public, max-age=3600",
		});
	});

	app.get("/mcp", (c) =>
		c.text(
			"Citable MCP: POST JSON-RPC here (Streamable HTTP, no session).",
			405,
			{ allow: "POST" },
		),
	);
	app.post("/mcp", async (c) => {
		const ip = ipOf(c);
		if (mcpLimit.hit(ip) > 0)
			return c.json(
				{
					jsonrpc: "2.0",
					id: null,
					error: { code: -32000, message: "Too many requests" },
				},
				429,
			);
		let body: unknown;
		try {
			body = await c.req.json();
		} catch {
			return c.json(
				{
					jsonrpc: "2.0",
					id: null,
					error: { code: -32700, message: "Parse error" },
				},
				400,
			);
		}
		const answer = await handleMcp(body, async (url) => {
			const target = normalizeTarget(url);
			if (!target) return { error: `"${url}" is not a web address.` };
			const result = await report(target, ip, false);
			return "checks" in result ? result : { error: result.error };
		});
		if (answer === undefined) return c.body(null, 202);
		return c.json(answer);
	});

	app.get("*", async (c) => {
		const url = new URL(c.req.url);
		const rest = url.pathname.slice(1);
		if (RESERVED.has(rest.split("/")[0])) return c.notFound();
		const params = new URLSearchParams(url.search);
		const fresh = params.get("fresh") === "1";
		params.delete("fresh");
		const query = params.toString();
		const target = normalizeTarget(
			decodeURIComponent(rest) + (query ? `?${query}` : ""),
		);
		if (!target) return c.html(homePage(siteOf(c), true), 404);
		// One address per page: https://example.com/ and example.com both land on /example.com.
		const canonicalPath = `/${target.hostname}${target.pathname === "/" ? "" : target.pathname}`;
		if (canonicalPath !== url.pathname)
			return c.redirect(
				`${rootOf(c)}${canonicalPath}${query ? `?${query}` : ""}`,
				301,
			);
		const result = await report(target, ipOf(c), fresh);
		if (fresh)
			return c.redirect(
				rootOf(c) + canonicalPath + (query ? `?${query}` : ""),
				303,
			);
		if (!("checks" in result))
			return c.text(result.error, result.status as 429 | 503);
		return c.html(reportPage(result, siteOf(c)), result.error ? 502 : 200);
	});

	return app;
}
