import type { Fetched, Fetcher } from "../src/net";

/** A fetcher over a fixed map of address → response; anything else answers 404. */
export function fakeFetcher(
	responses: Record<string, Partial<Fetched>>,
	calls: string[] = [],
): Fetcher {
	return async (url) => {
		calls.push(url);
		const r = responses[url];
		return {
			url,
			finalUrl: r?.finalUrl ?? url,
			status: r?.status ?? 404,
			headers: r?.headers ?? {
				"content-type": r?.body?.trimStart().startsWith("<")
					? "text/html"
					: "text/plain",
			},
			body: r?.body ?? "",
			ms: r?.ms ?? 120,
			error: r?.error,
		};
	};
}

const words = (n: number) =>
	Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

export const GOOD_PAGE = `<!doctype html><html lang="en"><head>
<title>Acme: invoices that pay themselves</title>
<meta name="description" content="Acme sends invoices, chases late payments and reconciles them with your bank, for small teams.">
<link rel="canonical" href="https://acme.example/">
<meta property="og:title" content="Acme">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"WebSite","url":"https://acme.example/"}]}</script>
<script src="/app.js"></script>
</head><body><h1>Invoices that <em>pay</em> themselves</h1><h2>How it works</h2><p>${words(400)}</p>
<svg><title>logo</title></svg><script>var hidden = "${words(50)}";</script></body></html>`;

export const SPA_PAGE = `<!doctype html><html><head><title>App</title><script src="/bundle.js"></script></head><body><div id="root"></div></body></html>`;

export function goodSite(
	origin = "https://acme.example",
): Record<string, Partial<Fetched>> {
	return {
		[`${origin}/`]: {
			status: 200,
			body: GOOD_PAGE,
			headers: { "content-type": "text/html" },
			ms: 200,
		},
		[`${origin}/robots.txt`]: {
			status: 200,
			body: `User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
		},
		[`${origin}/llms.txt`]: {
			status: 200,
			body: `# Acme\n\n> Invoices.\n\n- [Docs](${origin}/docs)\n`,
		},
		[`${origin}/sitemap.xml`]: {
			status: 200,
			body: '<?xml version="1.0"?><urlset><url><loc>x</loc></url></urlset>',
			headers: { "content-type": "application/xml" },
		},
	};
}
