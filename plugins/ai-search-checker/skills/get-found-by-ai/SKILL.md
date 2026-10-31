---
name: get-found-by-ai
description: Get a website found and quoted by AI. Checks whether ChatGPT, Claude, Perplexity and Google AI can find, read and quote it. Use when the user says get my site found by AI, AI SEO, SEO for ChatGPT, show up in ChatGPT or Perplexity, is my site in AI search, or GEO.
---

# Get a site found by AI

Use the `check_site` tool from the `ai-search-checker` server.

1. Take the domain or page the user names (for example `example.com` or `example.com/pricing`). If they gave none, ask for one.
2. Call `check_site` with that address in `url`.
3. Tell the user the score out of 100, then the problems from worst to least, each with its fix, in plain words.
4. If the user wants the fixes done, offer to make them in their own files. Do not change anything without asking.

The tool is read-only: it reads the public page, `robots.txt`, `llms.txt` and the sitemap, and stores nothing. Training crawlers such as GPTBot are listed apart and are not scored; blocking them is the user's choice.
