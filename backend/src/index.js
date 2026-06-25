// Fine Print Whisperer — managed AI proxy (Cloudflare Worker).
//
// Holds ONE provider API key and serves AI analysis to all installs of the
// published extension, so users get AI with zero setup. The passive
// auto-detect banner in the extension stays regex-only and never hits this
// worker — only explicit "Scan" / chat actions do, which keeps cost tied to
// real engagement.
//
// Provider is swappable via the AI_PROVIDER var ("groq" | "claude" | "gemini").
import * as claude from "./providers/claude.js";
import * as gemini from "./providers/gemini.js";
import * as groq from "./providers/groq.js";

const PROVIDERS = { groq, claude, gemini };

// Server-side caps, mirroring the extension's client-side truncation.
const MAX_SCAN_CHARS = 8000;
const MAX_CHAT_CHARS = 6000;
const MAX_QUESTION_CHARS = 500;

// Rate limit: per (IP + anonymous install id), fixed 1-hour window.
const RATE_LIMIT = 40;
const RATE_WINDOW_SECONDS = 3600;

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedId = env.ALLOWED_EXTENSION_ID; // optional: pin to published id
  let allow = "";
  if (origin.startsWith("chrome-extension://")) {
    allow = !allowedId || origin === `chrome-extension://${allowedId}` ? origin : "";
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-fpw-install-id",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

async function checkRateLimit(env, request) {
  if (!env.RATE_LIMIT_KV) return true; // KV not bound (e.g. local dev) — skip
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const install = request.headers.get("x-fpw-install-id") || "anon";
  const key = `rl:${ip}:${install}`;
  const current = parseInt((await env.RATE_LIMIT_KV.get(key)) || "0", 10);
  if (current >= RATE_LIMIT) return false;
  await env.RATE_LIMIT_KV.put(key, String(current + 1), {
    expirationTtl: RATE_WINDOW_SECONDS,
  });
  return true;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405, cors);
    }

    const url = new URL(request.url);
    const route = url.pathname;
    if (route !== "/api/scan" && route !== "/api/chat") {
      return json({ error: "not_found" }, 404, cors);
    }

    if (!(await checkRateLimit(env, request))) {
      return json({ error: "rate_limited", message: "Hourly free limit reached. Try again later." }, 429, cors);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, cors);
    }

    const provider = PROVIDERS[env.AI_PROVIDER] || PROVIDERS.groq;

    try {
      if (route === "/api/scan") {
        const text = String(payload.text || "").slice(0, MAX_SCAN_CHARS);
        if (text.trim().length < 50) return json({ error: "no_text" }, 400, cors);
        const data = await provider.analyze(env, text);
        return json({ data }, 200, cors);
      }

      // /api/chat
      const tosText = String(payload.tosText || "").slice(0, MAX_CHAT_CHARS);
      const question = String(payload.question || "").slice(0, MAX_QUESTION_CHARS).trim();
      if (!question) return json({ error: "no_question" }, 400, cors);
      if (tosText.trim().length < 50) return json({ error: "no_text" }, 400, cors);
      const answer = await provider.chat(env, tosText, question);
      return json({ answer }, 200, cors);
    } catch (err) {
      console.error("FPW backend error:", err && err.message);
      return json({ error: "upstream_error", message: "AI analysis failed." }, 502, cors);
    }
  },
};
