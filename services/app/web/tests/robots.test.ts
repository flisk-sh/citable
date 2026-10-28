import { describe, expect, it } from "bun:test";
import { isAllowed, parseRobots } from "../src/robots";

describe("robots.txt", () => {
	it("uses the group that names the crawler, not the * group", () => {
		const robots = parseRobots(
			"User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n",
		);
		expect(isAllowed(robots, "OAI-SearchBot", "/").allowed).toBe(true);
		expect(isAllowed(robots, "OAI-SearchBot", "/").named).toBe(true);
		expect(isAllowed(robots, "GPTBot", "/").allowed).toBe(false);
	});

	it("matches crawler names case-insensitively and merges groups for one crawler", () => {
		const robots = parseRobots(
			"User-agent: gptbot\nDisallow: /a\n\nUser-agent: GPTBot\nDisallow: /b\n",
		);
		expect(isAllowed(robots, "GPTBot", "/a/x").allowed).toBe(false);
		expect(isAllowed(robots, "GPTBot", "/b").allowed).toBe(false);
		expect(isAllowed(robots, "GPTBot", "/c").allowed).toBe(true);
	});

	it("shares rules between consecutive user-agent lines", () => {
		const robots = parseRobots(
			"User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n",
		);
		expect(isAllowed(robots, "ClaudeBot", "/").allowed).toBe(false);
		expect(isAllowed(robots, "GPTBot", "/").allowed).toBe(false);
		expect(isAllowed(robots, "PerplexityBot", "/").allowed).toBe(true);
	});

	it("lets the longest rule win, and Allow win a tie", () => {
		const robots = parseRobots(
			"User-agent: *\nDisallow: /docs\nAllow: /docs/public\nDisallow: /x\nAllow: /x\n",
		);
		expect(isAllowed(robots, "Bingbot", "/docs/private").allowed).toBe(false);
		expect(isAllowed(robots, "Bingbot", "/docs/public/page").allowed).toBe(
			true,
		);
		expect(isAllowed(robots, "Bingbot", "/x").allowed).toBe(true);
	});

	it("reads * and $ in patterns", () => {
		const robots = parseRobots(
			"User-agent: *\nDisallow: /*.pdf$\nDisallow: /search*q=\n",
		);
		expect(isAllowed(robots, "Googlebot", "/a/b.pdf").allowed).toBe(false);
		expect(isAllowed(robots, "Googlebot", "/a/b.pdf?x").allowed).toBe(true);
		expect(isAllowed(robots, "Googlebot", "/search?lang=en&q=x").allowed).toBe(
			false,
		);
	});

	it("matches wildcards the way the regular expression did", () => {
		const cases: [string, string, boolean][] = [
			["/a*b*c", "/aXbYc", true],
			["/a*b*c", "/aXcYb", false],
			["/*.php$", "/x.php", true],
			["/*.php$", "/x.php?y", false],
			["/*.php", "/x.php?y", true],
			["/a*a$", "/a", false],
			["/a*a$", "/aa", true],
			["/x$", "/x", true],
			["/x$", "/xy", false],
			["*", "/anything", true],
			["/$", "/", true],
			["/a$b", "/a$bc", true],
		];
		for (const [pattern, path, expected] of cases) {
			const robots = parseRobots(`User-agent: *\nDisallow: ${pattern}\n`);
			expect([pattern, path, !isAllowed(robots, "Bot", path).allowed]).toEqual([
				pattern,
				path,
				expected,
			]);
		}
	});

	it("does not backtrack on a pattern built to stall it", () => {
		const robots = parseRobots(
			`User-agent: *\nDisallow: /${"*a".repeat(40)}*X\n`,
		);
		const started = performance.now();
		expect(isAllowed(robots, "Bot", `/${"a".repeat(2000)}`).allowed).toBe(true);
		expect(performance.now() - started).toBeLessThan(100);
	});

	it("treats an empty Disallow as no rule, and ignores comments", () => {
		const robots = parseRobots(
			"# hello\nUser-agent: * # everyone\nDisallow:\n",
		);
		expect(isAllowed(robots, "Googlebot", "/").allowed).toBe(true);
	});

	it("collects sitemaps wherever they appear", () => {
		const robots = parseRobots(
			"Sitemap: https://a.example/s1.xml\nUser-agent: *\nDisallow:\nSitemap: https://a.example/s2.xml\n",
		);
		expect(robots.sitemaps).toEqual([
			"https://a.example/s1.xml",
			"https://a.example/s2.xml",
		]);
	});

	it("names the rule that decided", () => {
		const robots = parseRobots("User-agent: ClaudeBot\nDisallow: /\n");
		expect(isAllowed(robots, "ClaudeBot", "/page").rule).toBe("Disallow: /");
	});
});
