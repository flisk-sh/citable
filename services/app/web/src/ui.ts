// The pages, rendered on the server with no JavaScript: the home page with its form, a report, and the badge. The
// Content-Security-Policy in index.ts allows no scripts at all.
import type { Check, Report } from "./checks";
import { esc, faqJsonLd, head, type PageMeta } from "./seo";
import { SITE } from "./site";

export const EXAMPLES = ["stripe.com", "vercel.com", "nytimes.com", "flisk.sh"];

const STYLE = `
:root{--bg:#fbfaf7;--fg:#1d1c1a;--muted:#6b6862;--line:#e6e2da;--card:#fff;--pass:#1f7a4d;--warn:#a86400;--fail:#b3261e;--info:#4a5a78;--accent:#2d4cc8}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#efede8;--muted:#a19d95;--line:#2c2b28;--card:#1c1b19;--pass:#5fc28e;--warn:#e0a54a;--fail:#f07a70;--info:#9fb0d4;--accent:#8ea2ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 80px}a{color:var(--accent)}
h1{font-size:clamp(28px,6vw,44px);line-height:1.1;letter-spacing:-.02em;margin:0 0 12px}
.lede{color:var(--muted);font-size:18px;margin:0 0 28px}
form{display:flex;gap:8px;flex-wrap:wrap}input[type=text]{flex:1 1 260px;min-width:0;font:inherit;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg)}
button{font:inherit;font-weight:600;padding:12px 18px;border:0;border-radius:10px;background:var(--fg);color:var(--bg);cursor:pointer}
.chips{margin:14px 0 0;color:var(--muted);font-size:14px}.chips a{margin-right:10px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;font-size:14px}.top a{color:var(--fg);text-decoration:none;font-weight:700}
.score{display:flex;gap:20px;align-items:center;margin:8px 0 28px}
.ring{flex:none;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--s)*1%),var(--line) 0)}
.ring b{width:84px;height:84px;border-radius:50%;background:var(--bg);display:grid;place-items:center;font-size:30px}
.ring small{display:block;font-size:12px;color:var(--muted);font-weight:400;margin-top:-6px}
.host{font-size:clamp(22px,5vw,30px);font-weight:700;word-break:break-all;margin:0}
.meta{color:var(--muted);font-size:14px;margin:4px 0 0}
.check{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:14px 16px;margin:10px 0}
.check h3{font-size:16px;margin:0;display:flex;gap:10px;align-items:baseline}.check h3 span.pts{margin-left:auto;color:var(--muted);font-weight:400;font-size:14px;white-space:nowrap}
.dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--c);display:inline-block;transform:translateY(1px)}
.check p{margin:6px 0 0}.fix{white-space:pre-wrap;background:color-mix(in srgb,var(--c) 9%,transparent);border-left:3px solid var(--c);padding:8px 12px;border-radius:6px;margin-top:8px}
details{margin-top:6px;color:var(--muted);font-size:14px}details ul{margin:6px 0 0;padding-left:20px;word-break:break-word}
h2{font-size:20px;margin:36px 0 8px}pre{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;overflow-x:auto;font-size:13px;white-space:pre-wrap;word-break:break-all}
.row{display:flex;gap:8px;flex-wrap:wrap}.btn{display:inline-block;padding:9px 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--fg);background:var(--card);font-size:14px;font-weight:600}
.error{border:1px solid var(--fail);color:var(--fail);border-radius:12px;padding:14px 16px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.top{flex-wrap:wrap;gap:12px}.top form{flex:0 1 380px;flex-wrap:nowrap}.top input[type=text]{flex:1 1 auto}.top input[type=text],.top button{padding:8px 12px}
footer{margin-top:48px;color:var(--muted);font-size:14px}
dt{font-weight:700;margin-top:14px}dd{margin:4px 0 0}
.demo{margin:24px 0 0;max-width:560px}.demo video,.demo img{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);background:var(--card)}.demo .still{display:none}
@media (prefers-reduced-motion:reduce){.demo video{display:none}.demo .still{display:block}}
.pass{--c:var(--pass)}.warn{--c:var(--warn)}.fail{--c:var(--fail)}.info{--c:var(--info)}
`;

/** The path the site is served under: empty online, /api/web behind Flisk's local proxy. */
const rootOf = (publicUrl: string) =>
	new URL(publicUrl).pathname.replace(/\/$/, "");

/** `publicUrl` is the site's own address, ending in a slash; `meta.path` is the page under it. */
function layout(publicUrl: string, meta: PageMeta, body: string): string {
	const base = publicUrl.replace(/\/$/, "");
	const root = rootOf(publicUrl);
	return `<!doctype html><html lang="${SITE.lang}"><head>
${head(base, meta)}
<style>${STYLE}</style></head><body><main>${body}
<footer>Citable reads pages the way an AI crawler does: no JavaScript, no model, nothing stored. <a href="${SITE.repo}">Open source</a>, built and run with <a href="${SITE.author.url}">Flisk</a>. · <a href="${root}/about">About the checker</a></footer>
</main></body></html>`;
}

const form = (root: string, value = "") =>
	`<form action="${root}/check" method="get"><input type="text" name="url" value="${esc(value)}" placeholder="example.com" aria-label="Site address" autocomplete="url" inputmode="url" required><button type="submit">Check</button></form>`;

/** The home page; `noindex` when it answers an address that is not a site (404). */
export function homePage(publicUrl: string, noindex = false): string {
	const base = publicUrl.replace(/\/$/, "");
	const root = rootOf(publicUrl);
	return layout(
		publicUrl,
		{
			path: "",
			title: `${SITE.name}: ${SITE.tagline}`,
			description: SITE.description,
			noindex,
		},
		`<h1>Can AI answers cite your site?</h1>
<p class="lede">Put <b>citable.flisk.si/</b> in front of any address. Citable reads the page the way ChatGPT, Claude, Perplexity and Google's crawlers do, and tells you what keeps it out of their answers, with the fix.</p>
${form(root)}
<p class="chips">Try ${EXAMPLES.map((e) => `<a href="${root}/${e}">${e}</a>`).join("")}</p>
<figure class="demo"><img class="still" src="${root}/demo.jpg" width="960" height="540" alt=""><video src="${root}/demo.mp4" poster="${root}/demo.jpg" width="960" height="540" autoplay muted loop playsinline preload="metadata" aria-describedby="demo-text"></video>
<figcaption id="demo-text" class="sr">A 13-second clip: citable.flisk.si/ is typed in front of stripe.com, the report scores it 96 out of 100, lists each check with its fix, and offers Ask ChatGPT and Ask Claude buttons.</figcaption></figure>
<h2>What it checks</h2>
<ul>
<li>robots.txt for each answer engine's crawler, apart from the training crawlers you may want to keep out</li>
<li>noindex and nosnippet, which keep a page out of answers and AI Overviews</li>
<li>whether the text is in the HTML or appears only after JavaScript runs</li>
<li>title, description, headings, canonical, schema.org data, sitemap, llms.txt, response time</li>
</ul>
<h2>In your AI</h2>
<p>Citable is also an MCP server. Ask your assistant "can AI cite example.com?":</p>
<pre>claude mcp add --transport http citable ${esc(base)}/mcp</pre>`,
	);
}

const statusWord: Record<Check["status"], string> = {
	pass: "Pass",
	warn: "Improve",
	fail: "Fix",
	info: "Note",
};

function checkCard(c: Check): string {
	return `<section class="check ${c.status}"><h3><span class="dot" aria-hidden="true"></span>${esc(c.title)}<span class="pts">${c.max > 0 ? `${Math.round(c.points)} / ${c.max}` : statusWord[c.status]}</span></h3>
<p><span class="sr">${statusWord[c.status]}: </span>${esc(c.summary)}</p>${c.fix ? `<div class="fix">${esc(c.fix)}</div>` : ""}${
		c.details?.length
			? `<details><summary>Details</summary><ul>${c.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>`
			: ""
	}</section>`;
}

/** The text that hands a report's fixes to the visitor's own AI. */
export function fixPrompt(report: Report): string {
	const todo = report.checks.filter(
		(c) => c.fix && (c.status === "fail" || c.status === "warn"),
	);
	return [
		`Citable checked ${report.finalUrl} for AI search (score ${report.score}/100). Help me fix these, most important first, with the exact code or config to change:`,
		...todo.map(
			(c, i) =>
				`${i + 1}. ${c.title}: ${c.summary}\n   Suggested fix: ${c.fix}`,
		),
	].join("\n");
}

const scoreClass = (score: number) =>
	score >= 75 ? "pass" : score >= 50 ? "warn" : "fail";

export function reportPage(report: Report, publicUrl: string): string {
	const base = publicUrl.replace(/\/$/, "");
	const root = rootOf(publicUrl);
	const path = `${report.host}${new URL(report.url).pathname.replace(/^\/$/, "")}`;
	const top = `<div class="top"><a href="${root}/">Citable</a>${form(root, report.host)}</div>`;
	if (report.error) {
		return layout(
			publicUrl,
			{
				path,
				title: `${report.host}: could not check`,
				description: `Citable could not read ${report.host}, so it cannot say whether ChatGPT, Claude, Perplexity and Google AI can cite it.`,
				noindex: true,
			},
			`${top}<p class="host">${esc(report.host)}</p><div class="error" style="margin-top:16px">Could not read the page: ${esc(report.error)}.</div>`,
		);
	}
	const fixes = report.checks.filter(
		(c) => c.status === "fail" || c.status === "warn",
	).length;
	const prompt = fixPrompt(report);
	const q = encodeURIComponent(prompt);
	const ordered = [...report.checks].sort((a, b) => order(a) - order(b));
	return layout(
		publicUrl,
		{
			path,
			title: `${report.host}: ${report.score}/100 for AI search`,
			description: `Can ChatGPT, Claude, Perplexity and Google AI cite ${report.host}? Score ${report.score}/100, grade ${report.grade}, ${fixes} thing${fixes === 1 ? "" : "s"} to fix, each with the fix.`,
			crumbs: [{ name: report.host, path }],
		},
		`${top}
<div class="score"><div class="ring ${scoreClass(report.score)}" style="--s:${report.score}" role="img" aria-label="Score ${report.score} of 100"><b>${report.score}<small>grade ${report.grade}</small></b></div>
<div><p class="host">${esc(report.host)}</p><p class="meta">${esc(report.finalUrl)}<br>${fixes === 0 ? "Nothing to fix." : `${fixes} thing${fixes === 1 ? "" : "s"} to fix.`} Checked ${esc(report.checkedAt.replace("T", " ").slice(0, 16))} UTC · <a href="?fresh=1">check again</a></p></div></div>
${report.partial ? `<div class="error">Partial report: the page answered ${report.partial}, so its contents were not checked.</div>` : ""}
${ordered.map(checkCard).join("")}
${
	fixes > 0
		? `<h2>Fix it with your AI</h2><p>Citable never calls a model. Hand the list to yours:</p>
<div class="row"><a class="btn" href="https://chatgpt.com/?q=${q}" rel="noopener" target="_blank">Ask ChatGPT</a><a class="btn" href="https://claude.ai/new?q=${q}" rel="noopener" target="_blank">Ask Claude</a></div>
<details><summary>The text it hands over</summary><pre>${esc(prompt)}</pre></details>`
		: ""
}
<h2>Show the score</h2>
<p><img src="${root}/badge/${esc(report.host)}.svg" alt="AI search score ${report.score}" height="20"></p>
<pre>[![AI search: ${report.score}/100](${esc(base)}/badge/${esc(report.host)}.svg)](${esc(base)}/${esc(report.host)})</pre>`,
	);
}

const order = (c: Check) => ({ fail: 0, warn: 1, pass: 2, info: 3 })[c.status];

export function aboutPage(publicUrl: string): string {
	return layout(
		publicUrl,
		{
			path: "about",
			title: "About the checker",
			description:
				"How Citable checks a site for AI search: what it fetches, the crawler it sends, what it stores, and answers to common questions.",
			jsonLd: [faqJsonLd()],
			crumbs: [{ name: "About", path: "about" }],
		},
		`<div class="top"><a href="${rootOf(publicUrl)}/">Citable</a></div><h1>About the checker</h1>
<p>For each check, Citable fetches at most four addresses from the site: the page, <code>/robots.txt</code>, <code>/llms.txt</code> and the sitemap. It identifies itself as <code>CitableBot/1.0 (+${esc(publicUrl.replace(/\/$/, ""))}/about)</code>, sends only GET requests, follows at most five redirects, reads at most 2 MB, and only reaches public addresses on ports 80 and 443.</p>
<p>A report is kept in memory for an hour so a shared link does not fetch the site again, then forgotten. Nothing is stored on disk; there is no database and no account.</p>
<p>Robots rules are read as RFC 9309 says: the group that names a crawler, else the <code>*</code> group, and the longest matching rule. Citable does not pretend to be another crawler, so a firewall that blocks some user agents may treat the real ones differently.</p>
<h2>Questions</h2>
<dl>${SITE.faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join("")}</dl>`,
	);
}

/** A shields-style badge: "AI search | 82/100". */
export function badge(score: number | undefined): string {
	const label = "AI search";
	const value = score === undefined ? "unknown" : `${score}/100`;
	const color =
		score === undefined
			? "#9f9f9f"
			: score >= 75
				? "#2e8b57"
				: score >= 50
					? "#d48a00"
					: "#c0392b";
	const lw = 62;
	const vw = Math.max(44, value.length * 7 + 12);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${label}: ${value}"><title>${label}: ${value}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + vw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${vw}" height="20" fill="${color}"/><rect width="${lw + vw}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${lw / 2}" y="14">${label}</text><text x="${lw + vw / 2}" y="14">${value}</text></g></svg>`;
}
