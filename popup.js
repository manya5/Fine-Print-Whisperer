// ─── Popup Interactions ───

document.addEventListener("DOMContentLoaded", async () => {
  const settingsBtn = document.getElementById("settings-btn");
  const closeSettingsBtn = document.getElementById("close-settings");
  const settingsPanel = document.getElementById("settings-panel");
  const scanBtn = document.getElementById("scan-btn");
  const autoDetectToggle = document.getElementById("auto-detect-toggle");
  const aiToggle = document.getElementById("ai-toggle");
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
  const settings = await chrome.storage.local.get(["autoDetect", "useAI"]);
  autoDetectToggle.checked = settings.autoDetect !== false;
  aiToggle.checked = settings.useAI !== false;

  // Save Settings
  autoDetectToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ autoDetect: e.target.checked });
  });
  aiToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ useAI: e.target.checked });
  });

  // Settings Panel Toggle
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.add("open");
  });
  closeSettingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
  });

  // Scan Button
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
      // First, try to send message (in case content script is already injected)
      chrome.tabs.sendMessage(tab.id, { 
        action: "force_scan",
        useAI: aiToggle.checked 
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not injected, let's inject it first
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          }, () => {
            // Wait a moment for script to initialize
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { 
                action: "force_scan", 
                useAI: aiToggle.checked 
              }, handleScanResponse);
            }, 100);
          });
        } else {
          handleScanResponse(response);
        }
      });
    } catch (err) {
      showError("this page is giving us nothing 👀");
    }
  });

  function handleScanResponse(response) {
    loadingState.classList.add("hide");
    if (!response || !response.success) {
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
      data.redFlags.forEach((flag, index) => {
        const div = document.createElement("div");
        div.className = `alert-card severity-${flag.severity || 'low'}`;
        div.style.animationDelay = `${index * 0.1}s`;

        let emoji = "⚠️";
        let showIcon = true;
        if (flag.category === "data_selling") emoji = "💸";
        else if (flag.category === "auto_renewal") emoji = "💳";
        else if (flag.category === "arbitration") emoji = "⚖️";
        else if (flag.category === "cancellation") emoji = "🔒";
        else if (flag.category === "data_collection") emoji = "🔍";
        else if (flag.category === "content_rights") emoji = "📝";
        else if (flag.category === "liability_limitation") emoji = "🛡️";
        else if (flag.category === "terms_changes") emoji = "🔄";

        const iconHTML = showIcon ? `
          <div class="alert-icon-container">
            <div class="alert-icon-pulse">${emoji}</div>
          </div>` : "";

        div.innerHTML = `
          ${iconHTML}
          <h3 class="alert-title">${flag.title}</h3>
          <p class="alert-desc">${flag.detail}</p>
        `;
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
  const geminiKeyInput = document.getElementById("gemini-key-input");
  const getApiKeyLink = document.getElementById("get-api-key-link");

  // ─── API Key Management ───
  const geminiSettings = await chrome.storage.local.get("geminiApiKey");
  if (geminiSettings.geminiApiKey) {
    geminiKeyInput.value = geminiSettings.geminiApiKey;
  }

  geminiKeyInput.addEventListener("change", (e) => {
    chrome.storage.local.set({ geminiApiKey: e.target.value.trim() });
  });

  getApiKeyLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "https://aistudio.google.com/apikey" });
  });

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
      let tosText = "";
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "get_tos_text" });
        tosText = response?.text || "";
      } catch {
        // Content script not injected — inject it
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"]
          });
          await new Promise(r => setTimeout(r, 200));
          const response = await chrome.tabs.sendMessage(tab.id, { action: "get_tos_text" });
          tosText = response?.text || "";
        } catch {
          tosText = "";
        }
      }

      if (!tosText || tosText.trim().length < 50) {
        removeTyping(typingId);
        appendMessage("ai", "I can't read this page 😅 Make sure you're on a Terms of Service or Privacy Policy page and try again!");
        return;
      }

      // 3. Try Gemini API
      const keySettings = await chrome.storage.local.get("geminiApiKey");
      if (keySettings.geminiApiKey) {
        try {
          const answer = await callGeminiAPI(keySettings.geminiApiKey, tosText, question);
          removeTyping(typingId);
          appendMessage("ai", answer);
          return;
        } catch (err) {
          console.warn("FPW Chat: Gemini API failed, falling back to keywords.", err);
        }
      }

      // 4. Fallback: keyword matching
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

  // ─── Gemini API ───
  async function callGeminiAPI(apiKey, tosText, question) {
    const trimmedTos = tosText.substring(0, 6000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `You are "Fine Print Whisperer" — a Gen-Z, friendly AI that answers questions about Terms of Service and Privacy Policy documents.

Rules:
- ONLY answer based on the provided document text
- If the answer is NOT clearly in the document, honestly say "I couldn't find that in this document 🤷"
- Keep answers concise — 2-3 sentences MAX
- Use a casual, friendly Gen-Z tone with occasional emoji
- If you spot concerning clauses, flag them with ⚠️
- Never make up information that isn't in the document`
            }]
          },
          contents: [{
            parts: [{
              text: `Here is the Terms of Service / Privacy Policy text:\n\n---\n${trimmedTos}\n---\n\nQuestion: ${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300
          }
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error("Empty response from API");
    }

    return data.candidates[0].content.parts[0].text;
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
      return "I'm not sure about that one without AI 🤔\n\nAdd your free Gemini API key in ⚙️ Settings for smarter answers!\n\nOr try asking about: refunds, data sharing, cancellation, location tracking, or arbitration 💡";
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
