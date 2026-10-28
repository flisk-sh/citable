// Everything about Citable that shows up in search results, link previews and AI answers. seo.ts builds the head of
// every page, JSON-LD, robots.txt, sitemap.xml, llms.txt, site.webmanifest and security.txt from it.

export const SITE = {
	name: "Citable",
	/** Under 60 characters: the <title> of the home page. */
	tagline: "Can AI answers cite your site?",
	/** 110 to 160 characters: the meta description and the link preview text. */
	description:
		"Check whether ChatGPT, Claude, Perplexity and Google AI Overviews can crawl, read and cite any page, crawler by crawler, with the fix. Free, no signup.",
	url: "https://citable.flisk.si/",
	repo: "https://github.com/flisk-sh/citable",
	lang: "en",
	locale: "en_US",
	author: { name: "Flisk", url: "https://flisk.sh" },
	/** An X handle with the @, or empty. */
	twitter: "",
	themeColor: { light: "#fbfaf7", dark: "#141413" },
	securityContact:
		"https://github.com/flisk-sh/citable/security/advisories/new",
	faq: [
		{
			q: "How do I check a site?",
			a: "Put citable.flisk.si/ in front of its address: citable.flisk.si/example.com, or a page such as citable.flisk.si/example.com/pricing.",
		},
		{
			q: "Which AI crawlers does Citable check?",
			a: "The ones that fetch pages to answer: OAI-SearchBot and ChatGPT-User, Claude-SearchBot and Claude-User, PerplexityBot, Googlebot and Bingbot. Training crawlers such as GPTBot, ClaudeBot, Google-Extended and CCBot are listed apart and not scored, because blocking them is a fair choice.",
		},
		{
			q: "Does Citable use AI?",
			a: "No. Every check is deterministic: robots.txt, response headers and the HTML a crawler without JavaScript sees. The Ask ChatGPT and Ask Claude buttons hand the list of fixes to your own assistant.",
		},
		{
			q: "Is there an API or MCP server?",
			a: "Yes: /api/check?url=example.com answers JSON, /badge/example.com.svg is a README badge, and /mcp is an MCP server with one read-only tool, check_site. None needs a key.",
		},
		{
			q: "What is stored?",
			a: "Nothing on disk. A report stays in memory for an hour so a shared link does not fetch the site again, then it is forgotten.",
		},
	],
} as const;
