// ─── Popup Interactions ───

// Managed AI backend (deployed Cloudflare Worker). Must match a host in
// manifest.json "host_permissions". For local testing point this at the URL
// printed by `wrangler dev` and add that host to the manifest temporarily.
const FPW_BACKEND = "https://fine-print-whisperer.fine-print-whisperer.workers.dev";

// Stable anonymous id so the backend can rate-limit per install without accounts.
async function getInstallId() {
  const { fpwInstallId } = await chrome.storage.local.get("fpwInstallId");
  if (fpwInstallId) return fpwInstallId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ fpwInstallId: id });
  return id;
}

// Pull the visible ToS text from the page, injecting the content script if needed.
async function getToSText(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: "get_tos_text" });
    return res?.text || "";
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await new Promise((r) => setTimeout(r, 200));
    const res = await chrome.tabs.sendMessage(tabId, { action: "get_tos_text" });
    return res?.text || "";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const settingsBtn = document.getElementById("settings-btn");
  const closeSettingsBtn = document.getElementById("close-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const scanBtn = document.getElementById("scan-btn");
  const autoDetectToggle = document.getElementById("auto-detect-toggle");
  const themeToggleBtn = document.getElementById("theme-toggle");

  const resultsContainer = document.getElementById("results-container");
  const messageContainer = document.getElementById("message-container");
  const loadingState = document.getElementById("loading-state");

  // Load Theme
  const themeSettings = await chrome.storage.local.get("theme");
  const currentTheme = themeSettings.theme || "dark";
  if (currentTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  // Theme Toggle Logic
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      chrome.storage.local.set({ theme: isDark ? "dark" : "light" });
    });
  }

  // Load Settings
  const settings = await chrome.storage.local.get(["autoDetect"]);
  autoDetectToggle.checked = settings.autoDetect !== false;

  // Save Settings
  autoDetectToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoDetect: e.target.checked });
  });

  // Settings Panel Toggle
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.add("open");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
  });

  // Scan Button — AI-quality scan via the managed backend, with a local
  // regex fallback when the backend is unreachable or over quota.
  scanBtn.addEventListener("click", async () => {
    resultsContainer.classList.add("hide");
    messageContainer.classList.add("hide");
    loadingState.classList.remove("hide");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      showError("doesn't look like fine print to us 🤷");
      return;
    }

    try {
      const tosText = await getToSText(tab.id);
      if (!tosText || tosText.trim().length < 50) {
        showError("this page is giving us nothing 👀");
        return;
      }

      // Try the managed AI backend first.
      try {
        const installId = await getInstallId();
        const res = await fetch(`${FPW_BACKEND}/api/scan`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-fpw-install-id": installId },
          body: JSON.stringify({ text: tosText }),
        });
        if (res.ok) {
          const { data } = await res.json();
          loadingState.classList.add("hide");
          renderResults(data, true);
          return;
        }
        console.warn("FPW: backend scan returned", res.status);
      } catch (err) {
        console.warn("FPW: backend scan failed, using local fallback.", err);
      }

      // Fallback: local regex scan from the content script.
      chrome.tabs.sendMessage(tab.id, { action: "force_scan" }, handleScanResponse);
    } catch (err) {
      showError("this page is giving us nothing 👀");
    }
  });

  function handleScanResponse(response) {
    loadingState.classList.add("hide");
    if (chrome.runtime.lastError || !response || !response.success) {
      if (response && response.error === "no_text") {
        showError("this page is giving us nothing 👀");
      } else {
        showError("doesn't look like fine print to us 🤷");
      }
      return;
    }

    renderResults(response.data, response.usedAI);
  }

  function renderResults(data, usedAI) {
    messageContainer.classList.add("hide");
    resultsContainer.classList.remove("hide");

    // TL;DR
    const tldrList = document.getElementById("tldr-list");
    tldrList.innerHTML = "";
    if (data.tldr && data.tldr.length > 0) {
      data.tldr.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        tldrList.appendChild(li);
      });
    }

    // Risk Score
    const riskCircle = document.getElementById("risk-circle");
    riskCircle.className = "risk-circle"; // reset
    let score = data.riskScore || 0;
    riskCircle.textContent = score;
    if (score < 40) riskCircle.classList.add("risk-low");
    else if (score < 70) riskCircle.classList.add("risk-medium");
    else riskCircle.classList.add("risk-high");

    const aiBadge = document.getElementById("ai-badge");
    if (usedAI) {
      aiBadge.classList.remove("hide");
    } else {
      aiBadge.classList.add("hide");
    }

    // Red Flags
    const flagsContainer = document.getElementById("flags-container");
    flagsContainer.innerHTML = "";
    if (data.redFlags && data.redFlags.length > 0) {
      const EMOJI = {
        data_selling: "💸",
        auto_renewal: "💳",
        arbitration: "⚖️",
        cancellation: "🔒",
        data_collection: "🔍",
        content_rights: "📝",
        liability_limitation: "🛡️",
        terms_changes: "🔄",
      };
      data.redFlags.forEach((flag, index) => {
        const div = document.createElement("div");
        div.className = `alert-card severity-${flag.severity || 'low'}`;
        div.style.animationDelay = `${index * 0.1}s`;

        // Build with textContent — flag.title/detail come from the AI, so never
        // inject them as HTML.
        const iconContainer = document.createElement("div");
        iconContainer.className = "alert-icon-container";
        const iconPulse = document.createElement("div");
        iconPulse.className = "alert-icon-pulse";
        iconPulse.textContent = EMOJI[flag.category] || "⚠️";
        iconContainer.appendChild(iconPulse);

        const title = document.createElement("h3");
        title.className = "alert-title";
        title.textContent = flag.title || "";

        const desc = document.createElement("p");
        desc.className = "alert-desc";
        desc.textContent = flag.detail || "";

        div.append(iconContainer, title, desc);
        flagsContainer.appendChild(div);
      });
    } else {
      flagsContainer.innerHTML = `<div style="text-align:left; font-family:'Caveat', cursive; font-size:20px; color:var(--text-primary);">No major red flags found! 🎉</div>`;
    }

    // Green Flags
    const greenFlagsContainer = document.getElementById("green-flags");
    greenFlagsContainer.innerHTML = "";
    if (data.greenFlags && data.greenFlags.length > 0) {
      data.greenFlags.forEach(flag => {
        const span = document.createElement("span");
        span.className = "green-tag";
        span.textContent = flag;
        greenFlagsContainer.appendChild(span);
      });
    }
  }

  function showError(msg) {
    loadingState.classList.add("hide");
    resultsContainer.classList.add("hide");
    messageContainer.classList.remove("hide");
    messageContainer.textContent = msg;
  }


  // ─────────────────────────────────────────────────────────
  // ─── Chat Feature (Ask the Fine Print) ──────────────────
  // ─────────────────────────────────────────────────────────

  const chatFab = document.getElementById("chat-fab");
  const chatPanel = document.getElementById("chat-panel");
  const chatClose = document.getElementById("chat-close");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  const chatMessages = document.getElementById("chat-messages");
  const chatChipsContainer = document.getElementById("chat-chips-container");
  const chatChips = document.querySelectorAll(".chat-chip");

  // ─── Chat Panel Toggle ───
  chatFab.addEventListener("click", () => {
    chatPanel.classList.add("open");
    chatFab.classList.add("hide");
    setTimeout(() => chatInput.focus(), 400);
  });

  chatClose.addEventListener("click", () => {
    chatPanel.classList.remove("open");
    chatFab.classList.remove("hide");
  });

  // ─── Message Sending ───
  chatSend.addEventListener("click", () => sendMessage(chatInput.value));
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  // ─── Quick Chip Clicks ───
  chatChips.forEach(chip => {
    chip.addEventListener("click", () => {
      sendMessage(chip.dataset.q);
    });
  });

  // ─── Core Chat Logic ───
  async function sendMessage(question) {
    question = question.trim();
    if (!question) return;

    // Clear welcome screen on first message
    const welcome = chatMessages.querySelector(".chat-welcome");
    if (welcome) welcome.remove();

    // Render user bubble
    appendMessage("user", question);
    chatInput.value = "";

    // Hide chips after first use
    if (chatChipsContainer) {
      chatChipsContainer.classList.add("hide");
    }

    // Show typing dots
    const typingId = showTyping();

    try {
      // 1. Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
        removeTyping(typingId);
        appendMessage("ai", "Open a website with Terms of Service first, then ask me! 🌐");
        return;
      }

      // 2. Get ToS text from content script
      const tosText = await getToSText(tab.id);

      if (!tosText || tosText.trim().length < 50) {
        removeTyping(typingId);
        appendMessage("ai", "I can't read this page 😅 Make sure you're on a Terms of Service or Privacy Policy page and try again!");
        return;
      }

      // 3. Ask the managed AI backend.
      try {
        const installId = await getInstallId();
        const res = await fetch(`${FPW_BACKEND}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-fpw-install-id": installId },
          body: JSON.stringify({ tosText, question }),
        });
        if (res.ok) {
          const { answer } = await res.json();
          removeTyping(typingId);
          appendMessage("ai", answer);
          return;
        }
        console.warn("FPW Chat: backend returned", res.status);
      } catch (err) {
        console.warn("FPW Chat: backend failed, falling back to keywords.", err);
      }

      // 4. Fallback: local keyword matching
      removeTyping(typingId);
      const fallbackAnswer = keywordFallback(question, tosText);
      appendMessage("ai", fallbackAnswer);

    } catch (err) {
      console.error("FPW Chat error:", err);
      removeTyping(typingId);
      appendMessage("ai", "Something went wrong 😵 Try again in a sec!");
    }
  }

  // ─── Render Helpers ───
  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `chat-msg chat-msg-${role}`;

    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;

    div.appendChild(bubble);
    chatMessages.appendChild(div);

    // Scroll to bottom
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  let typingCounter = 0;
  function showTyping() {
    const id = ++typingCounter;
    const div = document.createElement("div");
    div.className = "chat-msg chat-msg-ai";
    div.id = `typing-${id}`;
    div.innerHTML = `
      <div class="chat-bubble chat-bubble-ai typing-indicator">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    `;
    chatMessages.appendChild(div);
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(`typing-${id}`);
    if (el) el.remove();
  }

  // ─── Keyword Fallback (no AI needed) ───
  function keywordFallback(question, tosText) {
    if (!tosText) return "I can't read this page yet. Try scanning it first! 🔍";

    const q = question.toLowerCase();
    const lowerText = tosText.toLowerCase();

    const topics = [
      {
        keywords: ["refund", "money back", "return", "reimburse", "get my money"],
        searchTerms: ["refund", "non-refundable", "money back", "return policy", "reimburse", "no refund"],
        label: "refunds"
      },
      {
        keywords: ["location", "gps", "track", "where i am", "geolocation"],
        searchTerms: ["location", "gps", "geolocation", "tracking", "geographic", "precise location"],
        label: "location tracking"
      },
      {
        keywords: ["delete", "erase", "remove my data", "forget me", "remove account"],
        searchTerms: ["delete", "erase", "remove", "right to be forgotten", "erasure", "account deletion"],
        label: "data deletion"
      },
      {
        keywords: ["cancel", "unsubscribe", "opt out", "stop", "end my"],
        searchTerms: ["cancel", "terminate", "unsubscribe", "opt out", "opt-out", "cancellation", "discontinue"],
        label: "cancellation"
      },
      {
        keywords: ["share", "sell", "third party", "data", "privacy", "personal info"],
        searchTerms: ["share", "sell", "third party", "third-party", "partners", "advertisers", "disclose", "transfer"],
        label: "data sharing"
      },
      {
        keywords: ["arbitration", "sue", "court", "lawsuit", "legal", "dispute"],
        searchTerms: ["arbitration", "class action", "waive", "dispute", "court", "litigation", "jury"],
        label: "legal disputes"
      },
      {
        keywords: ["cookie", "cookies", "tracking"],
        searchTerms: ["cookie", "cookies", "tracking pixel", "web beacon", "analytics"],
        label: "cookies/tracking"
      }
    ];

    // Find matching topic
    let matchedTopic = null;
    for (const topic of topics) {
      if (topic.keywords.some(kw => q.includes(kw))) {
        matchedTopic = topic;
        break;
      }
    }

    if (!matchedTopic) {
      return "I couldn't reach the AI just now 🤔 Try again in a sec!\n\nOr ask about: refunds, data sharing, cancellation, location tracking, or arbitration 💡";
    }

    // Find relevant sentences
    const sentences = tosText.split(/[.!?\n]+/);
    const relevant = sentences
      .filter(s => matchedTopic.searchTerms.some(term => s.toLowerCase().includes(term)))
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 400)
      .slice(0, 2);

    if (relevant.length === 0) {
      return `Couldn't find anything about ${matchedTopic.label} in this document 🤷\n\nIt doesn't seem to be mentioned in the ToS.`;
    }

    return `Here's what I found about ${matchedTopic.label} 📋\n\n"${relevant.join('"\n\n"')}"`;
  }

});
