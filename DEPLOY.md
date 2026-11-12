# Deploy Citable at citable.flisk.si (free)

Citable online is one Cloudflare Worker on the free plan: the same Hono app as the Bun server, started from [`services/app/web/src/worker.ts`](services/app/web/src/worker.ts) and configured in [`services/app/web/wrangler.toml`](services/app/web/wrangler.toml). No database (reports live in memory for an hour) and no AI key (every check is deterministic).

It moved off Render's free plan on 2026-11-12: every free Render service in the workspace shares one pool of instance hours, and when the pool ran out, Render suspended them all until the next month.

## What the Worker does differently

- **The clip.** `demo.mp4` (1.5 MB) is too big for the Worker bundle, so `bun run worker:assets` writes it and `demo.jpg` to `public/`, and Cloudflare serves them as static assets. Cloudflare's asset server ignores `Range`, so `/demo.mp4` goes through the Worker first, which answers byte ranges for Safari.
- **Fetching sites.** Each hop is still checked against private addresses (`node:dns` with `nodejs_compat`). The Worker cannot pin the request to the checked address, because its `fetch` has no TLS server name option; it does not need to, since a Worker's `fetch` never reaches a private network.
- **Limits.** Cached reports and rate-limit counters live in memory per Worker instance, so they reset more often than on a single server.

## Deploy

From `services/app/web`, logged in with `bunx wrangler@4 login`:

```bash
bun run deploy
```

That writes `public/` and runs `bunx wrangler@4 deploy`. The custom domain `citable.flisk.si` is created by Cloudflare; the hostname must have no other DNS record in zone `flisk.si` (delete an old `CNAME` first, or the deploy stops with code 100117).

## Check it

```bash
curl -s https://citable.flisk.si/ready
```

```bash
curl -s 'https://citable.flisk.si/api/check?url=flisk.sh' | head -c 300
```

```bash
curl -s -r 0-1 -o /dev/null -D - https://citable.flisk.si/demo.mp4 | head -1
```

```bash
curl -s -X POST https://citable.flisk.si/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The range request answers `206`.

## Limits

- 30 new checks per visitor address per hour (`CITABLE_CHECKS_PER_HOUR`); views of a report already in memory do not count. 120 MCP calls per minute.
- The checker reaches only public addresses on ports 80 and 443, and checks every redirect again. The checker only reads, with GET.
- Workers Free allows 100,000 requests a day and 10 ms of CPU per request; a check mostly waits on the network.
