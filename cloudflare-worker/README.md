# Profile link unfurls (Cloudflare Worker)

Makes `acosmibot.com/u/<username>` produce a rich preview card when shared in
Discord, Twitter, Slack, iMessage, etc. — the growth loop for individual member
signups.

## How it works

Crawlers don't run JavaScript, so our React SPA can't generate previews for them.
This Worker intercepts `acosmibot.com/u/*`, and:

- **Crawler bot** (Discordbot, Twitterbot, …) → returns the server-rendered Open
  Graph HTML from `GET https://api.acosmibot.com/api/profile/<username>/og`.
- **Human** → passes the request straight through to Azure Static Web Apps (the
  normal SPA). No change to the user experience.

The data/markup all comes from the API endpoint (`api/blueprints/profiles.py` →
`get_profile_og`), so the Worker itself stays tiny and never needs redeploying
when the card content changes.

## One-time setup

1. **Proxy the apex domain.** In the Cloudflare dashboard → DNS, set the
   `acosmibot.com` record to **Proxied** (orange cloud). It is currently
   DNS-only (grey cloud), which means Workers don't run on it. Traffic still
   reaches the same Azure origin — Cloudflare just sits in front now.
   - Verify afterward: `curl -sI https://acosmibot.com | grep -i cf-ray` should
     return a header. The site should load normally.

2. **Create the Worker.** Cloudflare dashboard → Workers & Pages → Create →
   paste `profile-unfurl.js`. Deploy.

3. **Add the route.** Worker → Settings → Triggers → Routes → Add route:
   - Route: `acosmibot.com/u/*`
   - Zone: `acosmibot.com`

   (Optional, for local CLI deploys, use a `wrangler.toml` with the same route.)

## Test it

- Quick check the API renders tags:
  `curl -s -A "Discordbot" https://api.acosmibot.com/api/profile/<yourname>/og`
  → should contain `<meta property="og:title" ...>`.
- After the route is live, validate the real URL with a preview debugger
  (e.g. opengraph.xyz, or paste the link into a private Discord channel).

## Notes / future

- Phase 1 uses the user's **Discord avatar** as `og:image`. When rank-card
  customization ships (Phase 3), swap `og:image` to a rendered share card
  (`/api/profile/<name>/card.png`) and bump `twitter:card` to
  `summary_large_image` for a bigger preview.
- Alternative to this Worker (if you'd rather keep everything in Azure): add a
  linked Azure Functions API and a `staticwebapp.config.json` route mapping
  `/u/*` to a function that does the same UA sniffing. The Worker is recommended
  since the zone is already on Cloudflare.
