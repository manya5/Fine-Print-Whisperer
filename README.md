# 🔮 Fine Print Whisperer

> **Your AI-powered Chrome extension that reads the fine print so you don't have to.**

Fine Print Whisperer automatically detects Terms of Service and Privacy Policy pages, scans them for red flags, and gives you an instant, plain-English summary — no more scrolling through walls of legal text.

![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge)
![Free](https://img.shields.io/badge/Cost-100%25%20Free-00C853?style=for-the-badge)

---

## ✨ Features

### 🚩 Red Flag Detection
Instantly identifies anti-consumer clauses including:
- **💸 Data Sharing / Selling** — Are they selling your data to third parties?
- **💳 Auto-Renewal traps** — Will you be billed automatically?
- **⚖️ Forced Arbitration** — Are you giving up your right to sue?
- **🔒 Strict Cancellation** — Can you actually leave?
- **🔍 Extensive Data Collection** — How much are they tracking?
- **📝 Content Rights Grab** — Who owns your content?
- **🛡️ Liability Shield** — Are they dodging responsibility?
- **🔄 Terms Can Change Anytime** — Can they change the rules without telling you?

### ⚡ Key Insights (TL;DR)
Get 3-bullet summaries of any Terms of Service page.

### 📊 Risk Score
Visual risk meter (0-100) that shows how consumer-friendly the terms are.

### 💬 Chat with the Fine Print
Ask questions about any ToS page in plain English:
- *"Can I get a refund?"*
- *"Do they share my location data?"*
- *"What happens if I cancel?"*

### 🎨 Beautiful UI
Scrapbook-inspired Gen-Z aesthetic with:
- Dark/Light mode toggle
- Smooth animations
- Ethereal backgrounds
- Responsive design

---

## 🚀 Installation

### Option 1 — Download the packaged extension (easiest)
1. Go to the [**latest release**](https://github.com/manya5/Fine-Print-Whisperer/releases/latest).
2. Under **Assets**, download `fine-print-whisperer-v1.1.zip`.
3. **Unzip it** to a folder (Chrome's "Load unpacked" needs a folder, not a `.zip`).
4. Open Chrome → `chrome://extensions/` → enable **Developer mode** (top-right toggle).
5. Click **"Load unpacked"** and select the unzipped folder.
6. Pin the 👀 icon from the toolbar's puzzle-piece menu. Done! 🎉

### Option 2 — From source (for development)
1. Clone this repo:
   ```bash
   git clone https://github.com/manya5/Fine-Print-Whisperer.git
   ```
2. `chrome://extensions/` → **Developer mode** → **Load unpacked** → select the repo folder.
   *(The extension loads from the repo root; the `backend/` folder is ignored by Chrome.)*

> **Note:** the in-page banner + regex scan work immediately. The **Scan** button and
> chat use the hosted AI backend — they work out of the box against the deployed Worker,
> or point them at your own (see [`backend/README.md`](./backend/README.md)).

---

## 🤖 How the AI works (zero setup)

AI is **built in** — no API key required.

- **Passive auto-detection** (the on-page banner + highlights) runs **locally** with
  fast regex matching, so it's free and private and never calls a server.
- **Clicking "Scan This Page"** or **asking a chat question** sends the visible page
  text to a small managed backend ([`/backend`](./backend)) that holds **one** AI
  provider key and returns the analysis. If the backend is unreachable or over quota,
  the extension gracefully falls back to the local regex scanner.

The backend is a [Cloudflare Worker](./backend/README.md) and is **provider-agnostic**
(**Groq** by default — Llama 3.3 70B; Anthropic Claude and Google Gemini are drop-in
alternatives, switchable with a single config var). See [`backend/README.md`](./backend/README.md)
to deploy your own.

See [`PRIVACY.md`](./PRIVACY.md) for exactly what is and isn't sent off-device.

### Architecture

```
Chrome Extension (client)                    Managed Backend (Cloudflare Worker)
─────────────────────────                    ───────────────────────────────────
content.js  auto-detect banner   ── regex only, no network (free) ──┐
            + highlight          (stays fully client-side)          │
popup.js    "Scan" button        ── POST /api/scan ──►  rate-limit ─┤─►  AI provider
            chat panel           ── POST /api/chat ──►  + CORS +    │    (Groq / Claude
                                                        validation  │     / Gemini)
            └─ regex/keyword fallback if backend is down or rate-limited ┘
```

**Cost control by design:** the passive banner runs regex on every page (free); the
AI backend is only called on *explicit* user action (Scan / chat), so spend tracks
real engagement. A per-(IP + anonymous install-id) hourly rate limit lives in
Workers KV.

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension — Vanilla JS, no frameworks, no build step
- **Managed AI backend** — Cloudflare Worker proxy, provider-agnostic
- **Groq (Llama 3.3 70B)** — default AI provider for scans + chat (Claude / Gemini swappable)
- **Workers KV** — anonymous per-install rate limiting
- **Custom CSS** — Handcrafted scrapbook aesthetic

---

## 📁 Project Structure

```
Fine Print Whisperer/
├── manifest.json      # Extension config
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic, backend calls & chat feature
├── styles.css         # All styling
├── content.js         # ToS detection & local regex scanning
├── background.js      # Service worker (toolbar badge)
├── ethereal.js        # Animated background effect
├── overlay.css        # In-page banner styles
├── icons/             # Extension icons
├── PRIVACY.md         # Privacy policy (Chrome Web Store requirement)
└── backend/           # Managed AI proxy (Cloudflare Worker)
    ├── src/index.js          # Router, CORS, rate limiting, validation
    ├── src/prompts.js        # Server-side scan + chat prompts
    ├── src/providers/        # groq.js (default), claude.js, gemini.js
    ├── smoke-test.sh         # Pre-deploy provider + endpoint checks
    ├── wrangler.toml         # Worker config (no secrets committed)
    └── README.md             # Deploy + provider-swap guide
```

---

## 🤝 Contributing

Pull requests are welcome! Feel free to open issues for bugs or feature requests.

---

## 📄 License

MIT License — Use it, modify it, ship it. Just don't be evil with it. ✌️

---

<p align="center">
  <b>Made with 💜 by <a href="https://github.com/manya5">Manya</a></b><br>
  <i>Because nobody actually reads the Terms of Service</i>
</p>
