// Anthropic Claude adapter (raw HTTP — no SDK, so it runs as-is on Cloudflare Workers).
// Default provider. Uses Claude Haiku 4.5: cheap, fast, strong at structured JSON
// extraction and nuanced legal-text reasoning.
import { SCAN_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, FLAG_CATEGORIES } from "../prompts.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";

// JSON Schema that guarantees the popup-renderable scan shape.
const SCAN_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      tldr: { type: "array", items: { type: "string" } },
      riskScore: { type: "integer" },
      redFlags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            detail: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
            category: { type: "string", enum: FLAG_CATEGORIES },
          },
          required: ["title", "detail", "severity", "category"],
          additionalProperties: false,
        },
      },
      greenFlags: { type: "array", items: { type: "string" } },
    },
    required: ["tldr", "riskScore", "redFlags", "greenFlags"],
    additionalProperties: false,
  },
};

async function callClaude(env, body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}

// Returns the parsed scan object { tldr, riskScore, redFlags, greenFlags }.
export async function analyze(env, tosText) {
  const text = await callClaude(env, {
    max_tokens: 1024,
    system: SCAN_SYSTEM_PROMPT,
    output_config: { format: SCAN_FORMAT },
    messages: [{ role: "user", content: `DOCUMENT TEXT:\n${tosText}` }],
  });
  return JSON.parse(text);
}

// Returns a plain-text answer string.
export async function chat(env, tosText, question) {
  return callClaude(env, {
    max_tokens: 300,
    system: CHAT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the Terms of Service / Privacy Policy text:\n\n---\n${tosText}\n---\n\nQuestion: ${question}`,
      },
    ],
  });
}
