# PriorAuth Draft

Static single-file app. Vercel serves `index.html` automatically at the root, no build step required.

## Files

- `index.html` — the app itself (HTML/CSS/JS in one file)
- `vercel.json` — explicit static-hosting config (clean URLs, no trailing slash)
- `.gitignore` — keeps OS/editor and Vercel local files out of the repo

## Important runtime dependency

This app calls `https://api.anthropic.com/v1/messages` directly from the browser, and uses a `window.storage` key-value API for the outcomes log and patient lookups. Both of those are provided automatically inside Claude.ai's artifact sandbox. Deployed standalone on Vercel, **neither of those will work as-is**:

- The Anthropic API call will fail (no API key, and Anthropic's API isn't meant to be called directly from a browser with a key exposed anyway).
- `window.storage` won't exist at all outside that sandbox, so the log and patient status features will throw errors.

To make this work as a real deployed app, you'd need to:
1. Add a small backend route (a Vercel serverless function works well) that holds your Anthropic API key server-side and proxies the `/v1/messages` call.
2. Replace `window.storage` calls with real persistence, e.g. Vercel KV, Postgres, or any small database, since there's no real backend service behind that API in a bare Vercel static deploy.

Until those two things are added, this deploy is a visual/UI preview only, the "Draft justification," outcomes log, and patient status features won't function on the live Vercel URL.
