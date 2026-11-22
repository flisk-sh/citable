// Routes. Any path that is not one of Citable's own is a site to check: /example.com, /example.com/pricing.
import { Hono } from "hono";
import { ASSETS } from "./assets.generated";
import { checkSite, type Report } from "./checks";
import {
	clientIp,
	type ProxyMode,
	RateLimiter,
	rateKey,
	Slots,
	securityHeaders,
	TtlCache,
} from "./guard";
import { LANGS, type Lang, pickLang } from "./i18n";
import { handleMcp } from "./mcp";
import { type Fetcher, normalizeTarget, safeFetch } from "./net";
import { rangeResponse } from "./range";
import { ICONS, robotsTxt, securityTxt, sitemapXml, webManifest } from "./seo";
import { SERVER_CARD_PATHS, serverCardJson } from "./server-card";
import { aboutPage, badge, EXAMPLES, homePage, reportPage } from "./ui";

export interface AppOptions {
	fetcher?: Fetcher;
	publicUrl?: string;
	proxy?: ProxyMode;
	/** New checks (not served from the cache) per client per hour. */
	checksPerHour?: number;
	/** Checks running at once, for the whole server. */
	maxChecks?: number;
	/**
	 * The how-it-works clip, served with byte ranges. The Bun server passes VIDEO from video.generated.ts; the Worker
	 * leaves it out (2 MB would not fit a Worker) and serves the same files as static assets.
	 */
	video?: Record<string, { type: string; base64: string }>;
	/** Paths served by something in front of this app (the Worker's static assets): never read as a site to check. */
	staticFiles?: string[];
}

const RESERVED_NAMES = [
	"",
	"ko",
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
];

const STATIC_FILE_EXTENSIONS = new Set([
	"webmanifest",
	"txt",
	"json",
	"png",
	"svg",
	"js",
	"css",
	"html",
	"xml",
	"ico",
]);

export function createApp(options: AppOptions = {}) {
	const fetcher = options.fetcher ?? safeFetch;
	const video = options.video ?? {};
	const RESERVED = new Set([
		...RESERVED_NAMES,
		...Object.keys(video),
		...(options.staticFiles ?? []),
	]);
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
		return rateKey(
			clientIp(c.req.raw.headers, env?.requestIP?.(c.req.raw)?.address, proxy),
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

	// Hono matches exact paths, so /about/ would fall through to 404 although /about exists.
	// Redirect once to the canonical no-slash path, keeping the language prefix and query string.
	app.use("*", async (c, next) => {
		const url = new URL(c.req.url);
		if (c.req.method !== "GET" && c.req.method !== "HEAD") return next();
		if (url.pathname.length <= 1 || !url.pathname.endsWith("/")) return next();
		// Only the site's own pages: report addresses (/example.com/) are canonicalized by the catch-all route.
		if (!RESERVED.has(url.pathname.split("/")[1])) return next();
		const base = siteOf(c).replace(/\/$/, "");
		const prefix = langOf(c) === "ko" ? "/ko" : "";
		const path = url.pathname.replace(/\/+$/, "");
		return c.redirect(`${base}${prefix}${path}${url.search}`, 301);
	});

	/** The language of this page: Korean lives under /ko (the outer app strips the prefix and sets this header). */
	const langOf = (c: {
		req: { header: (n: string) => string | undefined };
	}): Lang => (c.req.header("x-citable-lang") === "ko" ? "ko" : "en");
	/** Where this language's pages live, under the site address. */
	const pre = (c: Parameters<typeof siteOf>[0]) =>
		rootOf(c) + (langOf(c) === "ko" ? "/ko" : "");
	/** Headers for a page that depends on the visitor's language. */
	const pageHeaders = (
		extra: Record<string, string> = {},
	): Record<string, string> => ({ vary: "Accept-Language, Cookie", ...extra });

	/**
	 * Sends the visitor to the page in their language, so every language has its own address (and its own line in
	 * analytics): ?lang=ko or ?lang=en is an explicit choice, remembered in a cookie; with none, the cookie, else the
	 * browser's Accept-Language decides. Returns a redirect, or undefined when this page is already the right one.
	 */
	const negotiate = (
		c: Parameters<typeof siteOf>[0] & {
			req: { query: (k: string) => string | undefined };
		},
	): Response | undefined => {
		const here = langOf(c);
		const asked = c.req.query("lang");
		const explicit = asked === "ko" || asked === "en" ? asked : undefined;
		let want: Lang = here;
		if (explicit) want = explicit;
		else if (here === "en")
			want = pickLang({
				cookie: c.req.header("cookie"),
				acceptLanguage: c.req.header("accept-language"),
			});
		if (want === here && !explicit) return undefined;
		const url = new URL(c.req.url);
		url.searchParams.delete("lang");
		const path = url.pathname === "/" ? "" : url.pathname;
		const query = url.searchParams.toString();
		const headers = new Headers({
			location: `${rootOf(c)}${want === "ko" ? "/ko" : ""}${path || (want === "ko" ? "" : "/")}${query ? `?${query}` : ""}`,
			vary: "Accept-Language, Cookie",
			"cache-control": "private, max-age=0",
		});
		if (explicit)
			headers.set(
				"set-cookie",
				`lang=${want}; Path=/; Max-Age=31536000; SameSite=Lax`,
			);
		return new Response(null, { status: explicit ? 303 : 302, headers });
	};

	app.get("/health", (c) => c.json({ status: "ok", service: "citable" }));
	app.get("/ready", (c) => c.json({ ready: true }));
	app.get("/", (c) => {
		const moved = negotiate(c);
		if (moved) return moved;
		const lang = langOf(c);
		return c.html(
			homePage(siteOf(c), false, lang),
			200,
			pageHeaders({ "cache-control": "public, max-age=300" }),
		);
	});
	app.get("/about", (c) => {
		const moved = negotiate(c);
		if (moved) return moved;
		const lang = langOf(c);
		return c.html(
			aboutPage(siteOf(c), lang),
			200,
			pageHeaders({ "cache-control": "public, max-age=300" }),
		);
	});
	app.get("/robots.txt", (c) =>
		c.text(robotsTxt(siteOf(c).replace(/\/$/, ""))),
	);
	app.get("/sitemap.xml", (c) =>
		c.body(
			sitemapXml(
				siteOf(c).replace(/\/$/, ""),
				[
					"",
					"about",
					...EXAMPLES,
					"ko",
					"ko/about",
					...EXAMPLES.map((e) => `ko/${e}`),
				],
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
	// MCP Server Card: the same JSON at both paths in use. GET also answers HEAD.
	for (const path of SERVER_CARD_PATHS)
		app.get(path, (c) =>
			c.body(serverCardJson(), 200, {
				"content-type": "application/json; charset=utf-8",
				"access-control-allow-origin": "*",
				"cache-control": "public, max-age=3600",
			}),
		);
	// The how-it-works clip. Safari plays a video only from a server that answers byte ranges.
	for (const [name, file] of Object.entries(video)) {
		const body = new Uint8Array(Buffer.from(file.base64, "base64"));
		app.get(`/${name}`, (c) =>
			rangeResponse(body, file.type, c.req.header("range")),
		);
	}
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
		if (!target) return c.redirect(`${pre(c)}/`, 303);
		return c.redirect(
			`${pre(c)}/${target.hostname}${target.pathname === "/" ? "" : target.pathname}${target.search}`,
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
		if (typeof result.error === "string" && result.error.startsWith("refused:"))
			return c.json({ error: result.error }, 400, {
				"access-control-allow-origin": "*",
			});
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
		const moved = negotiate(c);
		if (moved) return moved;
		const params = new URLSearchParams(url.search);
		const fresh = params.get("fresh") === "1";
		params.delete("fresh");
		const lang = langOf(c);
		const langHeaders = pageHeaders();
		params.delete("lang");
		const query = params.toString();
		let decoded: string;
		try {
			decoded = decodeURIComponent(rest);
		} catch {
			return c.html(homePage(siteOf(c), true, lang), 404, langHeaders);
		}
		const fileExtension = decoded.match(/\.([^.]+)$/)?.[1].toLowerCase();
		if (
			!decoded.includes("/") &&
			fileExtension &&
			STATIC_FILE_EXTENSIONS.has(fileExtension)
		)
			return c.notFound();
		const target = normalizeTarget(decoded + (query ? `?${query}` : ""));
		if (!target)
			return c.html(homePage(siteOf(c), true, lang), 404, langHeaders);
		// One address per page: https://example.com/ and example.com both land on /example.com.
		const canonicalPath = `/${target.hostname}${target.pathname === "/" ? "" : target.pathname}`;
		if (canonicalPath !== url.pathname)
			return c.redirect(
				`${pre(c)}${canonicalPath}${query ? `?${query}` : ""}`,
				301,
			);
		const result = await report(target, ipOf(c), fresh);
		if (fresh)
			return c.redirect(
				pre(c) + canonicalPath + (query ? `?${query}` : ""),
				303,
			);
		if (!("checks" in result))
			return c.text(result.error, result.status as 429 | 503);
		return c.html(reportPage(result, siteOf(c), lang), 200, langHeaders);
	});

	// Korean pages live under /ko: the same routes, with the prefix taken off and the language noted for them.
	const outer = new Hono<{
		Bindings: { requestIP?: (r: Request) => { address: string } | null };
	}>();
	outer.all("*", (c) => {
		const url = new URL(c.req.url);
		let ctx: Parameters<typeof app.fetch>[2];
		try {
			ctx = c.executionCtx;
		} catch {
			ctx = undefined; // Bun and tests have none
		}
		if (!/^\/ko(\/|$)/.test(url.pathname))
			return app.fetch(c.req.raw, c.env, ctx);
		url.pathname = url.pathname.slice(3) || "/";
		const headers = new Headers(c.req.raw.headers);
		headers.set("x-citable-lang", "ko");
		return app.fetch(
			new Request(url, { method: c.req.method, headers, redirect: "manual" }),
			c.env,
			ctx,
		);
	});
	return outer;
}
