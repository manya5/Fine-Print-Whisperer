# Fine Print Whisperer — Backend

A tiny [Cloudflare Worker](https://workers.cloudflare.com/) that holds **one** AI
provider key and serves AI analysis to every install of the extension, so users
get AI features with zero setup. Provider-agnostic (**Groq** by default; Claude and
Gemini are drop-in alternatives).

## Endpoints

| Method | Path        | Body                       | Response                                              |
| ------ | ----------- | -------------------------- | ---------------------------------------------------- |
| POST   | `/api/scan` | `{ "text": "<tos text>" }` | `{ "data": { tldr, riskScore, redFlags, greenFlags } }` |
| POST   | `/api/chat` | `{ "tosText": "...", "question": "..." }` | `{ "answer": "..." }`                  |

Errors return `{ "error": "...", "message": "..." }` with a 4xx/5xx status. The
extension falls back to its local regex scanner on any non-200.

## Setup

```bash
cd backend
npm install

# 1. Create the rate-limit KV namespace and paste the id into wrangler.toml
npx wrangler kv namespace create RATE_LIMIT_KV

# 2. Set the provider key as a secret (never commit it)
npx wrangler secret put GROQ_API_KEY          # default provider
# or, depending on AI_PROVIDER in wrangler.toml:
# npx wrangler secret put ANTHROPIC_API_KEY   # AI_PROVIDER = "claude"
# npx wrangler secret put GEMINI_API_KEY      # AI_PROVIDER = "gemini"

# 3. Run locally (KV rate-limiting is skipped in dev)
npm run dev          # http://localhost:8787

# 4. Deploy
npm run deploy       # https://fine-print-whisperer.<subdomain>.workers.dev
```

## Swapping providers

Set `AI_PROVIDER` in `wrangler.toml` to `"groq"`, `"claude"`, or `"gemini"`, set the
matching secret, and `npm run deploy`. No code changes. Add a new provider by dropping a
`src/providers/<name>.js` that exports `analyze(env, tosText)` and
`chat(env, tosText, question)`, then registering it in `src/index.js`.

## Abuse protection (MVP, honest limits)

Because the extension is public, the backend key can be abused. MVP mitigations:
per-(IP + anonymous install-id) rate limiting via KV, request-size caps, and a
restricted CORS origin (`ALLOWED_EXTENSION_ID`). Set a **hard monthly spend cap**
on the provider dashboard as the real backstop. Accounts/quotas are out of scope
for the MVP.
