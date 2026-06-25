const titleEl = document.querySelector("#side-title");
const outputEl = document.querySelector("#side-output");

let context = {
  title: "Unknown page",
  url: "",
  selection: "",
  visibleText: "",
  description: "",
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "refresh") return refresh();
  if (button.dataset.action === "save") return save();
  if (button.dataset.action === "titles") return renderTitles();
  if (button.dataset.action === "description") return renderDescription();
  if (button.dataset.action === "followup") return renderFollowup();
  if (button.dataset.action === "mine") return renderMine();
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
        visibleText: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 5000) || "",
        description: document.querySelector("meta[name='description']")?.content || "",
      }),
    });
    page = result.result || {};
  } catch {
    page = {};
  }
  context = {
    title: tab.title || "Untitled page",
    url: tab.url || "",
    selection: page.selection || "",
    visibleText: page.visibleText || "",
    description: page.description || "",
  };
  titleEl.textContent = context.title;
  outputEl.innerHTML = `
    <article>
      <strong>Title breakdown</strong>
      <p>${context.title}</p>
    </article>
    <article>
      <strong>Hook guess</strong>
      <p>The page likely promises a useful outcome, strong curiosity gap, or recognizable problem.</p>
    </article>
    <article>
      <strong>Thumbnail or opening angle</strong>
      <p>Look for contrast: before/after, mistake/fix, chaos/system, or personal proof.</p>
    </article>
    <article>
      <strong>Copying warning</strong>
      <p>Use this as inspiration only. Build a version with your own story, audience, proof, and Creator DNA.</p>
    </article>
  `;
}

async function save() {
  const item = {
    id: `insp-${Date.now()}`,
    sourceTitle: context.title,
    sourceUrl: context.url,
    analysis: "Saved from side panel. Use as inspiration, not copying.",
    createdAt: new Date().toISOString(),
  };
  const { savedInspiration = [] } = await chrome.storage.local.get("savedInspiration");
  await chrome.storage.local.set({ savedInspiration: [item, ...savedInspiration].slice(0, 50) });
  append("Saved as inspiration", "This page is now in local extension storage.");
}

function renderFollowup() {
  append("Follow-up idea", "Make a version for your audience: test the idea with your own messy workflow, show proof, then explain what you would repeat or avoid.");
}

function renderMine() {
  append("Make it mine", "Rewrite the core angle around your Creator DNA: honest experiment, quick proof, useful takeaway, and a conversational CTA.");
}

function renderTitles() {
  const subject = cleanSubject(context.selection || context.description || context.title);
  append("Title suggestions", [
    `I Tested ${subject} So You Do Not Have To`,
    `The ${subject} Mistake Nobody Explains`,
    `Before You Copy ${subject}, Watch This`,
  ].join("\n"));
}

function renderDescription() {
  const subject = cleanSubject(context.selection || context.description || context.title);
  append("Description draft", `I break down ${subject} through my own creator workflow, with real proof, honest limitations, and a version my audience can actually use.\n\nUse this as inspiration, not copying.`);
}

function append(title, text) {
  outputEl.insertAdjacentHTML("afterbegin", `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanSubject(text = "") {
  const clean = text.replace(/\s+/g, " ").replace(/[^\w\s-]/g, "").trim();
  return clean.split(/\s+/).filter(Boolean).slice(0, 7).join(" ") || "This Idea";
}
