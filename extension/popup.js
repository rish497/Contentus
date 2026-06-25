const titleEl = document.querySelector("#page-title");
const selectionEl = document.querySelector("#selection-preview");
const notesEl = document.querySelector("#notes");
const resultEl = document.querySelector("#result");

let pageContext = {
  title: "Unknown page",
  url: "",
  selection: "",
  visibleText: "",
  description: "",
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "save") return saveIdea();
  if (action === "analyze") return showResult(analyzeContent(pageContext));
  if (action === "titles") return showResult(suggestTitles(pageContext));
  if (action === "description") return showResult(generateDescription(pageContext));
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
  let visibleText = "";
  let description = "";

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        selection: window.getSelection().toString(),
        visibleText: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 5000) || "",
        description: document.querySelector("meta[name='description']")?.content || "",
      }),
    });
    selection = result.result?.selection || "";
    visibleText = result.result?.visibleText || "";
    description = result.result?.description || "";
  } catch {
    selection = "";
  }

  return {
    title: tab.title || "Untitled page",
    url: tab.url || "",
    selection,
    visibleText,
    description,
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
  const subject = context.selection || context.description || context.title;
  return [
    `Summary: ${context.title}`,
    `Hook analysis: ${hookGuess(subject)}`,
    `Platform: ${detectPlatform(context.url)}`,
    "Audience angle: Turn the topic into a version for your own audience, proof, and niche.",
    "What works: Specific promise, easy entry point, and clear emotional angle.",
    "Originality warning: Use this as inspiration, not copying.",
  ].join("\n\n");
}

function suggestTitles(context) {
  const subject = cleanSubject(context.selection || context.description || context.title);
  return [
    "Title suggestions:",
    `1. I Tested ${subject} So You Do Not Have To`,
    `2. The ${subject} Mistake Nobody Explains`,
    `3. I Tried ${subject} With My Real Workflow`,
    `4. Before You Copy ${subject}, Watch This`,
    "",
    "Use this as inspiration, not copying. Add your own proof or story before publishing.",
  ].join("\n");
}

function generateDescription(context) {
  const subject = cleanSubject(context.selection || context.description || context.title);
  return [
    "YouTube description draft:",
    `In this video, I break down ${subject} through my own creator workflow instead of copying someone else's angle. I show what works, what I would change, and how to turn the idea into something useful for my audience.`,
    "",
    "CTA: Comment with the part you want me to test next.",
    "Disclosure: Brainstormed with AI support; final story and edits should be yours.",
  ].join("\n");
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

function cleanSubject(text = "") {
  const clean = text.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
  return words || "This Idea";
}

function hookGuess(text = "") {
  if (/\?|how|why|mistake|secret|best|worst/i.test(text)) return "The page uses curiosity or a problem-led angle.";
  if (/review|tested|try|experiment/i.test(text)) return "The page likely works because it promises proof through a test.";
  return "The page can be reframed as a personal experiment, a useful breakdown, or a before/after.";
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
