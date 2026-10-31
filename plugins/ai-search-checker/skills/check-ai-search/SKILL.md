---
name: check-ai-search
description: Check whether AI answer engines can find, read and quote a website. Use when the user asks if their site shows up in ChatGPT, Claude, Perplexity or Google AI, or wants SEO for AI search.
---

# Check a site for AI search

Use the `check_site` tool from the `ai-search-checker` server.

1. Take the domain or page the user names (for example `example.com` or `example.com/pricing`). If they gave none, ask for one.
2. Call `check_site` with that address in `url`.
3. Tell the user the score out of 100, then the problems from worst to least, each with its fix, in plain words.
4. If the user wants the fixes done, offer to make them in their own files. Do not change anything without asking.

The tool is read-only: it reads the public page, `robots.txt`, `llms.txt` and the sitemap, and stores nothing. Training crawlers such as GPTBot are listed apart and are not scored; blocking them is the user's choice.
