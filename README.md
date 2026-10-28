# Citable

**Can AI answers cite your site?** Put `citable.flisk.si/` in front of any address:

```
https://stripe.com/pricing  →  https://citable.flisk.si/stripe.com/pricing
```

[![How Citable works: put citable.flisk.si/ in front of stripe.com, get a score with each check and its fix, then hand the fixes to your own AI](docs/demo.gif)](https://citable.flisk.si)

Citable reads the page the way ChatGPT search, Claude, Perplexity, Google AI Overviews and Copilot's crawlers do, scores it out of 100, and says what keeps it out of their answers, with the fix.

- **Crawler access, one engine at a time.** robots.txt is read as RFC 9309 says, for each answer crawler (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Googlebot, Bingbot). Training crawlers (GPTBot, ClaudeBot, Google-Extended…) are listed apart and not scored: blocking them is a choice.
- **What a crawler without JavaScript sees.** noindex and nosnippet (header and meta), readable text in the server's HTML, title and description, headings, schema.org JSON-LD, canonical, sitemap, llms.txt, response time. A site whose bot protection refuses the checker gets a partial report that says so, not a score for an empty page.
- **Fixes for your AI, not ours.** Citable never calls a model. Under every report, *Ask ChatGPT* and *Ask Claude* hand the list of fixes to the visitor's own assistant.
- **An MCP server.** `https://citable.flisk.si/mcp` (Streamable HTTP, no key) gives Claude, ChatGPT, Cursor or Codex one read-only tool, `check_site`.
- **A badge.** `![AI search](https://citable.flisk.si/badge/example.com.svg)`.
- **No signup, no database, no API key.** The URL is the state. Reports live in memory for an hour, then they are gone.

## Run it

Needs Docker, Tilt and the [Flisk CLI](https://github.com/flisk-sh/flisk).

```bash
git clone https://github.com/flisk-sh/citable.git
cd citable
flisk project --yes
flisk up app
flisk status          # the URL, e.g. http://api.citable.localhost:8083/api/web
```

Open the URL with a trailing slash. Edits under `services/app/web/src` reload on save.

Without Flisk: `cd services/app/web && bun install && bun run dev` (port 4000).

Tests: `cd services/app/web && bun test`.

## API

| Route | What it does |
| --- | --- |
| `GET /` | The home page |
| `GET /example.com[/path]` | The report for that page (`?fresh=1` checks again) |
| `GET /api/check?url=` | The report as JSON |
| `GET /badge/example.com.svg` | The score as a badge |
| `POST /mcp` | MCP (Streamable HTTP, stateless): `check_site` |
| `GET /about` | What the checker fetches and how |

Settings, all optional: `PORT`, `CITABLE_PUBLIC_URL`, `CITABLE_PROXY` (`none`, `last-forwarded` for Render, `cloudflare`), `CITABLE_CHECKS_PER_HOUR` (30 new checks per address; cached reports are free), `CITABLE_MAX_CHECKS` (8 at once). See the header of [`services/app/web/src/index.ts`](services/app/web/src/index.ts).

## How a check works

At most four GET requests to the site: the page, `/robots.txt`, `/llms.txt` and the sitemap, as `CitableBot/1.0 (+https://citable.flisk.si/about)`. Only public addresses on ports 80 and 443; every redirect hop is checked again; 8 seconds and 2 MB at most. The page is parsed with Bun's streaming HTMLRewriter. Everything is deterministic: the same site gives the same report.

## Online

citable.flisk.si is one Render free web service from [`render.yaml`](render.yaml) and the root [`Dockerfile`](Dockerfile). [DEPLOY.md](DEPLOY.md) has the steps.

Built and run with [Flisk](https://github.com/flisk-sh/flisk). MIT licensed.

The clip on the home page and above is drawn by `services/app/web/scripts/video.ts` (`bun run video`, needs ffmpeg).
