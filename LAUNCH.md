# Citable: Product Hunt listing draft

Nothing here has been posted. The maker posts from their own personal account. No vote requests, no vote swaps, no new accounts.

## Why this product, and why it is easy (ICE)

Read from the most-voted launches of the week of Oct 26, 2026 (weekly and Oct 27 daily leaderboards), and scored for what Flisk ships: one free Render service, no database, no API key, no model.

| Idea (from the leaderboard) | Votes | Impact | Confidence | Ease | ICE |
| --- | --- | --- | --- | --- | --- |
| **Can AI search cite my site?** (like #12 Notra, GEO tool) | 148 | 7 | 7 | 9 | **7.7** |
| Free PDF accessibility checker (like #9 PDF Accessibility Checker) | 170 | 5 | 6 | 6 | 5.7 |
| Chat widget for any workflow (like #8 N8N Chat UI) | 186 | 6 | 5 | 5 | 5.3 |
| Cloud bill cutter (like #14 CloudKnife) | 127 | 7 | 4 | 3 | 4.7 |
| User-reaction preview (like #1 TheySaid) | 354 | 8 | 4 | 2 | 4.7 |

The top of the board (TheySaid, Strawberry, Overmind, SurgePix) needs a model or an account system; that breaks "no keys". Notra's idea does not: whether ChatGPT, Claude and Perplexity can read a site is decided by robots.txt, headers and HTML, all of which can be checked deterministically. Every site owner has the question, the answer fits on one page, and the URL swap makes it shareable, the same shape that worked for Helpdock.

## Listing

**Name:** Citable

**Tagline** (60 characters max), chosen first:

1. See if ChatGPT, Claude and Perplexity can cite your site (56)
2. Put citable.flisk.si/ before any URL. AI search, checked. (57)
3. Why AI answers skip your site, and the fix for each reason (58)

**Description** (under 260 characters):

> Put citable.flisk.si/ in front of any address and see whether ChatGPT, Claude, Perplexity and Google AI can read and cite the page: crawler by crawler, with the fix for each problem. Free, no signup, no AI key, open source. Also an MCP server.

**Tags:** SEO, Developer Tools, Artificial Intelligence.

**Gallery (5):**

1. The URL swap: `stripe.com` → `citable.flisk.si/stripe.com`, and the report it opens (score ring, checks).
2. A site that blocks answer engines: the crawler check naming OAI-SearchBot, Claude-SearchBot and PerplexityBot, and the robots.txt lines that fix it. Training crawlers listed apart: "a choice, not a score".
3. A JavaScript-only page: "0 words of readable text" and the server-rendering fix.
4. *Ask Claude*: the list of fixes handed to the visitor's own assistant; and `claude mcp add --transport http citable https://citable.flisk.si/mcp` answering "can AI cite example.com?".
5. How it works: four GET requests, RFC 9309 robots rules, Bun's HTMLRewriter, no model, nothing stored; built and run with Flisk.

## Maker first comment

> Hi! More people now ask ChatGPT, Claude or Perplexity instead of searching, and a site can be invisible to them without anyone noticing: one robots.txt line written for training crawlers also blocks the crawler that fetches pages for answers, a "noindex" slips into production, or the whole page is JavaScript that those crawlers never run.
>
> Citable checks all of that from the outside: put citable.flisk.si/ in front of any address. It reads robots.txt for each answer engine separately (training crawlers are listed apart, because blocking those is a fair choice), then reads the page without JavaScript, the way they do. Every problem comes with its fix, and one click hands the list to your own AI. No model on our side, no signup, nothing stored.
>
> It is also an MCP server, so you can ask your assistant "can AI cite our docs?". Which site should we check first? Drop one in the comments.

## Before launch

- [x] Public repo: github.com/flisk-sh/citable.
- [ ] Live: deploy with the Render Blueprint and add the `citable` CNAME ([DEPLOY.md](DEPLOY.md)); switch to Starter for launch day so it does not sleep.
- [ ] Check the answers by hand on ten known sites before posting (a news site that blocks bots, an SPA, a docs site), and fix anything that reads wrong.
- [ ] Record the gallery from a real run; no mockups.
- [ ] Ask Product Hunt support whether products built on Flisk by Flisk's makers count as separate from the Flisk listing (same question as Helpdock; one answer covers both).
- [ ] Post the night-before note to the people who already use Flisk (no vote ask).
