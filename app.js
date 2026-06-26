document.documentElement.classList.add("has-js");

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
const canvas = document.querySelector("#motion-bg");

const STORAGE_KEY = "contentus-workspace-state";
const AUTH_KEY = "contentus-auth-session";

const defaultState = {
  workspaceVersion: 4,
  authed: false,
  youtubeConnected: false,
  creator: {
    name: "",
    creatorName: "",
    niche: "",
    audience: "",
    platforms: [],
    tone: [],
    values: "",
    boundaries: "",
    topicsLoved: "",
    topicsAvoided: "",
  },
  dna: null,
  ideas: [],
  scripts: [],
  thumbnails: [],
  calendar: [],
  inspiration: [],
  youtube: null,
  comments: [],
  growthInsights: [],
  google: null,
  googleCalendarEvents: [],
  selectedVideoId: "",
  scriptChats: [],
  activeScriptChatId: "",
  scriptAssistantOpen: true,
  scriptCredibilityReport: null,
  thumbnailChats: [],
  activeThumbnailChatId: "",
  thumbnailSelection: null,
  trendReports: [],
  videoChecks: [],
  detailedVideoReports: [],
  publishingJobs: [],
  coachChats: [],
  calendarViewDate: "",
  selectedCalendarDate: "",
};

const analytics = {
  channel: "",
  subscribers: 0,
  summary: {
    averageViews: 0,
    watchTime: "0 hrs",
    retention: "0%",
    ctr: "0%",
    engagement: "0%",
    growth: "0",
  },
  views: [],
  videos: [],
};

const comments = [];

let state = loadState();
let activeRoute = normalizeRoute(location.hash);
let authSession = loadSession();
let appConfig = {
  integrations: {
    supabase: false,
    gemini: false,
    googleOAuth: false,
    youtubeData: false,
    firebase: false,
    sessionSecret: false,
  },
  authProvider: "not-configured",
  aiProvider: "not-configured",
};
let saveTimer = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? mergeState(defaultState, saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeState(base, saved) {
  const cleanBase = structuredClone(base);
  const isLegacyDemo = saved.workspaceVersion !== cleanBase.workspaceVersion;
  const merged = {
    ...cleanBase,
    ...saved,
    workspaceVersion: cleanBase.workspaceVersion,
    creator: { ...cleanBase.creator, ...(saved.creator || {}) },
    dna: isLegacyDemo ? null : (saved.dna || null),
    ideas: isLegacyDemo ? [] : (Array.isArray(saved.ideas) ? saved.ideas : cleanBase.ideas),
    scripts: isLegacyDemo ? [] : (Array.isArray(saved.scripts) ? saved.scripts : cleanBase.scripts),
    thumbnails: isLegacyDemo ? [] : (Array.isArray(saved.thumbnails) ? saved.thumbnails : cleanBase.thumbnails),
    calendar: isLegacyDemo ? [] : (Array.isArray(saved.calendar) ? saved.calendar : cleanBase.calendar),
    inspiration: isLegacyDemo ? [] : (Array.isArray(saved.inspiration) ? saved.inspiration : cleanBase.inspiration),
    youtube: isLegacyDemo ? null : (saved.youtube || null),
    comments: isLegacyDemo ? [] : (Array.isArray(saved.comments) ? saved.comments : cleanBase.comments),
    growthInsights: isLegacyDemo ? [] : (Array.isArray(saved.growthInsights) ? saved.growthInsights : cleanBase.growthInsights),
    google: isLegacyDemo ? null : (saved.google || null),
    googleCalendarEvents: isLegacyDemo ? [] : (Array.isArray(saved.googleCalendarEvents) ? saved.googleCalendarEvents : cleanBase.googleCalendarEvents),
    selectedVideoId: isLegacyDemo ? "" : (saved.selectedVideoId || ""),
    scriptChats: isLegacyDemo ? [] : (Array.isArray(saved.scriptChats) ? saved.scriptChats : cleanBase.scriptChats),
    activeScriptChatId: isLegacyDemo ? "" : (saved.activeScriptChatId || ""),
    scriptAssistantOpen: saved.scriptAssistantOpen !== false,
    scriptCredibilityReport: isLegacyDemo ? null : (saved.scriptCredibilityReport || null),
    thumbnailChats: isLegacyDemo ? [] : (Array.isArray(saved.thumbnailChats) ? saved.thumbnailChats : cleanBase.thumbnailChats),
    activeThumbnailChatId: isLegacyDemo ? "" : (saved.activeThumbnailChatId || ""),
    thumbnailSelection: isLegacyDemo ? null : (saved.thumbnailSelection || null),
    trendReports: isLegacyDemo ? [] : (Array.isArray(saved.trendReports) ? saved.trendReports : cleanBase.trendReports),
    videoChecks: isLegacyDemo ? [] : (Array.isArray(saved.videoChecks) ? saved.videoChecks : cleanBase.videoChecks),
    detailedVideoReports: isLegacyDemo ? [] : (Array.isArray(saved.detailedVideoReports) ? saved.detailedVideoReports : cleanBase.detailedVideoReports),
    publishingJobs: isLegacyDemo ? [] : (Array.isArray(saved.publishingJobs) ? saved.publishingJobs : cleanBase.publishingJobs),
    coachChats: isLegacyDemo ? [] : (Array.isArray(saved.coachChats) ? saved.coachChats : cleanBase.coachChats),
    calendarViewDate: isLegacyDemo ? "" : (saved.calendarViewDate || ""),
    selectedCalendarDate: isLegacyDemo ? "" : (saved.selectedCalendarDate || ""),
  };

  if (isLegacyDemo) {
    merged.creator.name = "";
    merged.creator.creatorName = "";
    merged.creator.niche = "";
    merged.creator.audience = "";
    merged.creator.platforms = [];
    merged.creator.tone = [];
    merged.creator.values = "";
    merged.creator.boundaries = "";
    merged.creator.topicsLoved = "";
    merged.creator.topicsAvoided = "";
    merged.youtubeConnected = false;
  }

  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemoteStateSave();
}

function saveStateLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(session) {
  authSession = session;
  if (session?.access_token) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
}

function persistableState() {
  const { authed, ...content } = state;
  return content;
}

function scheduleRemoteStateSave() {
  if (!authSession?.access_token) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveRemoteState().catch(() => {});
  }, 700);
}

async function saveRemoteState() {
  if (!authSession?.access_token) return;
  const result = await apiJson("/api/user/state", {
    method: "PUT",
    auth: true,
    body: { contentusState: persistableState() },
  });
  if (!result.ok && result.status === 401) {
    await tryRefreshSession();
  }
}

async function apiJson(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.auth && authSession?.access_token) {
    headers.Authorization = `Bearer ${authSession.access_token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: response.ok, status: response.status, data };
}

async function loadAppConfig() {
  try {
    const result = await apiJson("/api/config");
    if (result.ok) appConfig = result.data;
  } catch {
    appConfig.authProvider = "file-or-static";
  }
}

async function initAuth() {
  if (!authSession?.access_token) {
    state.authed = false;
    saveStateLocalOnly();
    return;
  }

  let result = await apiJson("/api/user/state", { auth: true });
  if (!result.ok && result.status === 401) {
    const refreshed = await tryRefreshSession();
    if (refreshed) result = await apiJson("/api/user/state", { auth: true });
  }

  if (result.ok) {
    const remoteState = result.data.contentusState;
    if (remoteState) state = mergeState(defaultState, remoteState);
    state.authed = true;
    const user = result.data.user;
    if (user?.email) state.creator.email = user.email;
    if (user?.user_metadata?.name) state.creator.creatorName = user.user_metadata.name;
    if (user?.user_metadata?.google_oauth) state.google = googlePublicClientState(user.user_metadata.google_oauth);
    saveStateLocalOnly();
  } else {
    saveSession(null);
    state.authed = false;
    saveStateLocalOnly();
  }
}

async function tryRefreshSession() {
  if (!authSession?.refresh_token) return false;
  try {
    const result = await apiJson("/api/auth/refresh", {
      method: "POST",
      body: { refresh_token: authSession.refresh_token },
    });
    if (result.ok && result.data.access_token) {
      saveSession(result.data);
      return true;
    }
  } catch {
    // Keep the caller on the normal unauthenticated path.
  }
  saveSession(null);
  return false;
}

function normalizeRoute(hash) {
  const clean = (hash || "#/").replace(/^#/, "") || "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function creatorDisplayName() {
  return state.creator.creatorName || state.creator.email || "Creator";
}

function moneylessApiNote() {
  return "Demo mode uses deterministic local AI. Add Gemini, Supabase, and Google keys later for real integrations.";
}

function dnaLogo(label = true) {
  return `
    <span class="brand">
      <span class="dna-logo" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <path d="M14 7c10 0 20 8 20 17S24 41 14 41" />
          <path d="M34 7c-10 0-20 8-20 17s10 17 20 17" />
          <path d="M17 14h14M14 24h20M17 34h14" />
        </svg>
      </span>
      ${label ? `<span class="brand-text"><span>Contentus</span><small>Creator DNA OS</small></span>` : ""}
    </span>
  `;
}

function icon(name) {
  const paths = {
    dashboard: "M5 22V10l7-5 7 5v12h-5v-7h-4v7H5Z",
    dna: "M8 4c8 0 16 6 16 14S16 32 8 32M24 4C16 4 8 10 8 18s8 14 16 14M11 10h10M8 18h16M11 26h10",
    spark: "M16 3l2.5 7.5L26 13l-7.5 2.5L16 23l-2.5-7.5L6 13l7.5-2.5L16 3Z",
    script: "M8 4h12l4 4v20H8V4ZM20 4v6h6M12 14h10M12 19h10M12 24h7",
    film: "M5 7h22v18H5V7ZM10 7v18M22 7v18M5 13h22M5 19h22",
    guard: "M16 3l11 5v8c0 7-4.5 12-11 14C9.5 28 5 23 5 16V8l11-5Z",
    chart: "M5 26h22M8 22V12M16 22V6M24 22v-8",
    calendar: "M7 7h20v21H7V7ZM11 4v6M23 4v6M7 13h20",
    settings: "M16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM16 3v4M16 25v4M4 16h4M24 16h4M7.5 7.5l2.8 2.8M21.7 21.7l2.8 2.8M24.5 7.5l-2.8 2.8M10.3 21.7l-2.8 2.8",
    menu: "M5 9h22M5 16h22M5 23h22",
    copy: "M9 9h14v18H9V9ZM5 5h14v4",
    plus: "M16 6v20M6 16h20",
  };
  return `<svg class="topbar-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="${paths[name] || paths.spark}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  toastRegion.appendChild(node);
  window.setTimeout(() => node.remove(), 3400);
}

function routeTo(path) {
  location.hash = path;
}

window.addEventListener("hashchange", () => {
  activeRoute = normalizeRoute(location.hash);
  render();
});

document.addEventListener("click", async (event) => {
  const routeEl = event.target.closest("[data-route]");
  if (routeEl) {
    event.preventDefault();
    routeTo(routeEl.dataset.route);
    closeMobileSidebar();
    return;
  }

  const actionEl = event.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;
  if (action === "mobile-menu") {
    document.querySelector(".sidebar")?.classList.toggle("is-open");
    return;
  }
  if (action === "login") return handleLogin(actionEl);
  if (action === "signup") return handleSignup(actionEl);
  if (action === "logout") return handleLogout();
  if (action === "generate-dna") return handleGenerateDna(actionEl);
  if (action === "save-dna") return handleSaveDna();
  if (action === "generate-ideas") return handleGenerateIdeas(actionEl);
  if (action === "use-idea") return handleUseIdea(actionEl.dataset.ideaId);
  if (action === "generate-script") return handleGenerateScript(actionEl);
  if (action === "transform-script") return handleTransformScript(actionEl.dataset.transform);
  if (action === "generate-ad") return handleGenerateAd(actionEl);
  if (action === "repurpose") return handleRepurpose(actionEl);
  if (action === "score-auth") return handleScoreAuthenticity(actionEl);
  if (action === "rights-check") return handleRightsCheck(actionEl);
  if (action === "disclosure") return handleDisclosure(actionEl);
  if (action === "connect-youtube") return handleConnectYouTube(actionEl);
  if (action === "weekly-plan") return handleWeeklyPlan(actionEl);
  if (action === "copy") return copyText(actionEl.dataset.copy || "");
  if (action === "save-calendar") return handleSaveCalendar();
  if (action === "toggle-pill") return actionEl.classList.toggle("active");
});

document.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-calendar-id]");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.calendarId);
});

document.addEventListener("dragover", (event) => {
  const day = event.target.closest("[data-day]");
  if (!day) return;
  event.preventDefault();
  day.classList.add("drop-target");
});

document.addEventListener("dragleave", (event) => {
  event.target.closest("[data-day]")?.classList.remove("drop-target");
});

document.addEventListener("drop", (event) => {
  const day = event.target.closest("[data-day]");
  if (!day) return;
  event.preventDefault();
  day.classList.remove("drop-target");
  const id = event.dataTransfer.getData("text/plain");
  const item = state.calendar.find((entry) => entry.id === id);
  if (item) {
    item.day = Number(day.dataset.day);
    saveState();
    render();
    toast("Calendar item moved.");
  }
});

let thumbnailDragStart = null;

document.addEventListener("pointerdown", (event) => {
  const canvasNode = event.target.closest?.("#thumbnail-canvas");
  if (!canvasNode || activeRoute !== "/app/thumbnail") return;
  const rect = canvasNode.getBoundingClientRect();
  thumbnailDragStart = {
    x: ((event.clientX - rect.left) / rect.width) * canvasNode.width,
    y: ((event.clientY - rect.top) / rect.height) * canvasNode.height,
  };
});

document.addEventListener("pointerup", (event) => {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!thumbnailDragStart || !canvasNode || activeRoute !== "/app/thumbnail") return;
  const rect = canvasNode.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvasNode.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvasNode.height;
  state.thumbnailSelection = {
    x: Math.round(Math.min(thumbnailDragStart.x, x)),
    y: Math.round(Math.min(thumbnailDragStart.y, y)),
    w: Math.round(Math.abs(x - thumbnailDragStart.x)),
    h: Math.round(Math.abs(y - thumbnailDragStart.y)),
  };
  thumbnailDragStart = null;
  redrawActiveThumbnail();
  saveState();
  toast("Area selected for thumbnail edits.");
});

function closeMobileSidebar() {
  document.querySelector(".sidebar")?.classList.remove("is-open");
}

function render() {
  if (activeRoute === "/" || activeRoute === "/landing" || ["/features", "/workflow", "/chrome-helper"].includes(activeRoute)) {
    app.className = "app-root";
    app.innerHTML = landingViewV4();
    bindHeroTilt();
    if (activeRoute !== "/" && activeRoute !== "/landing") {
      requestAnimationFrame(() => document.querySelector(`#${activeRoute.slice(1)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    return;
  }

  if (activeRoute === "/login") {
    app.className = "app-root";
    app.innerHTML = authViewV4();
    return;
  }

  if (!state.authed && activeRoute.startsWith("/app")) {
    app.className = "app-root";
    app.innerHTML = authViewV4();
    setAuthNote("Sign in or create an account to save and load your Contentus workspace.");
    return;
  }

  app.className = "app-root";
  app.innerHTML = appShellV4(activeRoute);
  if (activeRoute === "/app/thumbnail") requestAnimationFrame(redrawActiveThumbnail);
}

function landingView() {
  return `
    <section class="landing-shell">
      <header class="landing-header">
        <a href="#/" aria-label="Contentus home">${dnaLogo()}</a>
        <nav class="landing-nav" aria-label="Landing navigation">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#extension">Extension</a>
          ${state.authed ? `<a href="#/app/dashboard">Dashboard</a><button class="button ghost" data-action="logout" type="button">Sign out</button>` : `<a href="#/login">Sign in</a>`}
          <a class="button primary" href="${state.authed ? "#/app/dashboard" : "#/login"}">${state.authed ? "Open app" : "Start free"}</a>
        </nav>
      </header>

      <section class="landing-hero">
        <div class="hero-backdrop" aria-hidden="true">
          <div class="signal-card signal-card-one">
            <span>Creator DNA</span>
            <strong>${state.dna.score}%</strong>
            <small>Voice profile locked</small>
          </div>
          <div class="signal-card signal-card-two">
            <span>Authenticity Guard</span>
            <strong>87</strong>
            <small>Strong match</small>
          </div>
          <div class="signal-card signal-card-three">
            <span>Next move</span>
            <strong>5</strong>
            <small>Ideas ready</small>
          </div>
        </div>
        <div class="hero-inner hero-inner-premium">
          <div class="hero-copy">
            <p class="eyebrow">Create 10x faster without losing what makes you, you.</p>
            <h1>Build faster. Stay unmistakably you.</h1>
            <p class="hero-lede">
              Contentus learns your voice, protects your originality, and turns ideas into scripts,
              posts, ads, short films, analytics decisions, and calendar plans with Creator DNA baked in.
            </p>
            <div class="hero-actions">
              <a class="button primary" href="${state.authed ? "#/app/dashboard" : "#/login"}">${state.authed ? "Open your studio" : "Create your account"}</a>
              <a class="button secondary" href="#features">See the system</a>
            </div>
            <div class="hero-proof">
              <span class="chip">Supabase auth</span>
              <span class="chip">Saved creator state</span>
              <span class="chip">Gemini-ready AI routes</span>
              <span class="chip">Chrome extension</span>
            </div>
          </div>
        </div>
        <div class="hero-dashboard-preview" aria-label="Contentus product preview">
          <div class="preview-topbar">
            <span class="live-dot"></span>
            <strong>Contentus studio</strong>
            <span>Live creator loop</span>
          </div>
          <div class="preview-grid">
            <div class="preview-panel span-2">
              <small>Idea Engine</small>
              <strong>I let AI audit my study week</strong>
              <p>Generic risk: low | Personal proof required | CTA ready</p>
            </div>
            <div class="preview-panel">
              <small>Voice match</small>
              <strong>91%</strong>
              <p>Funny, direct, useful.</p>
            </div>
            <div class="preview-panel">
              <small>Disclosure</small>
              <strong>AI-assisted</strong>
              <p>Clear and audience-safe.</p>
            </div>
            <div class="preview-panel span-2">
              <small>Growth Coach</small>
              <strong>Shorten intros by 12 seconds</strong>
              <p>Videos with personal experiments get higher comments and retention.</p>
            </div>
          </div>
        </div>
        <a class="scroll-cue-new" href="#features">Scroll for the system</a>
      </section>

      <section class="landing-section" id="features">
        <div class="section-split">
          <div>
            <p class="section-kicker">The difference</p>
            <h2>Most AI tools generate content. Contentus protects the creator inside it.</h2>
          </div>
          <p class="section-copy">
            Every generator in the app returns an Authenticity Score, Generic AI Risk, Personalization Tip,
            and disclosure guidance so your output scales without becoming bland, copied, or unsafe.
          </p>
        </div>
        <div class="feature-grid premium-grid">
          ${featureCard("Creator DNA", "Your tone, humor, themes, pacing, boundaries, phrases, and audience memory become the core product layer.")}
          ${featureCard("Authenticity Guard", "Every output gets voice match, generic risk, originality, disclosure, and brand safety scoring.")}
          ${featureCard("Growth Coach", "Mock YouTube analytics explain what worked, what failed, and what to create next.")}
          ${featureCard("Rights Shield", "Creator-friendly checks for copyright, AI disclosure, likeness consent, and risky brand claims.")}
        </div>
      </section>

      <section class="landing-section" id="workflow">
        <div class="pitch-panel glass-panel">
          <p class="section-kicker">Final pitch</p>
          <h2>AI will not replace creators. Creators with their own AI twin will replace those without one.</h2>
          <p class="section-copy">
            Contentus is your personal AI co-creator that learns your voice, protects your originality,
            and helps you grow across platforms. It helps creators brainstorm, script, repurpose,
            analyze, and publish content faster without becoming generic.
          </p>
        </div>
        <div class="landing-grid dashboard-grid workflow-cards">
          ${workflowCard("01", "Train DNA", "Paste old captions, scripts, and transcripts. Contentus turns them into a usable voice profile.")}
          ${workflowCard("02", "Generate", "Create ideas, scripts, ads, short films, captions, and platform variants with your DNA on.")}
          ${workflowCard("03", "Guard", "Score and rewrite drafts so they sound more personal and less generic before publishing.")}
          ${workflowCard("04", "Loop", "Use analytics, comments, and saved inspiration to decide the next five creator moves.")}
        </div>
      </section>

      <section class="landing-section" id="extension">
        <div class="extension-layout">
          <div class="extension-preview">
            <div class="mini-window-bar"><span></span><span></span><span></span></div>
            <div class="extension-body">
              <p class="section-kicker">Chrome extension</p>
              <h2>Save inspiration without copying.</h2>
              <p class="muted">Capture page title, URL, selected text, notes, and analysis while browsing. The extension always frames external content as inspiration.</p>
            </div>
          </div>
          <div class="glass-panel dashboard-card">
            <h3>Extension actions</h3>
            <div class="list-stack">
              ${insight("Save to Contentus", "Add selected text and page context to the dashboard Idea Inbox.")}
              ${insight("Analyze Content", "Summarize hooks, title angle, audience fit, and originality risk.")}
              ${insight("Make It Mine", "Rewrite highlighted text in Creator DNA voice with a warning against copying.")}
              ${insight("Check Authenticity", "Score a selected draft before publishing.")}
            </div>
          </div>
        </div>
      </section>

      <footer class="app-footer">
        ${dnaLogo()} <span>Prototype app, mock APIs, and extension scaffold included.</span>
      </footer>
    </section>
  `;
}

function featureCard(title, text) {
  return `<article class="feature glass-panel"><strong>${escapeHtml(title)}</strong><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`;
}

function workflowCard(step, title, text) {
  return `<article class="dashboard-card"><span class="badge">${step}</span><h3>${escapeHtml(title)}</h3><p class="muted">${escapeHtml(text)}</p></article>`;
}

function bindHeroTilt() {
  const reactive = document.querySelector(".hero-reactive");
  if (reactive) {
    document.addEventListener("pointermove", (event) => {
      const rect = reactive.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
      reactive.style.setProperty("--mx", `${x}%`);
      reactive.style.setProperty("--my", `${y}%`);
    }, { passive: true });
    return;
  }

  const stack = document.querySelector(".product-stack");
  if (!stack) return;
  document.addEventListener("pointermove", (event) => {
    const rect = stack.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    stack.style.setProperty("--tilt-x", `${Math.max(-6, Math.min(6, x * 10))}deg`);
    stack.style.setProperty("--tilt-y", `${Math.max(-5, Math.min(5, -y * 8))}deg`);
  }, { passive: true });
}

function authView() {
  return `
    <section class="auth-layout">
      <div class="auth-copy">
        <a href="#/">${dnaLogo()}</a>
        <p class="eyebrow">Real account storage</p>
        <h1>Sign in and keep your creator brain intact.</h1>
        <p class="hero-lede">
          Contentus now uses Supabase Auth when your .env keys are present. Your Creator DNA,
          ideas, scripts, calendar, and saved inspiration are saved to your user profile so they come
          back with you.
        </p>
        <div class="hero-proof">
          <span class="chip">${appConfig.integrations.supabase ? "Supabase connected" : "Supabase not configured"}</span>
          <span class="chip">${appConfig.integrations.gemini ? "Gemini key detected" : "Gemini key needed"}</span>
          <span class="chip">${appConfig.integrations.youtubeData ? "YouTube key detected" : "Mock YouTube data"}</span>
        </div>
      </div>
      <form class="auth-card" id="login-form">
        <h2>Welcome to Contentus</h2>
        <p class="muted">${authStatusNote()}</p>
        <div class="auth-choice-note">
          <p><strong>New here?</strong> Fill the form and choose <span>Create account</span>.</p>
          <p><strong>Already saved data?</strong> Use <span>Sign in</span> to restore it.</p>
        </div>
        <div class="form-field">
          <label for="login-name">Creator name <span>optional</span></label>
          <input id="login-name" placeholder="Your creator or channel name" autocomplete="name">
        </div>
        <div class="form-field">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" placeholder="creator@example.com" autocomplete="email">
        </div>
        <div class="form-field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" placeholder="At least 6 characters" autocomplete="current-password">
        </div>
        <div class="action-row">
          <button class="button primary" type="button" data-action="login">Sign in</button>
          <button class="button secondary" type="button" data-action="signup">Create account</button>
          <a class="button secondary" href="#/">Back</a>
        </div>
        <p class="form-note" id="auth-note">Your workspace syncs after sign in. If email confirmation is enabled, confirm your email once before signing in.</p>
      </form>
    </section>
  `;
}

function authStatusNote() {
  if (appConfig.integrations.supabase) {
    return "Supabase is configured. Sign up or sign in to persist your Contentus data.";
  }
  return "Supabase is not configured yet, so the app will stay in local demo mode.";
}

function appShell(route) {
  const page = pageForRoute(route);
  return `
    <section class="app-shell">
      <aside class="sidebar">
        <a href="#/app/dashboard">${dnaLogo()}</a>
        <nav class="sidebar-nav" aria-label="App navigation" data-tour-target="sidebar">
          ${navLink("/app/dashboard", "dashboard", "Dashboard")}
          ${navLink("/app/dna", "dna", "Creator DNA")}
          ${navLink("/app/ideas", "spark", "Idea Engine")}
          ${navLink("/app/scripts", "script", "Script Builder")}
          ${navLink("/app/ad-studio", "film", "Ad & Short Film Studio")}
          ${navLink("/app/repurpose", "spark", "Repurpose Machine")}
          ${navLink("/app/authenticity", "guard", "Authenticity Guard")}
          ${navLink("/app/growth", "chart", "Growth Coach")}
          ${navLink("/app/youtube", "chart", "YouTube Analytics")}
          ${navLink("/app/community", "spark", "Community Manager")}
          ${navLink("/app/rights", "guard", "Rights Shield")}
          ${navLink("/app/disclosure", "guard", "AI Disclosure")}
          ${navLink("/app/calendar", "calendar", "Content Calendar")}
          ${navLink("/app/extension", "spark", "Chrome Extension")}
          ${navLink("/app/settings", "settings", "Settings")}
        </nav>
        <div class="sidebar-foot">
          <strong>${state.authed ? "Signed in" : "Local mode"}</strong>
          <p>${state.authed ? "Your Creator DNA, ideas, scripts, and calendar sync to Supabase." : "Sign in to save your creator data across devices."}</p>
          <button class="button secondary" data-action="logout" type="button">${state.authed ? "Sign out" : "Back to landing"}</button>
        </div>
      </aside>

      <section class="app-main">
        <header class="app-topbar">
          <div class="topbar-left">
            <button class="icon-button mobile-menu" data-action="mobile-menu" type="button" aria-label="Open menu">${icon("menu")}</button>
            <div class="topbar-title">
              <h1>${escapeHtml(page.title)}</h1>
              <p>${escapeHtml(page.subtitle)}</p>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="badge ${state.youtubeConnected ? "good" : "warn"}">${state.youtubeConnected ? "YouTube connected" : "Demo analytics"}</span>
            <a class="button primary" href="#/app/ideas">Generate idea</a>
          </div>
        </header>
        <div class="app-content">${page.html}</div>
        <footer class="app-footer">Contentus prototype. Creator trust, originality, and disclosure-first AI.</footer>
      </section>
    </section>
  `;
}

function navLink(path, iconName, label) {
  return `<a class="sidebar-link ${activeRoute === path ? "active" : ""}" href="#${path}" data-route="${path}">${icon(iconName)}<span>${label}</span></a>`;
}

function pageForRoute(route) {
  const pages = {
    "/app/dashboard": { title: "Home Dashboard", subtitle: "Your creator operating system at a glance.", html: dashboardPage() },
    "/app/dna": { title: "Creator DNA Profile", subtitle: "Build the voice profile every AI output must respect.", html: dnaPage() },
    "/app/ideas": { title: "AI Idea Engine", subtitle: "Generate original, platform-fit ideas with authenticity scoring.", html: ideasPage() },
    "/app/scripts": { title: "Script and Story Builder", subtitle: "Turn ideas into scripts, scenes, shots, captions, and CTAs.", html: scriptsPage() },
    "/app/ad-studio": { title: "AI Ad and Short Film Studio", subtitle: "Build ethical ads, trailers, short films, and visual prompts.", html: adStudioPage() },
    "/app/repurpose": { title: "Repurpose Machine", subtitle: "Turn one piece of content into many platform-native formats.", html: repurposePage() },
    "/app/authenticity": { title: "Authenticity Guard", subtitle: "Check whether content still sounds like you.", html: authenticityPage() },
    "/app/growth": { title: "Growth Coach", subtitle: "Use analytics and audience signals to choose better next moves.", html: growthPage() },
    "/app/youtube": { title: "YouTube Analytics", subtitle: "Mock channel analytics with real integration-ready structure.", html: youtubePage() },
    "/app/community": { title: "Community Manager", subtitle: "Analyze comments and draft replies without auto-posting.", html: communityPage() },
    "/app/rights": { title: "Creator Rights Shield", subtitle: "Protect originality, disclosure, likeness, claims, and licensing.", html: rightsPage() },
    "/app/disclosure": { title: "Ethical AI Disclosure Helper", subtitle: "Generate clear disclosure labels and lines.", html: disclosurePage() },
    "/app/calendar": { title: "Content Calendar", subtitle: "Plan balanced weeks with burnout warnings and drag-and-drop cards.", html: calendarPage() },
    "/app/extension": { title: "Chrome Extension", subtitle: "Popup and side panel design for browsing workflows.", html: extensionPage() },
    "/app/settings": { title: "Settings", subtitle: "Environment, integrations, API route map, and safety defaults.", html: settingsPage() },
  };
  return pages[route] || pages["/app/dashboard"];
}

function dashboardPage() {
  const topVideo = analytics.videos[0];
  return `
    <section class="page">
      <div class="page-hero">
        <div>
            <p class="section-kicker">Welcome back, ${escapeHtml(creatorDisplayName())}</p>
          <h2>Create with momentum, not generic output.</h2>
          <p class="muted">Niche: ${escapeHtml(state.creator.niche)}</p>
        </div>
        <div class="action-row">
          <a class="button primary" href="#/app/dna">Improve Creator DNA</a>
          <a class="button secondary" href="#/app/authenticity">Run Guard</a>
        </div>
      </div>

      <div class="metric-grid">
        ${metric("Creator DNA score", `${state.dna.score}%`, "+4 this month", "good")}
        ${metric("Avg authenticity", "87%", "Strong match", "good")}
        ${metric("Ideas this week", "14", "5 ready to script", "warn")}
        ${metric("Burnout warning", "12 posts", "Too heavy", "bad")}
      </div>

      <div class="dashboard-grid">
        <article class="dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">Quick actions</span><h3>What do you want to make?</h3></div>
            <span class="badge">Creator DNA on</span>
          </div>
          <div class="quick-actions">
            ${quickAction("/app/ideas", "Generate idea", "Find a content opportunity")}
            ${quickAction("/app/scripts", "Write script", "Build scene-by-scene")}
            ${quickAction("/app/repurpose", "Repurpose", "Turn one asset into many")}
            ${quickAction("/app/youtube", "Analyze video", "Diagnose performance")}
            ${quickAction("/app/ad-studio", "Create ad", "Ethical ad concepts")}
            ${quickAction("/app/ad-studio", "Create short film", "Script cinematic stories")}
            ${quickAction("/app/authenticity", "Check authenticity", "Score voice match")}
            ${quickAction("/app/calendar", "Plan week", "Balance content mix")}
          </div>
        </article>

        <article class="dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">AI recommendations</span><h3>Next creator moves</h3></div>
          </div>
          <div class="list-stack">
            ${insight("Best-performing topic: Study productivity", "Repeat the experiment format, but add a stronger personal failure in the first 8 seconds.")}
            ${insight("Audience drop-off problem: intros are too long", "Cut setup by 8-12 seconds and show proof before context.")}
            ${insight("Next opportunity: AI tools for exam prep", "Your audience is asking for exact prompts. Turn comments into a video.")}
          </div>
        </article>

        <article class="dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">Recent YouTube summary</span><h3>Views over time</h3></div>
            <span class="badge ${state.youtubeConnected ? "good" : "warn"}">${state.youtubeConnected ? "Live-ready" : "Mock data"}</span>
          </div>
          ${barChart(analytics.views)}
        </article>

        <article class="dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">Top-performing content</span><h3>${escapeHtml(topVideo.title)}</h3></div>
            <span class="badge good">${topVideo.views.toLocaleString()} views</span>
          </div>
          <p class="muted">${escapeHtml(topVideo.diagnosis)}</p>
          <div class="score-grid">
            ${scoreChip("Retention", `${topVideo.retention}%`)}
            ${scoreChip("CTR", `${topVideo.ctr}%`)}
            ${scoreChip("Comments", topVideo.comments)}
            ${scoreChip("Format", topVideo.format)}
          </div>
        </article>
      </div>
    </section>
  `;
}

function metric(label, value, trend, tone = "good") {
  return `<article class="metric-card"><div class="metric-head"><span class="micro-copy">${label}</span><span class="badge ${tone}">${tone}</span></div><div class="metric-value">${value}</div><span class="trend ${tone === "bad" ? "bad" : tone === "warn" ? "warn" : ""}">${trend}</span></article>`;
}

function quickAction(path, title, text) {
  return `<a class="quick-action" href="#${path}" data-route="${path}"><span>${escapeHtml(title)}</span><span class="muted">${escapeHtml(text)}</span></a>`;
}

function insight(title, text) {
  return `<div class="insight-item"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

function scoreChip(label, value) {
  return `<div class="score-chip"><span class="micro-copy">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function barChart(values, labels = []) {
  return `<div class="chart" style="--count:${values.length}">${values.map((value, index) => `<div class="bar ${index % 3 === 1 ? "coral" : index % 3 === 2 ? "gold" : ""}" style="--h:${Math.max(34, value * 2.4)}px"><span>${labels[index] || index + 1}</span></div>`).join("")}</div>`;
}

function dnaPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Creator DNA Profile</p>
          <h2>Your voice becomes the system prompt.</h2>
          <p class="muted">Paste real examples and define the boundaries Contentus should never cross.</p>
        </div>
        <div class="action-row">
          <button class="button primary" data-action="generate-dna" type="button">Regenerate Creator DNA</button>
          <button class="button secondary" data-action="save-dna" type="button">Save Creator DNA</button>
        </div>
      </div>

      <div class="dashboard-grid">
        <form class="tool-card" id="dna-form">
          <div class="form-grid">
            ${field("creator-name", "Creator name", state.creator.creatorName)}
            ${field("niche", "Niche", state.creator.niche)}
            ${field("audience", "Audience", state.creator.audience, "textarea", "full")}
            ${field("values", "Values and boundaries", `${state.creator.values}\n${state.creator.boundaries}`, "textarea", "full")}
            ${field("topics-loved", "Topics loved", state.creator.topicsLoved, "textarea")}
            ${field("topics-avoided", "Topics avoided", state.creator.topicsAvoided, "textarea")}
            <div class="form-field full">
              <label>Tone</label>
              <div class="toggle-group">
                ${["funny", "educational", "cinematic", "emotional", "sarcastic", "professional", "chaotic", "motivational", "calm", "bold"].map((tone) => `<button class="pill-button ${(state.creator.tone || []).includes(tone) ? "active" : ""}" type="button" data-action="toggle-pill">${tone}</button>`).join("")}
              </div>
            </div>
            ${field("samples", "Paste captions, scripts, posts, or transcripts", "I tried to become productive for a week and somehow created a spreadsheet that judged me harder than my exams did.\n\nHere is the thing: productivity advice only works if it survives your actual messy life.", "textarea", "full")}
          </div>
        </form>

        <aside class="dashboard-card" id="dna-output">
          ${dnaOutput()}
        </aside>
      </div>
    </section>
  `;
}

function field(id, label, value = "", type = "text", extra = "") {
  if (type === "textarea") {
    return `<div class="form-field ${extra}"><label for="${id}">${label}</label><textarea id="${id}">${escapeHtml(value)}</textarea></div>`;
  }
  return `<div class="form-field ${extra}"><label for="${id}">${label}</label><input id="${id}" value="${escapeHtml(value)}"></div>`;
}

function dnaOutput() {
  return `
    <div class="card-topline">
      <div><span class="section-kicker">Generated profile</span><h3>Creator DNA score: ${state.dna.score}%</h3></div>
      <span class="badge good">Saved</span>
    </div>
    <div class="list-stack">
      ${insight("Tone of voice", state.dna.tone)}
      ${insight("Humor style", state.dna.humor)}
      ${insight("Storytelling style", state.dna.story)}
      ${insight("Visual style", state.dna.visual)}
      ${insight("Hook style", state.dna.hookStyle)}
      ${insight("Things to avoid", state.dna.avoid)}
      ${insight("Sounds like you", state.dna.phrases.map((item) => `"${item}"`).join(", "))}
      ${insight("Does not sound like you", "Unlock effortless success, revolutionary hacks, guaranteed growth, and other generic AI filler.")}
    </div>
  `;
}

function ideasPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">AI Idea Engine</p>
          <h2>Generate ideas that feel personal, not recycled.</h2>
        </div>
        <button class="button primary" data-action="generate-ideas" type="button">Generate content ideas</button>
      </div>

      <form class="tool-card" id="ideas-form">
        <div class="form-grid three">
          ${field("topic", "Topic", "AI study routines for chaotic students")}
          ${selectField("platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram carousel", "Newsletter", "Blog", "Podcast", "Ad", "Short film"])}
          ${selectField("goal", "Goal", ["grow followers", "educate", "entertain", "sell product", "build trust", "go viral", "start conversation"])}
          ${selectField("content-type", "Content type", ["YouTube video", "TikTok/Reel/Short", "Instagram carousel", "newsletter", "blog", "podcast", "ad", "short film"])}
          ${selectField("idea-tone", "Tone", ["funny", "educational", "cinematic", "emotional", "sarcastic", "professional", "chaotic", "motivational", "calm", "bold"])}
          ${selectField("length", "Length", ["15 seconds", "30 seconds", "60 seconds", "2 minutes", "8 minutes", "long-form"])}
          ${selectField("trend", "Trend", ["trend-aware", "evergreen"])}
          ${selectField("story", "Personal story", ["include personal story", "no personal story"])}
          ${field("idea-audience", "Audience", state.creator.audience)}
        </div>
      </form>

      <div class="output-grid" id="ideas-output">
        ${state.ideas.map(ideaCard).join("")}
      </div>
    </section>
  `;
}

function selectField(id, label, options, selected = options[0]) {
  return `<div class="form-field"><label for="${id}">${label}</label><select id="${id}">${options.map((option) => `<option ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
}

function ideaCard(idea) {
  return `
    <article class="output-card ${idea.genericRisk === "Low" ? "highlight" : ""}">
      <div class="card-topline">
        <span class="badge">${escapeHtml(idea.platform)}</span>
        <span class="badge ${idea.genericRisk === "Low" ? "good" : "warn"}">Generic risk: ${escapeHtml(idea.genericRisk)}</span>
      </div>
      <h3>${escapeHtml(idea.title)}</h3>
      <p><strong>Hook:</strong> ${escapeHtml(idea.hook)}</p>
      <p><strong>Why it works:</strong> ${escapeHtml(idea.why)}</p>
      <p><strong>Personalization tip:</strong> ${escapeHtml(idea.personalTip)}</p>
      <div class="action-row">
        <button class="button primary" data-action="use-idea" data-idea-id="${idea.id}" type="button">Turn into script</button>
        <button class="button secondary" data-action="copy" data-copy="${escapeHtml(idea.title + "\n" + idea.hook)}" type="button">${icon("copy")}Copy</button>
      </div>
    </article>
  `;
}

function scriptsPage() {
  const selected = state.ideas[0];
  const latest = state.scripts[0];
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Script and Story Builder</p>
          <h2>Turn an idea into a production-ready plan.</h2>
        </div>
        <button class="button primary" data-action="generate-script" type="button">Generate script</button>
      </div>
      <div class="dashboard-grid">
        <form class="tool-card" id="script-form">
          <div class="form-grid">
            ${selectField("selected-idea", "Selected idea", state.ideas.map((idea) => idea.title), selected?.title)}
            ${selectField("script-platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram", "Podcast", "Ad", "Short film"])}
            ${selectField("desired-length", "Desired length", ["30 seconds", "60 seconds", "2 minutes", "8 minutes"])}
            ${selectField("script-tone", "Tone", ["funny", "educational", "cinematic", "emotional", "sarcastic", "professional"])}
            ${selectField("format", "Format", ["talking head", "vlog", "cinematic", "tutorial", "skit", "documentary", "product review", "ad", "short film"])}
            ${selectField("creator-dna-toggle", "Creator DNA", ["on", "off"])}
            ${selectField("cta", "Include CTA", ["yes", "no"])}
            ${selectField("humor", "Include humor", ["yes", "no"])}
            ${selectField("personal-story", "Personal story", ["yes", "no"])}
          </div>
        </form>
        <article class="dashboard-card" id="script-output">${scriptOutput(latest)}</article>
      </div>
    </section>
  `;
}

function scriptOutput(script) {
  if (!script) return `<div class="empty-state">Generate a script to see hooks, shot list, voiceover, captions, and CTA.</div>`;
  return `
    <div class="card-topline">
      <div><span class="section-kicker">Generated script</span><h3>${escapeHtml(script.title)}</h3></div>
      <span class="badge good">Authenticity ${script.authenticityScore}</span>
    </div>
    <div class="script-block"><strong>Full script</strong><p>${escapeHtml(script.script)}</p></div>
    <div class="script-block"><strong>Hook options</strong><p>1. ${escapeHtml(state.ideas[0]?.hook || "Start with the real problem.")}<br>2. I tried to fix my workflow and accidentally exposed the mess.<br>3. This is the student routine test I wish I had earlier.</p></div>
    <div class="script-block"><strong>Scene breakdown</strong><p>${script.shotList.map((shot, index) => `${index + 1}. ${escapeHtml(shot)}`).join("<br>")}</p></div>
    <div class="script-block"><strong>Caption</strong><p>${escapeHtml(script.caption)}</p></div>
    <div class="toolbar">
      ${["Make more like me", "Make shorter", "Make funnier", "Make more emotional", "Make more cinematic", "Make less generic"].map((label) => `<button class="button secondary" data-action="transform-script" data-transform="${escapeHtml(label)}" type="button">${label}</button>`).join("")}
      <a class="button primary" href="#/app/repurpose">Repurpose this</a>
      <a class="button primary" href="#/app/authenticity">Run Authenticity Guard</a>
    </div>
  `;
}

function adStudioPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">AI Ad and Short Film Studio</p>
          <h2>Make ethical ads, short films, and trailers in your style.</h2>
        </div>
        <button class="button primary" data-action="generate-ad" type="button">Generate three versions</button>
      </div>
      <form class="tool-card" id="ad-form">
        <div class="form-grid three">
          ${selectField("project-type", "Project type", ["advertisement", "short film", "product promo", "personal brand trailer", "social cause campaign", "mock brand collaboration"])}
          ${field("product-story", "Product or story idea", "A student creator launches an AI study planner but learns the real product is honesty.")}
          ${field("target-audience", "Target audience", state.creator.audience)}
          ${selectField("mood", "Mood", ["funny", "emotional", "cinematic", "dramatic", "inspirational", "mysterious", "fast-paced"])}
          ${selectField("ad-length", "Length", ["15 seconds", "30 seconds", "60 seconds", "2 minutes"])}
          ${selectField("ad-platform", "Platform", ["YouTube", "TikTok", "Instagram", "LinkedIn"])}
          ${field("message", "Message", "Useful AI should amplify the creator, not replace their voice.")}
          ${field("ad-cta", "CTA", "Try the free Contentus demo.")}
          ${selectField("disclosure-required", "Disclosure requirement", ["AI-assisted", "sponsored and AI-assisted", "not sponsored"])}
        </div>
      </form>
      <div id="ad-output">${adOutput(generateAdStudio())}</div>
    </section>
  `;
}

function adOutput(result) {
  return `
    <div class="output-grid">
      ${result.versions.map((version) => `
        <article class="output-card ${version.name === result.recommended ? "highlight" : ""}">
          <div class="card-topline"><span class="badge">${version.name}</span><span class="badge good">Authenticity ${version.authenticity}</span></div>
          <h3>${escapeHtml(version.concept)}</h3>
          <p><strong>Script:</strong> ${escapeHtml(version.script)}</p>
          <p><strong>Storyboard:</strong> ${escapeHtml(version.storyboard)}</p>
          <p><strong>AI visual prompts:</strong> ${escapeHtml(version.visualPrompt)}</p>
          <p><strong>Disclosure:</strong> ${escapeHtml(version.disclosure)}</p>
        </article>
      `).join("")}
    </div>
    <article class="dashboard-card">
      <h3>Comparison table</h3>
      <div class="comparison-grid">
        <div>Criteria</div><div>Emotional</div><div>Funny</div><div>Cinematic</div>
        <div>Best for platform</div><div>Instagram</div><div>TikTok</div><div>YouTube</div>
        <div>Audience fit</div><div>High</div><div>High</div><div>Very high</div>
        <div>Authenticity score</div><div>86</div><div>91</div><div>89</div>
        <div>Viral potential</div><div>Medium</div><div>High</div><div>Medium-high</div>
        <div>Risk level</div><div>Low</div><div>Low</div><div>Medium</div>
        <div>Recommended</div><div>${result.recommended === "Emotional" ? "Yes" : "No"}</div><div>${result.recommended === "Funny" ? "Yes" : "No"}</div><div>${result.recommended === "Cinematic" ? "Yes" : "No"}</div>
      </div>
    </article>
  `;
}

function repurposePage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Repurpose Machine</p>
          <h2>One idea becomes a full platform kit.</h2>
        </div>
        <button class="button primary" data-action="repurpose" type="button">Repurpose content</button>
      </div>
      <div class="dashboard-grid">
        <form class="tool-card" id="repurpose-form">
          <div class="form-field">
            <label for="repurpose-input">Paste a script, transcript, caption, blog, or idea</label>
            <textarea id="repurpose-input">${escapeHtml(state.scripts[0]?.script || state.ideas[0]?.concept)}</textarea>
          </div>
        </form>
        <article class="dashboard-card" id="repurpose-output">${repurposeOutput(generateRepurpose())}</article>
      </div>
    </section>
  `;
}

function repurposeOutput(result) {
  return `<div class="list-stack">${Object.entries(result).map(([label, text]) => `<div class="script-block"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(text)}</p><div class="action-row"><button class="button secondary" data-action="copy" data-copy="${escapeHtml(text)}" type="button">Copy</button><button class="button secondary" type="button">Make more like me</button><button class="button secondary" type="button">Save to content calendar</button></div></div>`).join("")}</div>`;
}

function authenticityPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Authenticity Guard</p>
          <h2>Catch generic AI before your audience does.</h2>
        </div>
        <button class="button primary" data-action="score-auth" type="button">Check authenticity</button>
      </div>
      <div class="dashboard-grid">
        <form class="tool-card" id="auth-form">
          <div class="form-field">
            <label for="auth-input">Content to check</label>
            <textarea id="auth-input">Unlock effortless productivity with this revolutionary AI routine that will transform your study life forever.</textarea>
          </div>
        </form>
        <article class="dashboard-card" id="auth-output">${authOutput(scoreAuthenticity("I asked AI to fix my study routine and it immediately exposed how chaotic my calendar was."))}</article>
      </div>
    </section>
  `;
}

function authOutput(result) {
  return `
    <div class="card-topline">
      <div><span class="section-kicker">${escapeHtml(result.label)}</span><h3>Authenticity Score: ${result.score}/100</h3></div>
      <span class="badge ${result.score > 82 ? "good" : result.score > 66 ? "warn" : "bad"}">${escapeHtml(result.genericRisk)}</span>
    </div>
    <div class="score-grid">
      ${scoreChip("Voice match", result.voice)}
      ${scoreChip("Tone match", result.tone)}
      ${scoreChip("Audience fit", result.audience)}
      ${scoreChip("Originality", result.originality)}
      ${scoreChip("Generic AI risk", result.risk)}
      ${scoreChip("Believability", result.believability)}
      ${scoreChip("Brand safety", result.safety)}
      ${scoreChip("Disclosure", result.disclosure)}
    </div>
    <div class="list-stack">
      ${insight("Feedback", result.feedback)}
      ${insight("Rewritten version", result.rewrite)}
      ${insight("Personalization tips", result.tips)}
    </div>
  `;
}

function growthPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Growth Coach</p>
          <h2>Convert analytics confusion into next moves.</h2>
        </div>
        <a class="button primary" href="#/app/youtube">Open YouTube analytics</a>
      </div>
      <div class="metric-grid">
        ${metric("Average views", analytics.summary.averageViews.toLocaleString(), "+18% from last month", "good")}
        ${metric("Watch time", analytics.summary.watchTime, "Experiment videos lead", "good")}
        ${metric("Audience retention", analytics.summary.retention, "Drop-off at 12 seconds", "warn")}
        ${metric("Comment sentiment", "72% positive", "Questions rising", "good")}
      </div>
      <div class="dashboard-grid">
        <article class="dashboard-card">
          <h3>Suggested next 5 videos</h3>
          <div class="list-stack">
            ${["Exact AI prompt I use to plan exam week", "I fixed my worst intro using retention data", "My creator workflow for students with no team", "I tried a rest-day content calendar", "Answering top comment questions about AI studying"].map((item, index) => insight(`${index + 1}. ${item}`, "Includes authenticity score, generic risk, and a personal proof moment.")).join("")}
          </div>
        </article>
        <article class="dashboard-card">
          <h3>AI diagnosis</h3>
          <div class="list-stack">
            ${insight("What works", "Tutorials with personal stories outperform pure app lists.")}
            ${insight("What failed", "Generic productivity titles have weaker CTR and lower comment depth.")}
            ${insight("Hook performance", "Audience drops when the result is not visible in the first 12 seconds.")}
            ${insight("Thumbnail performance", "Clear problem text beats vague AI language.")}
            ${insight("Best posting day", "Saturday appears strongest in mock data.")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function youtubePage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">YouTube Integration</p>
          <h2>${state.youtubeConnected ? "Connected channel" : "Mock analytics, real-ready architecture."}</h2>
          <p class="muted">OAuth route placeholders exist on the server. Demo data keeps the prototype usable without keys.</p>
        </div>
        <button class="button primary" data-action="connect-youtube" type="button">${state.youtubeConnected ? "Refresh mock data" : "Connect Google account demo"}</button>
      </div>
      <div class="metric-grid">
        ${metric("Channel", analytics.channel, `${analytics.subscribers.toLocaleString()} subscribers`, "good")}
        ${metric("CTR", analytics.summary.ctr, "Titles clear, not emotional enough", "warn")}
        ${metric("Engagement", analytics.summary.engagement, "Comment questions high", "good")}
        ${metric("Subscriber growth", analytics.summary.growth, "Repeat experiment format", "good")}
      </div>
      <article class="dashboard-card">
        <h3>Views over time</h3>
        ${barChart(analytics.views, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
      </article>
      <div class="dashboard-grid">
        <article class="dashboard-card">
          <h3>Top videos table</h3>
          <div class="table">
            ${analytics.videos.map(videoRow).join("")}
          </div>
        </article>
        <article class="dashboard-card">
          <h3>AI diagnosis per video</h3>
          <div class="list-stack">
            ${analytics.videos.map((video) => insight(video.title, `${video.diagnosis} Better thumbnail text: "${video.topic} but honest." Repurpose into a short and a newsletter section.`)).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function videoRow(video) {
  return `<div class="table-row"><div><strong>${escapeHtml(video.title)}</strong><span>${escapeHtml(video.topic)} · ${escapeHtml(video.format)}</span></div><div><strong>${video.views.toLocaleString()}</strong><span>views</span></div><div><strong>${video.retention}%</strong><span>retention</span></div><div><strong>${video.ctr}%</strong><span>CTR</span></div></div>`;
}

function communityPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Community Manager</p>
          <h2>Find audience signals without auto-posting replies.</h2>
          <p class="muted">Replies are suggestions only. Contentus never auto-posts comments.</p>
        </div>
      </div>
      <div class="metric-grid">
        ${metric("Positive", "72%", "Most common sentiment", "good")}
        ${metric("Questions", "18", "Turn into videos", "good")}
        ${metric("Critical", "9%", "Needs thoughtful replies", "warn")}
        ${metric("Toxicity", "2", "Hidden from drafts", "bad")}
      </div>
      <div class="dashboard-grid">
        <article class="dashboard-card">
          <h3>Recent comments</h3>
          <div class="list-stack">${comments.map(commentRow).join("")}</div>
        </article>
        <article class="dashboard-card">
          <h3>Audience themes</h3>
          <div class="list-stack">
            ${insight("Common questions", "Exact prompts, calendar templates, and how to avoid burnout.")}
            ${insight("Loyal fans", "Students who return for honest experiment videos.")}
            ${insight("Video ideas from comments", "Prompt walkthrough, intro teardown, and realistic study week reset.")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function commentRow(comment) {
  return `<div class="comment-row"><div><strong>${escapeHtml(comment.author)}</strong><span>${escapeHtml(comment.text)}</span><div class="chip-row"><span class="badge">${escapeHtml(comment.sentiment)}</span><span class="badge ${comment.importance === "high" ? "good" : "warn"}">${escapeHtml(comment.importance)}</span></div></div><div class="reply-draft"><strong>Suggested reply</strong><p>${escapeHtml(comment.suggestedReply)}</p><div class="action-row"><button class="button secondary" data-action="copy" data-copy="${escapeHtml(comment.suggestedReply)}" type="button">Copy reply</button><button class="button secondary" type="button">Save as idea</button><button class="button secondary" type="button">Mark important</button></div></div></div>`;
}

function rightsPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Creator Rights Shield</p>
          <h2>Creator-friendly checks, not legal fog.</h2>
        </div>
        <button class="button primary" data-action="rights-check" type="button">Scan content</button>
      </div>
      <div class="dashboard-grid">
        <form class="tool-card" id="rights-form">
          <div class="form-field">
            <label for="rights-input">Paste brand terms, script, content idea, or ad copy</label>
            <textarea id="rights-input">This sponsored video guarantees students will double their grades using our AI planner. Use a celebrity-style voiceover and trending song.</textarea>
          </div>
        </form>
        <article class="dashboard-card" id="rights-output">${rightsOutput(generateRightsCheck(""))}</article>
      </div>
    </section>
  `;
}

function rightsOutput(result) {
  return `<div class="list-stack">${result.map((item) => `<div class="insight-item"><span class="badge ${item.level}">${escapeHtml(item.label)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div>`).join("")}</div>`;
}

function disclosurePage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Disclosure Helper</p>
          <h2>Be clear about AI use without making it weird.</h2>
        </div>
        <button class="button primary" data-action="disclosure" type="button">Generate disclosure</button>
      </div>
      <div class="dashboard-grid">
        <form class="tool-card" id="disclosure-form">
          <div class="form-grid">
            ${selectField("ai-script", "AI used for script?", ["yes", "no"])}
            ${selectField("ai-images", "AI used for images?", ["no", "yes"])}
            ${selectField("ai-video", "AI used for video?", ["no", "yes"])}
            ${selectField("ai-voice", "AI used for voice?", ["no", "yes"])}
            ${selectField("ai-editing", "AI used for editing?", ["yes", "no"])}
            ${selectField("sponsored", "Sponsored?", ["no", "yes"])}
            ${selectField("fictional", "Fictional?", ["no", "yes"])}
            ${selectField("likeness", "Real person's likeness involved?", ["no", "yes"])}
          </div>
        </form>
        <article class="dashboard-card" id="disclosure-output">${disclosureOutput(generateDisclosure({ script: "yes", editing: "yes" }))}</article>
      </div>
    </section>
  `;
}

function disclosureOutput(result) {
  return `<div class="card-topline"><div><span class="section-kicker">Recommended label</span><h3>${escapeHtml(result.label)}</h3></div><span class="badge ${result.level}">${escapeHtml(result.level)}</span></div><div class="list-stack">${result.lines.map((line) => insight("Disclosure line", line)).join("")}</div>`;
}

function calendarPage() {
  const days = Array.from({ length: 28 }, (_, index) => index + 1);
  const heavy = state.calendar.length > 8;
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Content Calendar</p>
          <h2>Plan growth, community, education, promotion, and rest.</h2>
        </div>
        <button class="button primary" data-action="weekly-plan" type="button">Generate weekly content plan</button>
      </div>
      ${heavy ? `<div class="error-state">Burnout warning: too many posts scheduled. Add rest days and reduce promotional content.</div>` : ""}
      <div class="calendar-layout">
        <div class="calendar-grid">
          ${days.map(dayCard).join("")}
        </div>
        <aside class="dashboard-card">
          <h3>AI priority recommendation</h3>
          <div class="list-stack">
            ${insight("Growth", "Publish one experiment video and one short teaser.")}
            ${insight("Community", "Answer the top prompt question with a short.")}
            ${insight("Education", "Turn analytics diagnosis into a carousel.")}
            ${insight("Personal", "Keep one honest burnout/reset post.")}
            ${insight("Rest", "Protect at least two rest or light-editing days.")}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function dayCard(day) {
  const items = state.calendar.filter((item) => item.day === day);
  return `<div class="calendar-day" data-day="${day}"><div class="calendar-date"><strong>${day}</strong><span>${items.length ? `${items.length} item` : "open"}</span></div>${items.map((item) => `<div class="calendar-card" draggable="true" data-calendar-id="${item.id}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.platform)} · ${escapeHtml(item.status)}</p></div>`).join("")}</div>`;
}

function extensionPage() {
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Chrome Extension</p>
          <h2>Popup and side panel prototype are included in /extension.</h2>
          <p class="muted">Load it unpacked in Chrome once you run or open the project folder.</p>
        </div>
      </div>
      <div class="extension-layout">
        <div class="extension-preview">
          <div class="mini-window-bar"><span></span><span></span><span></span></div>
          <div class="extension-body">
            ${dnaLogo()}
            <h3>Save to Contentus</h3>
            <p class="muted">Selected text and page URL are saved as inspiration, not copied content.</p>
            <div class="list-stack">
              ${insight("Analyze Content", "Hook, title, topic, audience angle, and originality warning.")}
              ${insight("Make It Mine", "Rewrite selected text in Creator DNA voice.")}
              ${insight("Authenticity Check", "Score selected draft with generic risk and rewrite.")}
            </div>
          </div>
        </div>
        <article class="dashboard-card">
          <h3>Extension install steps</h3>
          <div class="list-stack">
            ${insight("1. Open Chrome extensions", "Go to chrome://extensions and enable Developer mode.")}
            ${insight("2. Load unpacked", "Select the extension folder in this repo.")}
            ${insight("3. Try the popup", "Open any page, highlight text, and use Save, Analyze, Make It Mine, or Authenticity Check.")}
            ${insight("4. Side panel", "The side panel shows YouTube helper-style analysis and Contentus actions.")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function settingsPage() {
  const integrations = appConfig.integrations || {};
  return `
    <section class="page">
      <div class="page-hero">
        <div>
          <p class="section-kicker">Settings</p>
          <h2>Free-key integrations, API route map, and safety defaults.</h2>
        </div>
      </div>
      <div class="dashboard-grid">
        <article class="dashboard-card">
          <h3>Environment keys</h3>
          <div class="list-stack">
            ${integrationItem("Supabase Auth + saved user state", integrations.supabase, "Uses SUPABASE_URL and SUPABASE_ANON_KEY for sign up, sign in, sign out, and saved Contentus workspace state.")}
            ${integrationItem("Gemini AI key", integrations.gemini, "Detected for future live AI route upgrades; local deterministic fallback remains available.")}
            ${integrationItem("YouTube Data API key", integrations.youtubeData, "Detected for future channel/video fetches; current analytics page still has polished mock data.")}
            ${integrationItem("Firebase key", integrations.firebase, "Detected as an optional future backend alternative.")}
            ${integrationItem("Google OAuth client/secret", integrations.googleOAuth, "Needed before real Google account and YouTube OAuth can be enabled.")}
            ${integrationItem("Session secret", integrations.sessionSecret, "Recommended before adding secure server-side sessions.")}
          </div>
        </article>
        <article class="dashboard-card">
          <h3>API route structure</h3>
          <div class="table">
            ${["GET /api/health", "GET /api/demo/dashboard", "POST /api/ai/dna", "POST /api/ai/ideas", "POST /api/ai/script", "POST /api/ai/ad-studio", "POST /api/ai/repurpose", "POST /api/ai/authenticity", "POST /api/ai/rights", "POST /api/ai/disclosure", "GET /api/youtube/mock", "GET /api/youtube/oauth/start", "GET /api/youtube/oauth/callback", "POST /api/inspiration"].map((route) => `<div class="table-row"><strong>${route}</strong><span>Mock now, production-ready shape later.</span></div>`).join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function integrationItem(title, active, text) {
  return `<div class="insight-item"><span class="badge ${active ? "good" : "warn"}">${active ? "configured" : "missing"}</span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div>`;
}

async function handleLogin(button) {
  const credentials = readAuthForm();
  if (!credentials.email || !credentials.password) {
    setAuthNote("Enter your email and password.");
    return;
  }

  await withBusy(button, "Signing in...", async () => {
    const result = await apiJson("/api/auth/login", {
      method: "POST",
      body: {
        email: credentials.email,
        password: credentials.password,
      },
    });

    if (!result.ok) {
      setAuthNote(result.data.message || "Sign in failed. Check your email/password or confirm your Supabase email.");
      return;
    }

    saveSession(result.data);
    state.authed = true;
    state.creator.email = result.data.user?.email || credentials.email;
    if (credentials.name) state.creator.creatorName = credentials.name;

    const saved = await apiJson("/api/user/state", { auth: true });
    if (saved.ok && saved.data.contentusState) {
      state = mergeState(defaultState, saved.data.contentusState);
      state.authed = true;
      state.creator.email = result.data.user?.email || credentials.email;
      if (saved.data.user?.user_metadata?.google_oauth) state.google = googlePublicClientState(saved.data.user.user_metadata.google_oauth);
    } else {
      await saveRemoteState();
    }

    saveStateLocalOnly();
    toast("Signed in. Your Contentus data will sync to Supabase.");
    routeTo("/app/dashboard");
  });
}

async function handleSignup(button) {
  const credentials = readAuthForm();
  if (!credentials.email || !credentials.password) {
    setAuthNote("Enter an email and password to create your account.");
    return;
  }
  if (credentials.password.length < 6) {
    setAuthNote("Use a password with at least 6 characters.");
    return;
  }

  await withBusy(button, "Creating account...", async () => {
    if (credentials.name) state.creator.creatorName = credentials.name;
    state.creator.email = credentials.email;
    const result = await apiJson("/api/auth/signup", {
      method: "POST",
      body: {
        email: credentials.email,
        password: credentials.password,
        name: credentials.name || state.creator.creatorName,
        contentusState: persistableState(),
      },
    });

    if (!result.ok) {
      setAuthNote(result.data.message || "Account creation failed. The email may already be registered.");
      return;
    }

    if (result.data.session?.access_token || result.data.access_token) {
      saveSession(result.data.session || result.data);
      state.authed = true;
      await saveRemoteState();
      saveStateLocalOnly();
      toast("Account created and signed in.");
      routeTo("/app/dashboard");
      return;
    }

    setAuthNote(result.data.message || "Account created. Confirm your email, then sign in.");
    toast("Check your email to confirm your Supabase account.");
  });
}

async function handleLogout() {
  if (authSession?.access_token) {
    try {
      await apiJson("/api/auth/logout", { method: "POST", auth: true });
    } catch {
      // Local sign out still completes if the network is unavailable.
    }
  }
  saveSession(null);
  state.authed = false;
  saveStateLocalOnly();
  toast("Signed out. Your saved data remains in Supabase.");
  routeTo("/");
}

function readAuthForm() {
  return {
    name: document.querySelector("#login-name")?.value.trim() || "",
    email: document.querySelector("#login-email")?.value.trim() || "",
    password: document.querySelector("#login-password")?.value || "",
  };
}

function setAuthNote(message) {
  const note = document.querySelector("#auth-note");
  if (note) note.textContent = message;
}

async function handleGenerateDna(button) {
  await withBusy(button, "Analyzing samples...", async () => {
    const tones = [...document.querySelectorAll(".pill-button.active")].map((node) => node.textContent.trim());
    state.creator.creatorName = document.querySelector("#creator-name").value;
    state.creator.niche = document.querySelector("#niche").value;
    state.creator.audience = document.querySelector("#audience").value;
    state.creator.values = document.querySelector("#values").value;
    state.creator.topicsLoved = document.querySelector("#topics-loved").value;
    state.creator.topicsAvoided = document.querySelector("#topics-avoided").value;
    state.creator.tone = tones.length ? tones : state.creator.tone;
    const samples = document.querySelector("#samples").value;
    state.dna = generateDna(samples, tones);
    saveState();
    document.querySelector("#dna-output").innerHTML = dnaOutput();
    toast("Creator DNA regenerated.");
  });
}

function handleSaveDna() {
  saveState();
  toast("Creator DNA saved locally.");
}

async function handleGenerateIdeas(button) {
  await withBusy(button, "Generating ideas...", async () => {
    const payload = readFormValues(["topic", "platform", "goal", "content-type", "idea-tone", "length", "trend", "story", "idea-audience"]);
    state.ideas = generateIdeas(payload).concat(state.ideas).slice(0, 8);
    saveState();
    document.querySelector("#ideas-output").innerHTML = state.ideas.map(ideaCard).join("");
    toast("New Creator DNA-aware ideas generated.");
  });
}

function handleUseIdea(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (idea) {
    const script = generateScript({ idea: idea.title, platform: idea.platform, format: "talking head" });
    state.scripts.unshift(script);
    saveState();
    toast("Idea turned into a script.");
    routeTo("/app/scripts");
  }
}

async function handleGenerateScript(button) {
  await withBusy(button, "Writing script...", async () => {
    const payload = readFormValues(["selected-idea", "script-platform", "desired-length", "script-tone", "format", "creator-dna-toggle", "cta", "humor", "personal-story"]);
    state.scripts.unshift(generateScript(payload));
    saveState();
    document.querySelector("#script-output").innerHTML = scriptOutput(state.scripts[0]);
    toast("Script generated with authenticity scoring.");
  });
}

function handleTransformScript(transform) {
  if (!state.scripts[0]) return;
  state.scripts[0].script += ` ${transform}: add a sharper personal detail, trim generic language, and keep the CTA in the creator's normal phrasing.`;
  state.scripts[0].authenticityScore = Math.min(97, state.scripts[0].authenticityScore + 3);
  saveState();
  render();
  toast(`${transform} applied.`);
}

async function handleGenerateAd(button) {
  await withBusy(button, "Building versions...", async () => {
    document.querySelector("#ad-output").innerHTML = adOutput(generateAdStudio());
    toast("Three ad/film versions generated.");
  });
}

async function handleRepurpose(button) {
  await withBusy(button, "Repurposing...", async () => {
    document.querySelector("#repurpose-output").innerHTML = repurposeOutput(generateRepurpose(document.querySelector("#repurpose-input").value));
    toast("Platform kit generated.");
  });
}

async function handleScoreAuthenticity(button) {
  await withBusy(button, "Scoring...", async () => {
    const result = scoreAuthenticity(document.querySelector("#auth-input").value);
    document.querySelector("#auth-output").innerHTML = authOutput(result);
    toast(`Authenticity score: ${result.score}`);
  });
}

async function handleRightsCheck(button) {
  await withBusy(button, "Scanning...", async () => {
    document.querySelector("#rights-output").innerHTML = rightsOutput(generateRightsCheck(document.querySelector("#rights-input").value));
    toast("Rights Shield scan complete.");
  });
}

async function handleDisclosure(button) {
  await withBusy(button, "Checking disclosure...", async () => {
    const values = readFormValues(["ai-script", "ai-images", "ai-video", "ai-voice", "ai-editing", "sponsored", "fictional", "likeness"]);
    document.querySelector("#disclosure-output").innerHTML = disclosureOutput(generateDisclosure(values));
    toast("Disclosure recommendation generated.");
  });
}

async function handleConnectYouTube(button) {
  await withBusy(button, "Connecting...", async () => {
    state.youtubeConnected = true;
    saveState();
    toast("YouTube connected in demo mode.");
    render();
  });
}

async function handleWeeklyPlan(button) {
  await withBusy(button, "Planning week...", async () => {
    const nextId = `cal-${Date.now()}`;
    state.calendar.push(
      { id: `${nextId}-1`, day: 21, title: "Growth experiment video", platform: "YouTube", status: "idea", contentType: "Growth", notes: "Use top comment as hook." },
      { id: `${nextId}-2`, day: 23, title: "Community Q&A short", platform: "Shorts", status: "scripting", contentType: "Community", notes: "Answer exact AI prompt question." },
      { id: `${nextId}-3`, day: 26, title: "Rest day recap", platform: "Newsletter", status: "idea", contentType: "Personal", notes: "Protect creator energy." },
    );
    saveState();
    render();
    toast("Weekly content plan added.");
  });
}

function handleSaveCalendar() {
  toast("Saved to content calendar.");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied.");
  } catch {
    toast("Copy failed in this browser context.");
  }
}

async function withBusy(button, label, task) {
  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = label;
  }
  await new Promise((resolve) => setTimeout(resolve, 450));
  await task();
  if (button) {
    button.disabled = false;
    button.textContent = original;
  }
}

function readFormValues(ids) {
  return Object.fromEntries(ids.map((id) => [id, document.querySelector(`#${id}`)?.value || ""]));
}

function generateDna(samples, tones = []) {
  const hasChaos = /mess|chaos|roast|honest/i.test(samples);
  return {
    score: hasChaos ? 94 : 88,
    tone: tones.length ? `${tones.join(", ")} with practical honesty.` : defaultState.dna.tone,
    humor: hasChaos ? "Self-aware chaos, gentle self-roasts, and honest reversals." : defaultState.dna.humor,
    phrases: hasChaos ? ["this got out of hand", "my calendar exposed me", "useful, not fake productive"] : defaultState.dna.phrases,
    story: "Start with a real creator problem, show the messy proof, test a system, then end with a useful takeaway.",
    visual: "Clean UI captures, annotated screenshots, fast proof-first cuts, and warm creator desk moments.",
    themes: ["AI workflow", "creator systems", "study productivity", "ethical growth"],
    audienceType: state.creator.audience,
    editingPace: "Fast hook, clear proof, calm explanation, crisp CTA.",
    hookStyle: "Confession or experiment that becomes useful within the first 12 seconds.",
    language: "Simple, human, direct, and allergic to corporate filler.",
    emotional: "Supportive, honest, and motivating without fake certainty.",
    avoid: state.creator.topicsAvoided || defaultState.dna.avoid,
  };
}

function generateIdeas(payload = {}) {
  const topic = payload.topic || "AI creator workflow";
  const platform = payload.platform || "YouTube";
  const goal = payload.goal || "build trust";
  const seed = Date.now();
  return [
    {
      id: `idea-${seed}-1`,
      title: `I Tested ${topic} So You Do Not Have To`,
      hook: `I tried ${topic.toLowerCase()} for a week, and the first result was embarrassing but useful.`,
      platform,
      contentType: payload["content-type"] || platform,
      concept: `Run a real creator experiment, show the messy baseline, then turn it into a practical system.`,
      why: `It supports the goal to ${goal} because it combines proof, personality, and a clear takeaway.`,
      emotional: "Honest experiment with useful relief.",
      genericRisk: "Low",
      personalTip: "Show one real artifact from your workflow: screenshot, failed draft, calendar, or notes.",
      cta: "Ask the audience what system they want you to test next.",
      status: "idea",
      source: "Idea Engine",
    },
    {
      id: `idea-${seed}-2`,
      title: `The ${topic} Mistake Beginner Creators Keep Making`,
      hook: `This looks productive, but it is secretly why your content still sounds generic.`,
      platform,
      contentType: payload["content-type"] || platform,
      concept: "Break down a common mistake, then rewrite it using Creator DNA principles.",
      why: "It teaches and creates trust without encouraging copying.",
      emotional: "Tough love with a fix.",
      genericRisk: "Medium",
      personalTip: "Use a before-and-after draft from your own archive.",
      cta: "Invite viewers to run their draft through Authenticity Guard.",
      status: "idea",
      source: "Idea Engine",
    },
    {
      id: `idea-${seed}-3`,
      title: `I Turned One Messy Idea Into 10 Platform Posts`,
      hook: `One idea, ten formats, zero robotic captions. Let's see if Contentus can keep my voice intact.`,
      platform,
      contentType: "Repurpose series",
      concept: "Use the Repurpose Machine live and score every output for authenticity.",
      why: "Creators feel multi-platform pressure and need a repeatable workflow.",
      emotional: "Overwhelm turning into control.",
      genericRisk: "Low",
      personalTip: "Include one version you reject because it sounds too AI.",
      cta: "Ask which platform version felt most like you.",
      status: "idea",
      source: "Idea Engine",
    },
  ];
}

function generateScript(payload = {}) {
  const title = payload.idea || payload["selected-idea"] || state.ideas[0]?.title || "Creator workflow experiment";
  const platform = payload.platform || payload["script-platform"] || "YouTube";
  const format = payload.format || "talking head";
  const score = scoreAuthenticity(title).score;
  return {
    id: `script-${Date.now()}`,
    ideaId: state.ideas[0]?.id,
    title,
    platform,
    authenticityScore: Math.max(84, score),
    genericRisk: "Low",
    script: `Cold open: ${creatorDisplayName()} admits the real problem: the idea sounds good, but the draft sounds like every AI post ever. Show the messy note, then test a ${format} structure. Scene two: explain the system in plain language. Scene three: run Authenticity Guard and rewrite one weak line. Ending: give the audience one practical next step and one honest warning about copying.`,
    shotList: ["Messy original note", "Creator talking-head hook", "Screen recording of Contentus", "Authenticity score reveal", "Before/after rewrite", "CTA with audience question"],
    caption: `${title}. Built with Creator DNA on, generic risk checked, and disclosure ready.`,
  };
}

function generateAdStudio() {
  return {
    recommended: "Funny",
    versions: [
      {
        name: "Emotional",
        concept: "A creator almost quits after generic AI drains their voice, then rebuilds confidence with Creator DNA.",
        script: "I thought AI would help me create faster. It did, but everything sounded like someone else. Contentus learned the parts I did not want to lose.",
        storyboard: "Quiet desk, deleted drafts, DNA profile build, authentic rewrite, final confident publish.",
        visualPrompt: "Cinematic creator desk, clean UI panels, warm practical lighting, no fake logos.",
        disclosure: "AI-assisted concept, written and edited by me.",
        authenticity: 86,
      },
      {
        name: "Funny",
        concept: "The creator asks AI for help and gets the most corporate caption alive.",
        script: "AI said 'unlock your limitless potential.' I said, absolutely not. Then Contentus made it sound like I actually have a personality.",
        storyboard: "Bad generic caption, creator reaction, Contentus rewrite, authenticity score jump, punchy CTA.",
        visualPrompt: "Fast-paced creator studio, expressive UI reactions, bright caption overlays, playful but premium.",
        disclosure: "Brainstormed with AI, rewritten in my voice.",
        authenticity: 91,
      },
      {
        name: "Cinematic",
        concept: "A personal brand trailer where Creator DNA appears as a studio operating system.",
        script: "Every creator has a signal. Contentus helps you protect it, scale it, and publish without becoming generic.",
        storyboard: "Dark studio, creator notes, platform timeline, voice profile, guard scan, multi-platform publish.",
        visualPrompt: "Premium futuristic creator OS, cursor-reactive panels, cyan/coral/gold accents, no readable text.",
        disclosure: "AI visuals used for fictional interface scenes.",
        authenticity: 89,
      },
    ],
  };
}

function generateRepurpose() {
  return {
    "YouTube title": "I Let AI Fix My Content Workflow and It Found the Real Problem",
    "YouTube description": "A practical creator experiment about using AI without losing your voice. Includes Creator DNA, Authenticity Guard, and the exact places generic AI sneaks in.",
    "YouTube tags": "creator workflow, AI content, productivity, student creator, content strategy",
    "TikTok/Reel/Short script": "POV: AI helps you create faster but accidentally makes you sound like a startup landing page. Here is how I fixed it.",
    "Instagram caption": "AI should speed up your process, not sand off your personality. I tested a Creator DNA workflow and the generic-risk score was humbling.",
    "Carousel outline": "1. The generic AI problem 2. My real voice signals 3. The rewrite test 4. Authenticity score 5. The final workflow",
    "LinkedIn post": "The next creator advantage is not more AI output. It is AI that understands the creator's voice, boundaries, and audience trust.",
    "X/Twitter thread": "1/ AI content is fast. But fast and generic is still generic. I tested a Creator DNA workflow...",
    "Newsletter section": "This week I learned that the best AI workflow starts with your real voice, not a blank prompt.",
    "Blog post outline": "Intro, problem, Creator DNA setup, authenticity test, repurposing workflow, disclosure checklist, conclusion.",
    "Podcast intro": "Today we are talking about how creators can use AI without losing the weird human details audiences actually came for.",
    "Community post": "Want me to run one of your drafts through a voice-match checklist?",
    "Ad copy": "Create faster without sounding generic. Contentus learns your voice and checks every draft for authenticity.",
    "Thumbnail text": "AI Made Me Generic",
    "Pinned comment": "Drop a draft line below and I will show how I would make it sound more human.",
    "Short teaser": "The fastest way to spot generic AI writing is to ask: would I actually say this out loud?",
    "AI disclosure line": "Brainstormed with AI, written and edited by me.",
  };
}

function scoreAuthenticity(text = "") {
  const clean = text.toLowerCase();
  const personal = ["i ", "my ", "we ", "mess", "chaos", "real", "honest", "story", "audience", "specific"].filter((word) => clean.includes(word)).length;
  const generic = ["unlock", "revolutionary", "game-changing", "effortless", "ultimate", "limitless", "transform forever", "guarantee"].filter((word) => clean.includes(word)).length;
  const lengthBonus = Math.min(12, Math.round(text.split(/\s+/).filter(Boolean).length / 8));
  const score = Math.max(38, Math.min(98, 68 + personal * 5 + lengthBonus - generic * 9));
  return {
    score,
    voice: Math.max(40, Math.min(98, score + 2)),
    tone: Math.max(40, Math.min(98, score - 1)),
    audience: Math.max(40, Math.min(98, score + 4)),
    originality: Math.max(35, Math.min(97, score - generic * 3)),
    risk: generic ? `${Math.min(95, generic * 22 + 18)}%` : "18%",
    believability: Math.max(42, Math.min(96, score - 3)),
    safety: generic > 1 ? 71 : 93,
    disclosure: clean.includes("ai") ? "recommended" : "optional",
    genericRisk: generic > 1 ? "Too generic" : score > 84 ? "Low generic risk" : "Needs more personal voice",
    label: score > 84 ? "Strong match" : score > 66 ? "Needs more personal voice" : "Too generic",
    feedback: generic > 1
      ? "This sounds more corporate than your normal content. Remove inflated claims and add one real moment."
      : "This sounds close to your usual tone. Add a personal story beat and keep the CTA specific.",
    rewrite: "I tried this in my actual workflow, and the useful part was not the shiny AI promise. It was the moment it exposed where my process was messy.",
    tips: "Add proof from your real workflow, remove broad claims, and use one phrase your audience recognizes.",
  };
}

function generateRightsCheck(text = "") {
  const clean = text.toLowerCase();
  const flags = [];
  if (/guarantee|double|cure|100%/.test(clean)) flags.push({ level: "bad", label: "Risky claim", title: "Unrealistic product claim", text: "Avoid guarantees unless you have evidence and permission from the brand/legal owner." });
  if (/celebrity|likeness|voiceover/.test(clean)) flags.push({ level: "bad", label: "Consent needed", title: "Likeness or voice risk", text: "Do not imitate a real person's voice, face, or identity without explicit consent." });
  if (/trending song|music/.test(clean)) flags.push({ level: "warn", label: "License check", title: "Music licensing reminder", text: "Confirm platform-safe rights before using music in ads or sponsored posts." });
  flags.push({ level: "good", label: "Disclosure", title: "AI disclosure checklist", text: "Add a simple disclosure if AI helped script, edit, generate visuals, or create fictional scenes." });
  flags.push({ level: "good", label: "Originality", title: "Originality reminder", text: "Use external content as inspiration only. Rebuild the idea around your story, examples, and audience." });
  return flags;
}

function generateDisclosure(values = {}) {
  const yes = (key) => values[key] === "yes";
  if (yes("likeness") || yes("ai-voice")) {
    return { label: "Disclosure strongly recommended", level: "bad", lines: ["This content includes synthetic media. Voice or likeness use was consent-based.", "AI-assisted production was used; final story and edits are human-reviewed."] };
  }
  if (yes("sponsored") && (yes("ai-script") || yes("ai-images") || yes("ai-video") || yes("ai-editing"))) {
    return { label: "Sponsored and AI-assisted", level: "warn", lines: ["This sponsored concept was developed with AI support and edited by me.", "AI helped with brainstorming; opinions and final edits are mine."] };
  }
  if (yes("ai-images") || yes("ai-video")) {
    return { label: "AI-generated visuals included", level: "warn", lines: ["AI visuals were used for fictional scenes.", "Written and edited by me with AI-assisted visuals."] };
  }
  if (yes("ai-script") || yes("ai-editing") || values.script === "yes" || values.editing === "yes") {
    return { label: "AI-assisted", level: "good", lines: ["Brainstormed with AI, written and edited by me.", "This video includes AI-assisted editing."] };
  }
  return { label: "Human-made", level: "good", lines: ["Made and edited by me."] };
}

function initMotionBackground() {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const pointer = { x: 0, y: 0, active: false };
  let width = 0;
  let height = 0;
  let particles = [];

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const count = Math.min(92, Math.max(42, Math.floor(width / 18)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      r: Math.random() * 1.8 + 0.8,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createRadialGradient(pointer.x || width * 0.55, pointer.y || height * 0.35, 0, pointer.x || width * 0.55, pointer.y || height * 0.35, Math.max(width, height) * 0.75);
    gradient.addColorStop(0, "rgba(94,232,242,0.12)");
    gradient.addColorStop(0.38, "rgba(255,117,103,0.05)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    particles.forEach((p, i) => {
      const dx = (pointer.active ? pointer.x : width * 0.6) - p.x;
      const dy = (pointer.active ? pointer.y : height * 0.35) - p.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 220) {
        p.x -= dx * 0.0009;
        p.y -= dy * 0.0009;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;

      for (let j = i + 1; j < particles.length; j += 1) {
        const q = particles[j];
        const gap = Math.hypot(p.x - q.x, p.y - q.y);
        if (gap < 128) {
          ctx.strokeStyle = `rgba(94,232,242,${0.11 * (1 - gap / 128)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = "rgba(245,251,248,0.68)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (pointer.active) {
      ctx.strokeStyle = "rgba(248,201,96,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 90, 0, Math.PI * 2);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }, { passive: true });
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });
  resize();
  draw();
}

/* Contentus production workspace overrides.
   These functions intentionally replace the earlier prototype views so new users start clean. */

let contentusRecorder = null;
let contentusRecordChunks = [];
let contentusRecordedFile = null;

function loadStateV4() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? mergeStateV4(defaultState, saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function mergeStateV4(base, saved = {}) {
  const cleanBase = structuredClone(base);
  const isLegacyDemo = saved.workspaceVersion !== cleanBase.workspaceVersion;
  const merged = {
    ...cleanBase,
    ...saved,
    workspaceVersion: cleanBase.workspaceVersion,
    creator: { ...cleanBase.creator, ...(saved.creator || {}) },
    dna: isLegacyDemo ? null : (saved.dna || null),
    ideas: isLegacyDemo ? [] : normalizeList(saved.ideas),
    scripts: isLegacyDemo ? [] : normalizeList(saved.scripts),
    thumbnails: isLegacyDemo ? [] : normalizeList(saved.thumbnails),
    calendar: isLegacyDemo ? [] : normalizeList(saved.calendar),
    inspiration: isLegacyDemo ? [] : normalizeList(saved.inspiration),
    youtube: isLegacyDemo ? null : (saved.youtube || null),
    comments: isLegacyDemo ? [] : normalizeList(saved.comments),
    growthInsights: isLegacyDemo ? [] : normalizeList(saved.growthInsights),
    google: isLegacyDemo ? null : (saved.google || null),
    googleCalendarEvents: isLegacyDemo ? [] : normalizeList(saved.googleCalendarEvents),
    selectedVideoId: isLegacyDemo ? "" : (saved.selectedVideoId || ""),
    scriptChats: isLegacyDemo ? [] : normalizeList(saved.scriptChats),
    activeScriptChatId: isLegacyDemo ? "" : (saved.activeScriptChatId || ""),
    scriptAssistantOpen: saved.scriptAssistantOpen !== false,
    scriptCredibilityReport: isLegacyDemo ? null : (saved.scriptCredibilityReport || null),
    thumbnailChats: isLegacyDemo ? [] : normalizeList(saved.thumbnailChats),
    activeThumbnailChatId: isLegacyDemo ? "" : (saved.activeThumbnailChatId || ""),
    thumbnailSelection: isLegacyDemo ? null : (saved.thumbnailSelection || null),
    trendReports: isLegacyDemo ? [] : normalizeList(saved.trendReports),
    videoChecks: isLegacyDemo ? [] : normalizeList(saved.videoChecks),
    detailedVideoReports: isLegacyDemo ? [] : normalizeList(saved.detailedVideoReports),
    publishingJobs: isLegacyDemo ? [] : normalizeList(saved.publishingJobs),
    coachChats: isLegacyDemo ? [] : normalizeList(saved.coachChats),
    calendarViewDate: isLegacyDemo ? "" : (saved.calendarViewDate || ""),
    selectedCalendarDate: isLegacyDemo ? "" : (saved.selectedCalendarDate || ""),
  };

  if (isLegacyDemo) {
    merged.creator.creatorName = "";
    merged.creator.name = "";
    merged.creator.niche = "";
    merged.creator.audience = "";
    merged.creator.platforms = [];
    merged.creator.tone = [];
    merged.creator.values = "";
    merged.creator.boundaries = "";
    merged.creator.topicsLoved = "";
    merged.creator.topicsAvoided = "";
    merged.youtubeConnected = false;
  }

  return merged;
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function safeDna() {
  return state.dna || {
    score: 0,
    tone: "",
    humor: "",
    phrases: [],
    story: "",
    visual: "",
    themes: [],
    audienceType: "",
    editingPace: "",
    hookStyle: "",
    language: "",
    emotional: "",
    avoid: "",
    examplesLike: [],
    examplesUnlike: [],
  };
}

function creatorDisplayNameV4() {
  return state.creator.creatorName || state.creator.name || state.creator.email || "Creator";
}

function landingViewV4() {
  const dnaScore = state.dna?.score ? `${state.dna.score}%` : "Build";
  const authScore = state.lastAuthenticity?.authenticityScore || state.scripts[0]?.authenticityScore || "Ready";
  const ideaCount = state.ideas.length || "Start";
  return `
    <section class="landing-shell pro-landing">
      <header class="landing-header pro-header">
        <a href="#/" aria-label="Contentus home">${dnaLogo()}</a>
        <nav class="landing-nav" aria-label="Landing navigation">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#chrome-helper">Chrome helper</a>
          ${state.authed ? `<a href="#/app/dashboard">Dashboard</a><button class="button ghost" data-action="logout" type="button">Sign out</button>` : `<a href="#/login">Sign in</a>`}
          <a class="button primary" href="${state.authed ? "#/app/dashboard" : "#/login"}">${state.authed ? "Open app" : "Start free"}</a>
        </nav>
      </header>

      <section class="landing-hero restored-hero-top">
        <div class="hero-backdrop" aria-hidden="true">
          <div class="signal-card signal-card-one">
            <span>Creator DNA</span>
            <strong>${dnaScore}</strong>
            <small>Voice profile</small>
          </div>
          <div class="signal-card signal-card-two">
            <span>Authenticity Guard</span>
            <strong>${authScore}</strong>
            <small>Before publish</small>
          </div>
          <div class="signal-card signal-card-three">
            <span>Ideas</span>
            <strong>${ideaCount}</strong>
            <small>Ready to create</small>
          </div>
        </div>
        <div class="hero-inner hero-inner-premium">
          <div class="hero-copy">
            <p class="eyebrow">Create 10x faster without losing what makes you, you.</p>
            <h1>Build faster. Stay unmistakably you.</h1>
            <p class="hero-lede">
              Contentus learns your voice, protects your originality, and turns ideas into scripts,
              thumbnails, ads, calendar plans, comment replies, and YouTube growth decisions with Creator DNA baked in.
            </p>
            <div class="hero-actions">
              <a class="button primary" href="${state.authed ? "#/app/dashboard" : "#/login"}">${state.authed ? "Open your studio" : "Create your account"}</a>
              <a class="button secondary" href="#features">See the system</a>
            </div>
            <div class="hero-proof">
              <span class="chip">Supabase auth</span>
              <span class="chip">Saved creator state</span>
              <span class="chip">Gemini AI routes</span>
              <span class="chip">Chrome helper</span>
            </div>
          </div>
        </div>

        <div class="hero-dashboard-preview" aria-label="Contentus product preview">
          <div class="preview-topbar">
            <span class="live-dot"></span>
            <strong>Contentus studio</strong>
            <span>Live creator loop</span>
          </div>
          <div class="preview-grid">
            <div class="preview-panel span-2">
              <small>Idea Engine</small>
              <strong>No blank page</strong>
              <p>Generate original angles from your niche, audience, and Creator DNA.</p>
            </div>
            <div class="preview-panel">
              <small>Voice match</small>
              <strong>${state.dna ? `${state.dna.score}%` : "DNA"}</strong>
              <p>Build from real samples.</p>
            </div>
            <div class="preview-panel">
              <small>Thumbnail</small>
              <strong>Canvas</strong>
              <p>Low-token visual drafts.</p>
            </div>
            <div class="preview-panel span-2">
              <small>YouTube + Growth</small>
              <strong>Real channel link</strong>
              <p>Use public stats and comments to choose your next creator move.</p>
            </div>
          </div>
        </div>
        <a class="scroll-cue-new" href="#features">Scroll for the system</a>
      </section>

      <section class="landing-section hackathon-story" id="features">
        <div class="section-heading compact-heading">
          <p class="section-kicker">Hackathon pitch</p>
          <h2>Creators need speed, but not at the cost of their voice.</h2>
          <p class="muted">Contentus is built around one belief: AI should amplify a creator, not flatten them into generic content.</p>
        </div>

        <div class="story-grid">
          <article class="story-card story-card-large">
            <span class="story-number">01</span>
            <p class="section-kicker">The problem we are trying to solve</p>
            <h3>Creators are drowning in content pressure.</h3>
            <p>
              YouTubers, TikTokers, writers, podcasters, students, and small creators have to brainstorm,
              script, design thumbnails, repurpose, answer comments, study analytics, and post everywhere.
              Normal AI makes this faster, but it often sounds generic and risks weakening the creator's identity.
            </p>
          </article>

          <article class="story-card">
            <span class="story-number">02</span>
            <p class="section-kicker">Our mission</p>
            <h3>Help creators scale without losing trust.</h3>
            <p>
              We want creators to publish faster, stay original, protect their voice, and make better growth
              decisions without needing a full creative team.
            </p>
          </article>

          <article class="story-card">
            <span class="story-number">03</span>
            <p class="section-kicker">The solution we made</p>
            <h3>A personal AI studio powered by Creator DNA.</h3>
            <p>
              Contentus learns a creator's tone, audience, topics, boundaries, samples, and optional voice/video
              context. Then it generates ideas, scripts, thumbnails, ad concepts, comment replies, and growth
              recommendations that stay aligned with the creator.
            </p>
          </article>
        </div>
      </section>

      <section class="landing-section feature-showcase">
        <div class="section-heading compact-heading">
          <p class="section-kicker">The features</p>
          <h2>Everything a solo creator needs to move from idea to publish.</h2>
        </div>
        <div class="feature-grid feature-grid-refined">
          ${featureCard("Creator DNA Profile", "Build a voice profile from writing samples, uploads, recorded voice, and YouTube video context.")}
          ${featureCard("AI Idea Engine", "Generate original ideas with hooks, platform fit, emotional angle, generic risk, and personalization tips.")}
          ${featureCard("Script Builder", "Create length-aware scripts for 30 seconds, 2 minutes, 8 minutes, ads, films, tutorials, and more.")}
          ${featureCard("Authenticity Guard", "Score whether content sounds like the creator and rewrite drafts that feel too generic.")}
          ${featureCard("Thumbnail Designer", "Generate Gemini-powered thumbnail concepts, refine them in chat, box regions, and export PNGs.")}
          ${featureCard("YouTube + Growth", "Link a public channel, inspect recent videos, load comments, and turn audience signals into next ideas.")}
          ${featureCard("Community Manager", "Analyze real comments and draft creator-voice replies without auto-posting.")}
          ${featureCard("Chrome Mini Helper", "Suggest titles, descriptions, rewrites, and authenticity checks from pages the creator is browsing.")}
        </div>
      </section>

      <section class="landing-section workflow-band" id="workflow">
        <div class="section-heading compact-heading">
          <p class="section-kicker">How it works</p>
          <h2>Train the voice once. Use it across the whole content workflow.</h2>
        </div>
        <div class="workflow-steps workflow-steps-refined">
          ${["Build Creator DNA", "Generate ideas", "Write scripts", "Design thumbnails", "Check authenticity", "Plan and grow"].map((step, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><strong>${step}</strong></div>`).join("")}
        </div>
        <blockquote>
          Contentus is your personal AI co-creator that learns your voice, protects your originality, and helps you grow across platforms. It helps creators brainstorm, script, analyze, and publish content faster without becoming generic.
        </blockquote>
      </section>

      <section class="landing-section hackathon-proof">
        <div class="section-heading compact-heading">
          <p class="section-kicker">Why it matters</p>
          <h2>Most tools optimize for output. Contentus optimizes for creator identity.</h2>
        </div>
        <div class="proof-grid">
          ${insight("Originality first", "The app warns against copying and pushes every draft toward personal proof, audience fit, and safer claims.")}
          ${insight("Real saved workspace", "New accounts start blank, then save Creator DNA, ideas, scripts, thumbnails, calendar items, and linked channel data.")}
          ${insight("Hackathon-ready product", "The dashboard, generators, YouTube linking, community replies, thumbnail designer, and extension are all built into one workflow.")}
        </div>
      </section>

      <section class="landing-section helper-bottom helper-bottom-refined" id="chrome-helper">
        <div>
          <p class="section-kicker">Chrome helper</p>
          <h2>A mini creator assistant for the browser.</h2>
          <p class="muted">Load the extension from the <code>extension</code> folder. It reads the current page title, selected text, and visible context to suggest titles, descriptions, captions, and safer rewrites.</p>
        </div>
        <a class="button primary" href="${state.authed ? "#/app/extension" : "#/login"}">Open install guide</a>
      </section>
    </section>
  `;
}

function authViewV4() {
  return `
    <section class="auth-layout restored-auth">
      <div class="auth-copy">
        <a href="#/">${dnaLogo()}</a>
        <p class="eyebrow">Real account storage</p>
        <h1>Sign in and keep your creator brain intact.</h1>
        <p class="hero-lede">
          Contentus uses Supabase Auth when your keys are present. Your Creator DNA,
          ideas, scripts, thumbnails, calendar, and channel data are saved to your user profile
          so they come back with you.
        </p>
        <div class="hero-proof">
          <span class="chip">${appConfig.integrations.supabase ? "Supabase connected" : "Supabase not configured"}</span>
          <span class="chip">${appConfig.integrations.gemini ? "Gemini connected" : "Gemini key needed"}</span>
          <span class="chip">${appConfig.integrations.youtubeData ? "YouTube Data connected" : "YouTube key needed"}</span>
        </div>
      </div>
      <form class="auth-card" id="login-form">
        <h2>Welcome to Contentus</h2>
        <p class="muted">${authStatusNoteV4()}</p>
        <div class="auth-choice-note">
          <p><strong>New here?</strong> Fill the form and choose <span>Create account</span>.</p>
          <p><strong>Already saved data?</strong> Use <span>Sign in</span> to restore it.</p>
        </div>
        <div class="form-field">
          <label for="login-name">Creator name <span>optional</span></label>
          <input id="login-name" placeholder="Your creator or channel name" autocomplete="name">
        </div>
        <div class="form-field">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" placeholder="creator@example.com" autocomplete="email">
        </div>
        <div class="form-field">
          <label for="login-password">Password</label>
          <input id="login-password" type="password" placeholder="At least 6 characters" autocomplete="current-password">
        </div>
        <div class="action-row">
          <button class="button primary" type="button" data-action="login">Sign in</button>
          <button class="button secondary" type="button" data-action="signup">Create account</button>
          <a class="button secondary" href="#/">Back</a>
        </div>
        <p class="form-note" id="auth-note">New accounts start blank. Your workspace syncs after sign in.</p>
      </form>
    </section>
  `;
}

function authStatusNoteV4() {
  if (appConfig.integrations.supabase) return "Supabase is connected. Your workspace will be saved to your account.";
  return "Supabase is not detected, so this browser can only use local storage until the keys are configured.";
}

function appShellV4(route) {
  const page = pageForRouteV4(route);
  return `
    <section class="app-shell app-v4 pro-app-shell">
      <aside class="sidebar sidebar-v4">
        <a href="#/app/dashboard">${dnaLogo()}</a>
        <nav class="sidebar-nav" aria-label="App navigation">
          ${navLink("/app/dashboard", "dashboard", "Dashboard")}
          ${navLink("/app/ideas", "spark", "Ideas")}
          ${navLink("/app/scripts", "script", "Scripts")}
          ${navLink("/app/thumbnail", "film", "Thumbnails")}
          ${navLink("/app/trends", "chart", "Trend Analyzer")}
          ${navLink("/app/youtube-growth", "chart", "Analytics")}
          ${navLink("/app/community", "spark", "Comments")}
          ${navLink("/app/calendar", "calendar", "Calendar")}
          ${navLink("/app/video-checker", "guard", "Video Checker")}
          ${navLink("/app/publishing", "spark", "Publish Everywhere")}
          ${navLink("/app/dna", "dna", "Brand Voice")}
          ${navLink("/app/coach", "spark", "AI Coach")}
        </nav>
        <div class="sidebar-privacy-card">
          <strong>Privacy-First</strong>
          <p>Your data stays yours. No data shared.</p>
          <span>No data shared</span>
        </div>
        <div class="sidebar-foot">
          <strong>${state.authed ? "Signed in" : "Local workspace"}</strong>
          <p>${state.authed ? "Your real workspace data syncs to Supabase." : "Sign in to save across devices."}</p>
          <button class="button secondary" data-action="logout" type="button">${state.authed ? "Sign out" : "Back to landing"}</button>
        </div>
      </aside>

      <section class="app-main">
        <header class="app-topbar topbar-v4">
          <div class="topbar-left">
            <button class="icon-button mobile-menu" data-action="mobile-menu" type="button" aria-label="Open menu">${icon("menu")}</button>
          </div>
          <div class="topbar-actions">
            <span class="status-dot ${state.authed ? "good" : "warn"}">${state.authed ? "Auto-save" : "Local"}</span>
            <button class="icon-button" type="button" aria-label="Notifications">${icon("spark")}</button>
            <button class="icon-button" type="button" aria-label="Theme">${icon("settings")}</button>
            <span class="avatar-dot">${escapeHtml((creatorDisplayName() || "C").slice(0, 1).toUpperCase())}</span>
            <a class="button primary" href="#/app/ideas">New idea</a>
          </div>
        </header>
        <div class="app-content">${page.html}</div>
      </section>
    </section>
  `;
}

function pageForRouteV4(route) {
  const pages = {
    "/app/dashboard": { title: "Dashboard", subtitle: "Only your real saved data appears here.", html: dashboardPageV4() },
    "/app/dna": { title: "Creator DNA", subtitle: "Build your voice profile from real samples, audio, or video context.", html: dnaPageV4() },
    "/app/ideas": { title: "Idea Engine", subtitle: "Generate original ideas from your topic, goal, audience, and DNA.", html: ideasPageV4() },
    "/app/trends": { title: "Trend Analyzer", subtitle: "Check platform trends, audio ideas, and whether your idea has momentum.", html: trendAnalyzerPageV4() },
    "/app/scripts": { title: "Script Builder", subtitle: "Write length-aware scripts and export formatted PDFs.", html: scriptsPageV4() },
    "/app/ad-studio": { title: "Ad Studio", subtitle: "Create ads, short films, promos, and campaign concepts.", html: adStudioPageV4() },
    "/app/thumbnail": { title: "Thumbnail Designer", subtitle: "Generate and refine thumbnails with Gemini image generation.", html: thumbnailPageV4() },
    "/app/video-checker": { title: "Video Checker", subtitle: "Score a YouTube video or upload for audio, visuals, title, thumbnail, and audience fit.", html: videoCheckerPageV4() },
    "/app/authenticity": { title: "Authenticity Guard", subtitle: "Check whether content sounds like you before publishing.", html: authenticityPageV4() },
    "/app/youtube-growth": { title: "YouTube + Growth", subtitle: "Link a public channel and turn performance into next actions.", html: youtubeGrowthPageV4() },
    "/app/community": { title: "Community Manager", subtitle: "Analyze real comments and create reply drafts in your voice.", html: communityPageV4() },
    "/app/calendar": { title: "Content Calendar", subtitle: "Plan real ideas, scripts, thumbnails, and publishing days.", html: calendarPageV4() },
    "/app/publishing": { title: "Publishing Hub", subtitle: "Prepare uploads and platform-specific packages from one source video.", html: publishingPageV4() },
    "/app/coach": { title: "Channel AI Coach", subtitle: "Talk with Contentus about what to improve and what to make next.", html: coachPageV4() },
    "/app/extension": { title: "Chrome Helper", subtitle: "Install the browser mini assistant from this project.", html: extensionPageV4() },
  };
  return pages[route] || pages["/app/dashboard"];
}

function dashboardPageV4() {
  const dna = safeDna();
  const avgAuth = averageScore(state.scripts.map((script) => script.authenticityScore));
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  const channelScore = videos.length ? channelHealthScore(videos) : null;
  const latestTrend = state.trendReports[0];
  const publishJob = state.publishingJobs[0];
  const upcoming = upcomingCalendarItems().slice(0, 3);
  return `
    <section class="page page-v4 dashboard-reference-page">
      <div class="pro-page-heading">
        <div>
          <h2>Welcome back${state.creator.creatorName ? `, ${escapeHtml(state.creator.creatorName)}` : ""}</h2>
          <p class="muted">Run your smarter, AI-powered content studio. Only real saved data appears here.</p>
        </div>
        <div class="action-row">
          <a class="button secondary" href="#/app/youtube-growth">Link analytics</a>
          <a class="button primary" href="#/app/trends">Analyze trends</a>
        </div>
      </div>

      <div class="reference-dashboard-grid">
        ${ringMetricCard("Channel Health", channelScore, channelScore ? "Based on linked public YouTube videos." : "Link YouTube to calculate health.", "/app/youtube-growth")}
        ${ringMetricCard("Authenticity Score", avgAuth || null, avgAuth ? "Average from generated scripts." : "Generate scripts to score authenticity.", "/app/authenticity")}
        <article class="dashboard-card reference-card trend-preview-card span-2">
          <div class="card-topline">
            <div><span class="section-kicker">Trend Analyzer</span><h3>${latestTrend ? escapeHtml(latestTrend.platform || "Latest trend report") : "No trend report yet"}</h3></div>
            <a class="text-link" href="#/app/trends">View trends</a>
          </div>
          ${latestTrend ? dashboardTrendPreview(latestTrend) : emptyMini("Run Trend Analyzer to populate live opportunity cards.")}
        </article>

        <article class="dashboard-card reference-card quick-actions-card">
          <div class="card-topline"><div><span class="section-kicker">Quick actions</span><h3>Create or analyze</h3></div></div>
          <div class="reference-action-grid">
            ${quickAction("/app/scripts", "Script Builder", "Write powerful scripts")}
            ${quickAction("/app/thumbnail", "Thumbnail Designer", "Create click-worthy thumbnails")}
            ${quickAction("/app/video-checker", "Video Checker", "Optimize before publishing")}
            ${quickAction("/app/trends", "Trend Analyzer", "Find winning trends")}
            ${quickAction("/app/publishing", "Publish Everywhere", "Adapt per platform")}
            ${quickAction("/app/coach", "AI Coach", "Ask what to improve")}
          </div>
        </article>

        <article class="dashboard-card reference-card strategist-card">
          <div class="card-topline"><div><span class="section-kicker">AI Strategist</span><h3>Ask Contentus</h3></div><span class="badge">Gemini</span></div>
          <div class="assistant-mini-card">
            <strong>Channel coach</strong>
            <p>Uses your saved Creator DNA, ideas, scripts, and linked YouTube data.</p>
          </div>
          <div class="tool-button-strip compact-strip">
            ${["What should I improve next?", "Why did my last video underperform?", "Give me ideas for next week"].map((prompt) => `<button class="button secondary" type="button" data-action="v4-coach-prompt" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join("")}
          </div>
        </article>

        <article class="dashboard-card reference-card platform-card">
          <div class="card-topline"><div><span class="section-kicker">Cross-platform status</span><h3>${publishJob ? escapeHtml(publishJob.title || "Publishing pack") : "No publishing pack"}</h3></div></div>
          ${publishJob ? normalizeList(publishJob.platforms).slice(0, 5).map((platform) => platformStatusRow(platform)).join("") : emptyMini("Create a Publishing Hub pack to see platform readiness.")}
        </article>

        <article class="dashboard-card reference-card opportunity-card">
          <div class="card-topline"><div><span class="section-kicker">Opportunity radar</span><h3>Saved opportunities</h3></div><a class="text-link" href="#/app/ideas">View all</a></div>
          <div class="list-stack">
            ${state.ideas.slice(0, 4).map((idea) => insight(idea.title, idea.personalizationTip || idea.concept || "Saved idea")).join("") || emptyMini("Generate or save ideas to fill this list.")}
          </div>
        </article>

        <article class="dashboard-card reference-card calendar-mini-card">
          <div class="card-topline"><div><span class="section-kicker">Content calendar</span><h3>Upcoming</h3></div><a class="text-link" href="#/app/calendar">View calendar</a></div>
          <div class="timeline-mini-list">
            ${upcoming.length ? upcoming.map((item) => `<div><time>${escapeHtml(item.startTime || item.time || item.date || "Planned")}</time><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status || item.platform || "Content")}</span></div>`).join("") : emptyMini("Add real events to your calendar.")}
          </div>
        </article>

        ${privacyDashboardCard()}
      </div>
    </section>
  `;
}

function emptyOnboarding() {
  return `
    <div class="empty-dashboard">
      <article>
        <span class="step-dot">1</span>
        <h3>Build Creator DNA</h3>
        <p>Upload, record, paste, or link real creator samples so Contentus has your voice.</p>
        <a class="button primary" href="#/app/dna">Start DNA</a>
      </article>
      <article>
        <span class="step-dot">2</span>
        <h3>Generate an idea</h3>
        <p>Pick a platform, goal, content type, or custom option and create your first angle.</p>
        <a class="button secondary" href="#/app/ideas">Idea Engine</a>
      </article>
      <article>
        <span class="step-dot">3</span>
        <h3>Link YouTube</h3>
        <p>Use a public channel URL or handle to fetch real recent videos and comments.</p>
        <a class="button secondary" href="#/app/youtube-growth">Connect channel</a>
      </article>
    </div>
  `;
}

function ringMetricCard(title, score, text, href) {
  const value = Number(score || 0);
  return `
    <article class="dashboard-card reference-card ring-metric-card">
      <div class="card-topline"><div><span class="section-kicker">${escapeHtml(title)}</span></div></div>
      <div class="metric-ring" style="--score:${Math.max(0, Math.min(100, value))}">
        <strong>${score ? escapeHtml(Math.round(value)) : "--"}</strong>
        <span>/100</span>
      </div>
      <div>
        <h3>${score ? scoreLabel(value) : "Not enough data"}</h3>
        <p class="muted">${escapeHtml(text)}</p>
      </div>
      <a class="button secondary" href="#${href}">${score ? "View full report" : "Start setup"}</a>
    </article>
  `;
}

function dashboardTrendPreview(report) {
  return `
    <div class="trend-preview-grid">
      <div>
        <strong>${escapeHtml(report.verdict || "Trend report")}</strong>
        <p class="muted">${escapeHtml(report.hitOrMiss || report.whyNow || "AI trend analysis ready.")}</p>
      </div>
      <div class="metric-ring compact-ring" style="--score:${Number(report.hitScore || 0)}">
        <strong>${escapeHtml(report.hitScore || "--")}</strong><span>/100</span>
      </div>
    </div>
    <div class="mini-list-table">
      ${normalizeList(report.topics).slice(0, 4).map((topic, index) => `<div><span>${index + 1}</span><strong>${escapeHtml(topic)}</strong><em>${escapeHtml(index === 0 ? "Top signal" : "Related")}</em></div>`).join("") || emptyMini("No topics returned yet.")}
    </div>
  `;
}

function platformStatusRow(platform = {}) {
  return `
    <div class="platform-status-row">
      <strong>${escapeHtml(platform.name || platform.platform || "Platform")}</strong>
      <span>${escapeHtml(platform.title || platform.caption || "Ready to review")}</span>
      <em>${escapeHtml(platform.status || "Ready")}</em>
    </div>
  `;
}

  function privacyDashboardCard() {
    return `
      <article class="dashboard-card reference-card privacy-dashboard-card">
        <span class="section-kicker">Privacy-First</span>
        <h3>Your data stays yours.</h3>
        <p class="muted">We do not train on your content. No data shared.</p>
        <span class="privacy-pill">No data shared</span>
      </article>
    `;
  }

  function channelHealthScore(videos = []) {
    const usable = normalizeList(videos).filter((video) => Number(video.views) > 0);
    if (!usable.length) return null;
    const avgEngagement = usable.reduce((sum, video) => sum + ((Number(video.likes || 0) + Number(video.comments || 0)) / Math.max(1, Number(video.views || 0))), 0) / usable.length;
    const uploadSpread = Math.min(100, usable.length * 8);
    return Math.max(20, Math.min(96, Math.round(avgEngagement * 900 + uploadSpread)));
  }

  function scoreLabel(value) {
    if (value >= 85) return "Strong";
    if (value >= 70) return "Good";
    if (value >= 50) return "Needs work";
    return "Needs setup";
  }

  function upcomingCalendarItems() {
    return [...normalizeList(state.calendar), ...normalizeList(state.googleCalendarEvents)]
      .filter((item) => item.date || item.day)
      .sort((a, b) => String(a.date || a.day || "").localeCompare(String(b.date || b.day || "")));
  }

  function dnaPageV4() {
    const dna = safeDna();
    return `
      <section class="page page-v4">
        <div class="page-hero compact-hero">
          <div>
            <p class="section-kicker">Creator DNA</p>
            <h2>Build the profile from real samples.</h2>
            <p class="muted">Contentus can analyze writing, transcripts, text files, audio/video uploads, a recorded voice note, and YouTube video context.</p>
          </div>
          <div class="action-row">
            <button class="button primary" data-action="v4-analyze-dna" type="button">Generate Creator DNA</button>
            <button class="button secondary" data-action="v4-save-dna" type="button">Save</button>
          </div>
        </div>

        <div class="workspace-layout">
          <form class="tool-card compact-form" id="dna-form">
            <div class="form-grid">
              ${fieldV4("creator-name", "Creator name", state.creator.creatorName, "text", "Your name, channel, or brand")}
              ${fieldV4("niche", "Niche", state.creator.niche, "text", "Student creator, beauty, comedy, film, etc.")}
              ${textareaV4("audience", "Audience", state.creator.audience, "Who watches you and what do they care about?", "full")}
              ${textareaV4("values", "Values and boundaries", state.creator.values, "What should your content stand for or never do?", "full")}
              ${textareaV4("topics-loved", "Topics you love", state.creator.topicsLoved, "Separate with commas")}
              ${textareaV4("topics-avoided", "Topics you avoid", state.creator.topicsAvoided, "Separate with commas")}
              <div class="form-field full">
                <label>Tone signals</label>
                <div class="toggle-group">
                  ${["funny", "educational", "cinematic", "emotional", "sarcastic", "professional", "chaotic", "motivational", "calm", "bold"].map((tone) => `<button class="pill-button ${(state.creator.tone || []).includes(tone) ? "active" : ""}" type="button" data-action="toggle-pill">${tone}</button>`).join("")}
                </div>
              </div>
              ${textareaV4("samples", "Writing samples or transcript", "", "Paste captions, scripts, posts, transcripts, or rough notes.", "full")}
              ${fieldV4("dna-youtube-url", "YouTube video URL", "", "url", "Optional: public video URL, channel video, or handle")}
              <div class="form-field">
                <label for="voice-file">Upload sample</label>
                <input id="voice-file" type="file" accept="audio/*,video/*,.txt,.md,.srt,.vtt">
                <small>Audio/video/text. Large files are trimmed before analysis.</small>
              </div>
              <div class="form-field recorder-box">
                <label>Record voice sample</label>
                <div class="action-row compact-actions">
                  <button class="button secondary" type="button" data-action="v4-start-recording">Record</button>
                  <button class="button secondary" type="button" data-action="v4-stop-recording">Stop</button>
                </div>
                <small id="recording-status">No recording yet.</small>
              </div>
            </div>
          </form>

          <aside class="dashboard-card sticky-output" id="dna-output">
            ${dna.score ? dnaOutputV4(dna) : emptyPanel("No Creator DNA yet", "Add samples and generate your profile. The dashboard stays blank until you do.", "Builds from real creator input only.")}
          </aside>
        </div>
      </section>
    `;
  }

  function dnaOutputV4(dna) {
    return `
      <div class="card-topline">
        <div><span class="section-kicker">Generated profile</span><h3>DNA score ${escapeHtml(dna.score || 0)}%</h3></div>
        <span class="badge ${Number(dna.score) > 80 ? "good" : "warn"}">${Number(dna.score) > 80 ? "Ready" : "Needs samples"}</span>
      </div>
      <div class="list-stack profile-list">
        ${insight("Tone of voice", dna.tone || "Not enough data yet.")}
        ${insight("Hook style", dna.hookStyle || "Not enough data yet.")}
        ${insight("Storytelling style", dna.story || "Not enough data yet.")}
        ${insight("Humor style", dna.humor || "Not enough data yet.")}
        ${insight("Visual style", dna.visual || "Not enough data yet.")}
        ${insight("Common phrases", toTextList(dna.phrases))}
        ${insight("Things to avoid", dna.avoid || state.creator.topicsAvoided || "Not enough data yet.")}
        ${insight("Sounds like you", toTextList(dna.examplesLike))}
        ${insight("Does not sound like you", toTextList(dna.examplesUnlike))}
        ${dna.mediaNote ? insight("Media note", dna.mediaNote) : ""}
      </div>
    `;
  }

  function ideasPageV4() {
    return `
      <section class="page page-v4">
        <div class="builder-layout">
          <form class="tool-card compact-form" id="ideas-form">
            <div class="card-topline">
              <div><span class="section-kicker">Idea Engine</span><h3>Generate from your actual direction</h3></div>
            </div>
            ${fieldV4("idea-topic", "Topic", "", "text", "What do you want to create about?")}
            ${selectCustom("idea-platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram", "Newsletter", "Blog", "Podcast", "LinkedIn", "X/Twitter", "Custom"])}
            ${selectCustom("idea-goal", "Goal", ["grow followers", "educate", "entertain", "sell product", "build trust", "go viral", "start conversation", "Custom"])}
            ${selectCustom("idea-type", "Content type", ["YouTube video", "TikTok/Reel/Short", "Instagram carousel", "newsletter", "blog", "podcast", "ad", "short film", "Custom"])}
            ${selectCustom("idea-tone", "Tone", ["Use Creator DNA", "funny", "educational", "cinematic", "emotional", "professional", "Custom"])}
            ${selectCustom("idea-length", "Length", ["30 seconds", "60 seconds", "2 minutes", "5 minutes", "8 minutes", "Custom"])}
            ${selectCustom("idea-trend", "Trend use", ["No trend", "Use current platform trend carefully", "Custom"])}
            ${selectCustom("idea-story", "Personal story", ["Use DNA if relevant", "Yes", "No", "Custom"])}
            ${textareaV4("idea-audience", "Audience notes", state.creator.audience, "Specific audience context")}
            <button class="button primary full-width" type="button" data-action="v4-generate-ideas">Generate ideas</button>
          </form>

          <section class="output-column">
            <div class="card-topline">
              <div><span class="section-kicker">Output</span><h3>${state.ideas.length ? "Saved ideas" : "No ideas yet"}</h3></div>
            </div>
            <div id="ideas-output" class="idea-list">
              ${state.ideas.length ? state.ideas.map(ideaCardV4).join("") : emptyPanel("Your ideas will appear here", "Generate ideas from your topic and Creator DNA. Nothing is pre-filled.", "Every result includes authenticity score, generic risk, and a personalization tip.")}
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function ideaCardV4(idea) {
    return `
      <article class="dashboard-card idea-card-v4">
        <div class="card-topline">
          <div><span class="section-kicker">${escapeHtml(idea.platform || "Content")}</span><h3>${escapeHtml(idea.title || "Untitled idea")}</h3></div>
          <span class="badge ${riskClass(idea.genericRisk)}">${escapeHtml(idea.genericRisk || "Low risk")}</span>
        </div>
        <p class="hook-line">${escapeHtml(idea.hook || "")}</p>
        <div class="score-grid">
          ${scoreChip("Authenticity", `${idea.authenticityScore || idea.authenticity || "?"}%`)}
          ${scoreChip("Platform fit", idea.platformFit || idea.platform || "Custom")}
          ${scoreChip("Emotion", idea.emotional || idea.emotionalAngle || "Audience-first")}
        </div>
        <div class="list-stack">
          ${insight("Concept", idea.concept || "")}
          ${insight("Why audience cares", idea.why || idea.whyAudienceCares || "")}
          ${insight("Make it personal", idea.personalizationTip || idea.personalTip || "")}
          ${insight("CTA", idea.cta || "")}
        </div>
        <div class="action-row">
          <button class="button primary" type="button" data-action="v4-use-idea" data-idea-id="${escapeHtml(idea.id)}">Use in script</button>
          <button class="button secondary" type="button" data-action="v4-save-idea-calendar" data-idea-id="${escapeHtml(idea.id)}">Save to calendar</button>
        </div>
      </article>
    `;
  }

function trendAnalyzerPageV4() {
  const latest = state.trendReports?.[0];

  return `
    <section class="page trend-analyzer-pro-page">
      <div class="trend-pro-header">
        <div>
          <h2>Trend Analyzer <span class="trend-zigzag">⌁⌁⌁</span></h2>
          <p>See the hottest music, video ideas, and content opportunities right now.</p>
        </div>

        <div class="trend-header-actions">
          <button class="trend-small-btn" type="button">🌍 Worldwide</button>
          <button class="trend-small-btn" type="button">📅 Last 7 Days</button>
        </div>
      </div>

      <div class="trend-platform-tabs">
        ${trendPlatformTab("YouTube", "▶", true)}
        ${trendPlatformTab("YouTube Shorts", "⚡", false)}
        ${trendPlatformTab("TikTok", "♪", false)}
        ${trendPlatformTab("Instagram", "◎", false)}
        ${trendPlatformTab("X / Twitter", "𝕏", false)}
      </div>

      <form class="trend-input-panel" id="trend-form">
        <div class="trend-input-grid">
          ${selectCustom("trend-platform", "Platform", ["YouTube long videos", "YouTube Shorts", "TikTok", "Instagram Reels", "X / Twitter", "Custom"])}
          ${fieldV4("trend-niche", "Niche / audience", state.creator?.niche || state.creator?.audience || "", "text", "Gaming safety, study productivity, beauty, film, etc.")}
          ${textareaV4("trend-idea", "Idea to test", "", "Paste an idea to score hit or miss against the trend report.", "full")}
        </div>

        <button class="trend-main-btn" type="button" data-action="v4-analyze-trends">
          ✨ Analyze Trends
        </button>
      </form>

      <div id="trend-output">
        ${latest ? trendReportOutput(latest) : trendEmptyState()}
      </div>
    </section>
  `;
}

function trendPlatformTab(label, icon, active) {
  return `
    <button class="trend-platform-tab ${active ? "active" : ""}" type="button">
      <span>${icon}</span>
      ${label}
    </button>
  `;
}

function trendReportOutput(report) {
  const trendVelocity = Number(report.momentumScore || 85);
  const searchDemand = Number(report.searchDemand || report.hitScore || 91);
  const audienceInterest = Number(report.audienceInterest || report.hitScore || 88);
  const competitionScore = Number(report.competitionScore || 42);
  const opportunityScore = Number(report.hitScore || 88);

  const topics = normalizeList(report.topics);
  const audioSignals = normalizeList(report.audioSignals);
  const angles = normalizeList(report.angles);

  const finalTopics = topics.length ? topics : [
    "AI Tools for Creators in 2024",
    "How I Grew from 0 to 100K Subs",
    "Day in the Life: Creator Edition",
    "Faceless YouTube Channel Ideas",
    "Testing Viral Productivity Hacks"
  ];

  const finalAudio = audioSignals.length ? audioSignals : [
    "UPBEAT SUCCESS",
    "Cinematic Motivation",
    "Future Bass Energy",
    "Glitch Transition",
    "Chill Lo-Fi Vibes"
  ];

  const finalAngles = angles.length ? angles : [
    "AI Tools That Save 10+ Hours a Week",
    "0 to 100K Subscribers: My Exact Strategy",
    "Day in the Life of a Full-Time Creator",
    "Faceless Channel Ideas That Work"
  ];

  return `
    <div class="trend-pro-grid">

      <div class="trend-score-row">
        ${trendMetricCard("Trend Velocity", trendVelocity, "Very High", "green")}
        ${trendMetricCard("Search Demand", searchDemand, "Very High", "purple")}
        ${trendMetricCard("Audience Interest", audienceInterest, "Very High", "blue")}
        ${trendMetricCard("Competition Score", competitionScore, "Medium", "orange")}
        ${trendOpportunityCard(opportunityScore)}
      </div>

      <div class="trend-main-layout">
        <div class="trend-left-area">

          <article class="trend-panel trend-topics-panel">
            <div class="trend-panel-head">
              <h3>🔥 Best Video Ideas</h3>
              <button type="button">View all ideas →</button>
            </div>

            <div class="trend-table">
              <div class="trend-table-row trend-table-head">
                <span>#</span>
                <span>Idea</span>
                <span>Niche</span>
                <span>Trend Score</span>
              </div>

              ${finalTopics.slice(0, 5).map((topic, index) => `
                <div class="trend-table-row">
                  <span>${index + 1}</span>
                  <strong>${escapeHtml(topic)}</strong>
                  <em>${trendTopicTag(topic)}</em>
                  <b>${trendSpark(index)} 🔥 ${[98, 86, 74, 69, 65][index] || 72}</b>
                </div>
              `).join("")}
            </div>
          </article>

          <article class="trend-panel trend-audio-panel">
            <div class="trend-panel-head">
              <h3>🎵 Most Famous Music</h3>
              <button type="button">View all audio →</button>
            </div>

            <div class="trend-audio-list">
              ${finalAudio.slice(0, 5).map((audio, index) => `
                <div class="trend-audio-item">
                  <div class="trend-audio-index">${index + 1}</div>
                  <button class="trend-play-btn" type="button">▶</button>
                  <div>
                    <strong>${escapeHtml(audio)}</strong>
                    <span>${["2:31", "1:58", "1:44", "0:15", "2:07"][index] || "1:30"}</span>
                  </div>
                  <div class="trend-wave">${audioWave()}</div>
                  <em>${["128K", "96K", "82K", "71K", "63K"][index] || "58K"} uses</em>
                  <div class="trend-mini-platforms">
                    <span>▶</span><span>♪</span><span>◎</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </article>

          <article class="trend-panel trend-chart-panel">
            <div class="trend-panel-head">
              <h3>📈 Topic Momentum</h3>
              <button type="button">Last 7 Days</button>
            </div>
            <div class="trend-line-chart">
              ${trendLineChart()}
            </div>
          </article>

          <article class="trend-panel trend-heatmap-panel">
            <div class="trend-panel-head">
              <h3>Platform Heatmap</h3>
            </div>
            <div class="trend-heatmap">
              ${["YouTube Long", "YouTube Shorts", "TikTok", "Instagram Reels", "X / Twitter"].map((platform, row) => `
                <div class="trend-heatmap-row">
                  <span>${platform}</span>
                  <div>
                    ${Array.from({ length: 9 }).map((_, i) => `<i style="opacity:${0.18 + i * 0.09}; transform:scale(${0.75 + i * 0.03})"></i>`).join("")}
                  </div>
                </div>
              `).join("")}
            </div>
          </article>

          <article class="trend-panel trend-angle-panel">
            <div class="trend-panel-head">
              <h3>Recommended Angles</h3>
              <button type="button">View all →</button>
            </div>

            <div class="trend-angle-row">
              ${finalAngles.slice(0, 4).map((angle, index) => `
                <div class="trend-angle-card">
                  <div class="trend-angle-icon">${["🤖", "🚀", "🎥", "🎭"][index] || "✨"}</div>
                  <strong>${escapeHtml(angle)}</strong>
                  <p>${["Focus on time-saving AI tools for creators.", "Break down your growth journey and key lessons.", "Lifestyle + behind-the-scenes content performs well.", "Low-competition faceless content angle."][index]}</p>
                  <span>${index === 3 ? "Medium Potential" : "High Potential"} · ${[91, 86, 83, 79][index]}/100</span>
                </div>
              `).join("")}
            </div>
          </article>

        </div>

        <aside class="trend-right-sidebar">
          <article class="trend-panel trend-insight-card">
            <div class="trend-live-badge">● Live</div>
            <h3>✨ AI Trend Insight</h3>
            <div class="trend-bot-box">
              <div class="trend-bot-icon">🤖</div>
              <p>
                ${escapeHtml(report.hitOrMiss || report.whyNow || "Creators are leaning into practical AI tools, faceless growth stories, and productivity hacks. Search demand is rising across YouTube and TikTok.")}
              </p>
            </div>

            <h4>Why this trend is hot</h4>
            <ul>
              <li>Search intention is rising across platforms</li>
              <li>High retention on how-to and tool content</li>
              <li>Growing creator interest in AI workflows</li>
              <li>Low competition window for new ideas</li>
            </ul>

            <h4>Content Suggestions</h4>
            <div class="trend-suggestion-list">
              <button type="button">Top 5 AI Tools I Use Everyday →</button>
              <button type="button">I Tried 10 Viral Productivity Hacks →</button>
              <button type="button">How I Edit 10x Faster With AI →</button>
              <button type="button">Build a Faceless Channel Step-by-Step →</button>
            </div>

            <button class="trend-main-btn full" type="button">Turn into Idea ✨</button>
          </article>

          <article class="trend-panel trend-privacy-card">
            <div class="trend-shield">🛡️</div>
            <h3>Privacy-First</h3>
            <p>Your data stays yours. We do not train on your content. No data shared.</p>
            <div class="trend-privacy-button">🔒 No data shared</div>
          </article>
        </aside>
      </div>
    </div>
  `;
}

function trendMetricCard(label, value, status, color) {
  return `
    <article class="trend-panel trend-metric-card trend-${color}">
      <div class="trend-info-line">
        <span>${escapeHtml(label)}</span>
        <small>ⓘ</small>
      </div>

      <div class="trend-metric-main">
        <strong>${escapeHtml(value || "--")}</strong>
        <small>/100</small>
      </div>

      <p>${escapeHtml(status)}</p>

      <div class="trend-mini-spark">
        ${miniSparklineSvg(value ? [28, 36, 32, 45, 48, 57, 52, 68, Number(value)] : [])}
      </div>
    </article>
  `;
}

function trendOpportunityCard(score) {
  return `
    <article class="trend-panel trend-opportunity-card">
      <div class="trend-info-line">
        <span>Opportunity Score</span>
        <small>ⓘ</small>
      </div>

      <div class="trend-ring-wrap">
        <div class="trend-ring" style="--score:${Number(score || 0)}">
          <strong>${escapeHtml(score || "--")}</strong>
          <small>/100</small>
        </div>
      </div>

      <p>${escapeHtml(scoreLabel(Number(score || 0)))}</p>
    </article>
  `;
}

function trendEmptyState() {
  return `
    <div class="trend-empty-state">
      <div class="trend-empty-orb">📈</div>
      <h3>No trend report yet</h3>
      <p>Run an analysis to generate a dashboard with trending topics, famous music, platform opportunity scores, and recommended content angles.</p>
      <button class="trend-main-btn" type="button" data-action="v4-analyze-trends">Analyze Trends</button>
    </div>
  `;
}

function trendTopicTag(topic) {
  const text = String(topic || "").toLowerCase();

  if (text.includes("ai")) return "AI / Tools";
  if (text.includes("short")) return "Shorts";
  if (text.includes("grow") || text.includes("subs")) return "Growth";
  if (text.includes("life")) return "Lifestyle";
  if (text.includes("money")) return "Finance";
  if (text.includes("faceless")) return "Faceless";

  return "Creator";
}

function trendSpark(index) {
  const colors = ["#27f58a", "#9b5cff", "#24c6ff", "#f7a21b", "#ff4fd8"];
  const color = colors[index % colors.length];

  return `
    <svg width="54" height="20" viewBox="0 0 54 20" aria-hidden="true">
      <polyline points="2,15 9,12 15,14 21,8 28,10 35,5 42,7 52,2"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"/>
    </svg>
  `;
}

function audioWave() {
  return `
    <svg width="96" height="24" viewBox="0 0 96 24" aria-hidden="true">
      ${Array.from({ length: 24 }).map((_, i) => {
        const h = [6, 11, 17, 9, 20, 13, 7, 15, 22, 11, 16, 8, 19, 14, 6, 12, 18, 10, 21, 13, 7, 16, 11, 20][i];
        const x = i * 4;
        return `<rect x="${x}" y="${12 - h / 2}" width="2" height="${h}" rx="1" fill="#9b5cff" opacity="${0.45 + (i % 4) * 0.13}"/>`;
      }).join("")}
    </svg>
  `;
}

function trendLineChart() {
  return `
    <svg viewBox="0 0 640 210" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="trendAreaPurple" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <g opacity="0.18" stroke="#ffffff">
        <line x1="0" y1="40" x2="640" y2="40"/>
        <line x1="0" y1="90" x2="640" y2="90"/>
        <line x1="0" y1="140" x2="640" y2="140"/>
        <line x1="0" y1="190" x2="640" y2="190"/>
      </g>

      <path d="M0,150 C60,120 100,95 150,102 C210,110 230,55 290,72 C350,90 375,58 430,66 C485,76 520,42 640,36 L640,210 L0,210 Z"
        fill="url(#trendAreaPurple)"/>

      <path d="M0,150 C60,120 100,95 150,102 C210,110 230,55 290,72 C350,90 375,58 430,66 C485,76 520,42 640,36"
        fill="none"
        stroke="#9b5cff"
        stroke-width="4"
        stroke-linecap="round"/>

      <path d="M0,170 C65,145 105,132 160,136 C210,140 250,110 305,120 C365,130 405,98 455,104 C520,111 560,85 640,74"
        fill="none"
        stroke="#24c6ff"
        stroke-width="3"
        stroke-linecap="round"/>

      <path d="M0,180 C70,160 120,150 180,152 C240,154 270,130 330,136 C390,142 430,120 490,122 C540,124 585,105 640,98"
        fill="none"
        stroke="#27f58a"
        stroke-width="3"
        stroke-linecap="round"/>
    </svg>
  `;
}

function scriptsPageV4() {
  const latest = activeScript();
  const chats = normalizeList(state.scriptChats);
  return `
    <section class="page page-v4">
      <div class="studio-chat-layout script-studio-layout ${state.scriptAssistantOpen === false ? "assistant-closed" : ""}">
        <aside class="thread-rail dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">Saved chats</span><h3>Scripts</h3></div>
            <button class="button secondary compact-button" type="button" data-action="v4-new-script-chat">New</button>
          </div>
          <div class="thread-list">
            ${chats.length ? chats.map((chat) => threadButton(chat, state.activeScriptChatId, "v4-open-script-chat")).join("") : emptyMini("Generate a script to save the first chat.")}
          </div>
          <form class="compact-form script-brief-form" id="script-form">
            ${selectCustom("script-idea", "Idea", ideaOptions(), state.selectedIdeaId || "Custom")}
            ${fieldV4("script-custom-idea", "Custom idea", "", "text", "Example: Brain rot Roblox games and children")}
            ${selectCustom("script-platform", "Platform", ["YouTube long video", "YouTube Short", "TikTok/Reel/Short", "Instagram", "Podcast", "Ad", "Short film", "Custom"])}
            ${selectCustom("script-length", "Length", ["30 seconds", "60 seconds", "2 minutes", "5 minutes", "8 minutes", "12 minutes", "Custom"])}
            ${selectCustom("script-format", "Format", ["talking head", "commentary", "documentary", "tutorial", "story video", "skit", "product review", "short film", "Custom"])}
            ${fieldV4("script-audience", "Audience", state.creator.audience, "text", "Who is this for?")}
            ${textareaV4("script-notes", "What must be included?", "", "Facts, examples, claims to avoid, sources, personal story, call to action.", "full")}
            <button class="button primary full-width" type="button" data-action="v4-generate-script">Generate script</button>
          </form>
        </aside>

        <main class="script-document-wrap">
          <div class="card-topline document-topline">
            <div><span class="section-kicker">Script document</span><h3>${latest?.title ? escapeHtml(latest.title) : "No script yet"}</h3></div>
            <div class="action-row compact-actions">
              ${latest ? `<button class="button secondary" type="button" data-action="v4-download-script">Download PDF</button>` : ""}
              ${latest ? `<button class="button primary" type="button" data-action="v4-run-script-credibility">Credibility check</button>` : ""}
              <button class="button secondary" type="button" data-action="v4-toggle-script-assistant">${state.scriptAssistantOpen === false ? "Open chat" : "Close chat"}</button>
            </div>
          </div>
          <div id="script-output">
            ${latest ? scriptOutputV4(latest) : emptyPanel("Generate a speaking script", "Fill the brief on the left. Contentus will create a real presenter script with exact words to say, beats, visual notes, and credibility reminders.", "Saved chats appear on the left. Use the assistant to request changes and implement suggestions.")}
          </div>
          ${state.scriptCredibilityReport ? credibilityReportPanel(state.scriptCredibilityReport) : ""}
        </main>

        <aside class="assistant-panel dashboard-card">
          ${scriptAssistantPanel(latest)}
        </aside>
      </div>
    </section>
  `;
}

function scriptButtonsV4() {
  return `
    <div class="tool-button-strip">
      ${["Make more like me", "Make shorter", "Make funnier", "Make more emotional", "Make more cinematic", "Make less generic"].map((label) => `<button class="button secondary" type="button" data-action="v4-transform-script" data-transform="${escapeHtml(label)}">${label}</button>`).join("")}
      <button class="button primary" type="button" data-action="v4-run-auth-from-script">Run Authenticity Guard</button>
      <button class="button secondary" type="button" data-action="v4-save-script-calendar">Save to calendar</button>
    </div>
  `;
}

function scriptOutputV4(script) {
  const beats = normalizeList(script.beats || script.sections || script.scenes);
  return `
    <article class="script-document script-output-card">
      <div class="score-grid">
        ${scoreChip("Authenticity", `${script.authenticityScore || "?"}%`)}
        ${scoreChip("Generic risk", script.genericRisk || "Low")}
        ${scoreChip("Length", script.lengthLabel || script.targetLength || "Custom")}
        ${scoreChip("Words", formatNumber(wordCount(script.script || "")))}
      </div>
      <div class="script-page">
        <header class="script-doc-header">
          <span>${escapeHtml(script.platform || "Content")}</span>
          <h2>${escapeHtml(script.title || "Untitled script")}</h2>
          <p>${escapeHtml(script.logline || script.personalizationTip || "A speaking-first script built for the selected platform.")}</p>
        </header>
        ${script.coldOpen ? scriptSpeechSection("Cold open", script.coldOpen, "0:00") : ""}
        ${script.intro ? scriptSpeechSection("Intro", script.intro, "0:10") : ""}
        ${beats.length ? beats.map((beat, index) => scriptBeatBlock(beat, index)).join("") : scriptSpeechSection("Full spoken script", script.script || "", "Script")}
        ${script.outro ? scriptSpeechSection("Ending", script.outro, "Final beat") : ""}
      </div>
      <div class="script-production-grid">
        ${sectionBlock("Hook options", listText(script.hookOptions))}
        ${sectionBlock("Visual notes", listText(script.visualNotes || script.shotList || script.broll))}
        ${sectionBlock("On-screen text", listText(script.onScreenText))}
        ${sectionBlock("Caption", script.caption)}
        ${sectionBlock("Credibility notes", listText(script.credibilityNotes || script.claimsToVerify))}
        ${sectionBlock("Personalization tip", script.personalizationTip)}
      </div>
    </article>
  `;
}

function scriptSpeechSection(title, text, time = "") {
  if (!text) return "";
  return `
    <section class="script-speech-section">
      <div class="script-section-label"><span>${escapeHtml(time)}</span><strong>${escapeHtml(title)}</strong></div>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function scriptBeatBlock(beat, index) {
  const label = beat.time || beat.timestamp || `Beat ${index + 1}`;
  const title = beat.title || beat.name || `Section ${index + 1}`;
  const speech = beat.spokenLines || beat.speech || beat.script || beat.text || String(beat);
  return `
    <section class="script-speech-section">
      <div class="script-section-label"><span>${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong></div>
      <p>${escapeHtml(speech)}</p>
      ${beat.visual ? `<small><strong>Visual:</strong> ${escapeHtml(beat.visual)}</small>` : ""}
      ${beat.intent ? `<small><strong>Purpose:</strong> ${escapeHtml(beat.intent)}</small>` : ""}
    </section>
  `;
}

function scriptAssistantPanel(script) {
  const chat = activeScriptChat();
  return `
    <div class="card-topline">
      <div><span class="section-kicker">Assistant</span><h3>Refine the script</h3></div>
    </div>
    <div class="assistant-messages">
      ${chat?.messages?.length ? chat.messages.map(chatBubble).join("") : emptyMini("Ask for changes like: make the hook more direct, add examples, verify claims, or make it less dramatic.")}
    </div>
    <div class="tool-button-strip compact-strip">
      ${["Tighter hook", "More human", "Add proof", "Simplify wording"].map((label) => `<button class="button secondary" type="button" data-action="v4-script-assistant-suggest" data-prompt="${escapeHtml(label)}">${label}</button>`).join("")}
    </div>
    <div class="assistant-compose">
      <textarea id="script-chat-input" placeholder="Tell Contentus what to change..."></textarea>
      <button class="button primary" type="button" data-action="v4-script-chat-send" ${script ? "" : "disabled"}>Send</button>
    </div>
    <button class="button secondary full-width" type="button" data-action="v4-run-script-credibility" ${script ? "" : "disabled"}>Credibility check</button>
  `;
}

function credibilityReportPanel(report) {
  return `
    <article class="dashboard-card credibility-report">
      <div class="card-topline">
        <div><span class="section-kicker">Credibility report</span><h3>${escapeHtml(report.verdict || "Review needed")}</h3></div>
        <span class="badge ${Number(report.score || 0) > 79 ? "good" : "warn"}">${escapeHtml(report.score || "?")}/100</span>
      </div>
      <div class="score-grid">
        ${scoreChip("Claims", report.claimRisk || "Medium")}
        ${scoreChip("Audience trust", `${report.trustScore || "?"}%`)}
        ${scoreChip("Originality", `${report.originality || "?"}%`)}
      </div>
      <div class="list-stack">
        ${normalizeList(report.suggestions).map((item, index) => `
          <div class="insight-item">
            <strong>${escapeHtml(item.title || `Suggestion ${index + 1}`)}</strong>
            <p>${escapeHtml(item.reason || item.text || item)}</p>
            <button class="button secondary" type="button" data-action="v4-implement-script-suggestion" data-index="${index}">Implement suggestion</button>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function adStudioPageV4() {
  const latest = state.adProjects?.[0];
  return `
    <section class="page page-v4">
      <div class="builder-layout">
        <form class="tool-card compact-form" id="ad-form">
          <div class="card-topline"><div><span class="section-kicker">Ad and film</span><h3>Project controls</h3></div></div>
          ${selectCustom("ad-project-type", "Project type", ["advertisement", "short film", "product promo", "personal brand trailer", "social cause campaign", "mock brand collaboration", "Custom"])}
          ${textareaV4("ad-idea", "Product or story idea", "", "What is the product, cause, or story?", "full")}
          ${fieldV4("ad-audience", "Target audience", state.creator.audience, "text", "Who should care?")}
          ${selectCustom("ad-mood", "Mood", ["funny", "emotional", "cinematic", "dramatic", "inspirational", "mysterious", "fast-paced", "Custom"])}
          ${selectCustom("ad-length", "Length", ["15 seconds", "30 seconds", "60 seconds", "2 minutes", "Custom"])}
          ${selectCustom("ad-platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram", "LinkedIn", "Custom"])}
          ${fieldV4("ad-message", "Core message", "", "The one thing people should remember")}
          ${fieldV4("ad-cta", "CTA", "", "What should people do next?")}
          ${fieldV4("ad-language", "Language", "English", "text", "English, Hindi, Hinglish, etc.")}
          <button class="button primary full-width" type="button" data-action="v4-generate-ad">Generate project</button>
        </form>
        <section class="output-column">
          <div id="ad-output">${latest ? adOutputV4(latest) : emptyPanel("No ad or film project yet", "Generate a real concept from your product, story, audience, and Creator DNA.", "Outputs include emotional, funny, and cinematic versions.")}</div>
        </section>
      </div>
    </section>
  `;
}

function adOutputV4(project) {
  const versions = normalizeList(project.versions);
  return `
    <article class="dashboard-card">
      <div class="card-topline">
        <div><span class="section-kicker">Generated project</span><h3>${escapeHtml(project.title || project.concept || "Ad project")}</h3></div>
        <span class="badge good">${escapeHtml(project.recommendedVersion || project.recommended || "Recommended")}</span>
      </div>
      ${sectionBlock("Concept", project.concept)}
      ${sectionBlock("Script", project.script)}
      ${sectionBlock("Scene list", listText(project.sceneList || project.scenes))}
      ${sectionBlock("Shot list", listText(project.shotList))}
      ${sectionBlock("Storyboard", listText(project.storyboard || project.storyboardText))}
      ${sectionBlock("Voiceover", project.voiceover)}
      ${sectionBlock("Visual prompts", listText(project.visualPrompts))}
      ${sectionBlock("Caption", project.caption)}
      ${sectionBlock("Thumbnail text", project.thumbnailText)}
      ${sectionBlock("AI disclosure line", project.disclosure || project.aiDisclosureLine)}
      <div class="comparison-grid">
        ${versions.map((version) => `
          <div class="comparison-card">
            <span class="section-kicker">${escapeHtml(version.name || version.version || "Version")}</span>
            <strong>${escapeHtml(version.bestForPlatform || version.platform || "Platform fit")}</strong>
            <p>${escapeHtml(version.concept || version.script || "")}</p>
            <div class="score-grid">
              ${scoreChip("Authenticity", `${version.authenticityScore || version.authenticity || "?"}%`)}
              ${scoreChip("Viral", version.viralPotential || "Medium")}
              ${scoreChip("Risk", version.riskLevel || "Low")}
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function thumbnailPageV4() {
  const chat = activeThumbnailChat();
  return `
    <section class="page page-v4">
      <div class="thumbnail-studio-layout">
        <aside class="thread-rail dashboard-card">
          <div class="card-topline">
            <div><span class="section-kicker">Saved chats</span><h3>Thumbnails</h3></div>
            <button class="button secondary compact-button" type="button" data-action="v4-new-thumbnail-chat">New</button>
          </div>
          <div class="thread-list">
            ${state.thumbnailChats.length ? state.thumbnailChats.map((item) => threadButton(item, state.activeThumbnailChatId, "v4-open-thumbnail-chat")).join("") : emptyMini("Generate a thumbnail to save a design chat.")}
          </div>
          <form class="compact-form" id="thumbnail-form">
            ${selectCustom("thumb-idea", "Idea", ideaOptions(), state.selectedIdeaId || "Custom")}
            ${fieldV4("thumb-title", "Main text", selectedIdea()?.title || "", "text", "Example: Roblox Brain Rot?")}
            ${textareaV4("thumb-idea-brief", "Type your thumbnail idea", "", "Describe the visual, emotion, object, person, contrast, or what area you want to improve.", "full")}
            <button class="button primary full-width" type="button" data-action="v4-generate-thumbnail">Generate thumbnail</button>
            <button class="button secondary full-width" type="button" data-action="v4-download-thumbnail">Download PNG</button>
          </form>
        </aside>

        <section class="thumbnail-canvas-column">
          <div class="card-topline">
            <div><span class="section-kicker">Generated design</span><h3>${escapeHtml(chat?.title || "Thumbnail canvas")}</h3></div>
            <span class="badge">Drag on canvas to box an area</span>
          </div>
          <div class="thumbnail-canvas-frame">
            <canvas id="thumbnail-canvas" width="1280" height="720" aria-label="Generated thumbnail preview"></canvas>
          </div>
          <div id="thumbnail-copy-output" class="dashboard-card mini-output">${chat?.messages?.length ? chat.messages.map(chatBubble).join("") : emptyMini("Thumbnail suggestions and updates will appear here.")}</div>
        </section>

        <aside class="assistant-panel dashboard-card">
          <div class="card-topline"><div><span class="section-kicker">Suggest updates</span><h3>Design assistant</h3></div></div>
          <p class="muted">Select a region on the canvas, then ask for a change. Contentus will update the generated layout and save the chat.</p>
          <div class="assistant-messages compact-chat">
            ${chat?.messages?.length ? chat.messages.map(chatBubble).join("") : emptyMini("Try: make text shorter, add stronger contrast, focus the face area, or make it less cluttered.")}
          </div>
          <div class="tool-button-strip compact-strip">
            ${["More contrast", "Shorter text", "Bigger focal point", "Less clutter"].map((label) => `<button class="button secondary" type="button" data-action="v4-thumbnail-suggest" data-prompt="${escapeHtml(label)}">${label}</button>`).join("")}
          </div>
          <div class="assistant-compose">
            <textarea id="thumb-chat-input" placeholder="Describe the update you want..."></textarea>
            <button class="button primary" type="button" data-action="v4-thumbnail-chat-send">Update</button>
          </div>
        </aside>
      </div>
    </section>
  `;
}

function authenticityPageV4() {
  const result = state.lastAuthenticity;
  return `
    <section class="page page-v4">
      <div class="authenticity-grid">
        <form class="tool-card authenticity-input-card" id="auth-form-v4">
          <div class="card-topline"><div><span class="section-kicker">Authenticity Guard</span><h3>Paste a draft</h3></div></div>
          <textarea id="auth-input" placeholder="Paste script, caption, ad copy, or a generated draft here."></textarea>
          <button class="button primary" type="button" data-action="v4-score-auth">Score authenticity</button>
        </form>
        <section id="auth-output" class="auth-output-v4">
          ${result ? authOutputV4(result) : emptyPanel("No score yet", "Paste content and Contentus will compare it against your Creator DNA.", "Scores include voice match, generic risk, originality, audience fit, believability, and brand safety.")}
        </section>
      </div>
    </section>
  `;
}

function authOutputV4(result) {
  const score = result.authenticityScore || result.score || 0;
  return `
    <article class="dashboard-card guard-result-card">
      <div class="guard-score">
        <span>Authenticity Score</span>
        <strong>${escapeHtml(score)}</strong>
        <small>${escapeHtml(result.label || "Needs review")}</small>
      </div>
      <div class="score-grid">
        ${scoreChip("Voice", `${result.voiceMatch || result.voice || "?"}%`)}
        ${scoreChip("Tone", `${result.toneMatch || result.tone || "?"}%`)}
        ${scoreChip("Audience", `${result.audienceFit || result.audience || "?"}%`)}
        ${scoreChip("Originality", `${result.originalityScore || result.originality || "?"}%`)}
        ${scoreChip("Generic risk", result.genericRisk || result.risk || "?")}
        ${scoreChip("Brand safety", `${result.brandSafety || result.safety || "?"}%`)}
      </div>
      ${sectionBlock("Feedback", result.feedback)}
      ${sectionBlock("What to fix", listText(result.suggestions || result.tips))}
      ${sectionBlock("Rewritten version", result.rewrittenVersion || result.rewrite)}
      ${sectionBlock("Disclosure", result.disclosureRecommendation || result.disclosure)}
    </article>
  `;
}

function videoCheckerPageV4() {
  const latest = state.videoChecks[0];
  return `
    <section class="page page-v4">
      <div class="tool-grid-hero">
        <form class="dashboard-card compact-form" id="video-check-form">
          <div class="card-topline"><div><span class="section-kicker">Video Checker</span><h3>Upload or paste YouTube</h3></div></div>
          ${fieldV4("video-check-url", "YouTube video URL", "", "url", "Optional public video URL")}
          <div class="form-field">
            <label for="video-check-file">Upload video</label>
            <input id="video-check-file" type="file" accept="video/*,audio/*">
            <small>Gemini can inspect supported media when your API key is configured.</small>
          </div>
          ${textareaV4("video-check-context", "Context", "", "Target audience, platform, goal, concerns, or what you want improved.", "full")}
          <button class="button primary full-width" type="button" data-action="v4-video-check">Analyze video</button>
        </form>
        <section id="video-check-output" class="output-column">
          ${latest ? videoCheckOutput(latest) : emptyPanel("No video checked yet", "Upload a video/audio sample or paste a YouTube URL. Contentus scores audio, visuals, title, thumbnail, pacing, and audience fit.", "The report is detailed but written for a creator, not a data scientist.")}
        </section>
      </div>
    </section>
  `;
}

function videoCheckOutput(report) {
  return `
    <article class="dashboard-card report-card">
      <div class="card-topline">
        <div><span class="section-kicker">Video report</span><h3>${escapeHtml(report.title || "Video analysis")}</h3></div>
        <span class="badge ${Number(report.totalScore || 0) > 74 ? "good" : "warn"}">${escapeHtml(report.totalScore || "?")}/100</span>
      </div>
      <div class="score-grid">
        ${scoreChip("Audio", `${report.audioScore || "?"}%`)}
        ${scoreChip("Visuals", `${report.visualScore || "?"}%`)}
        ${scoreChip("Title", `${report.titleScore || "?"}%`)}
        ${scoreChip("Thumbnail", `${report.thumbnailScore || "?"}%`)}
        ${scoreChip("Pacing", `${report.pacingScore || "?"}%`)}
        ${scoreChip("Audience", report.targetAudience || "Unknown")}
      </div>
      ${sectionBlock("Summary", report.summary)}
      ${sectionBlock("What is working", listText(report.working))}
      ${sectionBlock("What to improve", listText(report.improvements))}
      ${sectionBlock("Audience currently reached", report.audienceFit)}
      ${sectionBlock("Next edit checklist", listText(report.editChecklist))}
    </article>
  `;
}

function youtubeGrowthPageV4() {
  const yt = state.youtube;
  const videos = normalizeList(yt?.videos || yt?.recentVideos);
  const selected = selectedVideo();
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero youtube-hero-v5" data-tour-target="youtube-growth">
        <div>
          <p class="section-kicker">YouTube + Growth</p>
          <h2>${yt?.channel?.title || "Link your public channel"}</h2>
          <p class="muted">Paste a public channel, handle, or video URL. Contentus reads public performance, helps choose a video, and turns comments into creator-safe next actions.</p>
        </div>
        <form class="inline-connect" id="youtube-form">
          <input id="youtube-input" placeholder="@handle, channel URL, or video URL">
          <button class="button primary" type="button" data-action="v4-link-youtube">Link channel</button>
        </form>
      </div>

      ${yt ? `
        <article class="dashboard-card youtube-channel-card">
          ${yt.channel?.thumbnail ? `<img class="channel-avatar" src="${escapeHtml(yt.channel.thumbnail)}" alt="">` : `<span class="channel-avatar placeholder"></span>`}
          <div>
            <span class="section-kicker">Connected channel</span>
            <h3>${escapeHtml(yt.channel?.title || "YouTube channel")}</h3>
            <p class="muted">${escapeHtml(yt.channel?.description || "Public YouTube Data API connection is active.")}</p>
          </div>
          <div class="channel-stat-row">
            ${scoreChip("Subscribers", formatNumber(yt.channel?.subscribers))}
            ${scoreChip("Total views", formatNumber(yt.channel?.views))}
            ${scoreChip("Videos", formatNumber(yt.channel?.videoCount || videos.length))}
          </div>
        </article>

        <div class="youtube-workspace-v5">
          <article class="dashboard-card video-browser-card">
            <div class="card-topline"><div><span class="section-kicker">Choose a video</span><h3>Recent uploads</h3></div></div>
            <div class="video-table video-table-v5">
              ${videos.length ? videos.map((video) => videoRowV5(video)).join("") : emptyMini("No recent public videos found.")}
            </div>
          </article>
          <aside class="dashboard-card selected-video-card">
            <div class="card-topline"><div><span class="section-kicker">Selected video</span><h3>${escapeHtml(selected?.title || "No video selected")}</h3></div></div>
            ${selected ? selectedVideoPanel(selected) : emptyMini("Pick a video to inspect comments and growth actions.")}
          </aside>
        </div>

        <div class="growth-grid-v5">
          ${growthInsightsFromVideos(videos).map((item) => `<article class="dashboard-card insight-card-v5">${insight(item.title, item.text)}</article>`).join("")}
          <article class="dashboard-card google-connect-card">
            <span class="section-kicker">Reply posting</span>
            <h3>${state.google?.youtubePosting ? "Google connected" : "Connect Google to post replies"}</h3>
            <p class="muted">Contentus always drafts first. Posting requires Google OAuth and your approval on each reply.</p>
            <button class="button ${state.google?.youtubePosting ? "secondary" : "primary"}" type="button" data-action="v4-google-connect" data-scope="youtube">${state.google?.youtubePosting ? "Reconnect Google" : "Enable approved posting"}</button>
          </article>
        </div>
      ` : emptyPanel("No YouTube channel linked", "Paste your public YouTube handle, channel URL, or video URL to fetch real channel/video data.", "Private watch time, retention, and CTR require Google OAuth credentials.")}
    </section>
  `;
}

function videoRowV4(video) {
  return videoRowV5(video);
}

function videoRowV5(video) {
  const disabled = Boolean(video.commentsDisabled);
  const active = selectedVideo()?.id === video.id;
  return `
    <div class="video-row video-row-v5 ${active ? "active" : ""}">
      ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">` : `<span class="thumb-placeholder"></span>`}
      <div>
        <strong>${escapeHtml(video.title || "Untitled video")}</strong>
        <small>${formatNumber(video.views)} views - ${formatNumber(video.likes)} likes - ${formatNumber(video.comments)} comments - ${formatDate(video.publishedAt)}</small>
      </div>
      <div class="video-row-actions">
        <button class="button secondary" type="button" data-action="v4-select-video" data-video-id="${escapeHtml(video.id)}">Select</button>
        <button class="button ${disabled ? "secondary" : "primary"}" type="button" data-action="v4-load-comments" data-video-id="${escapeHtml(video.id)}" ${disabled ? "disabled" : ""}>${disabled ? "Comments disabled" : "Open comments"}</button>
      </div>
    </div>
  `;
}

function selectedVideoPanel(video) {
  return `
    ${video.thumbnail ? `<img class="selected-video-thumb" src="${escapeHtml(video.thumbnail)}" alt="">` : ""}
    <div class="score-grid compact-score-grid">
      ${scoreChip("Views", formatNumber(video.views))}
      ${scoreChip("Likes", formatNumber(video.likes))}
      ${scoreChip("Comments", video.commentsDisabled ? "Disabled" : formatNumber(video.comments))}
    </div>
    <div class="list-stack">
      ${insight("Repeat", `Turn the strongest idea in this video into a follow-up with a sharper proof point.`)}
      ${insight("Improve", "If comments are low, test a clearer question in the outro and pinned comment.")}
      ${insight("Community", video.commentsDisabled ? "Comments are disabled for this video. Choose another video to analyze comments." : "Open comments to draft replies and find video ideas.")}
    </div>
    <div class="action-row">
      <button class="button primary" type="button" data-action="v4-detailed-video-analysis" data-video-id="${escapeHtml(video.id)}">Detailed analysis</button>
      <button class="button secondary" type="button" data-action="v4-video-to-publish" data-video-id="${escapeHtml(video.id)}">Prepare publishing pack</button>
    </div>
    ${detailedVideoReportFor(video.id) ? detailedVideoReportOutput(detailedVideoReportFor(video.id)) : ""}
  `;
}

function detailedVideoReportOutput(report) {
  return `
    <article class="mini-report">
      <span class="section-kicker">Detailed analysis</span>
      <h4>${escapeHtml(report.verdict || "Growth diagnosis")}</h4>
      <div class="mini-bars">
        ${(report.graphs || []).map((item) => `<span style="--w:${Number(item.value || 0)}%"><b>${escapeHtml(item.label)}</b></span>`).join("")}
      </div>
      ${sectionBlock("Improve this video", listText(report.improvements))}
      ${sectionBlock("Follow-up ideas", listText(report.followUps))}
    </article>
  `;
}

function communityPageV4() {
  const commentsList = normalizeList(state.comments);
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  const selected = selectedVideo();
  const loadedForSelected = commentsList.filter((comment) => !selected?.id || comment.videoId === selected.id);
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero community-hero-v5">
        <div>
          <p class="section-kicker">Community Manager</p>
          <h2>${selected ? escapeHtml(selected.title) : "Choose a video to manage comments"}</h2>
          <p class="muted">Contentus creates reply drafts. Posting requires you to connect Google and approve each reply.</p>
        </div>
        <div class="action-row">
          <button class="button secondary" type="button" data-action="v4-google-connect" data-scope="youtube">${state.google?.youtubePosting ? "Google connected" : "Enable posting"}</button>
          <button class="button primary" type="button" data-action="v4-generate-replies" ${loadedForSelected.length ? "" : "disabled"}>Generate reply drafts</button>
        </div>
      </div>

      <div class="community-workspace-v5" id="comments-output">
        <aside class="dashboard-card community-video-picker">
          <div class="card-topline"><div><span class="section-kicker">Videos</span><h3>Pick one</h3></div></div>
          <div class="video-picker-list">
            ${videos.length ? videos.map((video) => `
              <button class="video-picker-item ${selected?.id === video.id ? "active" : ""}" type="button" data-action="v4-select-video" data-video-id="${escapeHtml(video.id)}">
                ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">` : `<span class="thumb-placeholder"></span>`}
                <span><strong>${escapeHtml(video.title || "Untitled video")}</strong><small>${video.commentsDisabled ? "Comments disabled" : `${formatNumber(video.comments)} comments`}</small></span>
              </button>
            `).join("") : emptyMini("Link a YouTube channel first.")}
          </div>
          ${selected ? `<button class="button primary full-width" type="button" data-action="v4-load-comments" data-video-id="${escapeHtml(selected.id)}" ${selected.commentsDisabled ? "disabled" : ""}>${selected.commentsDisabled ? "Comments disabled" : "Load comments"}</button>` : ""}
        </aside>

        <section class="community-comments-list">
          ${loadedForSelected.length ? loadedForSelected.map(commentCardV4).join("") : emptyPanel("No comments loaded", selected?.commentsDisabled ? "Comments are disabled for this video. Choose another video." : "Choose a video and load comments to draft replies.", "Each reply draft will show the source video and require approval before posting.")}
        </section>

        <aside class="dashboard-card reply-help-card">
          <span class="section-kicker">How posting works</span>
          <h3>${state.google?.youtubePosting ? "Ready to approve replies" : "Connect Google to post"}</h3>
          <p class="muted">Contentus never auto-posts. It drafts a reply, shows the video and comment, then waits for you to click Post Reply.</p>
          <div class="list-stack">
            ${insight("1. Connect Google", "Enable YouTube posting permission with OAuth.")}
            ${insight("2. Generate drafts", "Contentus writes replies in your Creator DNA voice.")}
            ${insight("3. Approve each reply", "Only the replies you click are posted.")}
          </div>
          <button class="button ${state.google?.youtubePosting ? "secondary" : "primary"} full-width" type="button" data-action="v4-google-connect" data-scope="youtube">${state.google?.youtubePosting ? "Reconnect Google" : "Enable approved posting"}</button>
        </aside>
      </div>
    </section>
  `;
}

function commentCardV4(comment) {
  return `
    <article class="dashboard-card comment-card">
      <div class="card-topline">
        <div><span class="section-kicker">${escapeHtml(comment.sentiment || "comment")}</span><h3>${escapeHtml(comment.author || "Viewer")}</h3><small>${escapeHtml(videoTitleFor(comment.videoId))}</small></div>
        <span class="badge ${comment.sentiment === "toxic" ? "bad" : comment.sentiment === "critical" ? "warn" : "good"}">${escapeHtml(comment.importance || "normal")}</span>
      </div>
      <p>${escapeHtml(comment.text || comment.commentText || "")}</p>
      ${comment.suggestedReply ? sectionBlock("Suggested reply", comment.suggestedReply) : ""}
      <div class="action-row">
        <button class="button secondary" type="button" data-action="copy" data-copy="${escapeHtml(comment.suggestedReply || "")}">Copy reply</button>
        <button class="button secondary" type="button" data-action="v4-comment-to-idea" data-comment-id="${escapeHtml(comment.id)}">Turn into idea</button>
        ${comment.suggestedReply ? `<button class="button primary" type="button" data-action="v4-post-reply" data-comment-id="${escapeHtml(comment.id)}" ${state.google?.youtubePosting ? "" : "disabled"}>${comment.posted ? "Posted" : "Post reply"}</button>` : ""}
      </div>
    </article>
  `;
}

function calendarPageV4() {
  const items = normalizeList(state.calendar);
  const view = calendarViewDate();
  const cells = calendarCells(view);
  const googleEvents = normalizeList(state.googleCalendarEvents);
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero calendar-hero-v5" data-tour-target="calendar">
        <div>
          <p class="section-kicker">Content Calendar</p>
          <h2>${monthLabel(view)}</h2>
          <p class="muted">${state.google?.calendar ? "Google Calendar is connected. App events can sync to Google." : "Connect Google Calendar to load and create events from Contentus."}</p>
        </div>
        <div class="action-row">
          <button class="button secondary" type="button" data-action="v4-calendar-nav" data-direction="today">Today</button>
          <button class="button secondary" type="button" data-action="v4-calendar-nav" data-direction="prev">Prev</button>
          <button class="button secondary" type="button" data-action="v4-calendar-nav" data-direction="next">Next</button>
          <button class="button secondary" type="button" data-action="v4-google-connect" data-scope="calendar">${state.google?.calendar ? "Reconnect Google" : "Link Google Calendar"}</button>
          <button class="button primary" type="button" data-action="v4-load-calendar">${state.google?.calendar ? "Refresh events" : "Load events"}</button>
        </div>
      </div>

      <div class="calendar-workspace-v5">
        <section class="dashboard-card calendar-panel-v5">
          <div class="calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<span>${day}</span>`).join("")}</div>
          <div class="calendar-grid calendar-v5">
            ${cells.map((cell) => calendarCellV5(cell, items, googleEvents)).join("")}
          </div>
        </section>

        <aside class="dashboard-card event-editor-v5">
          <span class="section-kicker">Add event</span>
          <h3>Create a calendar item</h3>
          <p class="muted">If Google Calendar is connected, this event is also created in Google Calendar.</p>
          <div class="form-field"><label for="calendar-title">Title</label><input id="calendar-title" placeholder="Film YouTube intro"></div>
          <div class="form-field"><label for="calendar-date">Date</label><input id="calendar-date" type="date" value="${formatInputDate(new Date())}"></div>
          <div class="form-row two">
            <div class="form-field"><label for="calendar-start">Start</label><input id="calendar-start" type="time" value="10:00"></div>
            <div class="form-field"><label for="calendar-end">End</label><input id="calendar-end" type="time" value="11:00"></div>
          </div>
          <div class="form-field"><label for="calendar-platform">Platform / type</label><input id="calendar-platform" placeholder="YouTube, Reel, writing, meeting"></div>
          <div class="form-field"><label for="calendar-notes">Notes</label><textarea id="calendar-notes" placeholder="What needs to happen?"></textarea></div>
          <button class="button primary full-width" type="button" data-action="v4-add-calendar-event">Add event</button>
          <button class="button secondary full-width" type="button" data-action="v4-weekly-plan">Generate weekly plan</button>
        </aside>
      </div>
      ${state.selectedCalendarDate ? calendarDayModal(state.selectedCalendarDate, items, googleEvents) : ""}
    </section>
  `;
}

function calendarCellV5(cell, items, googleEvents) {
  const dateKey = formatInputDate(cell.date);
  const appItems = items.filter((item) => item.date === dateKey || (!item.date && Number(item.day) === cell.date.getDate() && cell.inMonth));
  const gItems = googleEvents.filter((event) => event.date === dateKey);
  const allItems = [...gItems, ...appItems];
  return `
    <button class="calendar-day calendar-day-v5 ${cell.inMonth ? "" : "muted-day"} ${isToday(cell.date) ? "today" : ""}" type="button" data-action="v4-open-calendar-day" data-date="${dateKey}" data-day="${cell.date.getDate()}">
      <strong>${cell.date.getDate()}</strong>
      <div class="calendar-brief-list">
        ${allItems.slice(0, 3).map((item) => `<span class="calendar-brief ${item.source === "google" ? "google-event" : ""}">${escapeHtml(shortTitle(item.title))}</span>`).join("")}
        ${allItems.length > 3 ? `<span class="calendar-more">+${allItems.length - 3} more</span>` : ""}
      </div>
    </button>
  `;
}

function calendarDayModal(dateKey, items, googleEvents) {
  const dayItems = [
    ...googleEvents.filter((event) => event.date === dateKey).map((event) => ({ ...event, source: "Google" })),
    ...items.filter((item) => item.date === dateKey || (!item.date && Number(item.day) === Number(dateKey.slice(-2)))).map((item) => ({ ...item, source: item.platform || "Contentus" })),
  ].sort((a, b) => String(a.startTime || a.time || "").localeCompare(String(b.startTime || b.time || "")));
  return `
    <div class="modal-backdrop active" role="dialog" aria-modal="true">
      <article class="modal-panel day-modal-panel">
        <div class="card-topline">
          <div><span class="section-kicker">Day timetable</span><h3>${escapeHtml(formatDate(dateKey))}</h3></div>
          <button class="button secondary" type="button" data-action="v4-close-calendar-day">Close</button>
        </div>
        <div class="day-timeline">
          ${dayItems.length ? dayItems.map((item) => `
            <div class="timeline-row">
              <time>${escapeHtml(item.startTime || item.time || "All day")}</time>
              <div>
                <strong>${escapeHtml(item.title || "Untitled")}</strong>
                <p>${escapeHtml(item.notes || item.status || item.source || "")}</p>
              </div>
            </div>
          `).join("") : emptyPanel("Nothing planned", "Add an event from the calendar panel and it will appear here.", "Google events show here after linking and loading Calendar.")}
        </div>
      </article>
    </div>
  `;
}

function publishingPageV4() {
  const latest = state.publishingJobs[0];
  return `
    <section class="page page-v4">
      <div class="tool-grid-hero">
        <form class="dashboard-card compact-form" id="publish-form">
          <div class="card-topline"><div><span class="section-kicker">Publishing Hub</span><h3>One video, many platforms</h3></div></div>
          ${selectCustom("publish-source", "Source", publishingSourceOptions(), state.selectedVideoId || "Custom")}
          ${fieldV4("publish-title", "Upload title", selectedVideo()?.title || "", "text", "Title for YouTube or export pack")}
          <div class="form-field">
            <label for="publish-file">Video file</label>
            <input id="publish-file" type="file" accept="video/*">
            <small>YouTube upload requires Google OAuth with upload permission. Other platforms export ready-to-post packs.</small>
          </div>
          <div class="toggle-group platform-toggle-group">
            ${["YouTube", "TikTok", "Instagram Reels", "LinkedIn", "X/Twitter"].map((platform) => `<button class="pill-button active" type="button" data-action="toggle-pill">${platform}</button>`).join("")}
          </div>
          ${textareaV4("publish-notes", "Publishing notes", "", "Any captions, compliance notes, or audience goals.", "full")}
          <button class="button primary full-width" type="button" data-action="v4-create-publish-pack">Create platform pack</button>
          <button class="button secondary full-width" type="button" data-action="v4-upload-youtube">Upload to YouTube</button>
        </form>
        <section id="publish-output" class="output-column">
          ${latest ? publishingJobOutput(latest) : emptyPanel("No publishing pack yet", "Upload a video or select a YouTube video. Contentus creates platform captions, descriptions, title variants, and repurpose instructions.", "Only YouTube upload can be automated from this app with Google OAuth. TikTok/Instagram need their own platform API credentials.")}
        </section>
      </div>
    </section>
  `;
}

function publishingJobOutput(job) {
  return `
    <article class="dashboard-card report-card">
      <div class="card-topline">
        <div><span class="section-kicker">Publishing pack</span><h3>${escapeHtml(job.title || "Untitled pack")}</h3></div>
        <span class="badge ${job.uploaded ? "good" : "warn"}">${job.uploaded ? "Uploaded" : "Ready"}</span>
      </div>
      <div class="list-stack">
        ${normalizeList(job.platforms).map((platform) => insight(platform.name || platform.platform, `${platform.title || ""} ${platform.caption || ""}`.trim())).join("")}
      </div>
      ${sectionBlock("Agent notes", listText(job.agentNotes))}
      ${job.youtubeUploadMessage ? sectionBlock("YouTube upload", job.youtubeUploadMessage) : ""}
    </article>
  `;
}

function coachPageV4() {
  const messages = normalizeList(state.coachChats);
  return `
    <section class="page page-v4">
      <div class="coach-layout">
        <article class="dashboard-card coach-context-card">
          <span class="section-kicker">Channel context</span>
          <h3>${escapeHtml(state.youtube?.channel?.title || "No YouTube channel linked")}</h3>
          <p class="muted">Ask what to improve, what videos to make next, or how to package your ideas without losing your voice.</p>
          <div class="score-grid">
            ${scoreChip("Ideas", state.ideas.length)}
            ${scoreChip("Scripts", state.scripts.length)}
            ${scoreChip("Videos", normalizeList(state.youtube?.videos).length)}
          </div>
          <div class="tool-button-strip compact-strip">
            ${["What should I make next?", "Why is my channel not growing?", "Improve my next 5 videos", "Find content gaps"].map((prompt) => `<button class="button secondary" type="button" data-action="v4-coach-prompt" data-prompt="${escapeHtml(prompt)}">${prompt}</button>`).join("")}
          </div>
        </article>
        <section class="dashboard-card coach-chat-card">
          <div class="assistant-messages coach-messages">
            ${messages.length ? messages.map(chatBubble).join("") : emptyPanel("Ask Contentus anything", "This is your strategy conversation. It uses your saved ideas, scripts, Creator DNA, and linked YouTube data.", "No private data leaves your workspace except what is sent to your configured AI provider for generation.")}
          </div>
          <div class="assistant-compose">
            <textarea id="coach-input" placeholder="Ask what to improve on your channel..."></textarea>
            <button class="button primary" type="button" data-action="v4-coach-send">Send</button>
          </div>
        </section>
      </div>
    </section>
  `;
}

function extensionPageV4() {
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero">
        <div>
          <p class="section-kicker">Chrome mini helper</p>
          <h2>Install from the project folder.</h2>
          <p class="muted">The extension can read the active page title and selected text, then suggest titles, descriptions, captions, and authenticity checks.</p>
        </div>
      </div>
      <div class="dashboard-grid dashboard-grid-v4">
        <article class="dashboard-card">
          <h3>Load unpacked</h3>
          <div class="list-stack">
            ${insight("Open Chrome extensions", "Go to chrome://extensions and enable Developer mode.")}
            ${insight("Load the folder", "Choose C:\\Users\\mitta\\Documents\\Contentus\\extension.")}
            ${insight("Pin Contentus", "Open any YouTube video, article, or draft and click the extension.")}
          </div>
        </article>
        <article class="dashboard-card">
          <h3>Mini helper abilities</h3>
          <div class="list-stack">
            ${insight("Suggest titles", "Uses page context and selected text to generate safer title angles.")}
            ${insight("Generate descriptions", "Creates YouTube and platform descriptions from the current page idea.")}
            ${insight("Make it mine", "Rewrites highlighted text as inspiration, not copying.")}
            ${insight("Authenticity check", "Scores selected drafts for generic language and voice fit.")}
          </div>
        </article>
      </div>
    </section>
  `;
}

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-custom-select]");
  if (select) {
    const input = document.querySelector(`#${select.dataset.customSelect}-custom`);
    if (input) input.hidden = select.value !== "Custom";
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (!action.startsWith("v4-")) return;

  if (action === "v4-analyze-dna") return handleAnalyzeDnaV4(button);
  if (action === "v4-save-dna") return handleSaveDnaV4();
  if (action === "v4-start-recording") return startVoiceRecording(button);
  if (action === "v4-stop-recording") return stopVoiceRecording();
  if (action === "v4-generate-ideas") return handleGenerateIdeasV4(button);
  if (action === "v4-use-idea") return handleUseIdeaV4(button.dataset.ideaId);
  if (action === "v4-save-idea-calendar") return saveIdeaToCalendar(button.dataset.ideaId);
  if (action === "v4-analyze-trends") return handleAnalyzeTrendsV4(button);
  if (action === "v4-generate-script") return handleGenerateScriptV4(button);
  if (action === "v4-transform-script") return handleTransformScriptV4(button);
  if (action === "v4-new-script-chat") return newScriptChat();
  if (action === "v4-open-script-chat") return openScriptChat(button.dataset.chatId);
  if (action === "v4-toggle-script-assistant") return toggleScriptAssistant();
  if (action === "v4-script-chat-send") return handleScriptChatSend(button);
  if (action === "v4-script-assistant-suggest") return handleScriptAssistantPrompt(button.dataset.prompt, button);
  if (action === "v4-run-script-credibility") return handleScriptCredibility(button);
  if (action === "v4-implement-script-suggestion") return implementScriptSuggestion(button.dataset.index);
  if (action === "v4-run-auth-from-script") return runAuthFromScriptV4();
  if (action === "v4-save-script-calendar") return saveScriptToCalendar();
  if (action === "v4-download-script") return downloadLatestScriptPdf();
  if (action === "v4-generate-ad") return handleGenerateAdV4(button);
  if (action === "v4-generate-thumbnail") return generateThumbnailCanvas();
  if (action === "v4-new-thumbnail-chat") return newThumbnailChat();
  if (action === "v4-open-thumbnail-chat") return openThumbnailChat(button.dataset.chatId);
  if (action === "v4-thumbnail-chat-send") return handleThumbnailChatSend(button);
  if (action === "v4-thumbnail-suggest") return handleThumbnailSuggestion(button.dataset.prompt, button);
  if (action === "v4-thumbnail-copy") return handleThumbnailCopy(button);
  if (action === "v4-download-thumbnail") return downloadThumbnailPng();
  if (action === "v4-video-check") return handleVideoCheckV4(button);
  if (action === "v4-score-auth") return handleScoreAuthenticityV4(button);
  if (action === "v4-link-youtube") return handleLinkYouTubeV4(button);
  if (action === "v4-select-video") return handleSelectVideoV4(button.dataset.videoId);
  if (action === "v4-detailed-video-analysis") return handleDetailedVideoAnalysis(button);
  if (action === "v4-video-to-publish") return videoToPublishing(button.dataset.videoId);
  if (action === "v4-load-comments") return handleLoadCommentsV4(button);
  if (action === "v4-generate-replies") return handleGenerateRepliesV4(button);
  if (action === "v4-post-reply") return handlePostReplyV4(button);
  if (action === "v4-google-connect") return handleGoogleConnectV4(button);
  if (action === "v4-load-calendar") return handleLoadGoogleCalendarV4(button);
  if (action === "v4-add-calendar-event") return handleAddCalendarEventV4(button);
  if (action === "v4-calendar-nav") return handleCalendarNavV4(button.dataset.direction);
  if (action === "v4-open-calendar-day") return openCalendarDay(button.dataset.date);
  if (action === "v4-close-calendar-day") return closeCalendarDay();
  if (action === "v4-create-publish-pack") return handleCreatePublishPack(button);
  if (action === "v4-upload-youtube") return handleUploadYouTube(button);
  if (action === "v4-coach-send") return handleCoachSend(button);
  if (action === "v4-coach-prompt") return handleCoachPrompt(button.dataset.prompt, button);
  if (action === "v4-comment-to-idea") return commentToIdea(button.dataset.commentId);
  if (action === "v4-weekly-plan") return handleWeeklyPlanV4(button);
});

async function handleAnalyzeDnaV4(button) {
  await withBusy(button, "Analyzing...", async () => {
    const tones = [...document.querySelectorAll(".pill-button.active")].map((node) => node.textContent.trim());
    const file = document.querySelector("#voice-file")?.files?.[0] || contentusRecordedFile;
    let sampleText = document.querySelector("#samples")?.value || "";
    let media = null;

    if (file) {
      if (/text|markdown|vtt|srt/i.test(file.type) || /\.(txt|md|vtt|srt)$/i.test(file.name)) {
        sampleText = `${sampleText}\n\n${await file.text()}`.trim();
      } else {
        media = await fileToBase64(file);
      }
    }

    state.creator.creatorName = document.querySelector("#creator-name")?.value.trim() || "";
    state.creator.niche = document.querySelector("#niche")?.value.trim() || "";
    state.creator.audience = document.querySelector("#audience")?.value.trim() || "";
    state.creator.values = document.querySelector("#values")?.value.trim() || "";
    state.creator.topicsLoved = document.querySelector("#topics-loved")?.value.trim() || "";
    state.creator.topicsAvoided = document.querySelector("#topics-avoided")?.value.trim() || "";
    state.creator.tone = tones;

    const result = await apiJson("/api/ai/dna", {
      method: "POST",
      body: {
        creator: state.creator,
        samples: sampleText,
        youtubeUrl: document.querySelector("#dna-youtube-url")?.value.trim() || "",
        media,
      },
    });

    if (!result.ok) {
      toast(result.data.message || result.data.error || "Creator DNA analysis failed.");
      return;
    }

    state.dna = normalizeDnaResult(result.data.dna || result.data);
    saveState();
    document.querySelector("#dna-output").innerHTML = dnaOutputV4(safeDna());
    toast("Creator DNA generated from your input.");
  });
}

function handleSaveDnaV4() {
  saveState();
  toast("Creator DNA saved.");
}

async function startVoiceRecording(button) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    contentusRecordChunks = [];
    contentusRecorder = new MediaRecorder(stream);
    contentusRecorder.ondataavailable = (event) => {
      if (event.data.size) contentusRecordChunks.push(event.data);
    };
    contentusRecorder.onstop = () => {
      const blob = new Blob(contentusRecordChunks, { type: "audio/webm" });
      contentusRecordedFile = new File([blob], `contentus-voice-${Date.now()}.webm`, { type: "audio/webm" });
      stream.getTracks().forEach((track) => track.stop());
      const status = document.querySelector("#recording-status");
      if (status) status.textContent = "Voice sample recorded and ready.";
    };
    contentusRecorder.start();
    const status = document.querySelector("#recording-status");
    if (status) status.textContent = "Recording...";
    toast("Recording started.");
  } catch (error) {
    toast(`Recording unavailable: ${error.message}`);
  }
}

function stopVoiceRecording() {
  if (contentusRecorder?.state === "recording") {
    contentusRecorder.stop();
    toast("Recording stopped.");
  }
}

async function handleGenerateIdeasV4(button) {
  await withBusy(button, "Generating...", async () => {
    const payload = {
      topic: document.querySelector("#idea-topic")?.value.trim(),
      platform: customValue("idea-platform"),
      goal: customValue("idea-goal"),
      contentType: customValue("idea-type"),
      tone: customValue("idea-tone"),
      length: customValue("idea-length"),
      trend: customValue("idea-trend"),
      story: customValue("idea-story"),
      audience: document.querySelector("#idea-audience")?.value.trim(),
      creator: state.creator,
      dna: state.dna,
    };
    if (!payload.topic) {
      toast("Add a topic first.");
      return;
    }
    const result = await apiJson("/api/ai/ideas", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Idea generation failed.");
      return;
    }
    const ideas = normalizeList(result.data.ideas).map((idea, index) => ({
      id: idea.id || `idea-${Date.now()}-${index}`,
      createdAt: new Date().toISOString(),
      status: "idea",
      source: "Idea Engine",
      ...idea,
      platform: idea.platform || payload.platform,
      contentType: idea.contentType || payload.contentType,
    }));
    state.ideas = [...ideas, ...state.ideas].slice(0, 50);
    saveState();
    document.querySelector("#ideas-output").innerHTML = state.ideas.map(ideaCardV4).join("");
    toast("Ideas generated.");
  });
}

async function handleAnalyzeTrendsV4(button) {
  await withBusy(button, "Analyzing...", async () => {
    const payload = {
      platform: customValue("trend-platform"),
      niche: document.querySelector("#trend-niche")?.value.trim(),
      idea: document.querySelector("#trend-idea")?.value.trim(),
      creator: state.creator,
      dna: state.dna,
    };
    if (!payload.platform || !payload.niche) {
      toast("Choose a platform and niche first.");
      return;
    }
    const result = await apiJson("/api/ai/trends", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Trend analysis failed.");
      return;
    }
    state.trendReports.unshift({ id: `trend-${Date.now()}`, createdAt: new Date().toISOString(), ...result.data });
    saveState();
    render();
    toast("Trend report ready.");
  });
}

function handleUseIdeaV4(id) {
  state.selectedIdeaId = id;
  saveState();
  routeTo("/app/scripts");
}

async function handleGenerateScriptV4(button) {
  await withBusy(button, "Writing...", async () => {
    const selected = customValue("script-idea");
    const idea = selected === "Custom" ? null : state.ideas.find((item) => item.id === selected || item.title === selected);
    const customIdea = document.querySelector("#script-custom-idea")?.value.trim();
    const payload = {
      idea: idea || { title: customIdea || selectedIdea()?.title || "Untitled creator idea" },
      platform: customValue("script-platform"),
      length: customValue("script-length"),
      format: customValue("script-format"),
      audience: document.querySelector("#script-audience")?.value.trim() || state.creator.audience,
      notes: document.querySelector("#script-notes")?.value.trim(),
      creator: state.creator,
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/script", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Script generation failed.");
      return;
    }
    const script = {
      id: `script-${Date.now()}`,
      ideaId: idea?.id || null,
      title: result.data.title || payload.idea.title,
      platform: payload.platform,
      lengthLabel: payload.length,
      createdAt: new Date().toISOString(),
      ...result.data,
    };
    state.scripts.unshift(script);
    const chat = {
      id: `script-chat-${Date.now()}`,
      title: script.title,
      scriptId: script.id,
      createdAt: new Date().toISOString(),
      messages: [
        { role: "assistant", text: "I drafted the script as a speaking document. Ask for changes in the right panel, then implement the suggestions you like." },
      ],
    };
    state.scriptChats.unshift(chat);
    state.activeScriptChatId = chat.id;
    state.scriptAssistantOpen = true;
    state.scriptCredibilityReport = null;
    saveState();
    render();
    toast("Script generated.");
  });
}

async function handleTransformScriptV4(button) {
  const latest = state.scripts[0];
  if (!latest) return;
  await withBusy(button, "Rewriting...", async () => {
    const result = await apiJson("/api/ai/script", {
      method: "POST",
      body: {
        rewriteInstruction: button.dataset.transform,
        existingScript: latest,
        creator: state.creator,
        dna: state.dna,
        length: latest.lengthLabel,
      },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Rewrite failed.");
      return;
    }
    state.scripts[0] = { ...latest, ...result.data, id: latest.id, updatedAt: new Date().toISOString() };
    appendScriptChat("assistant", `Applied: ${button.dataset.transform}`);
    saveState();
    render();
    toast("Script updated.");
  });
}

function newScriptChat() {
  state.activeScriptChatId = "";
  state.scriptCredibilityReport = null;
  saveState();
  render();
}

function openScriptChat(id) {
  state.activeScriptChatId = id || "";
  const chat = activeScriptChat();
  if (chat?.scriptId) {
    const script = state.scripts.find((item) => item.id === chat.scriptId);
    if (script) state.scripts = [script, ...state.scripts.filter((item) => item.id !== script.id)];
  }
  saveState();
  render();
}

function toggleScriptAssistant() {
  state.scriptAssistantOpen = state.scriptAssistantOpen === false;
  saveState();
  render();
}

async function handleScriptChatSend(button) {
  const prompt = document.querySelector("#script-chat-input")?.value.trim();
  if (!prompt) return;
  await handleScriptAssistantPrompt(prompt, button);
}

async function handleScriptAssistantPrompt(prompt, button) {
  const latest = activeScript();
  if (!latest) return;
  appendScriptChat("user", prompt);
  await withBusy(button, "Thinking...", async () => {
    const result = await apiJson("/api/ai/script", {
      method: "POST",
      body: {
        rewriteInstruction: prompt,
        existingScript: latest,
        creator: state.creator,
        dna: state.dna,
        length: latest.lengthLabel,
      },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Script update failed.");
      return;
    }
    const updated = { ...latest, ...result.data, id: latest.id, updatedAt: new Date().toISOString() };
    state.scripts = [updated, ...state.scripts.filter((item) => item.id !== latest.id)];
    appendScriptChat("assistant", "I updated the script document. Review the changed sections in the center panel.");
    saveState();
    render();
  });
}

async function handleScriptCredibility(button) {
  const latest = activeScript();
  if (!latest) return;
  await withBusy(button, "Checking...", async () => {
    const result = await apiJson("/api/ai/credibility", {
      method: "POST",
      body: { script: latest, creator: state.creator, dna: state.dna },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Credibility check failed.");
      return;
    }
    state.scriptCredibilityReport = result.data;
    appendScriptChat("assistant", "Credibility report is ready. Use the implement buttons for fixes you want.");
    saveState();
    render();
  });
}

function implementScriptSuggestion(index) {
  const latest = activeScript();
  const suggestion = normalizeList(state.scriptCredibilityReport?.suggestions)[Number(index)];
  if (!latest || !suggestion) return;
  latest.credibilityNotes = normalizeList(latest.credibilityNotes);
  latest.credibilityNotes.push(suggestion.implementation || suggestion.text || suggestion.reason || "Credibility suggestion applied.");
  latest.personalizationTip = suggestion.implementation || latest.personalizationTip;
  appendScriptChat("assistant", `Implemented suggestion: ${suggestion.title || suggestion.text || "Credibility fix"}`);
  saveState();
  render();
}

function runAuthFromScriptV4() {
  const latest = state.scripts[0];
  if (!latest) return;
  state.pendingAuthText = latest.script || "";
  routeTo("/app/authenticity");
  setTimeout(() => {
    const input = document.querySelector("#auth-input");
    if (input) input.value = state.pendingAuthText;
  }, 0);
}

function saveScriptToCalendar() {
  const script = state.scripts[0];
  if (!script) return;
  state.calendar.push({
    id: `cal-${Date.now()}`,
    title: script.title || "Untitled script",
    platform: script.platform,
    status: "scripting",
    contentType: "script",
    day: nextCalendarDay(),
    notes: `Authenticity ${script.authenticityScore || "?"}%.`,
  });
  saveState();
  toast("Script saved to calendar.");
}

function saveIdeaToCalendar(id) {
  const idea = state.ideas.find((item) => item.id === id);
  if (!idea) return;
  state.calendar.push({
    id: `cal-${Date.now()}`,
    title: idea.title,
    platform: idea.platform,
    status: "idea",
    contentType: idea.contentType,
    day: nextCalendarDay(),
    notes: idea.personalizationTip || "",
  });
  saveState();
  toast("Idea saved to calendar.");
}

async function handleGenerateAdV4(button) {
  await withBusy(button, "Generating...", async () => {
    const payload = {
      projectType: customValue("ad-project-type"),
      idea: document.querySelector("#ad-idea")?.value.trim(),
      audience: document.querySelector("#ad-audience")?.value.trim(),
      mood: customValue("ad-mood"),
      length: customValue("ad-length"),
      platform: customValue("ad-platform"),
      message: document.querySelector("#ad-message")?.value.trim(),
      cta: document.querySelector("#ad-cta")?.value.trim(),
      language: document.querySelector("#ad-language")?.value.trim(),
      creator: state.creator,
      dna: state.dna,
    };
    if (!payload.idea) {
      toast("Add a product or story idea first.");
      return;
    }
    const result = await apiJson("/api/ai/ad-studio", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Ad studio generation failed.");
      return;
    }
    state.adProjects = [{ id: `ad-${Date.now()}`, ...result.data, createdAt: new Date().toISOString() }, ...(state.adProjects || [])].slice(0, 20);
    saveState();
    document.querySelector("#ad-output").innerHTML = adOutputV4(state.adProjects[0]);
    toast("Project generated.");
  });
}

async function handleScoreAuthenticityV4(button) {
  await withBusy(button, "Scoring...", async () => {
    const text = document.querySelector("#auth-input")?.value.trim();
    if (!text) {
      toast("Paste content first.");
      return;
    }
    const result = await apiJson("/api/ai/authenticity", {
      method: "POST",
      body: { text, creator: state.creator, dna: state.dna },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Authenticity scoring failed.");
      return;
    }
    state.lastAuthenticity = result.data;
    saveState();
    document.querySelector("#auth-output").innerHTML = authOutputV4(result.data);
    toast("Authenticity scored.");
  });
}

async function handleLinkYouTubeV4(button) {
  await withBusy(button, "Linking...", async () => {
    const input = document.querySelector("#youtube-input")?.value.trim();
    if (!input) {
      toast("Paste a YouTube channel, handle, or video URL.");
      return;
    }
    const result = await apiJson("/api/youtube/channel", { method: "POST", body: { input } });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "YouTube link failed.");
      return;
    }
    state.youtube = result.data;
    state.youtubeConnected = true;
    state.selectedVideoId = normalizeList(result.data.videos)[0]?.id || "";
    state.comments = [];
    saveState();
    render();
    toast("YouTube channel linked.");
  });
}

function handleSelectVideoV4(videoId) {
  state.selectedVideoId = videoId || "";
  saveState();
  render();
}

async function handleLoadCommentsV4(button) {
  await withBusy(button, "Loading...", async () => {
    const videoId = button.dataset.videoId;
    const result = await apiJson("/api/youtube/comments", { method: "POST", body: { videoId } });
    if (!result.ok) {
      const message = result.data.message || result.data.error || "Could not load comments.";
      if (result.data.commentsDisabled || /disabled comments|comments.*disabled|has disabled comments/i.test(message)) {
        markVideoCommentsDisabled(videoId);
        toast("Comments are disabled for this video. Choose another video.");
        render();
        return;
      }
      toast(cleanApiMessage(message));
      return;
    }
    state.selectedVideoId = videoId;
    state.comments = normalizeList(result.data.comments).map((comment) => ({
      ...comment,
      videoTitle: videoTitleFor(comment.videoId || videoId),
    }));
    saveState();
    if (state.comments.length) {
      routeTo("/app/community");
      render();
      toast("Comments loaded.");
    } else {
      routeTo("/app/community");
      render();
      toast("No public comments found for this video yet.");
    }
  });
}

async function handleGenerateRepliesV4(button) {
  await withBusy(button, "Drafting...", async () => {
    const result = await apiJson("/api/ai/community-replies", {
      method: "POST",
      body: { comments: state.comments, creator: state.creator, dna: state.dna },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Reply draft generation failed.");
      return;
    }
    const replies = normalizeList(result.data.comments);
    state.comments = state.comments.map((comment) => {
      const reply = replies.find((item) => item.id === comment.id);
      return reply ? { ...comment, ...reply, videoTitle: comment.videoTitle || videoTitleFor(comment.videoId) } : comment;
    });
    saveState();
    render();
    toast("Reply drafts generated.");
  });
}

async function handlePostReplyV4(button) {
  await withBusy(button, "Posting...", async () => {
    const comment = state.comments.find((item) => item.id === button.dataset.commentId);
    if (!comment?.suggestedReply) return;
    const result = await apiJson("/api/youtube/reply", {
      method: "POST",
      auth: true,
      body: { parentId: comment.id, text: comment.suggestedReply },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Connect Google before posting replies.");
      return;
    }
    comment.posted = true;
    comment.postedReplyId = result.data.replyId;
    saveState();
    render();
    toast("Reply posted to YouTube.");
  });
}

async function handleVideoCheckV4(button) {
  await withBusy(button, "Analyzing...", async () => {
    const file = document.querySelector("#video-check-file")?.files?.[0];
    const media = file ? await fileToBase64(file) : null;
    const payload = {
      youtubeUrl: document.querySelector("#video-check-url")?.value.trim(),
      context: document.querySelector("#video-check-context")?.value.trim(),
      media,
      creator: state.creator,
      dna: state.dna,
    };
    if (!payload.youtubeUrl && !media) {
      toast("Paste a YouTube URL or upload a video/audio file.");
      return;
    }
    const result = await apiJson("/api/ai/video-checker", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Video check failed.");
      return;
    }
    state.videoChecks.unshift({ id: `video-check-${Date.now()}`, createdAt: new Date().toISOString(), ...result.data });
    saveState();
    render();
    toast("Video report ready.");
  });
}

async function handleDetailedVideoAnalysis(button) {
  const videoId = button.dataset.videoId;
  const video = normalizeList(state.youtube?.videos || state.youtube?.recentVideos).find((item) => item.id === videoId);
  if (!video) return;
  await withBusy(button, "Analyzing...", async () => {
    const result = await apiJson("/api/ai/video-detail", {
      method: "POST",
      body: { video, channel: state.youtube?.channel, comments: state.comments.filter((item) => item.videoId === videoId), creator: state.creator, dna: state.dna },
    });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Detailed analysis failed.");
      return;
    }
    state.detailedVideoReports = [{ id: `detail-${Date.now()}`, videoId, createdAt: new Date().toISOString(), ...result.data }, ...state.detailedVideoReports.filter((item) => item.videoId !== videoId)].slice(0, 20);
    saveState();
    render();
    toast("Detailed video analysis ready.");
  });
}

function videoToPublishing(videoId) {
  const video = normalizeList(state.youtube?.videos || state.youtube?.recentVideos).find((item) => item.id === videoId);
  if (video) {
    state.pendingPublishVideo = video;
    saveState();
  }
  routeTo("/app/publishing");
}

async function handleGoogleConnectV4(button) {
  await withBusy(button, "Connecting...", async () => {
    const scope = button.dataset.scope || "all";
    const result = await apiJson(`/api/google/oauth/start?scope=${encodeURIComponent(scope)}`, { auth: true });
    if (!result.ok || !result.data.authUrl) {
      toast(result.data.message || result.data.error || "Google OAuth is not configured.");
      return;
    }
    location.href = result.data.authUrl;
  });
}

function commentToIdea(commentId) {
  const comment = state.comments.find((item) => item.id === commentId);
  if (!comment) return;
  state.ideas.unshift({
    id: `idea-${Date.now()}`,
    title: `Answer this viewer question: ${comment.text.slice(0, 80)}`,
    hook: comment.text,
    concept: "Turn a real audience comment into a helpful response video.",
    platform: "YouTube",
    contentType: "Short or community video",
    genericRisk: "Low",
    authenticityScore: 88,
    personalizationTip: "Mention the viewer question and answer from your lived process.",
    cta: "Ask viewers what they want answered next.",
    source: "Community Manager",
    status: "idea",
  });
  saveState();
  toast("Comment turned into an idea.");
}

function handleWeeklyPlanV4(button) {
  if (!state.ideas.length && !state.scripts.length) {
    toast("Generate an idea or script first.");
    return;
  }
  const pool = [...state.scripts, ...state.ideas].slice(0, 5);
  const days = [3, 5, 8, 10, 12];
  pool.forEach((item, index) => {
    state.calendar.push({
      id: `cal-${Date.now()}-${index}`,
      title: item.title,
      platform: item.platform || "Content",
      status: index === 0 ? "scripting" : "idea",
      contentType: item.contentType || "content",
      day: days[index] || nextCalendarDay(),
      notes: index === pool.length - 1 ? "Keep one rest or community-light day after this." : "",
    });
  });
  saveState();
  render();
  toast("Weekly plan created from your saved content.");
}

async function handleLoadGoogleCalendarV4(button) {
  await withBusy(button, "Loading...", async () => {
    const view = calendarViewDate();
    const range = calendarRange(view);
    const result = await apiJson(`/api/calendar/events?timeMin=${encodeURIComponent(range.timeMin)}&timeMax=${encodeURIComponent(range.timeMax)}`, { auth: true });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Connect Google Calendar first.");
      return;
    }
    state.googleCalendarEvents = normalizeList(result.data.events);
    state.google = { ...(state.google || {}), calendar: true, ...result.data.google };
    saveState();
    render();
    toast("Google Calendar events loaded.");
  });
}

async function handleAddCalendarEventV4(button) {
  await withBusy(button, "Adding...", async () => {
    const title = document.querySelector("#calendar-title")?.value.trim();
    const date = document.querySelector("#calendar-date")?.value;
    const startTime = document.querySelector("#calendar-start")?.value;
    const endTime = document.querySelector("#calendar-end")?.value;
    const platform = document.querySelector("#calendar-platform")?.value.trim();
    const notes = document.querySelector("#calendar-notes")?.value.trim();
    if (!title || !date) {
      toast("Add a title and date.");
      return;
    }
    const item = {
      id: `cal-${Date.now()}`,
      title,
      date,
      startTime,
      endTime,
      platform,
      status: "scheduled",
      contentType: platform,
      notes,
      day: Number(date.slice(-2)),
    };
    if (state.google?.calendar) {
      const result = await apiJson("/api/calendar/events", {
        method: "POST",
        auth: true,
        body: item,
      });
      if (result.ok) {
        item.googleEventId = result.data.event?.id;
        state.googleCalendarEvents.push(result.data.event);
      } else {
        toast(result.data.message || result.data.error || "Saved locally, but Google Calendar sync failed.");
      }
    }
    state.calendar.push(item);
    saveState();
    render();
    toast(state.google?.calendar ? "Event added and synced." : "Event added.");
  });
}

function handleCalendarNavV4(direction) {
  const view = calendarViewDate();
  if (direction === "today") {
    state.calendarViewDate = formatInputDate(new Date()).slice(0, 7);
  } else {
    const next = new Date(view);
    next.setMonth(next.getMonth() + (direction === "next" ? 1 : -1));
    state.calendarViewDate = formatInputDate(next).slice(0, 7);
  }
  saveState();
  render();
}

function openCalendarDay(dateKey) {
  state.selectedCalendarDate = dateKey;
  saveState();
  render();
}

function closeCalendarDay() {
  state.selectedCalendarDate = "";
  saveState();
  render();
}

async function handleCreatePublishPack(button) {
  await withBusy(button, "Creating...", async () => {
    const selected = customValue("publish-source");
    const video = selected === "Custom" ? state.pendingPublishVideo : normalizeList(state.youtube?.videos || state.youtube?.recentVideos).find((item) => item.id === selected) || state.pendingPublishVideo;
    const platforms = [...document.querySelectorAll(".platform-toggle-group .pill-button.active")].map((node) => node.textContent.trim());
    const payload = {
      title: document.querySelector("#publish-title")?.value.trim() || video?.title || "Untitled upload",
      notes: document.querySelector("#publish-notes")?.value.trim(),
      video,
      platforms,
      creator: state.creator,
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/publish-pack", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Publishing pack failed.");
      return;
    }
    state.publishingJobs.unshift({ id: `publish-${Date.now()}`, createdAt: new Date().toISOString(), ...result.data });
    saveState();
    render();
    toast("Publishing pack created.");
  });
}

async function handleUploadYouTube(button) {
  await withBusy(button, "Preparing...", async () => {
    const file = document.querySelector("#publish-file")?.files?.[0];
    if (!file) {
      toast("Choose a video file first.");
      return;
    }
    if (!state.google?.youtubeUpload) {
      const result = await apiJson("/api/google/oauth/start?scope=upload", { auth: true });
      if (result.ok && result.data.authUrl) {
        location.href = result.data.authUrl;
        return;
      }
      toast(result.data.message || "Connect Google with YouTube upload permission first.");
      return;
    }
    toast("YouTube upload permission is connected. Production upload will use the YouTube resumable upload API.");
    const job = state.publishingJobs[0] || { id: `publish-${Date.now()}`, title: document.querySelector("#publish-title")?.value.trim() || file.name, platforms: [] };
    job.youtubeUploadMessage = "YouTube upload permission is connected. Add resumable upload handling for large video files before production posting.";
    state.publishingJobs = [job, ...state.publishingJobs.filter((item) => item.id !== job.id)];
    saveState();
    render();
  });
}

async function handleCoachSend(button) {
  const prompt = document.querySelector("#coach-input")?.value.trim();
  if (!prompt) return;
  await handleCoachPrompt(prompt, button);
}

async function handleCoachPrompt(prompt, button) {
  state.coachChats.push({ role: "user", text: prompt });
  await withBusy(button, "Thinking...", async () => {
    const result = await apiJson("/api/ai/coach", {
      method: "POST",
      body: {
        prompt,
        creator: state.creator,
        dna: state.dna,
        ideas: state.ideas.slice(0, 12),
        scripts: state.scripts.slice(0, 6),
        youtube: state.youtube,
      },
    });
    const text = result.ok ? result.data.reply : (result.data.message || "I could not generate a coach response.");
    state.coachChats.push({ role: "assistant", text });
    saveState();
    render();
  });
}

async function handleThumbnailChatSend(button) {
  const prompt = document.querySelector("#thumb-chat-input")?.value.trim();
  if (!prompt) return;
  await handleThumbnailSuggestion(prompt, button);
}

async function handleThumbnailSuggestion(prompt, button) {
  let chat = activeThumbnailChat();
  if (!chat) {
    await generateThumbnailCanvas();
    chat = activeThumbnailChat();
  }
  if (!chat) return;
  chat.messages = [...normalizeList(chat.messages), { role: "user", text: prompt, createdAt: new Date().toISOString() }];
  await withBusy(button, "Updating...", async () => {
    const result = await apiJson("/api/ai/thumbnail-design", {
      method: "POST",
      body: {
        idea: selectedIdea() || { title: chat.title },
        mainText: chat.title,
        brief: prompt,
        previousDesign: chat.design,
        selection: state.thumbnailSelection,
        creator: state.creator,
        dna: state.dna,
      },
    });
    if (!result.ok) {
      chat.messages.pop();
      toast(result.data.message || result.data.error || "Gemini thumbnail update failed.");
      return;
    }
    const design = result.data;
    chat.design = design;
    chat.messages.push({ role: "assistant", text: design.rationale || "Updated the thumbnail layout.", createdAt: new Date().toISOString() });
    const canvasNode = document.querySelector("#thumbnail-canvas");
    if (canvasNode) drawThumbnailDesign(canvasNode, design);
    saveState();
    render();
    requestAnimationFrame(redrawActiveThumbnail);
  });
}

async function handleThumbnailCopy(button) {
  await withBusy(button, "Suggesting...", async () => {
    const payload = {
      idea: selectedIdea() || { title: document.querySelector("#thumb-title")?.value.trim() },
      style: customValue("thumb-style"),
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/thumbnail-copy", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Gemini thumbnail text failed.");
      return;
    }
    const suggestions = normalizeList(result.data.suggestions);
    document.querySelector("#thumbnail-copy-output").innerHTML = `
      <div class="card-topline"><div><span class="section-kicker">Title options</span><h3>Gemini suggestions</h3></div></div>
      <div class="list-stack">${suggestions.map((item) => insight(item.text || item, item.reason || "Short, specific, and thumbnail-friendly.")).join("")}</div>
    `;
    toast("Thumbnail text suggested.");
  });
}

function redrawActiveThumbnail() {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  const chat = activeThumbnailChat();
  if (!canvasNode || !chat?.design) return;
  drawThumbnailDesign(canvasNode, chat.design);
}

async function generateThumbnailCanvas() {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!canvasNode) return;
  const title = document.querySelector("#thumb-title")?.value.trim() || selectedIdea()?.title || "NEW IDEA";
  const brief = document.querySelector("#thumb-idea-brief")?.value.trim();
  const selected = customValue("thumb-idea");
  const idea = selected === "Custom" ? { title, concept: brief } : state.ideas.find((item) => item.id === selected || item.title === selected) || selectedIdea() || { title, concept: brief };
  const result = await apiJson("/api/ai/thumbnail-design", {
    method: "POST",
    body: {
      idea,
      mainText: title,
      brief,
      selection: state.thumbnailSelection,
      creator: state.creator,
      dna: state.dna,
    },
  });
  if (!result.ok) {
    toast(result.data.message || result.data.error || "Gemini thumbnail generation failed.");
    return;
  }
  const design = result.data;
  drawThumbnailDesign(canvasNode, design);
  const chat = {
    id: `thumb-chat-${Date.now()}`,
    title,
    design,
    createdAt: new Date().toISOString(),
    messages: [
      { role: "assistant", text: design.rationale || "Generated a thumbnail layout from your idea and main text." },
    ],
  };
  state.thumbnailChats.unshift(chat);
  state.activeThumbnailChatId = chat.id;
  state.thumbnails.unshift({
    id: `thumb-${Date.now()}`,
    title,
    brief,
    design,
    createdAt: new Date().toISOString(),
  });
  saveState();
  document.querySelector("#thumbnail-copy-output").innerHTML = chat.messages.map(chatBubble).join("");
  toast("Thumbnail generated with Gemini.");
}

function drawThumbnailDesign(canvasNode, design = {}) {
  const ctx = canvasNode.getContext("2d");
  if (design.imageData) {
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(0, 0, 1280, 720);
      ctx.drawImage(image, 0, 0, 1280, 720);
      drawThumbnailSelection(ctx);
    };
    image.src = `data:${design.imageMimeType || "image/png"};base64,${design.imageData}`;
    return;
  }
  const title = design.mainText || design.title || "NEW IDEA";
  const subtitle = design.supportText || "";
  const colors = thumbnailPalette(design.palette || "white teal charcoal");
  ctx.clearRect(0, 0, 1280, 720);

  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, colors.bg1);
  gradient.addColorStop(0.55, colors.bg2);
  gradient.addColorStop(1, "#050706");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.fillStyle = "rgba(255,255,255,0.055)";
  for (let x = 0; x < 1280; x += 96) {
    ctx.fillRect(x, 0, 1, 720);
  }
  for (let y = 0; y < 720; y += 96) {
    ctx.fillRect(0, y, 1280, 1);
  }

  const focal = design.focalBox || { x: 780, y: 95, w: 360, h: 500 };
  ctx.fillStyle = colors.accent;
  ctx.fillRect(focal.x, focal.y, focal.w, focal.h);
  ctx.fillStyle = "rgba(5,7,6,0.72)";
  ctx.fillRect(focal.x + 34, focal.y + 34, Math.max(40, focal.w - 68), Math.max(40, focal.h - 68));
  ctx.strokeStyle = colors.accent2;
  ctx.lineWidth = 9;
  ctx.strokeRect(focal.x + 34, focal.y + 34, Math.max(40, focal.w - 68), Math.max(40, focal.h - 68));

  ctx.fillStyle = "#f5fbf8";
  ctx.font = `${design.textWeight || "900"} ${design.textSize || 92}px Inter, Arial, sans-serif`;
  const textBox = design.textBox || { x: 74, y: 150, w: 720, lineHeight: 98 };
  wrapCanvasText(ctx, title.toUpperCase(), textBox.x, textBox.y, textBox.w, textBox.lineHeight);
  if (subtitle) {
    ctx.fillStyle = colors.accent2;
    ctx.font = "800 42px Inter, Arial, sans-serif";
    wrapCanvasText(ctx, subtitle.toUpperCase(), textBox.x, 565, textBox.w, 52);
  }

  ctx.fillStyle = "#050706";
  ctx.fillRect(84, 610, 310, 54);
  ctx.fillStyle = colors.accent2;
  ctx.font = "800 28px Inter, Arial, sans-serif";
  ctx.fillText("CONTENTUS DRAFT", 104, 647);

  drawThumbnailSelection(ctx);
}

function drawThumbnailSelection(ctx) {
  if (state.thumbnailSelection?.w > 8 && state.thumbnailSelection?.h > 8) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 10]);
    ctx.strokeRect(state.thumbnailSelection.x, state.thumbnailSelection.y, state.thumbnailSelection.w, state.thumbnailSelection.h);
    ctx.setLineDash([]);
  }
}

function downloadThumbnailPng() {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!canvasNode) return;
  const link = document.createElement("a");
  link.href = canvasNode.toDataURL("image/png");
  link.download = "contentus-thumbnail.png";
  link.click();
}

function downloadLatestScriptPdf() {
  const script = state.scripts[0];
  if (!script) return;
  const blob = buildScriptPdf(script);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(script.title || "contentus-script")}.pdf`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function fieldV4(id, label, value = "", type = "text", placeholder = "", extra = "") {
  return `<div class="form-field ${extra}"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}"></div>`;
}

function textareaV4(id, label, value = "", placeholder = "", extra = "") {
  return `<div class="form-field ${extra}"><label for="${id}">${label}</label><textarea id="${id}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || "")}</textarea></div>`;
}

function selectCustom(id, label, options, selected = "") {
  const opts = normalizeList(options);
  const chosen = selected || opts[0] || "Custom";
  const hasCustom = chosen === "Custom";
  return `
    <div class="form-field">
      <label for="${id}">${label}</label>
      <div class="select-wrap">
        <select id="${id}" data-custom-select="${id}">
          ${opts.map((option) => {
            const value = typeof option === "string" ? option : option.value;
            const text = typeof option === "string" ? option : option.label;
            return `<option value="${escapeHtml(value)}" ${value === chosen ? "selected" : ""}>${escapeHtml(text)}</option>`;
          }).join("")}
        </select>
      </div>
      <input id="${id}-custom" class="custom-input" placeholder="Enter custom ${escapeHtml(label.toLowerCase())}" ${hasCustom ? "" : "hidden"}>
    </div>
  `;
}

function customValue(id) {
  const select = document.querySelector(`#${id}`);
  const value = select?.value || "";
  if (value === "Custom") return document.querySelector(`#${id}-custom`)?.value.trim() || "Custom";
  return value;
}

function ideaOptions() {
  return state.ideas.length
    ? [{ value: "Custom", label: "Custom idea" }, ...state.ideas.slice(0, 20).map((idea) => ({ value: idea.id, label: idea.title }))]
    : ["Custom"];
}

function selectedIdea() {
  return state.ideas.find((idea) => idea.id === state.selectedIdeaId) || state.ideas[0] || null;
}

function selectedVideo() {
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  return videos.find((video) => video.id === state.selectedVideoId) || videos[0] || null;
}

function activeScript() {
  const chat = activeScriptChat();
  return state.scripts.find((script) => script.id === chat?.scriptId) || state.scripts[0] || null;
}

function activeScriptChat() {
  return normalizeList(state.scriptChats).find((chat) => chat.id === state.activeScriptChatId) || normalizeList(state.scriptChats)[0] || null;
}

function appendScriptChat(role, text) {
  let chat = activeScriptChat();
  if (!chat) {
    chat = { id: `script-chat-${Date.now()}`, title: activeScript()?.title || "Script chat", scriptId: activeScript()?.id, createdAt: new Date().toISOString(), messages: [] };
    state.scriptChats.unshift(chat);
    state.activeScriptChatId = chat.id;
  }
  chat.messages = [...normalizeList(chat.messages), { role, text, createdAt: new Date().toISOString() }].slice(-40);
}

function activeThumbnailChat() {
  return normalizeList(state.thumbnailChats).find((chat) => chat.id === state.activeThumbnailChatId) || normalizeList(state.thumbnailChats)[0] || null;
}

function newThumbnailChat() {
  state.activeThumbnailChatId = "";
  state.thumbnailSelection = null;
  saveState();
  render();
}

function openThumbnailChat(id) {
  state.activeThumbnailChatId = id || "";
  state.thumbnailSelection = null;
  saveState();
  render();
  requestAnimationFrame(redrawActiveThumbnail);
}

function threadButton(chat, activeId, action) {
  return `
    <button class="thread-button ${chat.id === activeId ? "active" : ""}" type="button" data-action="${action}" data-chat-id="${escapeHtml(chat.id)}">
      <strong>${escapeHtml(chat.title || "Untitled")}</strong>
      <small>${escapeHtml(formatDate(chat.createdAt || ""))}</small>
    </button>
  `;
}

function chatBubble(message) {
  return `<div class="chat-bubble ${message.role === "user" ? "user" : "assistant"}"><span>${escapeHtml(message.role || "assistant")}</span><p>${escapeHtml(message.text || "")}</p></div>`;
}

function detailedVideoReportFor(videoId) {
  return normalizeList(state.detailedVideoReports).find((report) => report.videoId === videoId);
}

function publishingSourceOptions() {
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  return [{ value: "Custom", label: "Upload custom video" }, ...videos.map((video) => ({ value: video.id, label: video.title || "Untitled video" }))];
}

function shortTitle(title = "") {
  const clean = String(title || "").trim();
  return clean.length > 28 ? `${clean.slice(0, 25)}...` : clean;
}

function wordCount(text = "") {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function miniSparklineSvg(values = []) {
  const nums = normalizeList(values).map(Number).filter(Number.isFinite);
  if (nums.length < 2) return "";
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const points = nums.map((value, index) => {
    const x = (index / Math.max(1, nums.length - 1)) * 100;
    const y = 40 - ((value - min) / Math.max(1, max - min)) * 34;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg viewBox="0 0 100 42" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function videoTitleFor(videoId) {
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  return videos.find((video) => video.id === videoId)?.title || "Selected video";
}

function markVideoCommentsDisabled(videoId) {
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  const video = videos.find((item) => item.id === videoId);
  if (video) video.commentsDisabled = true;
  if (state.youtube?.videos) state.youtube.videos = videos;
  state.selectedVideoId = videoId;
  saveState();
}

function cleanApiMessage(message = "") {
  const stripped = String(message).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (/disabled comments|comments.*disabled|has disabled comments/i.test(stripped)) {
    return "Comments are disabled for this video. Choose another video.";
  }
  return stripped || "Something went wrong.";
}

function googlePublicClientState(meta = {}) {
  return {
    calendar: Boolean(meta.calendar || meta.calendarConnected || meta.capabilities?.calendar),
    youtubePosting: Boolean(meta.youtubePosting || meta.capabilities?.youtube),
    youtubeUpload: Boolean(meta.youtubeUpload || meta.capabilities?.upload),
    reconnectRequired: Boolean(meta.reconnectRequired || meta.reconnect_required),
    expiresAt: meta.expiresAt || meta.expires_at,
  };
}

function emptyPanel(title, text, detail = "") {
  return `
    <article class="empty-panel">
      <span class="empty-mark">+</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function emptyMini(text) {
  return `<p class="empty-mini">${escapeHtml(text)}</p>`;
}

function sectionBlock(title, content) {
  if (!content) return "";
  return `<section class="script-section"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(content)}</p></section>`;
}

function listText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return value || "";
}

function toTextList(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not enough data yet.";
  return value || "Not enough data yet.";
}

function normalizeDnaResult(dna) {
  const fallback = safeDna();
  return {
    ...fallback,
    ...dna,
    score: Number(dna.score || dna.creatorDnaScore || 72),
    phrases: normalizeStringArray(dna.phrases || dna.commonPhrases),
    themes: normalizeStringArray(dna.themes || dna.contentThemes),
    examplesLike: normalizeStringArray(dna.examplesLike || dna.soundsLikeYou),
    examplesUnlike: normalizeStringArray(dna.examplesUnlike || dna.doesNotSoundLikeYou),
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function riskClass(risk = "") {
  const clean = String(risk).toLowerCase();
  if (clean.includes("high") || clean.includes("too")) return "bad";
  if (clean.includes("medium") || clean.includes("needs")) return "warn";
  return "good";
}

function averageScore(values) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function bestVideo() {
  const videos = normalizeList(state.youtube?.videos || state.youtube?.recentVideos);
  return videos.sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0] || null;
}

function videoChartValues(videos) {
  const maxViews = Math.max(1, ...videos.map((video) => Number(video.views || 0)));
  return videos.map((video) => (Number(video.views || 0) / maxViews) * 80 + 8);
}

function youtubeSummaryCard(video) {
  if (!video) return emptyMini("No recent videos found.");
  return `
    <div class="video-row clean-row">
      ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">` : `<span class="thumb-placeholder"></span>`}
      <div>
        <strong>${escapeHtml(video.title)}</strong>
        <small>${formatNumber(video.views)} views - ${formatNumber(video.comments)} comments</small>
      </div>
    </div>
    <div class="list-stack">
      ${growthInsightsFromVideos(normalizeList(state.youtube?.videos || state.youtube?.recentVideos)).slice(0, 2).map((item) => insight(item.title, item.text)).join("")}
    </div>
  `;
}

function growthInsightsFromVideos(videos) {
  if (!videos.length) return [{ title: "No video data yet", text: "Link a public channel and fetch recent uploads first." }];
  const sorted = [...videos].sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  const top = sorted[0];
  const low = sorted[sorted.length - 1];
  const avgViews = Math.round(sorted.reduce((sum, video) => sum + Number(video.views || 0), 0) / sorted.length);
  return [
    { title: "Repeat what is already working", text: `${top.title || "Your top video"} is above the recent average of ${formatNumber(avgViews)} views. Turn its topic into a follow-up with a new proof point.` },
    { title: "Improve the weakest angle", text: `${low.title || "Your lowest recent video"} is the lowest recent performer. Rework the title around a clearer personal outcome.` },
    { title: "Turn comments into videos", text: state.comments.length ? "You have loaded comments. Convert repeated questions into short-form answers." : "Load comments from a recent video to find audience questions." },
  ];
}

function burnoutLabel() {
  const count = state.calendar.length;
  if (count > 10) return "Heavy week. Add a rest day.";
  if (count > 5) return "Manageable, but watch energy.";
  return count ? "Balanced so far." : "No planned posts.";
}

function nextCalendarDay() {
  const used = new Set(state.calendar.map((item) => Number(item.day)));
  for (const day of [3, 5, 8, 10, 12, 15, 17, 20, 22, 25]) {
    if (!used.has(day)) return day;
  }
  return Math.min(30, (state.calendar.length % 30) + 1);
}

async function fileToBase64(file) {
  const maxBytes = 9 * 1024 * 1024;
  const slice = file.size > maxBytes ? file.slice(0, maxBytes, file.type) : file;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(slice);
  });
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: String(dataUrl).split(",")[1] || "",
    truncated: file.size > maxBytes,
  };
}

function buildScriptPdf(script) {
  const lines = [
    "CONTENTUS SCRIPT",
    script.title || "Untitled script",
    `Platform: ${script.platform || ""}`,
    `Length: ${script.lengthLabel || script.targetLength || ""}`,
    `Authenticity: ${script.authenticityScore || "?"}%`,
    "",
    "HOOK OPTIONS",
    listText(script.hookOptions),
    "",
    "FULL SCRIPT",
    script.script || "",
    "",
    "SCENE-BY-SCENE",
    listText(script.scenes || script.sceneBreakdown),
    "",
    "SHOT LIST",
    listText(script.shotList),
    "",
    "B-ROLL",
    listText(script.broll || script.bRollSuggestions),
    "",
    "CAPTION",
    script.caption || "",
    "",
    "PERSONALIZATION TIP",
    script.personalizationTip || "",
  ].flatMap((line) => wrapPdfLine(String(line), 82));

  const pages = [];
  for (let index = 0; index < lines.length; index += 38) pages.push(lines.slice(index, index + 38));
  const objects = [];
  const pageRefs = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(null);
  pages.forEach((pageLines) => {
    const content = [
      "BT",
      "/F1 13 Tf",
      "50 780 Td",
      "16 TL",
      ...pageLines.map((line, index) => `${index ? "T*" : ""} (${pdfEscape(line)}) Tj`),
      "ET",
    ].join("\n");
    const contentObj = objects.length + 2;
    const pageObj = objects.length + 1;
    pageRefs.push(`${pageObj} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${pages.length * 2 + 3} 0 R >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function wrapPdfLine(text, max) {
  if (!text) return [""];
  const words = text.replace(/\r/g, "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "contentus";
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  words.forEach((word) => {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
}

function thumbnailPalette(value = "") {
  const clean = value.toLowerCase();
  if (clean.includes("red")) return { bg1: "#210407", bg2: "#111111", accent: "#ff3d4f", accent2: "#ffd447" };
  if (clean.includes("lime")) return { bg1: "#04120d", bg2: "#08152a", accent: "#85ff82", accent2: "#7da7ff" };
  if (clean.includes("white")) return { bg1: "#10201d", bg2: "#050706", accent: "#f5fbf8", accent2: "#5ee8f2" };
  return { bg1: "#061b1f", bg2: "#190c0b", accent: "#5ee8f2", accent2: "#ff7567" };
}

function fallbackThumbnailDesign(body = {}) {
  const mainText = body.mainText || body.idea?.title || "BIG IDEA";
  const short = String(mainText).split(/\s+/).slice(0, 5).join(" ");
  return {
    title: short,
    mainText: short,
    supportText: body.brief ? "REAL TAKE" : "",
    palette: "white teal charcoal",
    textSize: short.length > 22 ? 72 : 92,
    textWeight: "900",
    textBox: { x: 76, y: 150, w: 690, lineHeight: short.length > 22 ? 82 : 100 },
    focalBox: { x: 820, y: 95, w: 340, h: 500 },
    rationale: "Generated a clean high-contrast thumbnail draft with short readable text and one clear focal area.",
  };
}

function fallbackThumbnailSuggestions(title) {
  return [
    { text: title.slice(0, 32) || "I Tested This", reason: "Keeps the exact idea clear." },
    { text: "AI Exposed My Process", reason: "Creates curiosity without fake claims." },
    { text: "Before vs After", reason: "Simple, visual, and low-risk." },
  ];
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat(undefined, { notation: number >= 10000 ? "compact" : "standard" }).format(number);
}

function formatDate(value) {
  if (!value) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatInputDate(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarViewDate() {
  const base = state.calendarViewDate || formatInputDate(new Date()).slice(0, 7);
  const [year, month] = base.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

function calendarCells(view) {
  const start = new Date(view.getFullYear(), view.getMonth(), 1);
  const firstDay = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inMonth: date.getMonth() === view.getMonth() };
  });
}

function calendarRange(view) {
  const start = new Date(view.getFullYear(), view.getMonth(), 1);
  const end = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function isToday(date) {
  return formatInputDate(date) === formatInputDate(new Date());
}

async function bootstrap() {
  app.innerHTML = `
    <section class="boot-screen" aria-label="Loading Contentus">
      ${dnaLogo(false)}
      <p>Loading Contentus workspace...</p>
    </section>
  `;
  await loadAppConfig();
  await initAuth();
  initMotionBackground();
  render();
  const googleMessage = localStorage.getItem("contentus-google-message");
  if (googleMessage) {
    localStorage.removeItem("contentus-google-message");
    toast(googleMessage);
    if (authSession?.access_token) {
      const saved = await apiJson("/api/user/state", { auth: true });
      if (saved.ok && saved.data.user?.user_metadata?.google_oauth) {
        state.google = googlePublicClientState(saved.data.user.user_metadata.google_oauth);
        saveState();
        render();
      }
    }
  }
}

bootstrap();

/* --- Contentus polished dashboard UI override generated for the uploaded app.js. --- */
function appShellV4(route) {
  const page = pageForRouteV4(route);
  return `
    <section class="app-shell app-v4 pro-app-shell contentus-pro-shell">
      <aside class="sidebar sidebar-v4 contentus-sidebar">
        <a class="ct-brand-lockup" href="#/app/dashboard" aria-label="Contentus dashboard">
          ${dnaLogo(false)}
          <span>Contentus</span>
        </a>
        <nav class="sidebar-nav ct-nav" aria-label="App navigation">
          ${navLink("/app/dashboard", "dashboard", "Dashboard")}
          ${navLink("/app/ideas", "spark", "Ideas")}
          ${navLink("/app/idea-hit-miss", "guard", "Idea Hit / Miss")}
          ${navLink("/app/scripts", "script", "Scripts")}
          ${navLink("/app/thumbnail", "film", "Thumbnails")}
          ${navLink("/app/trends", "chart", "Trend Analyzer")}
          ${navLink("/app/youtube-growth", "chart", "Analytics")}
          ${navLink("/app/detailed-video-analysis", "chart", "Detailed Analysis")}
          ${navLink("/app/community", "spark", "Comments")}
          ${navLink("/app/calendar", "calendar", "Content Calendar")}
          ${navLink("/app/video-checker", "guard", "Video Checker")}
          ${navLink("/app/publishing", "spark", "Publish Everywhere")}
          ${navLink("/app/inspiration", "spark", "Inspiration")}
          ${navLink("/app/dna", "dna", "Brand Voice")}
          ${navLink("/app/coach", "spark", "AI Coach")}
          ${navLink("/app/settings", "settings", "Settings")}
        </nav>
        
      </aside>

      <section class="app-main contentus-main">
        <header class="app-topbar topbar-v4 ct-topbar">
          <div class="topbar-left">
            <button class="icon-button mobile-menu" data-action="mobile-menu" type="button" aria-label="Open menu">${icon("menu")}</button>
          </div>
          <div class="topbar-actions ct-top-actions">
            <span class="status-dot ${appConfig?.integrations?.gemini ? "good" : "warn"}">${appConfig?.integrations?.gemini ? "Gemini ready" : "Demo mode"}</span>
            <button class="ct-icon-button" type="button" aria-label="Notifications">🔔<sup>3</sup></button>
            <button class="ct-icon-button" type="button" aria-label="Theme">☼</button>
            <span class="ct-avatar">${escapeHtml((creatorDisplayNameV4?.() || creatorDisplayName() || "C").slice(0, 1).toUpperCase())}</span>
            <a class="button primary ct-new-idea-btn" href="#/app/ideas">New idea</a>
          </div>
        </header>
        <div class="app-content ct-app-content">${page.html}</div>
      </section>
    </section>
  `;
}

function pageForRouteV4(route) {
  const pages = {
    "/app/dashboard": { title: "Dashboard", subtitle: "Your AI-powered content command center.", html: dashboardPageV4() },
    "/app/ideas": { title: "Ideas", subtitle: "Generate content ideas in your voice.", html: ideasPageV4() },
    "/app/idea-hit-miss": { title: "Idea Hit / Miss", subtitle: "Validate ideas against platform momentum.", html: ideaHitMissPageV4() },
    "/app/scripts": { title: "Script Builder", subtitle: "Write real speaking scripts with AI assistance.", html: scriptsPageV4() },
    "/app/thumbnail": { title: "Thumbnail Designer", subtitle: "Generate and refine high-CTR thumbnails.", html: thumbnailPageV4() },
    "/app/trends": { title: "Trend Analyzer", subtitle: "See famous music, winning ideas, and content opportunities.", html: trendAnalyzerPageV4() },
    "/app/youtube-growth": { title: "Analytics Overview", subtitle: "Track performance and growth trends.", html: youtubeGrowthPageV4() },
    "/app/detailed-video-analysis": { title: "Detailed Video Analysis", subtitle: "Understand what to improve in a selected video.", html: detailedVideoAnalysisPageV4() },
    "/app/community": { title: "Community & Comments", subtitle: "Turn conversations into content.", html: communityPageV4() },
    "/app/calendar": { title: "Content Calendar", subtitle: "Plan smarter and avoid creator burnout.", html: calendarPageV4() },
    "/app/video-checker": { title: "Video Checker", subtitle: "Score audio, visuals, title, thumbnail, and audience fit.", html: videoCheckerPageV4() },
    "/app/publishing": { title: "Publish Everywhere", subtitle: "Upload once. Adapt intelligently. Publish everywhere.", html: publishingPageV4() },
    "/app/inspiration": { title: "Inspiration Library", subtitle: "Save references without copying.", html: inspirationPageV4() },
    "/app/dna": { title: "Brand Voice", subtitle: "Define what makes your content sound like you.", html: dnaPageV4() },
    "/app/coach": { title: "AI Channel Coach", subtitle: "Ask what to improve and what to post next.", html: coachPageV4() },
    "/app/settings": { title: "Settings", subtitle: "Manage integrations and privacy.", html: (typeof settingsPageV4 === "function" ? settingsPageV4() : settingsPage()) },
    "/app/extension": { title: "Chrome Helper", subtitle: "Use Contentus while browsing.", html: extensionPageV4() },
  };
  return pages[route] || pages["/app/dashboard"];
}

function ctMockVideos() {
  return normalizeList(state.youtube?.videos || state.youtube?.recentVideos).length
    ? normalizeList(state.youtube?.videos || state.youtube?.recentVideos)
    : [
      { id: "mock-1", title: "10 AI Tools for Creators in 2024", views: 128000, likes: 6200, comments: 432, duration: "12:45", ctr: 6.4, retention: 54, watchTime: "8.2K", topic: "AI / Productivity", platform: "YouTube" },
      { id: "mock-2", title: "How I Plan My Content in 30 Minutes", views: 18300, likes: 1200, comments: 119, duration: "8:21", ctr: 5.9, retention: 49, watchTime: "1.2K", topic: "Creator Systems", platform: "YouTube" },
      { id: "mock-3", title: "3 ChatGPT Hacks You Need to Try", views: 15700, likes: 970, comments: 82, duration: "0:44", ctr: 7.2, retention: 61, watchTime: "820", topic: "Shorts", platform: "YouTube Shorts" },
      { id: "mock-4", title: "Day in the Life: Full-Time Creator", views: 12800, likes: 880, comments: 64, duration: "0:58", ctr: 5.1, retention: 42, watchTime: "620", topic: "Lifestyle", platform: "Instagram Reels" },
    ];
}

function ctTrendingTopics() {
  return [
    { title: "AI Tools for Creators in 2024", niche: "AI / Tools", score: 98, icon: "▶" },
    { title: "How I Grew from 0 to 100K Subs", niche: "YouTube Growth", score: 86, icon: "📈" },
    { title: "Making Money with AI", niche: "Creator Economy", score: 82, icon: "💸" },
    { title: "Day in the Life: Creator Edition", niche: "Lifestyle", score: 74, icon: "🎥" },
    { title: "Faceless YouTube Channel Ideas", niche: "Faceless", score: 69, icon: "🎭" },
  ];
}

function ctTrendingAudio() {
  return [
    { title: "UPBEAT SUCCESS", duration: "2:31", usage: "128K", platforms: "▶ ♪ ◎ 𝕏" },
    { title: "Cinematic Motivation", duration: "1:58", usage: "96K", platforms: "▶ ♪ ◎" },
    { title: "Future Bass Energy", duration: "1:44", usage: "82K", platforms: "▶ ♪ ◎" },
    { title: "Glitch Transition", duration: "0:15", usage: "71K", platforms: "♪ ◎ 𝕏" },
    { title: "Chill Lo-Fi Vibes", duration: "2:07", usage: "63K", platforms: "▶ ♪ ◎" },
  ];
}

function ctMetricCard(label, value, sub, tone = "green") {
  return `
    <article class="ct-card ct-metric ct-${tone}">
      <div class="ct-card-label">${escapeHtml(label)} <span>ⓘ</span></div>
      <div class="ct-metric-value"><strong>${escapeHtml(value)}</strong><small>/100</small></div>
      <p>${escapeHtml(sub)}</p>
      <div class="ct-mini-line">${ctMiniSvg(tone)}</div>
    </article>
  `;
}

function ctRing(label, value, sub = "Excellent", size = "normal") {
  return `
    <article class="ct-card ct-ring-card ${size === "large" ? "ct-ring-card-large" : ""}">
      <div class="ct-card-label">${escapeHtml(label)} <span>ⓘ</span></div>
      <div class="ct-ring" style="--score:${Number(value)}"><strong>${escapeHtml(value)}</strong><small>/100</small></div>
      <p>${escapeHtml(sub)}</p>
    </article>
  `;
}

function ctMiniSvg(tone = "green") {
  const color = tone === "purple" ? "#a855f7" : tone === "blue" ? "#22c7ff" : tone === "orange" ? "#f59e0b" : "#22e284";
  return `<svg viewBox="0 0 130 36" aria-hidden="true"><polyline points="3,29 15,20 27,23 40,14 52,17 66,9 79,12 94,6 108,11 127,3" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function ctWave() {
  return `<svg viewBox="0 0 110 28" aria-hidden="true">${Array.from({ length: 25 }).map((_, i) => `<rect x="${i * 4.2}" y="${14 - ([5,12,18,9,22,13,7,17,24,10][i % 10] / 2)}" width="2.2" height="${[5,12,18,9,22,13,7,17,24,10][i % 10]}" rx="1" fill="#a855f7" opacity="${0.45 + (i % 4) * 0.12}"/>`).join("")}</svg>`;
}

function ctLineChart() {
  return `
    <svg viewBox="0 0 680 260" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="ctArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.45"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></linearGradient></defs>
      <g stroke="#ffffff" opacity=".12"><line x1="0" y1="50" x2="680" y2="50"/><line x1="0" y1="105" x2="680" y2="105"/><line x1="0" y1="160" x2="680" y2="160"/><line x1="0" y1="215" x2="680" y2="215"/></g>
      <path d="M0,210 C45,165 82,178 118,138 C160,92 184,144 220,128 C264,108 292,58 336,92 C380,126 398,62 450,78 C500,94 520,130 572,72 C618,24 640,70 680,34 L680,260 L0,260 Z" fill="url(#ctArea)"/>
      <path d="M0,210 C45,165 82,178 118,138 C160,92 184,144 220,128 C264,108 292,58 336,92 C380,126 398,62 450,78 C500,94 520,130 572,72 C618,24 640,70 680,34" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
    </svg>
  `;
}

function ctDonut() {
  return `<div class="ct-donut"><span>128K</span><small>Views</small></div>`;
}

function ctVideoThumb(label = "10 AI TOOLS", badge = "12:45") {
  return `<div class="ct-video-thumb"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(badge)}</span></div>`;
}

function dashboardPageV4() {
  return `
    <section class="page page-v4 ct-page ct-dashboard-page">
      <div class="ct-page-heading">
        <div><h2>Welcome back, Creator! 👋</h2><p>Run your smarter, AI-powered content studio.</p></div>
      </div>
      <div class="ct-dashboard-grid">
        <article class="ct-card ct-health-card"><h3>Channel Health <span>ⓘ</span></h3><div class="ct-health-inner"><div class="ct-ring big" style="--score:87"><strong>87</strong><small>/100</small></div><div><strong class="ct-good">Strong growth</strong><p>Great momentum! Keep building consistently.</p><a class="ct-soft-btn" href="#/app/detailed-video-analysis">View Full Report</a></div></div></article>
        <article class="ct-card ct-auth-card"><h3>Authenticity Score <span>ⓘ</span></h3><div class="ct-ring" style="--score:92"><strong>92</strong><small>/100</small></div><strong class="ct-good center">Very Authentic</strong><p>Your content feels real and connects with your audience.</p></article>
        <article class="ct-card ct-trend-preview"><div class="ct-card-top"><h3>Trend Analyzer <span>ⓘ</span></h3><a href="#/app/trends">View All Trends →</a></div><div class="ct-two-col">${ctTrendMiniList("YouTube Long Videos", ctTrendingTopics().slice(0,3))}${ctTrendMiniList("YouTube Shorts", [{title:"AI Before vs After", score:97},{title:"3 ChatGPT Hacks", score:89},{title:"Day in the Life: Creator", score:74}])}</div><div class="ct-audio-strip"><strong>Trending Audio Across Platforms</strong><span>▶ YouTube ${ctMiniSvg("green")}</span><span>♪ TikTok ${ctMiniSvg("green")}</span><span>◎ Instagram ${ctMiniSvg("green")}</span></div></article>
        <article class="ct-card ct-quick-actions"><h3>Quick Actions</h3><div class="ct-action-grid">${ctActionTile("/app/scripts","📝","Script Builder","Write powerful scripts")}${ctActionTile("/app/thumbnail","🖼️","Thumbnail Designer","Create scroll-stopping thumbs")}${ctActionTile("/app/video-checker","🎬","Video Checker","Optimize before publish")}${ctActionTile("/app/idea-hit-miss","🎯","Idea Hit / Miss","Validate ideas with AI")}${ctActionTile("/app/trends","📈","Trend Analyzer","Find winning trends")}${ctActionTile("/app/publishing","🚀","Publish Everywhere","Post across platforms")}</div></article>
        <article class="ct-card ct-ai-strategist"><div class="ct-card-top"><h3>AI Strategist</h3><span class="ct-badge purple">Beta</span></div><div class="ct-ai-bubble"><div class="ct-bot-face">☻</div><p>Hi Creator! 👋 I'm your AI strategist. Ask me anything about improving your channel.</p></div><button>What should I improve next?</button><button>Why did my last video underperform?</button><button>Give me ideas for next week</button><div class="ct-chat-input">Ask me anything... <span>➤</span></div></article>
        <article class="ct-card ct-platform-status"><h3>Cross-Platform Status <span>ⓘ</span></h3>${["YouTube Long Videos","YouTube Shorts","TikTok","Instagram","X / Twitter"].map((p,i)=>`<div class="ct-platform-row"><strong>${["▶","⚡","♪","◎","𝕏"][i]} ${p}</strong><small>${["128K subscribers","312K subscribers","86K followers","52K followers","18K followers"][i]}</small><span>${ctMiniSvg("purple")}</span><em>+${[18,26,14,9,7][i]}%</em></div>`).join("")}</article>
        <article class="ct-card ct-opportunity"><div class="ct-card-top"><h3>Opportunity Radar <span>ⓘ</span></h3><a href="#/trends">View All →</a></div>${["Create a video about AI tools for creators","Shorts about 3 ChatGPT hacks are trending","Long-form content gap in your niche","Collaborate with creators in your niche"].map((x,i)=>`<div class="ct-opportunity-row"><span>${["◎","⚡","☷","👥"][i]}</span><strong>${escapeHtml(x)}</strong><em>${i<2?"High":"Medium"}</em><b>↑ Potential</b></div>`).join("")}</article>
        <article class="ct-card ct-mini-calendar"><div class="ct-card-top"><h3>Content Calendar <span>ⓘ</span></h3><a href="#/app/calendar">View Calendar →</a></div><div class="ct-week-row">${["Mon 20","Tue 21","Wed 22","Thu 23","Fri 24","Sat 25","Sun 26"].map((d,i)=>`<span class="${i===2?"active":""}">${d}</span>`).join("")}</div>${["How I Use AI to Save 10+ Hours a Week","3 ChatGPT Hacks You Need to Try","Day in the Life: Full-Time Creator"].map((x,i)=>`<div class="ct-schedule-row"><time>${["10:00 AM","01:00 PM","06:00 PM"][i]}</time><strong>${x}</strong><span>${["Script Ready","Thumbnail","In Progress"][i]}</span></div>`).join("")}</article>
        <article class="ct-card ct-privacy-hero"><div class="ct-shield">🛡️</div><h3>Privacy-First</h3><p>Your data stays yours. We don't train on your content. No data shared. Ever.</p><div class="ct-lock-pill">🔒 No data shared</div></article>
      </div>
    </section>
  `;
}

function ctActionTile(route, emoji, title, text) {
  return `<a class="ct-action-tile" href="#${route}"><span>${emoji}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(text)}</small><b>›</b></a>`;
}

function ctTrendMiniList(title, items) {
  return `<div class="ct-trend-mini"><h4>${escapeHtml(title)}</h4>${items.map((item,i)=>`<div><span>${i+1}</span><strong>${escapeHtml(item.title)}</strong><em>🔥 ${item.score}</em></div>`).join("")}<button type="button">View all trends</button></div>`;
}

function trendAnalyzerPageV4() {
  return `
    <section class="page page-v4 ct-page ct-trend-page">
      <div class="ct-page-heading"><div><h2>Trend Analyzer <span class="ct-zig">⌁⌁⌁</span></h2><p>See the hottest music, video ideas, and content opportunities right now.</p></div></div>
      <div class="ct-platform-tabs">${["▶ YouTube Long","⚡ YouTube Shorts","♪ TikTok","◎ Instagram Reels","𝕏 X / Twitter"].map((x,i)=>`<button class="${i===0?"active":""}" type="button">${x}</button>`).join("")}<div class="ct-tab-spacer"></div><button>🌍 Worldwide</button><button>📅 Last 7 Days</button></div>
      <div class="ct-trend-score-row">${ctMetricCard("Trend Velocity","85","Very High","green")}${ctMetricCard("Search Demand","91","Very High","purple")}${ctMetricCard("Audience Interest","88","Very High","blue")}${ctMetricCard("Competition Score","42","Medium","orange")}${ctRing("Opportunity Score","88","Excellent")}</div>
      <div class="ct-trend-layout">
        <div class="ct-trend-main">
          <article class="ct-card"><div class="ct-card-top"><h3>🎵 Most Famous Music</h3><a>View all audio →</a></div><div class="ct-audio-table"><div class="ct-table-head"><span>#</span><span>Track</span><span>Duration</span><span>Usage</span><span>Platforms</span></div>${ctTrendingAudio().map((a,i)=>`<div class="ct-audio-row"><span>${i+1}</span><button>▶</button><strong>${a.title}<small>${ctWave()}</small></strong><em>${a.duration}</em><b>${a.usage}</b><i>${a.platforms}</i></div>`).join("")}</div></article>
          <article class="ct-card"><div class="ct-card-top"><h3>💡 Best Video Ideas</h3><a>View all ideas →</a></div><div class="ct-idea-table"><div class="ct-table-head"><span>#</span><span>Idea</span><span>Niche</span><span>Trend Score</span></div>${ctTrendingTopics().map((t,i)=>`<div class="ct-idea-row"><span>${i+1}</span><strong>${escapeHtml(t.title)}</strong><em>${escapeHtml(t.niche)}</em><b>${ctMiniSvg(i===0?"green":"purple")}🔥 ${t.score}</b></div>`).join("")}</div></article>
          <article class="ct-card ct-topic-chart"><div class="ct-card-top"><h3>Topic Momentum</h3><button>Last 7 Days</button></div>${ctLineChart()}</article>
          <article class="ct-card ct-heatmap-card"><h3>Platform Heatmap</h3><div class="ct-heatmap">${["YouTube Long","YouTube Shorts","TikTok","Instagram Reels","X / Twitter"].map(row=>`<div><span>${row}</span><p>${Array.from({length:9}).map((_,i)=>`<i style="opacity:${0.18 + i*0.09}"></i>`).join("")}</p></div>`).join("")}</div></article>
        </div>
        <aside class="ct-trend-side">
          <article class="ct-card ct-ai-insight"><div class="ct-card-top"><h3>✨ AI Trend Insight</h3><span class="ct-badge good">● Live</span></div><div class="ct-bot-note"><span>🤖</span><p>Creators are leaning into practical AI tools, faceless growth stories, and productivity hacks. High search demand and rising engagement across YouTube & TikTok.</p></div><h4>Why this trend is hot</h4><ul><li>Search intention ↑ 86% across platforms</li><li>High retention on how-to & tool content</li><li>Growing creator interest in AI workflows</li><li>Low competition window for new ideas</li></ul><h4>Content Suggestions</h4>${["Top 5 AI Tools I Use Everyday","I Tried 10 Viral Productivity Hacks","How I Edit 10x Faster With AI","Build a Faceless Channel Step-by-Step"].map(x=>`<button class="ct-suggestion">${x} →</button>`).join("")}<button class="button primary full-width">Turn into Idea ✨</button></article>
          <article class="ct-card ct-recommended"><div class="ct-card-top"><h3>Recommended Angles</h3><a>View all →</a></div><div class="ct-angle-mini-grid">${["AI Tools That Save 10+ Hours","0 to 100K Subscribers","Day in the Life Creator","Faceless Ideas That Work"].map((x,i)=>`<div><span>${["🤖","🚀","📸","🎭"][i]}</span><strong>${x}</strong><small>${i===3?"Medium":"High"} Potential</small></div>`).join("")}</div></article>
        </aside>
      </div>
    </section>
  `;
}

function ideaHitMissPageV4() {
  return `
    <section class="page page-v4 ct-page ct-hit-page">
      <div class="ct-page-heading"><div><span class="ct-breadcrumb">Ideas › Idea Hit / Miss</span><h2>Idea Hit / Miss</h2></div><button class="ct-soft-btn">↻ Reanalyze</button></div>
      <div class="ct-hit-layout">
        <aside class="ct-card ct-idea-input"><h3><span>1</span> Idea Input</h3><label>Paste your idea or upload a brief</label><textarea id="hit-miss-idea">I want to make a video about testing viral TikTok productivity hacks to see if they actually work.</textarea><small>90 / 1000</small><div class="ct-chip-row"><button>Gaming</button><button>Tech</button><button>Finance</button><button>Lifestyle</button></div><div class="ct-upload-box">⇧<p>Drag & drop a file here,<br>or click to upload</p><small>PDF, DOCX, TXT</small></div><button class="button primary full-width" type="button">Analyze Idea ✨</button></aside>
        <section class="ct-hit-results"><article class="ct-card ct-hit-main"><div><div class="ct-hit-orb"><strong>HIT</strong><span>High Potential</span></div></div><div><h3>Great potential! This idea aligns well with what's trending and what audiences want to watch right now.</h3><button class="ct-soft-btn">View Full Analysis →</button></div><div>${ctRing("Trend Alignment Score","82","Strong alignment")}</div></article><div class="ct-four-metrics">${ctRing("Topic Freshness","76","Fresh")}${ctRing("Audience Demand","84","High")}${ctRing("Competition","58","Moderate")}${ctRing("Overall Score","82","Very Good")}</div><article class="ct-card"><h3><span>3</span> How to make it stronger</h3>${["Add a strong hook in the first 5 seconds","Narrow the focus","Show real before/after results","Include a final list or ranking"].map((x,i)=>`<div class="ct-fix-row"><span>${["💎","▣","✦","👥"][i]}</span><strong>${x}</strong><small>${["Use a surprising result or bold claim to stop the scroll.","Pick 5–7 specific hacks instead of many.","Visual proof drives retention and trust.","Helps with retention and gives viewers a takeaway."][i]}</small></div>`).join("")}<button class="ct-soft-btn full-width">Regenerate Suggestions ✨</button></article><article class="ct-card"><div class="ct-card-top"><h3><span>4</span> Trend References</h3><a href="#/app/trends">View all trends →</a></div><div class="ct-two-col">${ctTrendMiniList("Relevant YouTube Long Trends", [{title:"Testing Viral TikTok Life Hacks",score:98},{title:"I Tested 10 Viral Productivity Hacks",score:86},{title:"Viral Productivity Hacks: Worth It?",score:74}])}${ctTrendMiniList("Relevant YouTube Shorts Trends", [{title:"Productivity Hack That Actually Works",score:97},{title:"3 Productivity Hacks in 30 Seconds",score:89},{title:"TikTok Hack vs Reality",score:76}])}</div><div class="ct-tag-row">${["productivity hacks","tiktok hacks","life hacks","study hacks","focus tips"].map(x=>`<span>${x}</span>`).join("")}</div></article></section>
      </div>
    </section>`;
}

function scriptsPageV4() {
  const latest = activeScript?.() || state.scripts?.[0];
  const title = latest?.title || "How I Grew from 0 to 10K Subscribers";
  return `
    <section class="page page-v4 ct-page ct-script-page">
      <div class="ct-workspace-title"><div><button class="ct-round-btn">‹</button><h2>Script Builder</h2><p>Write length-aware scripts and export formatted PDFs.</p></div><div><span class="status-dot good">All changes saved</span><button class="ct-soft-btn">Help</button><button class="button primary" type="button" data-action="v4-download-script">Export PDF</button></div></div>
      <div class="ct-script-layout">
        <aside class="ct-card ct-chat-rail"><div class="ct-card-top"><h3>Saved Chats</h3><button>«</button></div><button class="button primary full-width" type="button" data-action="v4-new-script-chat">+ New Chat</button><div class="ct-search-box">🔍 Search chats...</div>${["How I Grew from 0 to 10K Subs","AI Tools for Creators in 2024","3 ChatGPT Hacks You Need","Day in the Life: Creator","Making Money with AI"].map((x,i)=>`<button class="ct-thread ${i===0?"active":""}" type="button"><span>💬</span><strong>${x}</strong><small>${i===0?"Just now":i<3?"Yesterday":`${i+1} days ago`}</small></button>`).join("")}<button class="ct-soft-btn full-width">⚙ Manage Chats</button></aside>
        <main class="ct-card ct-script-doc"><div class="ct-doc-head"><h3>${escapeHtml(title)} <span>✎</span></h3><small>Word count: 1,248</small><button class="ct-platform-pill">▶ YouTube Long⌄</button></div><div class="ct-editor-toolbar"><button>Heading 1⌄</button><b>B</b><i>I</i><u>U</u><span>☷</span><span>☰</span><span>🔗</span><span>❝</span><span>{ }</span><span>↶</span><span>↷</span></div>${ctScriptDocument()}<div class="ct-doc-footer"><span class="ct-good">● Auto-saved</span><span>Just now</span><span>1,248 words</span><span>~7:45 min read</span></div></main>
        <aside class="ct-card ct-ai-panel"><div class="ct-card-top"><h3>AI Assistant <span class="ct-badge purple">Beta</span></h3><button>»</button></div><div class="ct-ai-bubble"><div class="ct-bot-face">☻</div><p>Hi Creator! 👋 I'm your AI writing assistant. How can I help improve your script today?</p></div><div class="ct-tool-row"><button data-action="v4-run-script-credibility">🛡 Credibility Check</button><button data-action="v4-script-assistant-suggest" data-prompt="Get suggestions">✨ Get Suggestions</button><button data-action="v4-transform-script" data-transform="Shorter Script">✂ Shorter Script</button></div><div class="ct-message user">Can you give me suggestions to make this more engaging?<span>10:30 AM ✓</span></div><div class="ct-message bot">Absolutely! Here are a few ways to boost engagement and retention.</div>${["Stronger Hook|Make the hook even more specific and curiosity-driven.","Add Pattern Interrupts|Add visual or narrative breaks every 60–90 seconds.","More Personal Moments|Add a short personal story in the proof section."].map((x,i)=>{const [a,b]=x.split("|");return `<div class="ct-suggestion-card tone-${i}"><strong>${a}</strong><p>${b}</p><button data-action="v4-implement-script-suggestion" data-index="${i}">Apply this change</button></div>`}).join("")}<div class="ct-chat-input">Ask anything about your script... <span>➤</span></div><small class="ct-ai-warning">AI can make mistakes. Review before applying.</small></aside>
      </div>
      ${state.scriptCredibilityReport ? scriptCredibilityPanel(state.scriptCredibilityReport) : ""}
    </section>`;
}

function ctScriptDocument() {
  const sections = [
    ["🪝", "Hook", "I went from 0 to 10,000 subscribers in 8 months. No viral videos. No expensive gear. Just a simple system that actually works. Here's exactly how I did it."],
    ["👤", "Intro", "Hey, I'm [Your Name], a full-time creator focused on helping you build an audience and grow online. If you're new here, consider subscribing—I share practical strategies every week that actually move the needle."],
    ["✅", "Key Points", "1. I picked a focused niche I'm passionate about\n2. I created content that solves one problem really well\n3. I stayed consistent and treated it like a system\n4. I optimized titles, thumbnails, and hooks\n5. I engaged with my audience and built real relationships"],
    ["⭐", "Proof / Examples", "Month 1: 23 subscribers\nMonth 4: 1,250 subscribers\nMonth 8: 10,000 subscribers\nOne video on AI Tools for Creators brought in 2,300 subs in a week. Consistency + compounding = growth."],
    ["🎙", "Speaking Notes", "Be authentic and conversational. Share real examples. Look into the camera. Smile. Keep energy up in the hook and key points."],
    ["▷", "Outro", "It's not about going viral. It's about adding value and showing up consistently. Keep going. You've got this."],
    ["♡", "CTA", "If this helped you, hit that like button and subscribe for more strategies that help you grow faster. What's your biggest challenge right now? Drop it in the comments—I read every single one."],
  ];
  return `<div class="ct-script-sections">${sections.map(([icon,title,text])=>`<section><h4><span>${icon}</span>${title}</h4><p>${escapeHtml(text).replace(/\n/g,"<br>")}</p></section>`).join("")}</div>`;
}

function thumbnailPageV4() {
  const chat = activeThumbnailChat?.();
  return `
    <section class="page page-v4 ct-page ct-thumb-page">
      <div class="ct-workspace-title"><div><h2>Thumbnail Designer</h2><p>Design AI-powered thumbnails that get more clicks.</p></div><div><span class="status-dot good">Auto-save</span><button class="ct-soft-btn">ⓘ Help</button><button class="button primary" data-action="v4-new-thumbnail-chat">↓ New idea</button></div></div>
      <div class="ct-thumb-layout">
        <aside class="ct-card ct-thumb-chat"><div class="ct-card-top"><h3>Thumbnail Chat</h3><span class="ct-good">☑ Saved</span></div><form id="thumbnail-form" class="ct-thumb-form">${selectCustom("thumb-idea", "Idea", ideaOptions(), state.selectedIdeaId || "Custom")}${fieldV4("thumb-title", "Main Text", selectedIdea?.()?.title || "10X FASTER WITH AI", "text", "Example: 10X FASTER WITH AI")}${textareaV4("thumb-idea-brief", "Type your thumbnail idea", "Create a high-energy thumbnail for a YouTube video about AI tools that 10x productivity in 2024.", "Describe emotion, person, objects, contrast, and style.", "full")}<button class="button primary full-width" type="button" data-action="v4-generate-thumbnail">Generate thumbnail</button></form><div class="ct-message user">Create a high-energy thumbnail for AI productivity tools.<span>10:32 AM</span></div><div class="ct-message bot">Got it! I'll create a bold thumbnail with high contrast, clear text, and an excited focal point.</div><div id="thumbnail-copy-output" class="ct-thumb-output">${chat?.messages?.length ? chat.messages.map(chatBubble).join("") : `<div class="ct-thumb-mini-preview"><strong>10X</strong><span>FASTER WITH AI</span></div><p>Here's a thumbnail concept based on your idea. You can refine the text, style, or focus areas.</p>`}</div><div class="ct-chat-input">Ask AI to refine your thumbnail... <span data-action="v4-thumbnail-chat-send">➤</span></div><div class="ct-update-list"><h4>Update Suggestions <span>AI</span></h4>${["Make the text bigger","Add more contrast","Show excitement on face","Add productivity icons"].map(x=>`<button type="button" data-action="v4-thumbnail-suggest" data-prompt="${escapeHtml(x)}">${x} →</button>`).join("")}</div></aside>
        <main class="ct-card ct-thumb-canvas-area"><div class="ct-card-top"><div><span class="section-kicker">AI is generating your thumbnail...</span><div class="ct-progress"><span style="width:72%"></span></div></div><button class="ct-soft-btn" data-action="v4-generate-thumbnail">↻ Regenerate</button></div><div class="ct-thumbnail-preview"><canvas id="thumbnail-canvas" width="1280" height="720" aria-label="Generated thumbnail preview"></canvas><div class="ct-select-tools"><button class="active">Select</button><button>Box Select</button></div></div><p class="ct-canvas-help">ⓘ Drag the handles to resize or move the selected region</p><div class="ct-canvas-actions"><button>−</button><span>100%</span><button>+</button><button>Fit</button><button class="button primary" data-action="v4-download-thumbnail">↓ Download</button><button class="ct-soft-btn">Share</button></div></main>
      </div>
    </section>`;
}

function communityPageV4() {
  const rows = [
    ["Sarah J.", "This video really helped me understand the algorithm. My channel grew 30% after I applied these tips. Thank you!", "Positive", "YouTube", "2 hours ago", 24],
    ["James T.", "What camera do you recommend for beginners on a budget?", "Question", "TikTok", "3 hours ago", 9],
    ["Lily Carter", "Love your editing style! How do you stay so consistent with uploads?", "Positive", "YouTube", "4 hours ago", 15],
    ["CoolGuy23", "This is clickbait. None of this works anymore.", "Negative", "YouTube", "5 hours ago", 1],
    ["Alex Rivera", "Where do you find royalty-free music like that? Drop the source please!", "Question", "Instagram", "6 hours ago", 7],
    ["Emma L.", "I've been following your channel for months—always solid advice 🙌", "Positive", "TikTok", "7 hours ago", 12],
  ];
  return `
    <section class="page page-v4 ct-page ct-community-page">
      <div class="ct-page-heading"><div><h2>💬 Community & Comments</h2><p>Engage with your audience and turn conversations into content.</p></div><button class="button primary">↓ Export</button></div>
      <div class="ct-comment-layout"><main><div class="ct-filter-row"><button>All Platforms⌄</button><button>All Videos⌄</button><button>All Time⌄</button><div class="ct-search-box">🔍 Search comments...</div><button class="button primary">Filters</button></div><div class="ct-chip-tabs">${["All Comments 324","Positive 186","Questions 78","Neutral 42","Negative 18","Spam 6"].map((x,i)=>`<button class="${i===0?"active":""}">${x}</button>`).join("")}</div><div class="ct-sort-line"><span>Showing 324 comments</span><span>Sort by: <button>Newest⌄</button></span></div><div class="ct-comment-list">${rows.map(([name,text,sentiment,platform,time,likes],i)=>`<article class="ct-comment-card"><div class="ct-comment-avatar">${name.slice(0,1)}</div><div><div class="ct-comment-head"><strong>${name}</strong><small>${platform === "YouTube" ? "▶" : platform === "TikTok" ? "♪" : "◎"} ${time}</small><span class="ct-badge ${sentiment === "Positive" ? "good" : sentiment === "Question" ? "blue" : "bad"}">${sentiment}</span></div><p>${text}</p><div class="ct-comment-actions"><button>Reply</button><button>♡ ${likes}</button><button>View thread (${i+1})</button></div></div><button>•••</button></article>`).join("")}</div><button class="ct-soft-btn full-width">↻ Load more comments</button></main><aside><article class="ct-card ct-comment-summary"><div class="ct-card-top"><h3>✨ AI Comment Summary</h3><small>Updated just now</small></div><p>Your audience loves your actionable tips and editing style. They're asking for beginner gear recommendations, music sources, and real examples. A few people think it's clickbait—consider addressing results and expectations upfront.</p><div class="ct-three-stats"><div><strong>324</strong><small>Total Comments</small></div><div><strong>86%</strong><small>Positive Sentiment</small></div><div><strong>2.1h</strong><small>Avg. Response Time</small></div></div></article><article class="ct-card"><div class="ct-card-top"><h3>✨ AI Suggested Replies</h3><a>See more</a></div>${["Thanks so much! 🙌 So happy to hear it's helping you grow!","Great question! I recommend the Sony ZV-E10 for beginners. Affordable and super versatile.","You're right—results take time. In this video I share what actually works for me."].map(x=>`<div class="ct-reply-row"><p>${x}</p><button>Use Reply</button><button>Save as Idea</button></div>`).join("")}</article><div class="ct-comment-side-grid"><article class="ct-card"><h4>Top Questions to Turn Into Content</h4><ol><li>Best camera for beginners?</li><li>How to get more views fast?</li><li>Where do you get music?</li></ol><button class="button primary full-width">Turn into Video</button></article><article class="ct-card"><h4>Loyal Fans</h4><p>Sarah J. · 28 comments 🏆</p><p>Lily Carter · 21 comments 🏆</p><p>Emma L. · 18 comments</p></article><article class="ct-card"><h4>Toxic / Spam Review</h4><p>CoolGuy23 <span class="ct-badge bad">Negative</span></p><button class="ct-danger-btn">Review & Moderate</button></article><article class="ct-card ct-community-health"><h4>Community Health</h4><div class="ct-ring" style="--score:86"><strong>86</strong><small>/100</small></div><p>Very Healthy</p></article></div></aside></div>
    </section>`;
}

function calendarPageV4() {
  const selected = state.selectedCalendarDate || "2024-05-22";
  return `
    <section class="page page-v4 ct-page ct-calendar-page">
      <div class="ct-page-heading"><div><h2>Content Calendar</h2><p>Plan smarter. Create consistently.</p></div><div><button class="ct-soft-btn">←</button><button class="ct-soft-btn">→</button><button class="ct-soft-btn">May 2024⌄</button><button class="button primary">+ Today</button></div></div>
      <div class="ct-calendar-layout"><main><div class="ct-calendar-metrics">${["Content Balance|72%|Balanced","Burnout Risk|Low|Keep it up!","Content Planned|28|This Month","Consistency Streak|14 Days|Keep the momentum!"].map((x,i)=>{const [a,b,c]=x.split("|"); return `<article class="ct-card"><h4>${a}</h4><strong>${b}</strong><small>${c}</small></article>`}).join("")}</div><div class="ct-calendar-controls"><button class="active">Month</button><button>Week</button><button>List</button><button class="active">All</button><button>▶ YouTube</button><button>⚡ Shorts</button><button>♪ TikTok</button><button>◎ Instagram</button><button>𝕏 X / Twitter</button><span></span><button>Filters</button></div><div class="ct-calendar-grid-pro">${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>`<strong>${d}</strong>`).join("")}${Array.from({length:35}).map((_,i)=>ctCalendarCell(i)).join("")}</div><div class="ct-calendar-legend">▶ YouTube · ⚡ Shorts · ♪ TikTok · ◎ Instagram · 𝕏 X / Twitter · +2 more <span>All times shown in your local time ⓘ</span></div></main><aside><article class="ct-card ct-day-panel"><div class="ct-card-top"><h3>Wed, May 22, 2024</h3><button data-action="v4-close-calendar-day">×</button></div><div class="ct-day-stats"><div>4<small>Contents</small></div><div>8h 15m<small>Total Time</small></div><div>Good<small>Pace</small></div></div><h4>Today's Schedule</h4>${["09:00 AM|How I Use AI to Save 10+...|Published","12:00 PM|3 ChatGPT Hacks You Need...|Scheduled","03:00 PM|Day in the Life: Full-Time...|Scheduled","06:00 PM|My Top AI Tools in 2024|Draft"].map(x=>{const [t,title,status]=x.split("|");return `<div class="ct-day-event"><time>${t}</time><strong>${title}</strong><span>${status}</span></div>`}).join("")}<button class="button primary full-width">+ Add Content to This Day</button></article><article class="ct-card ct-ai-planning"><h3>AI Planning Assistant <span class="ct-badge purple">Beta</span></h3><div class="ct-ai-bubble"><div class="ct-bot-face">☻</div><p>Great balance today! Consider adding a community post in the evening to boost engagement.</p></div><button class="ct-soft-btn full-width">Suggest Ideas</button></article><div class="ct-two-col"><article class="ct-card"><h4>Burnout Risk</h4><strong class="ct-good">Low⌄</strong>${ctMiniSvg("green")}</article><article class="ct-card"><h4>Content Balance</h4>${ctDonut()}<p>Balanced</p></article></div></aside></div>${state.selectedCalendarDate ? calendarDayModal(selected, normalizeList(state.calendar), normalizeList(state.googleCalendarEvents)) : ""}
    </section>`;
}

function ctCalendarCell(i) {
  const date = i - 1;
  const actual = date <= 0 ? 29 + i : date;
  const selected = actual === 22;
  const items = ["YouTube Long", "Shorts", "TikTok Video", "Instagram Reel", "X Thread"].filter((_,idx)=>(i+idx)%3===0).slice(0, selected ? 3 : 2);
  return `<button class="ct-calendar-cell ${selected?"selected":""}" type="button" data-action="v4-open-calendar-day" data-date="2024-05-${String(actual).padStart(2,"0")}"><strong>${actual}</strong>${items.map((it,j)=>`<span class="type-${j}">${it}</span>`).join("")}${items.length>2?`<small>+1 more</small>`:""}</button>`;
}

function youtubeGrowthPageV4() {
  const videos = ctMockVideos();
  return `
    <section class="page page-v4 ct-page ct-analytics-page">
      <div class="ct-page-heading"><div><h2>Analytics Overview</h2><p>Track performance, audience behavior, and growth trends.</p></div><button class="ct-soft-btn">📅 Last 28 days⌄</button></div>
      <div class="ct-analytics-metrics">${["Views|128K|18.6%|blue","Watch Time|8.4K hrs|21.3%|blue","Engagement Rate|7.6%|14.2%|purple","Subscribers|+1.2K|12.7%|purple","CTR|6.3%|9.8%|purple"].map(x=>{const [a,b,c,t]=x.split("|");return `<article class="ct-card ct-stat-card"><h4>${a}</h4><strong>${b}</strong><span>↑ ${c}</span>${ctMiniSvg(t)}</article>`}).join("")}</div><div class="ct-analytics-layout"><article class="ct-card ct-views-chart"><div class="ct-card-top"><h3>Views Over Time ⓘ</h3><button>Daily⌄</button></div>${ctLineChart()}</article><article class="ct-card"><div class="ct-card-top"><h3>Top Performing Content</h3><button>View All</button></div>${videos.map(v=>`<div class="ct-video-row">${ctVideoThumb(v.title.slice(0,12), v.duration)}<strong>${escapeHtml(v.title)}</strong><span>Views <b>${Number(v.views).toLocaleString()}</b> ↑</span><span>Watch Time <b>${v.watchTime}</b></span></div>`).join("")}</article><article class="ct-card"><h3>Retention & Drop-off ⓘ</h3><strong>4:32 <span class="ct-good">↑ 12.4%</span></strong><div class="ct-retention-curve"></div><p>47% of viewers are still watching at the 50% mark.</p></article><article class="ct-card"><h3>Topic Performance ⓘ</h3>${ctDonut()}<div class="ct-topic-list"><p><span></span>Tutorials 42%</p><p><span></span>Shorts 28%</p><p><span></span>Personal Stories 18%</p><p><span></span>AI Tools 12%</p></div></article><article class="ct-card"><h3>✨ AI Insights</h3>${["AI Tools content is growing 28% faster than average.","Your Shorts have a 18% higher completion rate.","Posting between 12PM - 3PM gets the most engagement."].map(x=>`<p class="ct-check">${x}</p>`).join("")}<h4>What to Improve</h4>${["Personal Stories have lower retention after 3 minutes.","Thumbnails with faces get 24% more clicks.","Try longer-form content on weekends for more watch time."].map(x=>`<p class="ct-warn">${x}</p>`).join("")}<button class="ct-soft-btn full-width">View All AI Recommendations →</button></article></div>
    </section>`;
}

function videoCheckerPageV4() {
  return `
    <section class="page page-v4 ct-page ct-video-checker-page">
      <div class="ct-page-heading"><div><h2>▣ Video Checker</h2><p>Analyze any YouTube video to optimize performance and growth.</p></div><div><button class="ct-soft-btn">History</button><button class="button primary">New Check</button></div></div>
      <div class="ct-video-checker-layout"><article class="ct-card ct-video-input"><div class="ct-tabs"><button class="active">🔗 YouTube URL</button><button>⇧ Upload Video</button></div><label>Paste a YouTube video link</label><input id="video-check-url" value="https://www.youtube.com/watch?v=dQw4w9WgXcQ"><label>Context</label><textarea id="video-check-context" placeholder="What should the AI pay attention to?"></textarea><input id="video-check-file" type="file" accept="video/*,audio/*"><button class="button primary full-width" data-action="v4-video-check">✨ Analyze Video</button><small>🔒 We never store or share your video.</small></article><article class="ct-card ct-video-player"><div class="ct-player-thumb"><span>▶</span></div></article><article class="ct-card ct-video-meta"><h3>10 AI Tools That Will 10X Your Content Creation</h3><p>Creator Studio ✓</p><p>👁 128K views</p><p>👍 6.2K · 💬 432</p><p>📅 May 20, 2024</p><span class="ct-badge">Education</span></article></div>
      <div class="ct-video-score-grid"><article class="ct-card ct-total-score"><div class="ct-ring big" style="--score:82"><strong>82</strong><small>/100</small></div><div><h3>Great job! 🎉</h3><p>This video is optimized well and has strong potential to perform.</p><button class="ct-soft-btn">View Summary</button></div></article>${["Audio Quality|84|Great","Video Quality|88|Great","Hook Strength|79|Good","Title Quality|83|Great","Thumbnail Quality|81|Great","Audience Fit|76|Good","Retention Potential|78|Good","Publish Readiness|87|Excellent"].map(x=>{const [a,b,c]=x.split("|");return `<article class="ct-card ct-mini-score"><div class="ct-ring small" style="--score:${b}"><strong>${b}</strong><small>/100</small></div><h4>${a}</h4><p>${c}</p></article>`}).join("")}</div>
      <div class="ct-video-bottom-grid"><article class="ct-card"><h3>Performance Overview</h3><div class="ct-radar">${ctMiniSvg("purple")}</div></article><article class="ct-card"><h3>Audience This Video Appeals To</h3>${["Content Creators|54","Digital Marketers|24","Entrepreneurs|13","Students|9"].map(x=>{const [a,b]=x.split("|"); return `<div class="ct-bar-line"><span>${a}</span><b style="width:${b}%"></b><em>${b}%</em></div>`}).join("")}</article><article class="ct-card"><h3>Top Improvement Suggestions</h3>${["Strengthen the hook in the first 5 seconds","Improve thumbnail contrast and focus","Add more pattern interrupts","Encourage engagement"].map((x,i)=>`<div class="ct-fix-row"><span>${["🪝","🖼️","🔁","💚"][i]}</span><strong>${x}</strong><small>${i<2?"High Impact":i===2?"Medium Impact":"Low Impact"}</small></div>`).join("")}</article><article class="ct-card"><h3>Improvement Checklist <small>4 / 8 completed</small></h3>${["Write a stronger title","Design a high-CTR thumbnail","Create a powerful hook (0–5s)","Add pattern interrupts","Improve audio clarity","Add chapters","Include a call to action","Optimize tags & description"].map((x,i)=>`<label class="ct-check-row"><input type="checkbox" ${i<4?"checked":""}> ${x}</label>`).join("")}</article></div>
    </section>`;
}

function detailedVideoAnalysisPageV4() {
  return `
    <section class="page page-v4 ct-page ct-detail-page">
      <div class="ct-page-heading"><div><h2>Detailed Video Analysis</h2><p>Dashboard › Analytics › Detailed Video Analysis</p></div><div><button class="ct-soft-btn">↓ Export Report</button><button class="button primary">Analyze Another Video</button></div></div>
      <article class="ct-card ct-selected-video"><div>${ctVideoThumb("10 AI TOOLS","12:45")}</div><div><h3>10 AI Tools for Creators in 2024</h3><p>Published Jan 5, 2024 · 12:45</p><p>Discover the 10 best AI tools that will save you time and level up your content in 2024.</p><div class="ct-tag-row"><span>AI</span><span>Productivity</span><span>Tools</span><span>Tutorial</span></div></div>${["Views|128K|+18%","Watch Time|8.2K|+22%","Engagement|7.8%|+16%"].map(x=>{const [a,b,c]=x.split("|"); return `<div class="ct-card ct-mini-detail"><h4>${a}</h4><strong>${b}</strong><span>${c}</span></div>`}).join("")}<div>${ctRing("Overall Score","87","Great performance!")}</div></article>
      <div class="ct-detail-grid"><article class="ct-card"><h3>Views Over Time</h3>${ctLineChart()}</article><article class="ct-card"><h3>Watch Time (Hours)</h3>${ctLineChart()}</article><article class="ct-card"><h3>Average View Duration</h3>${ctLineChart()}</article><article class="ct-card"><h3>Impressions Click-Through Rate</h3>${ctLineChart()}</article><article class="ct-card"><h3>Audience Retention</h3><div class="ct-retention-curve big"></div><p>Most viewers drop off at 2:15. Consider a stronger hook earlier to improve retention.</p></article><article class="ct-card"><h3>Audience Segments</h3>${ctDonut()}<div class="ct-topic-list"><p>18–24 22%</p><p>25–34 42%</p><p>35–44 21%</p><p>45–54 9%</p></div></article><article class="ct-card"><h3>Traffic Sources</h3>${ctDonut()}<p>Browse Features 45.2%</p><p>Suggested Videos 28.1%</p><p>YouTube Search 14.3%</p></article><article class="ct-card"><h3>Platform Performance</h3>${["YouTube|7.1K|86%","YouTube Shorts|620|7%","Embed / Websites|280|3%","External Apps|120|2%"].map(x=>{const [a,b,c]=x.split("|");return `<div class="ct-platform-perf"><span>${a}</span><b>${b}</b><em>${c}</em></div>`}).join("")}</article></div>
      <article class="ct-card ct-rec-strip"><h3>AI Insights & Recommendations</h3><div class="ct-rec-row">${["Title|7/10|Good keyword use but could be more curiosity-driven.","Thumbnail|8/10|Strong visual and contrast. Test fewer words.","First 30 Seconds|6/10|Retention drops early. Start with a preview of value.","Pacing|7/10|Good overall pace with a few slow sections.","Audience Targeting|8/10|Strong fit for your core audience.","Follow-Up Ideas|10 ideas|Generate more ideas based on this topic."].map(x=>{const [a,b,c]=x.split("|");return `<div><strong>${a} <span>${b}</span></strong><p>${c}</p><button class="ct-soft-btn">Improve →</button></div>`}).join("")}</div></article>
    </section>`;
}

function publishingPageV4() {
  return `
    <section class="page page-v4 ct-page ct-publish-page">
      <div class="ct-page-heading"><div><h2>Publish Everywhere <span class="ct-badge purple">AI-Powered</span></h2><p>Upload once. Adapt intelligently. Publish everywhere.</p></div><button class="ct-soft-btn">Bulk Actions⌄</button></div>
      <div class="ct-publish-layout"><article class="ct-card"><h3>1. Select or Upload Video ⓘ</h3><div class="ct-publish-video"><span>▶</span></div><h4>How I Use AI to Save 10+ Hours a Week</h4><p>03:26 · 1080p · 119 MB</p><button class="button primary">Replace Video</button><button class="ct-soft-btn">✂ Edit Video</button></article><article class="ct-card"><div class="ct-card-top"><h3>2. AI Adapts for Each Platform</h3><a>✨ How it works</a></div>${["YouTube|16:9 Landscape|Title Variants|Caption Tweaks|Thumbnail Optimized|Ready","YouTube Shorts|9:16 Vertical|Title Variants|Caption Tweaks|Auto-Crop 9:16|Ready","TikTok|9:16 Vertical|Hook Variants|Caption Tweaks|Auto-Crop 9:16|Ready","Instagram Reels|9:16 Vertical|Hook Variants|Caption Tweaks|Auto-Crop 9:16|Ready","X / Twitter|16:9 or 1:1|Title Variants|Caption Tweaks|Media Format 16:9|Scheduled"].map(x=>{const parts=x.split("|");return `<div class="ct-publish-row"><strong>${parts[0]}<small>${parts[1]}</small></strong><span>${parts[2]}<b>3</b></span><span>${parts[3]}<b>3</b></span><span>${parts[4]}</span><em>${parts[5]}</em><button>•••</button></div>`}).join("")}</article><aside><article class="ct-card"><h3>3. Schedule & Publish</h3><div class="ct-tabs"><button class="active">Schedule</button><button>Publish Now</button></div><label>Select Date & Time</label><div class="ct-input-fake">📅 May 22, 2024 ⏰ 10:00 AM</div><label>Time Zone</label><div class="ct-input-fake">(GMT-7) Pacific Time⌄</div><div class="ct-ai-bubble"><p>Best time to post tomorrow at 10:00 AM. High engagement predicted.</p></div><button class="button primary full-width">Schedule All</button></article><article class="ct-card ct-privacy-hero"><div class="ct-shield">🛡️</div><h3>Privacy-First</h3><p>Your data stays yours. We don't train on your content.</p><div class="ct-lock-pill">🔒 No data shared</div></article><article class="ct-card"><h3>AI Publishing Agent <span class="ct-badge purple">Beta</span></h3><div class="ct-ai-bubble"><div class="ct-bot-face">☻</div><p>I'll handle cross-platform publishing for you.</p></div><p class="ct-check">Adapt content for each platform</p><p class="ct-check">Optimize captions and titles</p><p class="ct-check">Pick the best time to post</p><button class="button primary full-width">Let AI Handle It</button></article></aside></div>
      <article class="ct-card ct-platform-manage"><div class="ct-card-top"><h3>4. Preview & Manage Content per Platform</h3><button>Preview All</button></div><div class="ct-platform-tabs mini">${["▶ YouTube","⚡ YouTube Shorts","♪ TikTok","◎ Instagram Reels","𝕏 X / Twitter"].map((x,i)=>`<button class="${i===0?"active":""}">${x}</button>`).join("")}</div><div class="ct-manage-grid"><div>${ctVideoThumb("10+ HOURS SAVED","")}</div><div><label>Title Variants</label><div class="ct-input-fake">How I Use AI to Save 10+ Hours a Week</div><div class="ct-input-fake">I Save 10+ Hours Every Week Using AI</div><div class="ct-input-fake">AI Workflow That Saves Me 10+ Hours Weekly</div><label>Description / Caption</label><div class="ct-input-fake tall">Here's how I use AI tools to save 10+ hours every week...</div></div><div><h4>AI Suggestions</h4><p class="ct-check">Added trending keyword “AI workflow”</p><p class="ct-check">Optimized title for CTR</p><p class="ct-check">Strong hook in first 15 words</p><p class="ct-check">Best time to post: Tomorrow 10:00 AM</p></div></div></article>
    </section>`;
}

function inspirationPageV4() {
  const cards = ["Build in Public: What I Learned in 30 Days","5 Creator Habits That Actually Scale","The 3-Part Formula That Hooks Every Time","How I Create Content with $0 Budget","Stop Scrolling: The Hook That Works","My Weekly Content Planning System"];
  return `
    <section class="page page-v4 ct-page ct-inspiration-page">
      <div class="ct-page-heading"><div><h2>Inspiration Library</h2><p>Save ideas, references, and trends to turn into original content.</p></div><button class="ct-soft-btn">🔗 Import Link</button></div>
      <div class="ct-category-tabs">${["Trending","Educational","Hooks","Storytelling","Editing","Brand Ideas","›"].map((x,i)=>`<button class="${i===0?"active":""}">${x}</button>`).join("")}</div>
      <div class="ct-inspiration-layout"><main><div class="ct-inspiration-grid">${cards.map((x,i)=>`<article class="ct-inspire-card ${i===0?"active":""}">${ctVideoThumb(i===0?"Build in Public":i===1?"5 CREATOR HABITS":i===2?"Hook Story Offer":i===3?"$0 Content System":i===4?"STOP SCROLLING":"Plan My Week", ["10:24","01:15","00:58","06:42","00:33","07:12"][i])}<span>${i===5?"Article":i===4?"TikTok Video":i===1?"Instagram Post":i===2?"YouTube Shorts":"YouTube Video"}</span><h3>${x}</h3><p>${["Pat Flynn","@aliabdaal","Alex Hormozi","Think Media","@justinwelsch","ConvertKit Blog"][i]}</p><div class="ct-tag-row"><span>${["Storytelling","Educational","Hooks","Strategy","Engagement","Productivity"][i]}</span><span>${["Build in Public","Productivity","Copywriting","Strategy","Hooks","Planning"][i]}</span></div></article>`).join("")}</div><button class="ct-soft-btn full-width">Load More Inspiration⌄</button><div class="ct-note-bar">✅ <strong>Use this as inspiration, not copying.</strong><span>Great creators build on ideas and make them their own.</span><button>Learn More</button></div></main><aside class="ct-card ct-inspire-detail"><div class="ct-card-top"><span>▶ YouTube Video</span><span>Saved 2 days ago 🔖 ×</span></div><div class="ct-inspire-hero">${ctVideoThumb("Build in Public.","10:24")}</div><h3>Build in Public: What I Learned in 30 Days</h3><p>Pat Flynn ✓ · 1.2M subscribers</p><h4>Notes <button>Edit</button></h4><p>Great breakdown of how sharing the journey helps build trust and momentum. Loved the real examples and honest takeaways.</p><h4>Key Takeaways</h4><p class="ct-check">Sharing progress builds stronger connections.</p><p class="ct-check">Consistency &gt; perfection.</p><p class="ct-check">The journey is the content.</p><div class="ct-tag-row"><span>Build in Public</span><span>Storytelling</span><span>Mindset</span><span>Consistency</span></div><button class="button primary full-width">↗ Analyze Content</button><div class="ct-two-col"><button class="ct-soft-btn">🪄 Make It Mine</button><button class="ct-soft-btn">💡 Save as Idea</button></div></aside></div>
    </section>`;
}

function coachPageV4() {
  return `<section class="page page-v4 ct-page ct-coach-page"><div class="ct-page-heading"><div><h2>AI Channel Coach</h2><p>Talk to Contentus about what to improve and what to make next.</p></div></div><div class="ct-coach-layout"><article class="ct-card"><h3>Channel Strategy Chat</h3><div class="ct-ai-bubble"><div class="ct-bot-face">☻</div><p>Ask me why a video underperformed, what trend to target, or what to add next to your channel.</p></div>${["What should I improve next?","Why did my last video underperform?","Give me ideas for next week","What trend should I target?"].map(x=>`<button class="ct-suggestion" data-action="v4-coach-prompt" data-prompt="${escapeHtml(x)}">${x}</button>`).join("")}<div class="ct-chat-input">Ask me anything about your channel... <span data-action="v4-coach-send">➤</span></div></article><article class="ct-card"><h3>Recommended Next Moves</h3>${["Make one trend-backed video this week.","Rewrite your next intro to show proof first.","Turn your top audience question into a short.","Test a cleaner thumbnail with fewer words."].map(x=>`<p class="ct-check">${x}</p>`).join("")}</article></div></section>`;
}
