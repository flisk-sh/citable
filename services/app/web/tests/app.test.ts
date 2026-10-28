import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import { RateLimiter, rateKey, TtlCache } from "../src/guard";
import { fakeFetcher, goodSite } from "./fixtures";

const make = (calls: string[] = [], checksPerHour = 30) =>
	createApp({
		fetcher: fakeFetcher(goodSite(), calls),
		publicUrl: "https://citable.test/",
		checksPerHour,
	});

const rpc = (app: ReturnType<typeof make>, body: unknown) =>
	app.request("/mcp", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});

describe("pages", () => {
	it("serves the home page with a policy that allows no scripts", async () => {
		const res = await make().request("/");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-security-policy")).toContain(
			"default-src 'none'",
		);
		expect(res.headers.get("content-security-policy")).not.toContain(
			"script-src",
		);
		expect(res.headers.get("strict-transport-security")).toContain("max-age=");
		expect(await res.text()).toContain("Can AI answers cite your site?");
	});

	it("sends the form to the report address", async () => {
		const res = await make().request(
			"/check?url=https%3A%2F%2FAcme.example%2Fpricing",
		);
		expect(res.status).toBe(303);
		expect(res.headers.get("location")).toBe("/acme.example/pricing");
	});

	it("keeps links and redirects under the prefix a proxy stripped", async () => {
		const app = createApp({ fetcher: fakeFetcher(goodSite()) });
		const headers = { "x-forwarded-prefix": "/api/web" };
		const html = await (
			await app.request("http://api.citable.localhost/", { headers })
		).text();
		expect(html).toContain('action="/api/web/check"');
		expect(html).toContain('href="/api/web/flisk.sh"');
		const res = await app.request(
			"http://api.citable.localhost/check?url=acme.example",
			{ headers },
		);
		expect(res.headers.get("location")).toBe("/api/web/acme.example");
		const evil = await app.request(
			"http://api.citable.localhost/check?url=acme.example",
			{ headers: { "x-forwarded-prefix": "//evil.example" } },
		);
		expect(evil.headers.get("location")).toBe("/acme.example");
	});

	it("redirects other spellings of an address to one page", async () => {
		const res = await make().request("/https://acme.example/");
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/acme.example");
	});

	it("renders a report and serves the second view from memory", async () => {
		const calls: string[] = [];
		const app = make(calls);
		const res = await app.request("/acme.example");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("acme.example");
		expect(html).toContain("100<small>grade A");
		const fetched = calls.length;
		await app.request("/acme.example");
		expect(calls.length).toBe(fetched);
	});

	it("says what each fix is worth, and the total", async () => {
		const site = goodSite();
		delete site["https://acme.example/llms.txt"];
		const html = await (
			await createApp({ fetcher: fakeFetcher(site) }).request("/acme.example")
		).text();
		expect(html).toContain("1 thing to fix, worth up to 5 points");
		expect(html).toContain('<span class="gain">+5</span>');
		expect(html).toContain("Fix first · 1");
	});

	it("escapes what the site sends", async () => {
		const site = goodSite();
		site["https://acme.example/"] = {
			status: 200,
			body: "<title>&lt;script&gt;alert(1)&lt;/script&gt; title here</title>",
		};
		const app = createApp({ fetcher: fakeFetcher(site) });
		const html = await (await app.request("/acme.example")).text();
		expect(html).not.toContain("<script>alert(1)");
		expect(html).toContain("&lt;script&gt;alert(1)");
	});

	it("keeps what a site sends short, and reports other than the examples out of search", async () => {
		const long = "B".repeat(100_000);
		const site = goodSite();
		site["https://acme.example/"] = {
			status: 200,
			headers: { "content-type": "text/html" },
			body: `<title>${long}</title><meta name="description" content="${long}"><link rel="canonical" href="http://[${long}">${"<h1>x</h1>".repeat(5000)}`,
		};
		const app = createApp({ fetcher: fakeFetcher(site) });
		const res = await app.request("/acme.example");
		const html = await res.text();
		// What the site controls, without the stylesheet every page carries.
		expect(html.replace(/<style>[\s\S]*?<\/style>/, "").length).toBeLessThan(
			40_000,
		);
		expect(html).toContain("5000 h1 headings");
		expect(html).toContain('<meta name="robots" content="noindex">');
		const json = await (
			await app.request("/api/check?url=acme.example")
		).text();
		expect(json.length).toBeLessThan(20_000);
		const example = await (
			await createApp({
				fetcher: fakeFetcher(goodSite("https://flisk.sh")),
			}).request("/flisk.sh")
		).text();
		expect(example).toContain('content="index,follow');
	});

	it("limits new checks per client, not cached views", async () => {
		const app = make([], 1);
		expect((await app.request("/acme.example")).status).toBe(200);
		expect((await app.request("/acme.example")).status).toBe(200);
		expect((await app.request("/acme.example/other")).status).toBe(429);
	});

	it("serves the JSON report and the badge", async () => {
		const app = make();
		const json = (await (
			await app.request("/api/check?url=acme.example")
		).json()) as { score: number };
		expect(json.score).toBe(100);
		const svg = await app.request("/badge/acme.example.svg");
		expect(svg.headers.get("content-type")).toContain("image/svg+xml");
		expect(await svg.text()).toContain("100/100");
	});

	it("answers a broken percent escape with the home page, not an error", async () => {
		const res = await make().request("/%E0%A4%A");
		expect(res.status).toBe(404);
		expect(await res.text()).toContain("Can AI answers cite your site?");
	});

	it("counts an IPv6 client by its /64", async () => {
		const app = createApp({
			fetcher: fakeFetcher(goodSite()),
			proxy: "last-forwarded",
			checksPerHour: 1,
		});
		const from = (ip: string, path: string) =>
			app.request(path, { headers: { "x-forwarded-for": ip } });
		expect((await from("2001:db8:1:2::a", "/acme.example")).status).toBe(200);
		expect((await from("2001:db8:1:2::b", "/acme.example/x")).status).toBe(429);
		expect((await from("2001:db8:1:3::a", "/acme.example/y")).status).not.toBe(
			429,
		);
	});

	it("keeps its own paths out of the checker", async () => {
		expect((await make().request("/llms.txt")).status).toBe(200);
		expect((await make().request("/badge")).status).toBe(404);
	});
});

describe("MCP", () => {
	it("initializes, lists check_site and runs it", async () => {
		const app = make();
		const init = (await (
			await rpc(app, {
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: { protocolVersion: "2025-03-26" },
			})
		).json()) as {
			result: { protocolVersion: string };
		};
		expect(init.result.protocolVersion).toBe("2025-03-26");
		expect(
			(await rpc(app, { jsonrpc: "2.0", method: "notifications/initialized" }))
				.status,
		).toBe(202);
		const list = (await (
			await rpc(app, { jsonrpc: "2.0", id: 2, method: "tools/list" })
		).json()) as { result: { tools: { name: string }[] } };
		expect(list.result.tools.map((t) => t.name)).toEqual(["check_site"]);
		const call = (await (
			await rpc(app, {
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "check_site", arguments: { url: "acme.example" } },
			})
		).json()) as { result: { content: { text: string }[]; isError: boolean } };
		expect(call.result.isError).toBe(false);
		expect(call.result.content[0].text).toContain("100/100");
	});

	it("answers errors as JSON-RPC", async () => {
		const app = make();
		const bad = (await (
			await rpc(app, { jsonrpc: "2.0", id: 4, method: "nope" })
		).json()) as { error: { code: number } };
		expect(bad.error.code).toBe(-32601);
		const notUrl = (await (
			await rpc(app, {
				jsonrpc: "2.0",
				id: 5,
				method: "tools/call",
				params: { name: "check_site", arguments: { url: "localhost" } },
			})
		).json()) as { result: { isError: boolean } };
		expect(notUrl.result.isError).toBe(true);
	});
});

describe("guards", () => {
	it("counts hits per window", () => {
		let t = 0;
		const limiter = new RateLimiter(2, 1000, () => t);
		expect([
			limiter.hit("a"),
			limiter.hit("a"),
			limiter.hit("a") > 0,
			limiter.hit("b"),
		]).toEqual([0, 0, true, 0]);
		t = 1000;
		expect(limiter.hit("a")).toBe(0);
	});

	it("keys IPv4 by address and IPv6 by /64", () => {
		expect(rateKey("203.0.113.9")).toBe("203.0.113.9");
		expect(rateKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
		expect(rateKey("2001:db8:0:1:aaaa::1")).toBe("2001:db8:0:1::/64");
		expect(rateKey("2001:0db8::1")).toBe("2001:db8:0:0::/64");
		expect(rateKey("2001:db8:0:1:2:3:4:5")).toBe("2001:db8:0:1::/64");
	});

	it("forgets cached entries after their time and beyond the size", () => {
		let t = 0;
		const cache = new TtlCache<number>(100, 2, () => t);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("c", 3);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("c")).toBe(3);
		t = 100;
		expect(cache.get("c")).toBeUndefined();
	});
});
