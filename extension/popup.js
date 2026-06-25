const titleEl = document.querySelector("#page-title");
const selectionEl = document.querySelector("#selection-preview");
const notesEl = document.querySelector("#notes");
const resultEl = document.querySelector("#result");

let pageContext = {
  title: "Unknown page",
  url: "",
  selection: "",
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "save") return saveIdea();
  if (action === "analyze") return showResult(analyzeContent(pageContext));
  if (action === "mine") return showResult(makeItMine(pageContext.selection || pageContext.title));
  if (action === "guard") return showResult(checkAuthenticity(pageContext.selection || pageContext.title));
  if (action === "caption") return showResult(generateCaptions(pageContext.selection || pageContext.title));
  if (action === "sidepanel") return openSidePanel();
});

init();

async function init() {
  pageContext = await getPageContext();
  titleEl.textContent = pageContext.title;
  selectionEl.textContent = pageContext.selection
    ? `"${pageContext.selection.slice(0, 150)}${pageContext.selection.length > 150 ? "..." : ""}"`
    : "Highlight text on the page to use Make It Mine or Authenticity Check.";
}

async function getPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let selection = "";

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    selection = result.result || "";
  } catch {
    selection = "";
  }

  return {
    title: tab.title || "Untitled page",
    url: tab.url || "",
    selection,
  };
}

async function saveIdea() {
  const item = {
    id: `insp-${Date.now()}`,
    sourceTitle: pageContext.title,
    sourceUrl: pageContext.url,
    selectedText: pageContext.selection,
    notes: notesEl.value,
    platform: detectPlatform(pageContext.url),
    analysis: "Use this as inspiration, not copying. Rebuild the angle around your Creator DNA.",
    createdAt: new Date().toISOString(),
  };

  const { savedInspiration = [] } = await chrome.storage.local.get("savedInspiration");
  await chrome.storage.local.set({ savedInspiration: [item, ...savedInspiration].slice(0, 50) });
  showResult(`Saved to Contentus Idea Inbox.\n\n${item.analysis}`);
}

async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId: tab.id });
  } else {
    showResult("Side panel API is not available in this Chrome version. Use the popup actions instead.");
  }
}

function analyzeContent(context) {
  return [
    `Summary: ${context.title}`,
    "Hook analysis: The page likely leads with a clear problem or curiosity gap.",
    `Platform: ${detectPlatform(context.url)}`,
    "Audience angle: Turn the topic into a version for your own audience, proof, and niche.",
    "What works: Specific promise, easy entry point, and clear emotional angle.",
    "Originality warning: Use this as inspiration, not copying.",
  ].join("\n\n");
}

function makeItMine(text) {
  return [
    "Rewritten in Creator DNA voice:",
    `I tried this in my actual workflow, and the useful part was not the shiny claim. It was what it exposed about my process: ${text.slice(0, 120)}`,
    "Authenticity score: 88",
    "Generic risk: Low",
    "CTA: Want me to test this with my own audience next?",
  ].join("\n\n");
}

function checkAuthenticity(text) {
  const generic = /unlock|revolutionary|effortless|ultimate|guarantee/i.test(text);
  return [
    `Authenticity Score: ${generic ? 54 : 87}`,
    `What sounds like you: ${generic ? "Not enough yet." : "Specific, honest, and creator-led."}`,
    `What sounds generic: ${generic ? "Inflated promise language." : "Low generic risk."}`,
    "Suggested rewrite: Add one personal detail, remove broad claims, and keep the CTA conversational.",
  ].join("\n\n");
}

function generateCaptions(text) {
  return [
    `TikTok: POV: this idea looked simple until my actual workflow exposed the problem.`,
    `Instagram: I am using this as inspiration, not copying. Here is the version that fits my audience: ${text.slice(0, 80)}`,
    "YouTube title: I Tested This Creator Idea So You Do Not Have To",
    "LinkedIn: The best creator AI workflow protects voice first and output second.",
    "X thread: 1/ Fast content is useful only if it still sounds like you...",
  ].join("\n\n");
}

function detectPlatform(url = "") {
  if (url.includes("youtube.com")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X/Twitter";
  if (url.includes("docs.google.com")) return "Google Docs";
  return "Web";
}

function showResult(text) {
  resultEl.textContent = text;
}
