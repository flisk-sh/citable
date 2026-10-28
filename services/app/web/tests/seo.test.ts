import { describe, expect, it } from "bun:test";
import { createApp } from "../src/app";
import { ASSETS } from "../src/assets.generated";
import { ICONS } from "../src/seo";
import { SITE } from "../src/site";
import { fakeFetcher, goodSite } from "./fixtures";

const app = createApp({
	fetcher: fakeFetcher(goodSite()),
	publicUrl: "https://citable.test/",
});
const page = async (path: string) => (await app.request(path)).text();
const attr = (html: string, re: RegExp) => html.match(re)?.[1];

describe("site.ts", () => {
	it("keeps the tagline and description at lengths search results show whole", () => {
		expect(SITE.tagline.length).toBeLessThanOrEqual(60);
		expect(SITE.description.length).toBeGreaterThanOrEqual(110);
		expect(SITE.description.length).toBeLessThanOrEqual(160);
	});

	it("ships every icon the head and the manifest link to, at its size", () => {
		const size = (name: string) => {
			const png = Buffer.from(ASSETS[name].base64, "base64");
			return [png.readUInt32BE(16), png.readUInt32BE(20)];
		};
		for (const name of Object.values(ICONS)) expect(ASSETS[name]).toBeDefined();
		expect(size(ICONS.og)).toEqual([1200, 630]);
		expect(size(ICONS.apple)).toEqual([180, 180]);
	});
});

describe.each(["/", "/about", "/acme.example"])("the head of %s", (path) => {
	it("has one title, a description, a canonical link and a social card", async () => {
		const html = await page(path);
		expect(html.match(/<title>/g)).toHaveLength(1);
		const description = attr(
			html,
			/<meta name="description" content="([^"]+)"/,
		);
		expect(description?.length).toBeGreaterThan(50);
		expect(description?.length).toBeLessThanOrEqual(160);
		expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(
			`https://citable.test${path}`,
		);
		expect(attr(html, /<meta property="og:image" content="([^"]+)"/)).toBe(
			"https://citable.test/og.png",
		);
		expect(html).toContain(
			'<meta name="twitter:card" content="summary_large_image">',
		);
		expect(html).toContain('<link rel="icon" href="/favicon.ico"');
		expect(html).toContain('href="/about"');
	});

	it("has JSON-LD that parses", async () => {
		const json = attr(
			await page(path),
			/<script type="application\/ld\+json">(.+?)<\/script>/s,
		);
		const ld = JSON.parse(json as string) as {
			"@graph": { "@type": string }[];
		};
		const types = ld["@graph"].map((n) => n["@type"]);
		expect(types).toEqual(
			expect.arrayContaining(["WebSite", "Organization", "WebApplication"]),
		);
		if (path === "/about") expect(types).toContain("FAQPage");
	});
});

describe("files for crawlers", () => {
	it("serves robots.txt, the sitemap, the manifest and the icons instead of checking them as sites", async () => {
		expect(await page("/robots.txt")).toContain(
			"Sitemap: https://citable.test/sitemap.xml",
		);
		const sitemap = await app.request("/sitemap.xml");
		expect(sitemap.headers.get("content-type")).toContain("application/xml");
		expect(await sitemap.text()).toContain(
			"<loc>https://citable.test/about</loc>",
		);
		expect((await app.request("/site.webmanifest")).status).toBe(200);
		expect((await app.request("/.well-known/security.txt")).status).toBe(200);
		const og = await app.request("/og.png");
		expect(og.headers.get("content-type")).toBe("image/png");
		expect(
			(await app.request("/favicon.ico")).headers.get("content-type"),
		).toBe("image/x-icon");
	});

	it("keeps a failed check out of the index", async () => {
		const failing = createApp({
			fetcher: fakeFetcher({
				"https://down.example/": { error: "could not connect" },
			}),
			publicUrl: "https://citable.test/",
		});
		expect(await (await failing.request("/down.example")).text()).toContain(
			'<meta name="robots" content="noindex">',
		);
	});

	it("serves the how-it-works clip from the home page, with byte ranges for Safari", async () => {
		const home = await page("/");
		expect(home).toContain('<video src="/demo.mp4"');
		expect(home).toContain("autoplay muted loop playsinline controls");
		const full = await app.request("/demo.mp4");
		expect(full.headers.get("content-type")).toBe("video/mp4");
		expect(full.headers.get("accept-ranges")).toBe("bytes");
		const body = Buffer.from(await full.arrayBuffer());
		const size = body.byteLength;
		// the narration: an AAC track, which the controls unmute
		expect(body.includes("mp4a")).toBe(true);
		const part = await app.request("/demo.mp4", {
			headers: { range: "bytes=0-1" },
		});
		expect(part.status).toBe(206);
		expect(part.headers.get("content-range")).toBe(`bytes 0-1/${size}`);
		expect((await part.arrayBuffer()).byteLength).toBe(2);
		expect((await app.request("/demo.jpg")).headers.get("content-type")).toBe(
			"image/jpeg",
		);
	});
});
