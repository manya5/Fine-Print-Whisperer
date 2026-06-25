(function() {
  "use strict";

  if (window !== window.top || window.fpwInjected) {
    return;
  }
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.onMessage) {
    return;
  }
  window.fpwInjected = true;

  const TOS_KEYWORDS = [
    "terms of service", "terms of use", "privacy policy", 
    "terms and conditions", "end user license agreement", 
    "eula", "user agreement"
  ];

  const FLAG_RULES = {
    data_selling: {
      words: [
        "sell your data", "sell your personal", "sell your information",
        "sell information", "sell data", "share your data", "share your personal",
        "share your information", "share information with third",
        "third-party partners", "third party partners", "third parties",
        "advertising partners", "data brokers", "marketing partners",
        "may disclose", "may share", "may sell", "we share",
        "we may provide", "shared with advertisers", "provided to third",
        "transfer your data", "transfer your information",
        "share with our partners", "disclosed to third",
        "data with partners", "information with partners",
        "data with advertisers", "information to advertisers"
      ],
      severity: "high",
      title: "Data Sharing / Selling",
      detail: "They might sell or share your personal info with other companies."
    },
    auto_renewal: {
      words: [
        "automatically renew", "auto-renew", "auto renew",
        "recurring charge", "recurring payment", "recurring billing",
        "unless you cancel", "until you cancel", "until cancelled",
        "billed automatically", "charged automatically",
        "subscription will renew", "subscription renews",
        "will automatically be charged", "continuous subscription",
        "automatic renewal", "automatic billing", "autopay",
        "will be renewed", "renew automatically", "recurring subscription",
        "will continue to charge", "will continue to bill"
      ],
      severity: "high",
      title: "Auto-Renewal",
      detail: "You will be charged automatically unless you remember to cancel."
    },
    arbitration: {
      words: [
        "binding arbitration", "mandatory arbitration",
        "waive your right", "waive the right", "waiving your right",
        "class action", "class-action", "class action waiver",
        "waiving jury trial", "waive jury", "jury trial waiver",
        "individual basis", "individual arbitration",
        "dispute resolution", "informal dispute",
        "agree to arbitrate", "arbitration agreement",
        "opt out of arbitration",
        "small claims court", "arbitration provision"
      ],
      severity: "medium",
      title: "Forced Arbitration",
      detail: "You give up your right to sue them in court or join a class action."
    },
    cancellation: {
      words: [
        "non-refundable", "nonrefundable", "no refund", "no refunds",
        "cancellation fee", "early termination fee",
        "written notice required", "30 days notice", "30-day notice",
        "cannot be refunded", "will not be refunded",
        "fees are not refundable", "not eligible for a refund",
        "no credits", "prorated", "forfeited",
        "cancellation penalty", "restocking fee",
        "all sales are final", "final sale"
      ],
      severity: "medium",
      title: "Strict Cancellation",
      detail: "Canceling is difficult, and you might not get your money back."
    },
    data_collection: {
      words: [
        "collect your personal", "collect information",
        "we collect", "we may collect", "information we collect",
        "data we collect", "collect data about",
        "device information", "usage data", "browsing history",
        "ip address", "cookies and similar", "tracking technologies",
        "analytics", "device identifiers", "location data",
        "biometric", "facial recognition", "fingerprint",
        "voice data", "microphone", "camera access"
      ],
      severity: "low",
      title: "Extensive Data Collection",
      detail: "They collect a wide range of personal data, including device/usage info."
    },
    content_rights: {
      words: [
        "grant us a license", "grant us a non-exclusive",
        "irrevocable license", "perpetual license",
        "worldwide license", "royalty-free license",
        "right to use your content", "right to your content",
        "you grant us", "license to use",
        "sublicense", "sub-license",
        "we may use your content", "we own",
        "intellectual property", "transfer of rights",
        "right to modify your content", "right to distribute"
      ],
      severity: "medium",
      title: "Content Rights Grab",
      detail: "They claim broad rights to use, modify, or distribute your content."
    },
    liability_limitation: {
      words: [
        "not liable", "no liability", "limitation of liability",
        "limited liability", "disclaim all", "disclaim any",
        "as is", "as-is", "without warranty", "no warranty",
        "at your own risk", "not responsible",
        "shall not be liable", "will not be liable",
        "under no circumstances", "in no event shall",
        "maximum extent permitted", "exclusion of liability"
      ],
      severity: "low",
      title: "Liability Shield",
      detail: "They limit how much they can be held responsible if something goes wrong."
    },
    terms_changes: {
      words: [
        "modify these terms", "change these terms",
        "update these terms", "amend these terms",
        "right to modify", "right to change", "right to update",
        "without notice", "without prior notice",
        "at any time", "at our discretion", "sole discretion",
        "continued use constitutes", "constitutes acceptance",
        "deemed to have accepted"
      ],
      severity: "medium",
      title: "Terms Can Change Anytime",
      detail: "They can change the rules whenever they want, sometimes without telling you."
    }
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "force_scan") {
      performScan(true).then(sendResponse).catch(() => sendResponse({ success: false, error: "error" }));
      return true; // async response
    }
    if (request.action === "get_tos_text") {
      const text = document.body.innerText || "";
      sendResponse({ text: text.substring(0, 8000) });
      return;
    }
  });

  async function init() {
    const settings = await chrome.storage.local.get("autoDetect");
    if (settings.autoDetect === false) return;

    if (isToSPage()) {
      chrome.runtime.sendMessage({ action: "badge_alert" });
      
      const text = document.body.innerText;
      if (text && text.trim().length > 0) {
        const scanResult = await runKeywordScan(text);
        if (scanResult.redFlags && scanResult.redFlags.length > 0) {
          injectBanner(scanResult);
          highlightKeywords();
        }
      }
    }
  }

  function isToSPage() {
    const title = document.title.toLowerCase();
    const url = window.location.href.toLowerCase();
    const firstChars = document.body.innerText.substring(0, 2000).toLowerCase();

    let matches = 0;
    for (const kw of TOS_KEYWORDS) {
      const dashed = kw.replace(/ /g, '-');
      const solid = kw.replace(/ /g, '');
      if (title.includes(kw)) matches++;
      if (url.includes(dashed) || url.includes(solid)) matches++;
      if (firstChars.includes(kw)) matches++;
      
      if (matches >= 2) return true;
    }
    return false;
  }

  async function performScan(force = false) {
    const text = document.body.innerText;
    if (!text || text.trim().length === 0) {
      return { success: false, error: "no_text" };
    }

    if (!force && !isToSPage()) {
      return { success: false, error: "not_tos" };
    }

    // Local regex scan. This is the offline / over-quota fallback path; the
    // popup uses the managed AI backend for full-quality scans on demand.
    const result = await runKeywordScan(text);

    if (result && result.redFlags && result.redFlags.length > 0) {
      highlightKeywords();
    }

    return { success: true, data: result, usedAI: false };
  }

  async function runKeywordScan(text) {
    const lowerText = text.toLowerCase();
    const redFlags = [];
    const tldr = [];
    let riskScore = 15; // Base score
    
    let foundCategories = new Set();

    for (const [category, rule] of Object.entries(FLAG_RULES)) {
      for (const word of rule.words) {
        if (lowerText.includes(word)) {
          if (!foundCategories.has(category)) {
            redFlags.push({
              title: rule.title,
              detail: rule.detail,
              severity: rule.severity,
              category: category
            });
            foundCategories.add(category);
            riskScore += (rule.severity === "high" ? 20 : rule.severity === "medium" ? 10 : 5);
            tldr.push(rule.detail);
          }
        }
      }
    }

    riskScore = Math.min(riskScore, 100);

    if (tldr.length === 0) {
      tldr.push("No major red flags detected.");
      tldr.push("Standard terms apply.");
      tldr.push("Stay safe online!");
    } else if (tldr.length === 1) {
      tldr.push("Review this flag carefully.");
      tldr.push("Otherwise looks standard.");
    } else if (tldr.length > 3) {
      tldr.length = 3; // Keep only top 3
    }

    return {
      tldr: tldr,
      riskScore: riskScore,
      redFlags: redFlags,
      greenFlags: riskScore < 30 ? ["Looks relatively safe", "Standard terms"] : []
    };
  }

  function injectBanner(scanResult) {
    if (document.getElementById("fpw-banner")) return;
    
    const banner = document.createElement("div");
    banner.id = "fpw-banner";
    
    let pillsHTML = "";
    scanResult.redFlags.forEach(flag => {
      let emoji = "⚠️";
      if (flag.category === "data_selling") emoji = "💸";
      if (flag.category === "auto_renewal") emoji = "💳";
      if (flag.category === "arbitration") emoji = "⚖️";
      if (flag.category === "cancellation") emoji = "🔒";
      if (flag.category === "data_collection") emoji = "🔍";
      if (flag.category === "content_rights") emoji = "📝";
      if (flag.category === "liability_limitation") emoji = "🛡️";
      if (flag.category === "terms_changes") emoji = "🔄";
      
      const sevClass = flag.severity === "high" ? "fpw-high" : flag.severity === "medium" ? "fpw-medium" : "fpw-low";
      pillsHTML += `<div class="fpw-pill ${sevClass}">${emoji} ${flag.title}</div>`;
    });

    banner.innerHTML = `
      <div class="fpw-banner-content">
        <div class="fpw-left">
          <div class="fpw-title">Fine Print Whisperer 👀</div>
          <div class="fpw-pills">${pillsHTML}</div>
        </div>
        <div class="fpw-actions">
          <button id="fpw-full-scan-btn" class="fpw-btn">Full Scan ✦</button>
          <button id="fpw-close-btn" class="fpw-close">✕</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("fpw-close-btn").addEventListener("click", () => {
      banner.remove();
    });

    document.getElementById("fpw-full-scan-btn").addEventListener("click", () => {
      alert("Click the Fine Print Whisperer extension icon top right in your toolbar to see the full scan dashboard! ✨");
    });
  }

  function highlightKeywords() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentNode && node.parentNode.nodeName !== 'SCRIPT' && node.parentNode.nodeName !== 'STYLE' && node.parentNode.nodeName !== 'MARK') {
        const text = node.nodeValue.toLowerCase();
        let shouldHighlight = false;
        let highestSev = "medium";
        
        for (const [category, rule] of Object.entries(FLAG_RULES)) {
          for (const word of rule.words) {
            if (text.includes(word)) {
              shouldHighlight = true;
              if (rule.severity === "high") highestSev = "high";
            }
          }
        }

        if (shouldHighlight && text.trim().length > 5 && text.trim().length < 500) {
          nodesToReplace.push({ node, sev: highestSev });
        }
      }
    }

    nodesToReplace.forEach(({node, sev}) => {
      for (const [category, rule] of Object.entries(FLAG_RULES)) {
        for (const word of rule.words) {
          const regex = new RegExp(`(${word})`, "gi");
          if (regex.test(node.nodeValue)) {
            const span = document.createElement("span");
            span.innerHTML = node.nodeValue.replace(regex, `<mark class="fpw-highlight fpw-${sev}">$1</mark>`);
            if (node.parentNode) {
              node.parentNode.replaceChild(span, node);
            }
            return; 
          }
        }
      }
    });
  }

  // Run on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
