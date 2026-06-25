// Google Gemini adapter — drop-in alternative to the Claude provider.
// Lifted from the original extension's gemini-2.0-flash integration.
import { SCAN_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from "../prompts.js";

const MODEL = "gemini-2.0-flash";
const apiUrl = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

async function callGemini(env, { systemPrompt, userText, generationConfig }) {
  const res = await fetch(apiUrl(env.GEMINI_API_KEY), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

export async function analyze(env, tosText) {
  const text = await callGemini(env, {
    systemPrompt: SCAN_SYSTEM_PROMPT,
    userText: `DOCUMENT TEXT:\n${tosText}`,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: "application/json" },
  });
  return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
}

export async function chat(env, tosText, question) {
  return callGemini(env, {
    systemPrompt: CHAT_SYSTEM_PROMPT,
    userText: `Here is the Terms of Service / Privacy Policy text:\n\n---\n${tosText}\n---\n\nQuestion: ${question}`,
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });
}
