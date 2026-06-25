// Groq adapter — drop-in alternative to the Claude / Gemini providers.
// Groq exposes an OpenAI-compatible Chat Completions API, so this uses raw HTTP
// (no SDK) and runs as-is on Cloudflare Workers. Fast + cheap; good default for
// a zero-cost-to-the-user managed backend.
import { SCAN_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from "../prompts.js";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Llama 3.3 70B: strong instruction-following + JSON-mode support on Groq.
const MODEL = "llama-3.3-70b-versatile";

async function callGroq(env, body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

// Returns the parsed scan object { tldr, riskScore, redFlags, greenFlags }.
export async function analyze(env, tosText) {
  const text = await callGroq(env, {
    temperature: 0.3,
    max_tokens: 1024,
    // JSON mode: guarantees a parseable JSON object (no markdown fences).
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SCAN_SYSTEM_PROMPT },
      { role: "user", content: `DOCUMENT TEXT:\n${tosText}` },
    ],
  });
  return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
}

// Returns a plain-text answer string.
export async function chat(env, tosText, question) {
  return callGroq(env, {
    temperature: 0.3,
    max_tokens: 300,
    messages: [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Here is the Terms of Service / Privacy Policy text:\n\n---\n${tosText}\n---\n\nQuestion: ${question}`,
      },
    ],
  });
}
