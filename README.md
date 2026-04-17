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

### From Source (Developer Mode)
1. Clone this repo:
   ```bash
   git clone https://github.com/manya5/Fine-Print-Whisperer.git
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **"Load unpacked"**
5. Select the cloned folder
6. Done! The extension icon will appear in your toolbar 🎉

---

## 🔑 Optional: Add Gemini API Key (Free)

Adding a free Gemini API key supercharges the extension with AI-powered analysis:

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. In the extension, click ⚙️ **Settings** → paste your key

| Feature | Without API Key | With API Key |
|---|---|---|
| Red Flag Detection | Keyword matching | AI-powered understanding |
| TL;DR Summary | Generic | Smart, context-aware |
| Chat Answers | Limited to ~7 topics | Can answer anything |
| Cost | Free | Also free |

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension
- **Vanilla JS** — No frameworks, no build step
- **Gemini 2.0 Flash API** — For AI-powered analysis (optional)
- **Chrome Built-in AI** — On-device AI support (when available)
- **Custom CSS** — Handcrafted scrapbook aesthetic

---

## 📁 Project Structure

```
Fine Print Whisperer/
├── manifest.json      # Extension config
├── popup.html         # Extension popup UI
├── popup.js           # Popup logic & chat feature
├── styles.css         # All styling
├── content.js         # ToS detection & keyword scanning
├── background.js      # Service worker
├── ethereal.js        # Animated background effect
├── overlay.css        # In-page banner styles
└── icons/             # Extension icons
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
