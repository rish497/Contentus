const titleEl = document.querySelector("#side-title");
const outputEl = document.querySelector("#side-output");

let context = {
  title: "Unknown page",
  url: "",
};

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "refresh") return refresh();
  if (button.dataset.action === "save") return save();
  if (button.dataset.action === "followup") return renderFollowup();
  if (button.dataset.action === "mine") return renderMine();
});

refresh();

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  context = {
    title: tab.title || "Untitled page",
    url: tab.url || "",
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

function append(title, text) {
  outputEl.insertAdjacentHTML("afterbegin", `<article><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></article>`);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
