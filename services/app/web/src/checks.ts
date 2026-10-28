// The report: what an AI answer engine needs before it can read a page and cite it, checked from the outside the way a
// crawler sees it. Every check is deterministic (no model) and says how to fix what it finds. All I/O goes through the
// Fetcher, so tests/checks.test.ts runs whole reports against fixtures.
import { clip, readPage, schemaTypes } from "./html";
import type { Fetched, Fetcher } from "./net";
import { isAllowed, parseRobots, type Robots } from "./robots";

export type Status = "pass" | "warn" | "fail" | "info";

export interface Check {
	id: string;
	title: string;
	status: Status;
	points: number;
	max: number;
	summary: string;
	fix?: string;
	details?: string[];
}

export interface CrawlerVerdict {
	token: string;
	owner: string;
	role: "answers" | "training";
	allowed: boolean;
	rule?: string;
}

export interface Report {
	url: string;
	finalUrl: string;
	host: string;
	checkedAt: string;
	score: number;
	grade: string;
	checks: Check[];
	crawlers: CrawlerVerdict[];
	error?: string;
	/** The page's status when it was not 200, so its contents were not checked. */
	partial?: number;
}

/** Crawlers that fetch pages to answer and cite (blocking them keeps a site out of answers), then training crawlers. */
export const CRAWLERS: Omit<CrawlerVerdict, "allowed" | "rule">[] = [
	{ token: "OAI-SearchBot", owner: "ChatGPT search", role: "answers" },
	{
		token: "ChatGPT-User",
		owner: "ChatGPT, when a user asks",
		role: "answers",
	},
	{ token: "Claude-SearchBot", owner: "Claude search", role: "answers" },
	{ token: "Claude-User", owner: "Claude, when a user asks", role: "answers" },
	{ token: "PerplexityBot", owner: "Perplexity", role: "answers" },
	{
		token: "Googlebot",
		owner: "Google Search, AI Overviews, AI Mode",
		role: "answers",
	},
	{ token: "Bingbot", owner: "Bing, Copilot", role: "answers" },
	{ token: "GPTBot", owner: "OpenAI model training", role: "training" },
	{ token: "ClaudeBot", owner: "Anthropic model training", role: "training" },
	{
		token: "Google-Extended",
		owner: "Gemini model training",
		role: "training",
	},
	{
		token: "Applebot-Extended",
		owner: "Apple model training",
		role: "training",
	},
	{ token: "CCBot", owner: "Common Crawl", role: "training" },
	{ token: "meta-externalagent", owner: "Meta AI", role: "training" },
];

export function grade(score: number): string {
	if (score >= 90) return "A";
	if (score >= 75) return "B";
	if (score >= 60) return "C";
	if (score >= 40) return "D";
	return "F";
}

const isText = (f: Fetched) =>
	f.status === 200 && !/text\/html/i.test(f.headers["content-type"] ?? "");

export async function checkSite(
	target: URL,
	fetcher: Fetcher,
	now = new Date(),
): Promise<Report> {
	const page = await fetcher(target.href);
	const base: Omit<Report, "score" | "grade" | "checks" | "crawlers"> = {
		url: target.href,
		finalUrl: page.finalUrl,
		host: target.hostname,
		checkedAt: now.toISOString(),
	};
	if (page.error || page.status === 0) {
		return {
			...base,
			score: 0,
			grade: "F",
			checks: [],
			crawlers: [],
			error: page.error ?? "no answer",
		};
	}

	const final = new URL(page.finalUrl);
	const origin = final.origin;
	const [robotsFile, llms] = await Promise.all([
		fetcher(`${origin}/robots.txt`, { maxBytes: 500_000, timeoutMs: 6000 }),
		fetcher(`${origin}/llms.txt`, { maxBytes: 200_000, timeoutMs: 6000 }),
	]);
	const robotsOk = isText(robotsFile);
	const robots: Robots = robotsOk
		? parseRobots(robotsFile.body)
		: { groups: [], sitemaps: [] };
	const sitemapUrl = robots.sitemaps[0] ?? `${origin}/sitemap.xml`;
	const [sitemap, facts] = await Promise.all([
		fetcher(sitemapUrl, { maxBytes: 64_000, timeoutMs: 6000 }),
		readPage(page.status === 200 ? page.body : ""),
	]);

	const path = final.pathname + final.search;
	// A robots.txt that answers 5xx or not at all: Google treats the whole site as disallowed until it can read it.
	const robotsDown = robotsFile.status === 0 || robotsFile.status >= 500;
	const crawlers: CrawlerVerdict[] = CRAWLERS.map((c) => {
		if (robotsDown)
			return {
				...c,
				allowed: false,
				rule: `robots.txt ${robotsFile.status || "unreachable"}`,
			};
		const verdict = isAllowed(robots, c.token, path);
		return { ...c, allowed: verdict.allowed, rule: verdict.rule };
	});

	// Without a 200 there is no page to read: the checks of its contents say so instead of scoring an empty page.
	const read = page.status === 200;
	const ofPage = (
		check: () => Check,
		id: string,
		title: string,
		max: number,
	): Check =>
		read
			? check()
			: {
					id,
					title,
					status: "info",
					points: 0,
					max,
					summary: `Not checked: the page answered ${page.status}.`,
				};
	const checks: Check[] = [
		crawlerCheck(crawlers, robotsFile, robotsDown),
		trainingCheck(crawlers),
		indexableCheck(page, facts.metaRobots, final),
		ofPage(
			() => contentCheck(facts.words, facts.scripts, page.status),
			"content",
			"Readable without JavaScript",
			15,
		),
		ofPage(
			() => titleCheck(facts.title, facts.description),
			"title",
			"Title and description",
			10,
		),
		ofPage(
			() => structuredDataCheck(facts.jsonLd),
			"structured-data",
			"Structured data (schema.org)",
			10,
		),
		ofPage(
			() => headingsCheck(facts.h1, facts.h1Count, facts.h2Count),
			"headings",
			"Headings",
			5,
		),
		ofPage(
			() => canonicalCheck(facts.canonical, final),
			"canonical",
			"Canonical address",
			5,
		),
		sitemapCheck(sitemap, robots.sitemaps.length > 0),
		llmsCheck(llms),
		speedCheck(page.ms),
	];
	const score = Math.round(checks.reduce((sum, c) => sum + c.points, 0));
	return {
		...base,
		score,
		grade: grade(score),
		checks,
		crawlers,
		...(read ? {} : { partial: page.status }),
	};
}

function crawlerCheck(
	crawlers: CrawlerVerdict[],
	robotsFile: Fetched,
	robotsDown: boolean,
): Check {
	const answers = crawlers.filter((c) => c.role === "answers");
	const blocked = answers.filter((c) => !c.allowed);
	const max = 25;
	const points = (max * (answers.length - blocked.length)) / answers.length;
	const details = answers.map(
		(c) =>
			`${c.allowed ? "allowed" : "blocked"}: ${c.token} (${c.owner})${c.rule ? `, ${c.rule}` : ""}`,
	);
	if (robotsDown) {
		return {
			id: "ai-crawlers",
			title: "AI answer engines can crawl the page",
			status: "fail",
			points: 0,
			max,
			summary: `robots.txt answered ${robotsFile.status || "nothing"}. Crawlers treat an unreadable robots.txt as "keep out" until they can read it.`,
			fix: "Serve /robots.txt with status 200, or 404 when there are no rules.",
			details,
		};
	}
	if (blocked.length === 0) {
		return {
			id: "ai-crawlers",
			title: "AI answer engines can crawl the page",
			status: "pass",
			points,
			max,
			summary:
				robotsFile.status === 200
					? `All ${answers.length} answer crawlers may fetch this page.`
					: `No robots.txt (${robotsFile.status}), so every crawler may fetch this page.`,
			details,
		};
	}
	return {
		id: "ai-crawlers",
		title: "AI answer engines can crawl the page",
		status: "fail",
		points,
		max,
		summary: `${blocked.map((c) => c.token).join(", ")} ${blocked.length === 1 ? "is" : "are"} blocked, so ${blocked.length === 1 ? "that engine" : "those engines"} cannot read this page to cite it.`,
		fix: `In robots.txt, add a group that allows them, for example:\nUser-agent: ${blocked[0].token}\nAllow: /\nTraining crawlers (GPTBot, ClaudeBot, Google-Extended) are separate tokens: you can keep those blocked.`,
		details,
	};
}

function trainingCheck(crawlers: CrawlerVerdict[]): Check {
	const training = crawlers.filter((c) => c.role === "training");
	const blocked = training.filter((c) => !c.allowed);
	return {
		id: "training-crawlers",
		title: "Model training crawlers",
		status: "info",
		points: 0,
		max: 0,
		summary:
			blocked.length === 0
				? "Training crawlers may fetch this page. That is a choice, not a score: it does not change whether answers cite you."
				: `${blocked.length} of ${training.length} training crawlers are blocked. That is a choice, not a score: it does not change whether answers cite you.`,
		details: training.map(
			(c) => `${c.allowed ? "allowed" : "blocked"}: ${c.token} (${c.owner})`,
		),
	};
}

function indexableCheck(page: Fetched, metaRobots: string, final: URL): Check {
	const max = 15;
	const header = page.headers["x-robots-tag"] ?? "";
	const directives = `${metaRobots}, ${header}`.toLowerCase();
	const details = [
		`status ${page.status}`,
		`meta robots: ${clip(metaRobots) || "none"}`,
		`X-Robots-Tag: ${clip(header) || "none"}`,
		`${final.protocol === "https:" ? "HTTPS" : "plain HTTP"}`,
	];
	if (page.status === 401 || page.status === 403 || page.status === 429) {
		return {
			id: "indexable",
			title: "The page can be indexed and quoted",
			status: "fail",
			points: 0,
			max,
			summary: `The site refused Citable's crawler with ${page.status}. Bot protection that refuses unknown crawlers often refuses AI crawlers too, and they cannot cite a page they cannot read.`,
			fix: "In your firewall or bot protection (Cloudflare, Vercel, Akamai and others have a setting for it), let verified AI search crawlers through: OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot. Then check again.",
			details,
		};
	}
	if (page.status !== 200) {
		return {
			id: "indexable",
			title: "The page can be indexed and quoted",
			status: "fail",
			points: 0,
			max,
			summary: `The page answered ${page.status}. Crawlers keep only pages that answer 200.`,
			fix: "Make the address answer 200 (or redirect once to the address that does).",
			details,
		};
	}
	if (/\b(noindex|none)\b/.test(directives)) {
		return {
			id: "indexable",
			title: "The page can be indexed and quoted",
			status: "fail",
			points: 0,
			max,
			summary:
				"The page asks not to be indexed (noindex), so search and AI answers leave it out.",
			fix: 'Remove noindex from <meta name="robots"> and the X-Robots-Tag header on pages you want cited.',
			details,
		};
	}
	if (/\bnosnippet\b|max-snippet\s*:\s*0\b/.test(directives)) {
		return {
			id: "indexable",
			title: "The page can be indexed and quoted",
			status: "warn",
			points: 5,
			max,
			summary:
				"nosnippet (or max-snippet:0) forbids quoting the page. Google keeps such pages out of AI Overviews.",
			fix: "Remove nosnippet and max-snippet:0, or apply them only to the parts that must not be quoted (data-nosnippet).",
			details,
		};
	}
	if (final.protocol !== "https:") {
		return {
			id: "indexable",
			title: "The page can be indexed and quoted",
			status: "warn",
			points: 10,
			max,
			summary: "The page is served over plain HTTP.",
			fix: "Serve it over HTTPS and redirect HTTP to it.",
			details,
		};
	}
	return {
		id: "indexable",
		title: "The page can be indexed and quoted",
		status: "pass",
		points: max,
		max,
		summary: "Status 200 over HTTPS, with no noindex or nosnippet.",
		details,
	};
}

function contentCheck(words: number, scripts: number, status: number): Check {
	const max = 15;
	const summaryBase = `The HTML the server sends has ${words} words of readable text.`;
	if (status === 200 && words >= 250) {
		return {
			id: "content",
			title: "Readable without JavaScript",
			status: "pass",
			points: max,
			max,
			summary: summaryBase,
		};
	}
	const fix =
		"Most AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not run JavaScript. Render the main content on the server: server-side rendering or static generation (Next.js, Astro, Nuxt, SvelteKit all do it), or prerender the page.";
	if (words >= 80) {
		return {
			id: "content",
			title: "Readable without JavaScript",
			status: "warn",
			points: 8,
			max,
			summary: `${summaryBase} That is thin: an answer engine has little to quote.`,
			fix,
		};
	}
	return {
		id: "content",
		title: "Readable without JavaScript",
		status: "fail",
		points: 0,
		max,
		summary: `${summaryBase}${scripts > 0 ? " The text probably appears only after JavaScript runs, and crawlers that do not run it see an empty page." : ""}`,
		fix,
	};
}

function titleCheck(title: string, description: string): Check {
	const max = 10;
	const problems: string[] = [];
	let points = 0;
	if (!title) problems.push("no <title>");
	else if (title.length < 10 || title.length > 70) {
		problems.push(
			`the title is ${title.length} characters (10 to 70 reads best)`,
		);
		points += 3;
	} else points += 5;
	if (!description) problems.push("no meta description");
	else if (description.length < 50 || description.length > 170) {
		problems.push(
			`the description is ${description.length} characters (50 to 170 reads best)`,
		);
		points += 3;
	} else points += 5;
	const details = [
		`title: ${title || "(none)"}`,
		`description: ${description || "(none)"}`,
	];
	if (problems.length === 0) {
		return {
			id: "title",
			title: "Title and description",
			status: "pass",
			points,
			max,
			summary: "Both present and a readable length.",
			details,
		};
	}
	return {
		id: "title",
		title: "Title and description",
		status: points === 0 ? "fail" : "warn",
		points,
		max,
		summary: `${problems.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
		fix: 'Give the page a <title> that names it (10 to 70 characters) and a <meta name="description"> that says what it answers (50 to 170 characters). Engines show both next to the citation.',
		details,
	};
}

function structuredDataCheck(blocks: string[]): Check {
	const max = 10;
	const { types, invalid } = schemaTypes(blocks);
	const fix =
		"Add JSON-LD that says what the page is: Organization and WebSite on the home page, Article, Product, SoftwareApplication or FAQPage where they fit. https://schema.org";
	if (types.length === 0) {
		return {
			id: "structured-data",
			title: "Structured data (schema.org)",
			status: invalid > 0 ? "fail" : "warn",
			points: 0,
			max,
			summary:
				invalid > 0
					? `${invalid} JSON-LD block${invalid === 1 ? " is" : "s are"} not valid JSON.`
					: "No JSON-LD on the page.",
			fix,
		};
	}
	if (invalid > 0) {
		return {
			id: "structured-data",
			title: "Structured data (schema.org)",
			status: "warn",
			points: 5,
			max,
			summary: `Types: ${types.join(", ")}. ${invalid} other block${invalid === 1 ? " is" : "s are"} not valid JSON.`,
			fix: "Fix the JSON-LD blocks that do not parse (a trailing comma or an unescaped quote is the usual cause).",
		};
	}
	return {
		id: "structured-data",
		title: "Structured data (schema.org)",
		status: "pass",
		points: max,
		max,
		summary: `Types: ${types.join(", ")}.`,
	};
}

function headingsCheck(h1: string[], h1Count: number, h2Count: number): Check {
	const max = 5;
	const details = [...h1.map((h) => `h1: ${h || "(empty)"}`), `${h2Count} h2`];
	if (h1Count === 1 && h1[0] && h2Count > 0) {
		return {
			id: "headings",
			title: "Headings",
			status: "pass",
			points: max,
			max,
			summary: `One h1 ("${h1[0]}") and ${h2Count} h2 sections.`,
			details,
		};
	}
	const summary =
		h1Count === 0
			? "No h1."
			: h1Count > 1
				? `${h1Count} h1 headings.`
				: !h1[0]
					? "The h1 is empty."
					: "No h2 sections under the h1.";
	return {
		id: "headings",
		title: "Headings",
		status: "warn",
		points: h1.length >= 1 ? 3 : 0,
		max,
		summary,
		fix: "Use one h1 that names the page and h2s for its sections. Engines quote by section, and headings tell them where one starts.",
		details,
	};
}

function canonicalCheck(canonical: string, final: URL): Check {
	const max = 5;
	if (!canonical) {
		return {
			id: "canonical",
			title: "Canonical address",
			status: "warn",
			points: 0,
			max,
			summary: 'No <link rel="canonical">.',
			fix: `Add <link rel="canonical" href="${final.origin}${final.pathname}"> so every copy of the page credits one address.`,
		};
	}
	let resolved: URL;
	try {
		resolved = new URL(canonical, final);
	} catch {
		return {
			id: "canonical",
			title: "Canonical address",
			status: "fail",
			points: 0,
			max,
			summary: `The canonical "${canonical}" is not a valid address.`,
			fix: "Use an absolute https address.",
		};
	}
	if (resolved.hostname !== final.hostname) {
		return {
			id: "canonical",
			title: "Canonical address",
			status: "warn",
			points: 2,
			max,
			summary: `The canonical points to another host: ${resolved.href}. Credit goes there, not here.`,
			fix: "Point the canonical at this site unless the page really is a copy.",
		};
	}
	return {
		id: "canonical",
		title: "Canonical address",
		status: "pass",
		points: max,
		max,
		summary: resolved.href,
	};
}

function sitemapCheck(sitemap: Fetched, listed: boolean): Check {
	const max = 5;
	const looksLikeSitemap =
		sitemap.status === 200 &&
		/<(urlset|sitemapindex)\b/i.test(sitemap.body.slice(0, 64_000));
	if (looksLikeSitemap) {
		return {
			id: "sitemap",
			title: "Sitemap",
			status: "pass",
			points: listed ? max : 4,
			max,
			summary: listed
				? `Listed in robots.txt: ${clip(sitemap.finalUrl, 2000)}`
				: `Found at ${clip(sitemap.finalUrl, 2000)}, but robots.txt does not list it.`,
			fix: listed
				? undefined
				: `Add "Sitemap: ${clip(sitemap.finalUrl, 2000)}" to robots.txt.`,
		};
	}
	return {
		id: "sitemap",
		title: "Sitemap",
		status: "warn",
		points: 0,
		max,
		summary: listed
			? `robots.txt lists a sitemap, but ${clip(sitemap.finalUrl, 2000)} is not one (${sitemap.status || sitemap.error}).`
			: "No sitemap at /sitemap.xml and none listed in robots.txt.",
		fix: 'Publish an XML sitemap and list it in robots.txt with a "Sitemap:" line, so crawlers find every page, not only the linked ones.',
	};
}

function llmsCheck(llms: Fetched): Check {
	const max = 5;
	const note =
		"llms.txt is a young convention: AI coding tools read it, while no major answer engine says it uses it yet. Cheap to add.";
	if (isText(llms) && /^\s*# \S/.test(llms.body)) {
		const links =
			// A link stops at whitespace or the next "]": unbounded, a body of "](http://" repeated took a second to scan.
			(llms.body.match(/\]\(https?:\/\/[^)\s\]]+\)|\]\(\/[^)\s\]]*\)/g) ?? [])
				.length;
		return {
			id: "llms-txt",
			title: "llms.txt",
			status: "pass",
			points: max,
			max,
			summary: `Found at ${clip(llms.finalUrl, 2000)}, with ${links} link${links === 1 ? "" : "s"}.`,
			details: [note],
		};
	}
	return {
		id: "llms-txt",
		title: "llms.txt",
		status: "warn",
		points: 0,
		max,
		summary: isText(llms)
			? '/llms.txt exists but does not start with a "# " title.'
			: "No /llms.txt.",
		fix: 'Add /llms.txt: a Markdown file with "# Site name", a "> one-line summary", and lists of links to the pages that matter. https://llmstxt.org',
		details: [note],
	};
}

function speedCheck(ms: number): Check {
	const max = 5;
	const summary = `The first byte of the page arrived after ${ms} ms (measured from Frankfurt, redirects included).`;
	if (ms < 800)
		return {
			id: "speed",
			title: "Response time",
			status: "pass",
			points: max,
			max,
			summary,
		};
	return {
		id: "speed",
		title: "Response time",
		status: ms < 2000 ? "warn" : "fail",
		points: ms < 2000 ? 3 : 0,
		max,
		summary,
		fix: "Answer engines fetch while the user waits and give up on slow pages. Cache the HTML at the edge (a CDN) and skip redirect chains.",
	};
}
