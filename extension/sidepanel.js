const DEFAULT_API_BASE = "http://localhost:3000";

const titleEl = document.querySelector("#side-title");
const outputEl = document.querySelector("#side-output");

let context = {
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
  if (action === "refresh") return refresh();
  if (action === "save") return save(button);
  return runAiAction(action, button);
});

refresh();

async function refresh() {
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
  context = {
    title: tab.title || "Untitled page",
    url,
    selection: page.selection || "",
    visibleText: page.visibleText || "",
    description: page.description || "",
    platform: detectPlatform(url),
  };
  titleEl.textContent = context.title;
  outputEl.innerHTML = `
    <article>
      <strong>${escapeHtml(context.platform)} context loaded</strong>
      <p>${escapeHtml(context.title)}</p>
    </article>
  `;
}

async function save(button) {
  await withBusy(button, "Saving...", async () => {
    const item = {
      id: `insp-${Date.now()}`,
      sourceTitle: context.title,
      sourceUrl: context.url,
      selectedText: context.selection,
      platform: context.platform,
      createdAt: new Date().toISOString(),
    };
    const { savedInspiration = [] } = await chrome.storage.local.get("savedInspiration");
    await chrome.storage.local.set({ savedInspiration: [item, ...savedInspiration].slice(0, 50) });
    await apiJson("/api/inspiration", { method: "POST", body: item, optional: true });
    append("Saved as inspiration", "Saved. Use this as inspiration, not copying.");
  });
}

async function runAiAction(task, button) {
  await withBusy(button, "Asking AI...", async () => {
    append("Contentus AI", "Thinking...");
    const data = await apiJson("/api/ai/extension-helper", {
      method: "POST",
      body: { task, context },
    });
    appendHelperResult(data);
  });
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
    if (!response.ok) throw new Error(data.message || data.error || `Contentus API failed with ${response.status}`);
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
    append("Contentus AI error", error.message || "The helper failed.");
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

function appendHelperResult(data = {}) {
  const pieces = [];
  if (data.summary) pieces.push(data.summary);
  for (const section of data.sections || []) {
    pieces.push(`${section.label || "Insight"}: ${section.text || ""}`);
  }
  if (data.drafts?.length) {
    pieces.push(data.drafts.map((item, index) => `${index + 1}. ${item}`).join("\n"));
  }
  if (data.authenticityScore !== null && data.authenticityScore !== undefined) {
    pieces.push(`Authenticity score: ${data.authenticityScore}`);
  }
  if (data.genericRisk) pieces.push(`Generic risk: ${data.genericRisk}`);
  if (data.copyingWarning) pieces.push(data.copyingWarning);
  append(data.title || "Contentus AI", pieces.filter(Boolean).join("\n\n") || "No usable AI output returned.");
}

function append(title, text) {
  outputEl.insertAdjacentHTML("afterbegin", `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`);
}

function detectPlatform(url = "") {
  if (url.includes("youtube.com")) return "YouTube";
  if (url.includes("tiktok.com")) return "TikTok";
  if (url.includes("instagram.com")) return "Instagram";
  if (url.includes("twitter.com") || url.includes("x.com")) return "X/Twitter";
  if (url.includes("docs.google.com")) return "Google Docs";
  return "Web";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
