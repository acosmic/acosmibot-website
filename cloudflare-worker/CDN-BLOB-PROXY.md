# cdn.acosmibot.com → Azure Blob (Cloudflare Worker)

Serves user-uploaded embed images from Azure Blob Storage under the existing
`cdn.acosmibot.com` hostname, replacing the nginx vhost on the home server.

## Why a Worker

Azure Blob routes by Host header and returns **400** for a request arriving with
`Host: cdn.acosmibot.com`. The dashboard-native fix is Origin Rules → *Host
Header: Rewrite to*, but that field (and the matching SNI field) is **Enterprise
plan only**. A Worker sidesteps it: it issues a fresh `fetch()` to the blob
endpoint, which carries the correct Host and SNI by construction.

Free plan includes 100k Worker requests/day — far above this traffic, especially
since Discord re-hosts embed images through `media.discordapp.net` after the
first fetch.

## Setup

1. **DNS.** `cdn.acosmibot.com` → CNAME `acosmibotcdn.blob.core.windows.net`,
   **Proxied** (orange cloud). The Worker intercepts before the origin is used,
   but the record must exist and be proxied for the Worker to run at all.
   - Remove the old tunnel route for this hostname.

2. **Create the Worker.** Workers & Pages → Create → paste `cdn-blob-proxy.js` →
   Deploy.

3. **Add the route.** Worker → Settings → Triggers → Routes → Add route:
   - Route: `cdn.acosmibot.com/*`
   - Zone: `acosmibot.com`

4. **SSL/TLS** mode `Full (strict)` is fine — the Worker's outbound fetch
   validates against Azure's own certificate independently of the zone setting.

## Test

```bash
curl -I https://cdn.acosmibot.com/embed-images/698684768010895410/345dd90c-626e-4ad0-b96c-66224e5ebfd0_1770153840.png
```

Expect `200`, `content-type: image/png`, and
`cache-control: public, max-age=31536000, immutable`.

Negative checks — both should 404, confirming the Worker isn't an open proxy:

```bash
curl -sI https://cdn.acosmibot.com/                     # no container prefix
curl -sI https://cdn.acosmibot.com/some-other-container/x
```

## Notes

- The query string is dropped on purpose (no cache-busting, no SAS passthrough).
- `Access-Control-Allow-Origin: *` and `X-Content-Type-Options: nosniff` are set
  to match the nginx config this replaces.
- Only `/embed-images/` is proxied; other paths 404 without reaching Azure.
- Uploads are written by `acosmibot-api/api/blueprints/embeds.py` via
  `api/services/blob_storage.py`. The blob key is `<guild_id>/<filename>`, which
  makes the blob path identical to the public URL path — so the URLs already
  stored on embed records needed no rewriting.
