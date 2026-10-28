// The pages, rendered on the server with no JavaScript: the home page with its form, a report, and the badge. The
// Content-Security-Policy in index.ts allows no scripts at all.
import type { Check, Report } from "./checks";
import { esc, faqJsonLd, head, ICONS, type PageMeta } from "./seo";
import { SITE } from "./site";

export const EXAMPLES = ["stripe.com", "vercel.com", "nytimes.com", "flisk.sh"];

const STYLE = `
:root{--bg:#f6f5f1;--surface:#fff;--sunk:#efede7;--fg:#141413;--muted:#66635c;--faint:#8f8b82;--line:#e3e0d7;--accent:#2d4cc8;--accent-fg:#fff;--pass:#18794e;--warn:#b25d00;--fail:#c22a1f;--info:#4a5a78;--shadow:0 1px 2px rgba(20,20,19,.04),0 8px 24px -12px rgba(20,20,19,.12);--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0e0f12;--surface:#16181d;--sunk:#1c1f25;--fg:#eceae4;--muted:#a29f97;--faint:#77746d;--line:#272a31;--accent:#8ea2ff;--accent-fg:#0e0f12;--pass:#4fcf8e;--warn:#f0ad4e;--fail:#ff7b72;--info:#9fb0d4;--shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px -16px rgba(0,0,0,.6)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-underline-offset:3px}code{font-family:var(--mono);font-size:.9em;background:var(--sunk);padding:1px 6px;border-radius:6px}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}.narrow{max-width:820px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
header.bar{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 86%,transparent)}
header.bar .wrap{display:flex;align-items:center;gap:20px;min-height:64px;flex-wrap:wrap;padding-top:10px;padding-bottom:10px}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-weight:750;font-size:18px;letter-spacing:-.01em}.brand img{width:28px;height:28px;border-radius:7px}
nav{display:flex;gap:22px;margin-left:auto;font-size:15px}nav a{color:var(--muted);text-decoration:none}nav a:hover{color:var(--fg)}
.addr{display:flex;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:var(--shadow);transition:border-color .15s,box-shadow .15s}
.addr:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent),var(--shadow)}
.addr .pre{font-family:var(--mono);color:var(--faint);padding-left:12px;white-space:nowrap;font-size:16px}
.addr input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--fg);font:500 16px var(--mono);padding:12px 6px}
.addr button,.btn.primary{font:inherit;font-weight:650;border:0;border-radius:10px;background:var(--fg);color:var(--bg);padding:12px 20px;cursor:pointer;white-space:nowrap}
.addr button:hover,.btn.primary:hover{background:var(--accent);color:var(--accent-fg)}
.bar .addr{flex:1 1 320px;max-width:440px;padding:4px;border-radius:12px;box-shadow:none}.bar .addr input{padding:8px 4px;font-size:14px}.bar .addr .pre{font-size:14px;padding-left:10px}.bar .addr button{padding:8px 14px;font-size:14px}
.hero{padding:72px 0 40px;text-align:center}
.pill{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:600;color:var(--muted);border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 12px}.pill i{width:7px;height:7px;border-radius:50%;background:var(--pass)}
h1{font-size:clamp(36px,7vw,68px);line-height:1.02;letter-spacing:-.04em;font-weight:800;margin:22px auto 18px;max-width:14ch}
h1 em{font-style:normal;color:var(--accent)}
.lede{color:var(--muted);font-size:clamp(17px,2.4vw,20px);max-width:620px;margin:0 auto 32px}
.hero .addr{max-width:640px;margin:0 auto}
.examples{margin:16px 0 0;font-size:14px;color:var(--faint);display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center}
.examples a{color:var(--fg);text-decoration:none;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 12px;font-family:var(--mono);font-size:13px}.examples a:hover{border-color:var(--accent);color:var(--accent)}
.engines{margin:40px auto 0;display:flex;gap:10px 28px;justify-content:center;flex-wrap:wrap;color:var(--muted);font-weight:650;font-size:15px}.engines span{color:var(--faint);font-weight:500;width:100%;font-size:13px;text-transform:uppercase;letter-spacing:.08em}
.demo{margin:56px auto 0;max-width:920px;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:0 30px 80px -40px rgba(20,20,40,.45)}
.demo .chrome{display:flex;gap:7px;padding:12px 14px;border-bottom:1px solid var(--line);background:var(--sunk)}.demo .chrome i{width:11px;height:11px;border-radius:50%;background:var(--line)}
.demo video,.demo img{display:block;width:100%;height:auto}.demo .still{display:none}
@media (prefers-reduced-motion:reduce){.demo video{display:none}.demo .still{display:block}}
section.block{padding:88px 0 0}
.kicker{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);margin:0 0 10px}
h2{font-size:clamp(26px,4vw,38px);line-height:1.12;letter-spacing:-.03em;margin:0 0 14px;font-weight:780}
.sub{color:var(--muted);font-size:18px;max-width:640px;margin:0 0 36px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:20px}
.tile b{display:block;font-size:16px;margin-bottom:6px}.tile p{margin:0;color:var(--muted);font-size:15px;line-height:1.5}
.tile .w{float:right;font:600 12px var(--mono);color:var(--muted);background:var(--sunk);border-radius:6px;padding:2px 7px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;counter-reset:s}
.steps div{counter-increment:s}.steps div::before{content:counter(s);display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--fg);color:var(--bg);font-weight:750;margin-bottom:14px}
.steps b{display:block;font-size:18px;margin-bottom:6px}.steps p{margin:0;color:var(--muted)}
.term{background:#0e0f12;color:#e8e6e1;border-radius:14px;padding:18px 20px;font:14px/1.6 var(--mono);overflow-x:auto;border:1px solid #272a31;white-space:pre-wrap;word-break:break-all;margin:0}.term s{text-decoration:none;color:#77746d}
footer{margin-top:110px;border-top:1px solid var(--line);padding:28px 0 48px;color:var(--muted);font-size:14px}footer .wrap{display:flex;gap:16px 28px;flex-wrap:wrap;justify-content:space-between}footer a{color:var(--muted)}
.pass{--c:var(--pass)}.warn{--c:var(--warn)}.fail{--c:var(--fail)}.info{--c:var(--info)}
.summary{margin:36px 0 0;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:var(--shadow);display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center}
.ring{flex:none;width:136px;height:136px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--s)*1%),var(--sunk) 0)}
.ring b{width:110px;height:110px;border-radius:50%;background:var(--surface);display:grid;place-items:center;align-content:center;font-size:44px;font-weight:800;letter-spacing:-.04em;line-height:1}
.ring small{display:block;font-size:13px;color:var(--muted);font-weight:600;letter-spacing:0;margin-top:6px}
.host{font-size:clamp(26px,5vw,40px);font-weight:800;letter-spacing:-.03em;word-break:break-all;margin:0;line-height:1.1}
.final{font:14px var(--mono);color:var(--faint);margin:6px 0 14px;word-break:break-all}
.tags{display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:14px;color:var(--muted)}
.tag{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 12px;font-weight:650;background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--c)}
.again{margin-left:auto;font-weight:600;font-size:14px;text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:6px 12px;color:var(--fg)}.again:hover{border-color:var(--accent);color:var(--accent)}
.crawlers{grid-column:1/-1;border-top:1px solid var(--line);padding-top:22px}
.crawlers h3,.group h3{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 12px}
.bots{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:8px;list-style:none;margin:0;padding:0}
.bots li{display:flex;gap:10px;align-items:center;background:var(--sunk);border-radius:10px;padding:9px 12px;font-size:14px;line-height:1.3}
.bots li small{display:block;color:var(--faint);font-size:12px}
.ic{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--c);color:var(--surface);font:800 12px/1 ui-sans-serif,system-ui,sans-serif}
.training{margin:12px 0 0;font-size:13px;color:var(--faint)}
.group{margin-top:44px}
.check{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:10px 0;display:grid;grid-template-columns:auto 1fr;gap:4px 14px}
.check.fail,.check.warn{border-color:color-mix(in srgb,var(--c) 35%,var(--line))}
.check .ic{width:26px;height:26px;font-size:13px;margin-top:1px}
.check h4{margin:0;font-size:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.meter{margin-left:auto;display:flex;align-items:center;gap:8px;font:600 13px var(--mono);color:var(--muted);white-space:nowrap}
.meter span{width:64px;height:6px;border-radius:3px;background:var(--sunk);overflow:hidden}.meter span i{display:block;height:100%;background:var(--c);width:calc(var(--p)*1%)}
.check .body{grid-column:2}.check p{margin:2px 0 0;color:var(--muted)}
.fix{margin-top:12px;background:color-mix(in srgb,var(--c) 8%,var(--surface));border:1px solid color-mix(in srgb,var(--c) 22%,transparent);border-radius:10px;padding:12px 14px;white-space:pre-wrap;color:var(--fg)}
.fix strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--c);margin-bottom:4px}
details{margin-top:10px;font-size:14px;color:var(--muted)}summary{cursor:pointer;font-weight:600;width:max-content}summary:hover{color:var(--fg)}
details ul{margin:8px 0 0;padding:10px 14px 10px 30px;background:var(--sunk);border-radius:10px;font:13px/1.7 var(--mono);word-break:break-word}
.cta{margin-top:44px;border-radius:20px;padding:28px;background:var(--fg);color:var(--bg)}.cta h3{margin:0 0 6px;font-size:22px;letter-spacing:-.02em}.cta p{margin:0 0 18px;opacity:.75}
.cta .row{display:flex;gap:10px;flex-wrap:wrap}.cta .btn{display:inline-block;padding:11px 18px;border-radius:10px;font-weight:650;text-decoration:none;background:var(--bg);color:var(--fg)}.cta .btn:hover{background:var(--accent);color:var(--accent-fg)}
.cta details{color:inherit;opacity:.85}.cta pre{background:color-mix(in srgb,var(--bg) 10%,transparent);border-radius:10px;padding:12px;font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-word;margin:8px 0 0}
.badge{margin-top:44px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:22px}.badge h3{margin:0 0 12px;font-size:17px}.badge pre{margin:12px 0 0;background:var(--sunk);border-radius:10px;padding:12px;font:12px/1.6 var(--mono);white-space:pre-wrap;word-break:break-all}
.error{margin-top:28px;border:1px solid color-mix(in srgb,var(--fail) 40%,var(--line));background:color-mix(in srgb,var(--fail) 7%,var(--surface));color:var(--fg);border-radius:14px;padding:16px 18px}
.prose{padding-top:56px}.prose h1{text-align:left;margin:0 0 24px;font-size:clamp(34px,6vw,52px)}.prose p{color:var(--muted);font-size:17px}.prose h2{margin-top:48px}
dl{margin:0}dt{font-weight:700;margin-top:22px;font-size:17px}dd{margin:6px 0 0;color:var(--muted)}
@media (max-width:640px){.summary{grid-template-columns:1fr;justify-items:start;padding:22px}.ring{width:112px;height:112px}.ring b{width:90px;height:90px;font-size:36px}.addr .pre{display:none}.hero{padding-top:48px}nav{gap:16px;font-size:14px}.again{margin-left:0}.check{padding:16px}.meter span{display:none}.bots{grid-template-columns:1fr 1fr}.bar form+nav{display:none}}
.stage{position:relative;overflow:hidden;background:#07080c;color:#f4f3ef;--fg:#f4f3ef;--muted:#b0afba;--faint:#7f7e8a;--line:#262833;--surface:#11131a;--sunk:#1b1e28;--accent:#9db0ff;--accent-fg:#07080c;--pass:#4ade80;--warn:#fbbf24;--fail:#ff7b72}
.stage::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(60% 65% at 50% 30%,#000 25%,transparent 100%);mask-image:radial-gradient(60% 65% at 50% 30%,#000 25%,transparent 100%);pointer-events:none}
.stage::after{content:"";position:absolute;inset:-10%;background:radial-gradient(38% 32% at 22% 18%,rgba(91,124,255,.38),transparent 70%),radial-gradient(32% 30% at 82% 30%,rgba(74,222,128,.24),transparent 70%),radial-gradient(40% 36% at 55% 95%,rgba(168,85,247,.3),transparent 70%);pointer-events:none}
.stage>*{position:relative;z-index:1}
header.bar.stage{background:#07080c;border-bottom-color:#1d2029}header.bar.stage::before,header.bar.stage::after{display:none}
.grad{background:linear-gradient(92deg,#9db0ff,#c084fc 48%,#4ade80);-webkit-background-clip:text;background-clip:text;color:transparent}
.addr button,.btn.primary{background:linear-gradient(135deg,#5b7cff,#8b5cf6);color:#fff;box-shadow:0 8px 24px -10px rgba(91,124,255,.8)}
.addr button:hover,.btn.primary:hover{background:linear-gradient(135deg,#6d8bff,#a06bff);color:#fff}
.stage .addr{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.stage .examples a{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14)}
.hero.stage{padding:84px 0 0;text-align:center}.hero .demo{margin-bottom:-1px;border-radius:16px 16px 0 0;border-bottom:0;box-shadow:0 -10px 90px -20px rgba(124,92,255,.55)}
.engines b{display:inline-flex;align-items:center;gap:8px;color:#e6e5ee}.engines b i{width:8px;height:8px;border-radius:50%;background:var(--d)}
.tile{position:relative;overflow:hidden;transition:transform .15s,border-color .15s}.tile:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 50%,var(--line))}
.tile::before{content:"";position:absolute;left:0;top:0;bottom:0;width:calc(var(--w)*1.2%);max-width:100%;height:3px;background:linear-gradient(90deg,#5b7cff,#c084fc)}
.tile .w{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent)}
.steps div::before{background:linear-gradient(135deg,#5b7cff,#8b5cf6);color:#fff}
.summary.stage{border:0;box-shadow:0 30px 80px -40px rgba(91,124,255,.6)}
.summary.stage .ring{box-shadow:0 0 70px -10px var(--c);background:conic-gradient(var(--c) calc(var(--s)*1%),rgba(255,255,255,.1) 0)}.summary.stage .ring b{background:#0d0f15}
.summary.stage .bots li{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07)}
.check{border-left:4px solid var(--c)}
.cta{position:relative;overflow:hidden;background:linear-gradient(135deg,#1e2a6b,#3b1f73 60%,#0f3d2c);color:#fff}.cta .btn{background:#fff;color:#141413}.cta .btn:hover{background:#e7e9ff;color:#141413}.cta pre{background:rgba(0,0,0,.25)}
.hero.stage{padding:48px 0 0}
@media (min-width:980px){.hero.stage{padding:56px 0 64px}.hero.stage .wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);column-gap:56px;align-items:center;text-align:left}.hero.stage .wrap>*{grid-column:1}.hero.stage .pill{justify-self:start}.hero.stage h1{margin:18px 0 16px;font-size:clamp(44px,4.6vw,62px)}.hero.stage .lede{margin:0 0 26px;font-size:18px}.hero.stage .addr{margin:0}.hero.stage .examples,.hero.stage .engines{justify-content:flex-start}.hero.stage .engines{margin-top:26px;gap:8px 18px;font-size:14px}.hero.stage .demo{grid-column:2;grid-row:1/span 6;margin:0;border-radius:16px;border-bottom:1px solid var(--line);box-shadow:0 30px 90px -30px rgba(124,92,255,.6)}}
`;

/** The path the site is served under: empty online, /api/web behind Flisk's local proxy. */
const rootOf = (publicUrl: string) =>
	new URL(publicUrl).pathname.replace(/\/$/, "");

/** The address bar the visitor types into: Citable's host in front, as the address it will open. */
const form = (publicUrl: string, value = "") =>
	`<form class="addr" action="${rootOf(publicUrl)}/check" method="get" role="search"><span class="pre" aria-hidden="true">${esc(new URL(publicUrl).host)}/</span><input type="text" name="url" value="${esc(value)}" placeholder="example.com" aria-label="Site address" autocomplete="url" inputmode="url" spellcheck="false" required><button type="submit">Check</button></form>`;

/** `publicUrl` is the site's own address, ending in a slash; `meta.path` is the page under it. */
function layout(
	publicUrl: string,
	meta: PageMeta,
	body: string,
	search?: string,
): string {
	const base = publicUrl.replace(/\/$/, "");
	const root = rootOf(publicUrl);
	return `<!doctype html><html lang="${SITE.lang}"><head>
${head(base, meta)}
<style>${STYLE}</style></head><body>
<header class="bar stage"><div class="wrap"><a class="brand" href="${root}/"><img src="${root}/${ICONS.svg}" alt="" width="28" height="28">${SITE.name}</a>${search === undefined ? "" : form(publicUrl, search)}<nav><a href="${root}/#how">How it works</a><a href="${root}/about">About</a><a href="${SITE.repo}">GitHub</a></nav></div></header>
<main>${body}</main>
<footer><div class="wrap"><span>${SITE.name} reads pages the way an AI crawler does: no JavaScript, no model, nothing stored.</span><span><a href="${SITE.repo}">Open source</a> · built and run with <a href="${SITE.author.url}">Flisk</a> · <a href="${root}/about">About the checker</a></span></div></footer>
</body></html>`;
}

/** What the report scores, for the home page; the weights match checks.ts. */
const CHECKS: [string, number, string][] = [
	[
		"AI crawlers allowed",
		25,
		"robots.txt, read for each answer engine's crawler on its own.",
	],
	[
		"Indexable and quotable",
		15,
		"Status, HTTPS, and no noindex or nosnippet in the page or its headers.",
	],
	[
		"Readable without JavaScript",
		15,
		"The text is in the HTML the server sends, not painted in later.",
	],
	[
		"Title and description",
		10,
		"Present, and a length engines show next to the citation.",
	],
	["Structured data", 10, "schema.org JSON-LD that says what the page is."],
	["Headings", 5, "One h1, and h2 sections engines can quote on their own."],
	["Canonical address", 5, "One address for the page, so citations add up."],
	["Sitemap", 5, "Listed in robots.txt, so crawlers find every page."],
	["llms.txt", 5, "A short map of the site written for language models."],
	[
		"Response time",
		5,
		"Time to first byte, which crawlers on a budget notice.",
	],
];

/** The engines the hero names, with a colour each. */
const ENGINES: [string, string][] = [
	["ChatGPT", "#10a37f"],
	["Claude", "#d97757"],
	["Perplexity", "#20b8cd"],
	["Google AI Overviews", "#4285f4"],
	["Bing Copilot", "#a78bfa"],
];

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
		`<section class="hero stage"><div class="wrap">
<span class="pill"><i></i>Free · no signup · open source</span>
<h1>Can AI answers <em class="grad">cite</em> your site?</h1>
<p class="lede">Put <b>${esc(new URL(publicUrl).host)}/</b> in front of any address. Citable reads the page the way ChatGPT, Claude, Perplexity and Google's crawlers do, and tells you what keeps it out of their answers, with the fix.</p>
${form(publicUrl)}
<p class="examples">Try ${EXAMPLES.map((e) => `<a href="${root}/${e}">${e}</a>`).join("")}</p>
<p class="engines"><span>Checked crawler by crawler for</span>${ENGINES.map(([n, c]) => `<b style="--d:${c}"><i></i>${n}</b>`).join("")}</p>
<figure class="demo"><div class="chrome" aria-hidden="true"><i></i><i></i><i></i></div><img class="still" src="${root}/demo.jpg" width="960" height="540" alt=""><video src="${root}/demo.mp4" poster="${root}/demo.jpg" width="960" height="540" autoplay muted loop playsinline preload="metadata" aria-describedby="demo-text"></video>
<figcaption id="demo-text" class="sr">A 23-second film: citable.flisk.si/ is typed in front of stripe.com in a browser, the report scores it 96 out of 100, the camera moves to a check and its fix, and a click on Ask Claude hands the fixes to your own AI.</figcaption></figure>
</div></section><div class="wrap">
<section class="block" id="how"><p class="kicker">How it works</p><h2>One address, one honest report.</h2><p class="sub">No account, no browser extension, no model guessing. Citable fetches what a crawler fetches and reads it the same way.</p>
<div class="steps"><div><b>Prefix any address</b><p>citable.flisk.si/your-site.com, or paste it in the box above. Any page works, not only home pages.</p></div><div><b>Read it like a crawler</b><p>The page, robots.txt, llms.txt and the sitemap, with no JavaScript, as the seven answer crawlers see them.</p></div><div><b>Fix what blocks citations</b><p>Each problem comes with the exact change to make, and a button that hands the list to your own AI.</p></div></div></section>
<section class="block"><p class="kicker">What it checks</p><h2>Ten checks, scored out of 100.</h2><p class="sub">Weighted by how much each one decides whether an answer engine can quote you at all.</p>
<div class="grid">${CHECKS.map(([t, w, d]) => `<div class="tile" style="--w:${w * 4}"><span class="w">${w}</span><b>${t}</b><p>${d}</p></div>`).join("")}</div></section>
<section class="block narrow"><p class="kicker">In your AI</p><h2>Ask your assistant directly.</h2><p class="sub">Citable is also an MCP server. Add it once, then ask "can AI cite example.com?"</p>
<pre class="term"><s>$</s> claude mcp add --transport http citable ${esc(base)}/mcp</pre></section></div>`,
	);
}

const statusWord: Record<Check["status"], string> = {
	pass: "Pass",
	warn: "Improve",
	fail: "Fix",
	info: "Note",
};
const glyph: Record<Check["status"], string> = {
	pass: "✓",
	warn: "!",
	fail: "✕",
	info: "i",
};
const icon = (s: Check["status"]) =>
	`<span class="ic ${s}" aria-hidden="true">${glyph[s]}</span>`;

function checkCard(c: Check): string {
	const meter =
		c.max > 0
			? `<span class="meter"><span style="--p:${Math.round((100 * c.points) / c.max)}"><i></i></span>${Math.round(c.points)} / ${c.max}</span>`
			: `<span class="meter">${statusWord[c.status]}</span>`;
	return `<section class="check ${c.status}">${icon(c.status)}<h4>${esc(c.title)}${meter}</h4>
<div class="body"><p><span class="sr">${statusWord[c.status]}: </span>${esc(c.summary)}</p>${c.fix ? `<div class="fix"><strong>How to fix</strong>${esc(c.fix)}</div>` : ""}${
		c.details?.length
			? `<details><summary>Details</summary><ul>${c.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>`
			: ""
	}</div></section>`;
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function reportPage(report: Report, publicUrl: string): string {
	const base = publicUrl.replace(/\/$/, "");
	const root = rootOf(publicUrl);
	const path = `${report.host}${new URL(report.url).pathname.replace(/^\/$/, "")}`;
	if (report.error) {
		return layout(
			publicUrl,
			{
				path,
				title: `${report.host}: could not check`,
				description: `Citable could not read ${report.host}, so it cannot say whether ChatGPT, Claude, Perplexity and Google AI can cite it.`,
				noindex: true,
			},
			`<div class="wrap narrow"><div class="summary" style="grid-template-columns:1fr"><div><p class="host">${esc(report.host)}</p><div class="error">Could not read the page: ${esc(report.error)}.</div></div></div></div>`,
			report.host,
		);
	}
	const toFix = report.checks.filter(
		(c) => c.status === "fail" || c.status === "warn",
	);
	const fixes = toFix.length;
	const passing = report.checks.filter((c) => c.status === "pass");
	const notes = report.checks.filter((c) => c.status === "info");
	const prompt = fixPrompt(report);
	const q = encodeURIComponent(prompt);
	const answers = report.crawlers.filter((c) => c.role === "answers");
	const training = report.crawlers.filter((c) => c.role === "training");
	const trainingBlocked = training.filter((c) => !c.allowed).length;
	const group = (title: string, list: Check[]) =>
		list.length
			? `<div class="group"><h3>${title} · ${list.length}</h3>${[...list]
					.sort((a, b) => order(a) - order(b) || b.max - a.max)
					.map(checkCard)
					.join("")}</div>`
			: "";
	return layout(
		publicUrl,
		{
			path,
			title: `${report.host}: ${report.score}/100 for AI search`,
			description: `Can ChatGPT, Claude, Perplexity and Google AI cite ${report.host}? Score ${report.score}/100, grade ${report.grade}, ${plural(fixes, "thing")} to fix, each with the fix.`,
			crumbs: [{ name: report.host, path }],
			// A report shows what any site chose to say, under this domain. Only the curated examples are for search engines.
			noindex: !EXAMPLES.includes(path),
		},
		`<div class="wrap narrow">
<div class="summary stage"><div class="ring ${scoreClass(report.score)}" style="--s:${report.score}" role="img" aria-label="Score ${report.score} of 100"><b>${report.score}<small>grade ${report.grade}</small></b></div>
<div><p class="host">${esc(report.host)}</p><p class="final">${esc(report.finalUrl)}</p>
<div class="tags">${fixes === 0 ? `<span class="tag pass">✓ Nothing to fix</span>` : `<span class="tag ${toFix.some((c) => c.status === "fail") ? "fail" : "warn"}">${plural(fixes, "thing")} to fix</span>`}<span>Checked ${esc(report.checkedAt.replace("T", " ").slice(0, 16))} UTC</span><a class="again" href="?fresh=1">Check again</a></div></div>
${
	answers.length
		? `<div class="crawlers"><h3>Answer engines</h3><ul class="bots">${answers.map((c) => `<li>${icon(c.allowed ? "pass" : "fail")}<span>${esc(c.token)}<small>${esc(c.owner)}</small></span><span class="sr">${c.allowed ? "allowed" : "blocked"}</span></li>`).join("")}</ul>${training.length ? `<p class="training">Training crawlers: ${training.length - trainingBlocked} allowed, ${trainingBlocked} blocked. Not scored: it does not change whether answers cite you.</p>` : ""}</div>`
		: ""
}</div>
${report.partial ? `<div class="error">Partial report: the page answered ${report.partial}, so its contents were not checked.</div>` : ""}
${group("To fix", toFix)}
${
	fixes > 0
		? `<div class="cta"><h3>Fix it with your AI</h3><p>Citable never calls a model. Hand the list to yours, with the exact fixes.</p>
<div class="row"><a class="btn" href="https://chatgpt.com/?q=${q}" rel="noopener" target="_blank">Ask ChatGPT</a><a class="btn" href="https://claude.ai/new?q=${q}" rel="noopener" target="_blank">Ask Claude</a></div>
<details><summary>The text it hands over</summary><pre>${esc(prompt)}</pre></details></div>`
		: ""
}
${group("Passing", passing)}
${group("Notes", notes)}
<div class="badge"><h3>Show the score</h3><img src="${root}/badge/${esc(report.host)}.svg" alt="AI search score ${report.score}" height="20">
<pre>[![AI search: ${report.score}/100](${esc(base)}/badge/${esc(report.host)}.svg)](${esc(base)}/${esc(report.host)})</pre></div></div>`,
		report.host,
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
		`<div class="wrap narrow prose"><p class="kicker">About</p><h1>How the checker works</h1>
<p>For each check, Citable fetches at most four addresses from the site: the page, <code>/robots.txt</code>, <code>/llms.txt</code> and the sitemap. It identifies itself as <code>CitableBot/1.0 (+${esc(publicUrl.replace(/\/$/, ""))}/about)</code>, sends only GET requests, follows at most five redirects, reads at most 2 MB, and only reaches public addresses on ports 80 and 443.</p>
<p>A report is kept in memory for an hour so a shared link does not fetch the site again, then forgotten. Nothing is stored on disk; there is no database and no account.</p>
<p>Robots rules are read as RFC 9309 says: the group that names a crawler, else the <code>*</code> group, and the longest matching rule. Citable does not pretend to be another crawler, so a firewall that blocks some user agents may treat the real ones differently.</p>
<h2>Questions</h2>
<dl>${SITE.faq.map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join("")}</dl></div>`,
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
