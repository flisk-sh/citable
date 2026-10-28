# Deploy Citable at citable.flisk.si (free)

Citable online is one Render web service on the free plan: the `Dockerfile` at the repository root, declared in [`render.yaml`](render.yaml). Nothing else to sign up for: no database (reports live in memory for an hour) and no AI key (every check is deterministic).

What free means here (Render's free tier as described on 2026-10-27, https://render.com/docs/free; re-check before relying on it):

- The service sleeps after 15 minutes without traffic; the next visit waits about a minute. For launch day, set `plan: starter` in `render.yaml` so it never sleeps, and set it back afterwards.
- 512 MB and 0.1 CPU. A check mostly waits on the network; `CITABLE_MAX_CHECKS=8` keeps it well inside both.
- Cached reports and rate-limit counters are in memory and reset on every sleep or deploy.

## 1. Create the Blueprint

1. https://dashboard.render.com → **New → Blueprint** → `flisk-sh/citable`, branch `main`.
2. Render lists one service, `citable`, on the **Free** plan, with the domain `citable.flisk.si`. Nothing to fill in.
3. **Deploy Blueprint**, then open the `onrender.com` URL Render shows and check a site.

## 2. Point citable.flisk.si at it

1. Render: service `citable` → **Settings → Custom Domains** shows the target, normally `citable.onrender.com`.
2. Cloudflare: zone `flisk.si` → **DNS → Add record**: `CNAME`, name `citable`, the target from Render, proxy **DNS only** (grey cloud).
   - With the Cloudflare proxy on, also set `CITABLE_PROXY=cloudflare`, or rate limits key on Cloudflare's addresses.
3. Render: **Verify** next to the domain.

## 3. Check it

```bash
curl -s https://citable.flisk.si/ready
```

```bash
curl -s 'https://citable.flisk.si/api/check?url=flisk.sh' | head -c 300
```

```bash
curl -s -X POST https://citable.flisk.si/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Limits

- 30 new checks per visitor address per hour (`CITABLE_CHECKS_PER_HOUR`); views of a report already in memory do not count. 120 MCP calls per minute.
- The checker reaches only public addresses on ports 80 and 443, and checks every redirect again. A host that resolves differently between the check and the request (DNS rebinding) is not covered; the checker only reads, with GET.
- The response time is measured from Frankfurt and says so on the report.
