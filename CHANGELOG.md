# Changelog

All notable changes to Fine Print Whisperer are documented here.

## [1.1.0] — 2026-06-25

The "zero-setup AI" release. Anyone can now get full AI analysis with **no API key
and no configuration** — the AI runs through a managed backend instead of requiring
each user to bring their own key.

### Added
- **Managed AI backend** (`backend/`) — a [Cloudflare Worker](backend/README.md) that
  holds one provider key and serves AI scans + chat to every install.
  - `POST /api/scan` → `{ tldr, riskScore, redFlags, greenFlags }`
  - `POST /api/chat` → `{ answer }`
- **Provider-agnostic adapter** — switch AI providers with one config var, no code
  changes: **Groq** (`llama-3.3-70b-versatile`, default), Anthropic Claude, Google Gemini.
- **Anonymous rate limiting** — per-(IP + install-id) hourly cap via Workers KV; no
  accounts required.
- **Graceful fallback** — if the backend is down or rate-limited, the extension falls
  back to the local regex scanner with no errors.
- `PRIVACY.md` — privacy policy describing exactly what is/isn't sent off-device.
- `backend/smoke-test.sh` — pre-deploy validation for the provider API and Worker endpoints.

### Changed
- Extension now calls the managed backend for Scan + chat instead of an on-device /
  user-supplied key.
- `manifest.json` — wired extension icons (16/48/128); host permission points at the
  Worker; version bumped to 1.1.
- README updated with architecture, provider model, and self-host instructions.

### Removed
- **BYO-key UI** — users no longer paste their own Gemini key.
- Experimental `window.ai` on-device scan path (unavailable on virtually all browsers).

### Security
- AI fires only on explicit user action (Scan / chat); the passive auto-detect banner
  stays regex-only and never calls the network.
- Provider keys are never committed — set locally via `backend/.dev.vars` (gitignored)
  and in production via `wrangler secret put`.
- Server-side request-size caps and CORS restricted to extension origins.

## [1.0.0] — Initial release

- Manifest V3 Chrome extension: auto-detect ToS / Privacy pages, regex red-flag
  detection, on-page banner + keyword highlighting, risk score, and chat (BYO Gemini key).
