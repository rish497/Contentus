const DEFAULT_API_BASE = "http://localhost:3000";

const titleEl = document.querySelector("#page-title");
const selectionEl = document.querySelector("#selection-preview");
const notesEl = document.querySelector("#notes");
const resultEl = document.querySelector("#result");
const apiBaseEl = document.querySelector("#api-base");

let pageContext = {
  title: "Unknown page",
  url: "",
  selection: "",
  visibleText: "",
  description: "",
  platform: "Web",
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  if (action === "save") return saveIdea(button);
  if (action === "sidepanel") return openSidePanel();
  if (action === "save-api-base") return saveApiBase(button);
  return runAiAction(action, button);
});

init();

async function init() {
  apiBaseEl.value = await getApiBase();
  pageContext = await getPageContext();
  titleEl.textContent = pageContext.title;
  selectionEl.textContent = pageContext.selection
    ? `"${pageContext.selection.slice(0, 150)}${pageContext.selection.length > 150 ? "..." : ""}"`
    : "Highlight text on the page to use Make It Mine or Authenticity Check.";
}

async function saveApiBase(button) {
  await withBusy(button, "Saving...", async () => {
    const nextBase = String(apiBaseEl.value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
    if (!/^https?:\/\/.+/i.test(nextBase)) throw new Error("Enter a valid Contentus URL, like https://your-app.onrender.com");
    await chrome.storage.local.set({ contentusApiBase: nextBase });
    showResult(`Contentus app URL saved:\n${nextBase}`);
  });
}

async function getPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let page = {};
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        selection: window.getSelection().toString(),
        visibleText: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 7000) || "",
        description: document.querySelector("meta[name='description']")?.content || "",
      }),
    });
    page = result.result || {};
  } catch {
    page = {};
  }

  const url = tab.url || "";
  return {
    title: tab.title || "Untitled page",
    url,
    selection: page.selection || "",
    visibleText: page.visibleText || "",
    description: page.description || "",
    platform: detectPlatform(url),
  };
}

async function runAiAction(task, button) {
  await withBusy(button, "Asking AI...", async () => {
    showResult("Asking Contentus AI...");
    const data = await apiJson("/api/ai/extension-helper", {
      method: "POST",
      body: { task, context: pageContext, notes: notesEl.value },
    });
    showResult(formatHelperResult(data));
  });
}

async function saveIdea(button) {
  await withBusy(button, "Saving...", async () => {
    const item = {
      id: `insp-${Date.now()}`,
      sourceTitle: pageContext.title,
      sourceUrl: pageContext.url,
      selectedText: pageContext.selection,
      notes: notesEl.value,
      platform: pageContext.platform,
      createdAt: new Date().toISOString(),
    };

    const { savedInspiration = [] } = await chrome.storage.local.get("savedInspiration");
    await chrome.storage.local.set({ savedInspiration: [item, ...savedInspiration].slice(0, 50) });
    await apiJson("/api/inspiration", {
      method: "POST",
      body: item,
      optional: true,
    });
    showResult("Saved to Contentus.\n\nUse this as inspiration, not copying.");
  });
}

async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId: tab.id });
  } else {
    showResult("Side panel API is not available in this Chrome version. Use the popup actions instead.");
  }
}

async function apiJson(path, options = {}) {
  const base = await getApiBase();
  try {
    const response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(data.message || data.error || `Contentus API failed with ${response.status}`);
    }
    return data;
  } catch (error) {
    if (options.optional) return null;
    throw new Error(`Could not reach Contentus at ${base}. ${error.message}`);
  }
}

async function getApiBase() {
  const stored = await chrome.storage.local.get({ contentusApiBase: DEFAULT_API_BASE });
  return String(stored.contentusApiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}

async function withBusy(button, label, task) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    await task();
  } catch (error) {
    showResult(error.message || "Contentus AI failed.");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function formatHelperResult(data = {}) {
  const lines = [];
  if (data.title) lines.push(data.title);
  if (data.summary) lines.push(data.summary);
  for (const section of data.sections || []) {
    lines.push(`${section.label || "Insight"}:\n${section.text || ""}`);
  }
  if (data.drafts?.length) {
    lines.push(`Drafts:\n${data.drafts.map((item, index) => `${index + 1}. ${item}`).join("\n")}`);
  }
  if (data.authenticityScore !== null && data.authenticityScore !== undefined) {
    lines.push(`Authenticity score: ${data.authenticityScore}`);
  }
  if (data.genericRisk) lines.push(`Generic risk: ${data.genericRisk}`);
  if (data.copyingWarning) lines.push(data.copyingWarning);
  return lines.filter(Boolean).join("\n\n") || "Contentus AI returned no usable text.";
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
