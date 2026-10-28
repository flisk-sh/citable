import { afterEach, describe, expect, it } from "bun:test";
import { readPage } from "../../../services/app/web/src/html";
import {
	fakeFetcher,
	GOOD_PAGE,
	goodSite,
	SPA_PAGE,
} from "../../../services/app/web/tests/fixtures";
import { type Io, main } from "../src/cli";
import { NodeHTMLRewriter } from "../src/rewriter";

const NOW = new Date("2026-10-28T12:00:00Z");

async function run(argv: string[], site = goodSite()) {
	const out: string[] = [];
	const err: string[] = [];
	const io: Io = {
		out: (t) => out.push(t),
		err: (t) => err.push(t),
		fetcher: fakeFetcher(site),
		now: NOW,
	};
	const code = await main(argv, io);
	return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("citable", () => {
	it("prints the score and each check", async () => {
		const { code, out } = await run(["acme.example"]);
		expect(code).toBe(0);
		expect(out).toContain("https://acme.example/  100/100 (grade A)");
		expect(out).toContain("Answer engines: 7 of 7 allowed");
		expect(out).toContain("✓ llms.txt");
	});

	it("gives the same JSON for the same responses", async () => {
		const a = await run(["acme.example", "--json"]);
		const b = await run(["acme.example", "--json"]);
		expect(a.out).toBe(b.out);
		expect(JSON.parse(a.out).score).toBe(100);
	});

	it("fails below --min-score and says why", async () => {
		const site = goodSite();
		delete site["https://acme.example/llms.txt"];
		const { code, err } = await run(
			["acme.example", "--min-score", "100"],
			site,
		);
		expect(code).toBe(1);
		expect(err).toContain("scored 95, below --min-score 100");
		expect((await run(["acme.example", "--min-score", "95"], site)).code).toBe(
			0,
		);
	});

	it("scores the checks left after --skip out of 100", async () => {
		const site = goodSite();
		delete site["https://acme.example/llms.txt"];
		const { out } = await run(
			["acme.example", "--json", "--skip", "speed,llms-txt"],
			site,
		);
		const report = JSON.parse(out);
		expect(report.score).toBe(100);
		expect(report.checks.map((c: { id: string }) => c.id)).not.toContain(
			"llms-txt",
		);
	});

	it("prints a Markdown table with the fixes", async () => {
		const site = goodSite();
		delete site["https://acme.example/llms.txt"];
		const { out } = await run(["acme.example", "--markdown"], site);
		expect(out).toContain("### https://acme.example/: 95/100 (grade A)");
		expect(out).toContain("| ! | llms.txt | 0/5 |");
		expect(out).toContain("**How to fix**");
	});

	it("exits 2 when a page cannot be read", async () => {
		const { code, out } = await run(["acme.example"], {
			"https://acme.example/": { error: "could not connect" },
		});
		expect(code).toBe(2);
		expect(out).toContain("could not read the page: could not connect");
	});

	it("checks a local preview server given as a full address", async () => {
		const { code, out } = await run(
			["http://localhost:4173", "--skip", "speed"],
			goodSite("http://localhost:4173"),
		);
		expect(out).toContain("http://localhost:4173/  ");
		expect(code).toBe(0);
	});

	it("exits 2 on wrong usage", async () => {
		expect((await run([])).code).toBe(2);
		expect((await run(["acme.example", "--skip", "nope"])).err).toContain(
			"Unknown check id: nope",
		);
		expect((await run(["acme.example", "--min-score", "120"])).code).toBe(2);
		expect((await run(["not an address"])).code).toBe(2);
	});
});

describe("the Node rewriter", () => {
	const g = globalThis as unknown as { HTMLRewriter: unknown };
	const native = g.HTMLRewriter;
	afterEach(() => {
		g.HTMLRewriter = native;
	});

	it("reads a page exactly as Bun's HTMLRewriter does", async () => {
		const pages = [
			GOOD_PAGE,
			SPA_PAGE,
			"<html><body><h1>One</h1><h1>Two &amp; <b>three</b></h1><noscript>hidden</noscript></body></html>",
		];
		const fromBun = await Promise.all(pages.map(readPage));
		g.HTMLRewriter = NodeHTMLRewriter;
		const fromNode = await Promise.all(pages.map(readPage));
		expect(fromNode).toEqual(fromBun);
	});
});
