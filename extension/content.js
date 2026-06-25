(() => {
  if (window.__contentusHelperInjected) return;
  window.__contentusHelperInjected = true;

  const isYouTube = location.hostname.includes("youtube.com");
  const button = document.createElement("button");
  button.textContent = isYouTube ? "Contentus YouTube Helper" : "Save to Contentus";
  button.setAttribute("aria-label", "Open Contentus page helper");
  Object.assign(button.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    minHeight: "38px",
    padding: "0 12px",
    border: "1px solid rgba(94,232,242,.45)",
    borderRadius: "8px",
    background: "rgba(5,7,6,.88)",
    color: "#f5fbf8",
    font: "700 13px system-ui, sans-serif",
    boxShadow: "0 12px 34px rgba(0,0,0,.35)",
    cursor: "pointer",
  });

  const panel = document.createElement("aside");
  panel.hidden = true;
  panel.innerHTML = `
    <strong style="display:block;margin-bottom:6px;color:#5ee8f2;">Contentus</strong>
    <p style="margin:0 0 10px;color:#a5b5b1;line-height:1.35;">Use this as inspiration, not copying. Save the page, analyze the hook, or rewrite selected text in your Creator DNA voice from the extension popup.</p>
    <button type="button" style="width:100%;min-height:34px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(255,255,255,.08);color:#f5fbf8;cursor:pointer;">Close</button>
  `;
  Object.assign(panel.style, {
    position: "fixed",
    right: "16px",
    bottom: "64px",
    zIndex: "2147483647",
    width: "280px",
    padding: "12px",
    border: "1px solid rgba(255,255,255,.14)",
    borderRadius: "8px",
    background: "rgba(5,7,6,.94)",
    color: "#f5fbf8",
    font: "13px system-ui, sans-serif",
    boxShadow: "0 20px 58px rgba(0,0,0,.45)",
  });

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  panel.querySelector("button").addEventListener("click", () => {
    panel.hidden = true;
  });

  document.documentElement.append(button, panel);
})();
