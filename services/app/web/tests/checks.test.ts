import { describe, expect, it } from "bun:test";
import { checkSite, grade } from "../src/checks";
import { readPage, schemaTypes } from "../src/html";
import { fakeFetcher, GOOD_PAGE, goodSite, SPA_PAGE } from "./fixtures";

const target = new URL("https://acme.example/");
const byId = (report: Awaited<ReturnType<typeof checkSite>>, id: string) =>
	report.checks.find((c) => c.id === id);

describe("readPage", () => {
	it("reads head tags, headings and text the way a crawler without JavaScript does", async () => {
		const facts = await readPage(GOOD_PAGE);
		expect(facts.title).toBe("Acme: invoices that pay themselves");
		expect(facts.lang).toBe("en");
		expect(facts.canonical).toBe("https://acme.example/");
		expect(facts.h1).toEqual(["Invoices that pay themselves"]);
		expect(facts.h2Count).toBe(1);
		expect(facts.jsonLd).toHaveLength(1);
		// 400 body words and the headings; the script's 50 words and the svg title are not text.
		expect(facts.words).toBeGreaterThanOrEqual(400);
		expect(facts.words).toBeLessThan(420);
	});

	it("decodes entities in the title and description", async () => {
		const facts = await readPage(
			'<title>Tom &amp; Jerry&#39;s &#x2014; shop</title><meta name="description" content="A &quot;b&quot;">',
		);
		expect(facts.title).toBe("Tom & Jerry's — shop");
		expect(facts.description).toBe('A "b"');
	});

	it("collects schema.org types through @graph and arrays, and counts broken blocks", () => {
		expect(
			schemaTypes([
				'{"@graph":[{"@type":"A"},{"@type":["B","C"]}]}',
				'[{"@type":"D"}]',
				"{bad",
			]),
		).toEqual({
			types: ["A", "B", "C", "D"],
			invalid: 1,
		});
	});
});

describe("checkSite", () => {
	it("scores a well-prepared site near the top, with training crawlers left out of the score", async () => {
		const report = await checkSite(target, fakeFetcher(goodSite()));
		expect(report.error).toBeUndefined();
		expect(report.score).toBe(100);
		expect(report.grade).toBe("A");
		expect(report.checks.reduce((s, c) => s + c.max, 0)).toBe(100);
		expect(report.crawlers.find((c) => c.token === "GPTBot")?.allowed).toBe(
			false,
		);
		expect(byId(report, "training-crawlers")?.status).toBe("info");
	});

	it("fails the crawler check when an answer engine is blocked, and names it in the fix", async () => {
		const site = goodSite();
		site["https://acme.example/robots.txt"] = {
			status: 200,
			body: "User-agent: PerplexityBot\nDisallow: /\n",
		};
		const report = await checkSite(target, fakeFetcher(site));
		const check = byId(report, "ai-crawlers");
		expect(check?.status).toBe("fail");
		expect(check?.summary).toContain("PerplexityBot");
		expect(check?.fix).toContain("User-agent: PerplexityBot");
		expect(check?.points).toBeCloseTo((25 * 6) / 7);
	});

	it("treats a robots.txt that answers 5xx as keep-out", async () => {
		const site = goodSite();
		site["https://acme.example/robots.txt"] = { status: 503, body: "" };
		const report = await checkSite(target, fakeFetcher(site));
		expect(byId(report, "ai-crawlers")?.points).toBe(0);
		expect(report.crawlers.every((c) => !c.allowed)).toBe(true);
	});

	it("treats a missing robots.txt as allow-all", async () => {
		const site = goodSite();
		delete site["https://acme.example/robots.txt"];
		const report = await checkSite(target, fakeFetcher(site));
		expect(byId(report, "ai-crawlers")?.status).toBe("pass");
		expect(byId(report, "sitemap")?.points).toBe(4);
	});

	it("ignores a robots.txt that is an HTML page (a single-page app answering every path)", async () => {
		const site = goodSite();
		site["https://acme.example/robots.txt"] = {
			status: 200,
			body: "<html>Disallow: /</html>",
			headers: { "content-type": "text/html" },
		};
		const report = await checkSite(target, fakeFetcher(site));
		expect(byId(report, "ai-crawlers")?.status).toBe("pass");
	});

	it("fails a page rendered only by JavaScript", async () => {
		const site = goodSite();
		site["https://acme.example/"] = {
			status: 200,
			body: SPA_PAGE,
			headers: { "content-type": "text/html" },
		};
		const report = await checkSite(target, fakeFetcher(site));
		const content = byId(report, "content");
		expect(content?.status).toBe("fail");
		expect(content?.summary).toContain("JavaScript");
		expect(byId(report, "structured-data")?.status).toBe("warn");
		expect(report.score).toBeLessThan(75);
	});

	it("fails noindex from the header, and warns on nosnippet", async () => {
		const site = goodSite();
		site["https://acme.example/"] = {
			...site["https://acme.example/"],
			headers: { "content-type": "text/html", "x-robots-tag": "noindex" },
		};
		expect(
			byId(await checkSite(target, fakeFetcher(site)), "indexable")?.status,
		).toBe("fail");
		site["https://acme.example/"] = {
			status: 200,
			body: GOOD_PAGE.replace(
				"<head>",
				'<head><meta name="robots" content="max-snippet:0">',
			),
		};
		expect(
			byId(await checkSite(target, fakeFetcher(site)), "indexable")?.status,
		).toBe("warn");
	});

	it("reads robots.txt and the rest from the address the page redirected to", async () => {
		const calls: string[] = [];
		const site = goodSite("https://www.acme.example");
		site["https://acme.example/"] = {
			...site["https://www.acme.example/"],
			finalUrl: "https://www.acme.example/",
		};
		const report = await checkSite(target, fakeFetcher(site, calls));
		expect(calls).toContain("https://www.acme.example/robots.txt");
		expect(byId(report, "canonical")?.status).toBe("warn");
	});

	it("explains a bot block and skips the page checks instead of scoring an empty page", async () => {
		const site = goodSite();
		site["https://acme.example/"] = {
			status: 403,
			body: "<title>Access denied</title>",
		};
		const report = await checkSite(target, fakeFetcher(site));
		expect(report.partial).toBe(403);
		expect(byId(report, "indexable")?.summary).toContain("refused");
		expect(byId(report, "indexable")?.fix).toContain("OAI-SearchBot");
		expect(byId(report, "title")?.status).toBe("info");
		expect(byId(report, "title")?.summary).toBe(
			"Not checked: the page answered 403.",
		);
	});

	it("reports an error when the page does not answer", async () => {
		const report = await checkSite(
			target,
			fakeFetcher({ "https://acme.example/": { error: "could not connect" } }),
		);
		expect(report.error).toBe("could not connect");
		expect(report.score).toBe(0);
	});

	it("counts llms.txt links in linear time", async () => {
		const site = goodSite();
		site["https://acme.example/llms.txt"] = {
			status: 200,
			body: `# Acme\n\n- [Docs](https://acme.example/docs)\n${"](http://".repeat(22_000)}`,
		};
		const started = performance.now();
		const report = await checkSite(
			new URL("https://acme.example/"),
			fakeFetcher(site),
		);
		expect(performance.now() - started).toBeLessThan(200);
		expect(report.checks.find((c) => c.id === "llms-txt")?.summary).toContain(
			"with 1 link",
		);
	});

	it("marks slow pages", async () => {
		const site = goodSite();
		site["https://acme.example/"] = {
			...site["https://acme.example/"],
			ms: 2500,
		};
		expect(
			byId(await checkSite(target, fakeFetcher(site)), "speed")?.status,
		).toBe("fail");
	});

	it("grades by score", () => {
		expect([95, 80, 65, 45, 10].map(grade)).toEqual(["A", "B", "C", "D", "F"]);
	});
});
