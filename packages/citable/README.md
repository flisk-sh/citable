# citable

**Can AI answers cite your site?** The checks behind [citable.flisk.si](https://citable.flisk.si), for your terminal and CI.

```bash
npx @flisk-sh/citable stripe.com
```

```
https://stripe.com/nl  96/100 (grade A)
  Answer engines: 7 of 7 allowed

  ✓ AI answer engines can crawl the page       25/25  All 7 answer crawlers may fetch this page.
  ! Title and description                       8/10  The description is 174 characters (50 to 170 reads best).
      Fix: Give the page a <title> that names it (10 to 70 characters) and a <meta name="description"> ...
  ...
```

It reads each page the way ChatGPT search, Claude, Perplexity, Google AI Overviews and Copilot's crawlers do: robots.txt
for each answer crawler, noindex and nosnippet, text readable without JavaScript, title and description, headings,
schema.org, canonical, sitemap, llms.txt and response time. It scores the page out of 100 and gives a fix for each problem.

## Deterministic

No model and no account. The score comes from at most four GET requests (the page, `/robots.txt`, `/llms.txt`, the
sitemap) and fixed rules, so the same responses always give the same score, and a drop points at a check, the way a lint
error does. The one input that varies between runs is response time: leave it out with `--skip speed` when the score
gates a build.

## Options

| Option | |
| --- | --- |
| `--min-score <n>` | Exit 1 when a page scores below `n` |
| `--skip <ids>` | Leave checks out; the rest are scored out of 100. Ids: `ai-crawlers`, `indexable`, `content`, `title`, `structured-data`, `headings`, `canonical`, `sitemap`, `llms-txt`, `speed` |
| `--json` | The full reports as JSON |
| `--markdown` | A Markdown table, for `$GITHUB_STEP_SUMMARY` |
| `--timeout <ms>` | Time limit per request (8000) |

Give several addresses to check several pages. Exit codes: `0` passed, `1` below `--min-score`, `2` a page could not be
read or the usage is wrong.

A full address such as `http://localhost:4173/` checks a local preview before it ships. Over plain HTTP the page loses
the 5 points HTTPS is worth, so set `--min-score` with that in mind.

## In CI

```yaml
# .github/workflows/ai-search.yml
name: AI search score

on:
  schedule:
    - cron: "0 10 * * 1"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  citable:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Score https://example.com
        run: npx -y @flisk-sh/citable@0.1.0 https://example.com/ --skip speed --min-score 90 --markdown >> "$GITHUB_STEP_SUMMARY"
```

Pin the version, as above: a new release may add or reweigh a check, and a pinned version keeps the score comparable from
run to run.

## Node and Bun

Runs on Node 20 or later, and on Bun. On Node the page is parsed with
[html-rewriter-wasm](https://github.com/cloudflare/html-rewriter-wasm), on Bun with its built-in HTMLRewriter. Both are
lol-html, and the tests check that a page reads the same in both.

MIT licensed. Source: [flisk-sh/citable](https://github.com/flisk-sh/citable).
