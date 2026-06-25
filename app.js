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
};

const analytics = {
  channel: "Rish Creates",
  subscribers: 48200,
  summary: {
    averageViews: 18200,
    watchTime: "1.9K hrs",
    retention: "47%",
    ctr: "7.8%",
    engagement: "9.4%",
    growth: "+1,240",
  },
  views: [12, 18, 16, 28, 24, 38, 44, 41, 52, 66, 61, 74],
  videos: [
    {
      id: "yt-1",
      title: "I Let AI Plan My Study Week",
      views: 82000,
      likes: 7200,
      comments: 638,
      retention: 58,
      ctr: 9.8,
      format: "Experiment",
      topic: "AI study systems",
      diagnosis: "Personal experiment plus useful takeaway. The audience stayed because the proof arrived early.",
    },
    {
      id: "yt-2",
      title: "5 Apps Every Student Needs",
      views: 14300,
      likes: 900,
      comments: 74,
      retention: 31,
      ctr: 4.1,
      format: "List",
      topic: "Productivity tools",
      diagnosis: "Clear title, but the angle is generic. Add a stronger personal filter and a specific outcome.",
    },
    {
      id: "yt-3",
      title: "My Exam Week Reset Routine",
      views: 36500,
      likes: 3100,
      comments: 288,
      retention: 49,
      ctr: 8.2,
      format: "Vlog tutorial",
      topic: "Study routine",
      diagnosis: "Strong comments because it felt real. Shorten the intro by 8 seconds.",
    },
  ],
};

const comments = [
  {
    id: "com-1",
    author: "Anaya",
    text: "Can you show the exact prompt you used for the AI schedule?",
    sentiment: "asking questions",
    importance: "high",
    suggestedReply: "Yes. I will drop the exact prompt in the next video and pin a cleaner version here too.",
  },
  {
    id: "com-2",
    author: "Dev",
    text: "This made me feel better about my messy routine lol",
    sentiment: "positive",
    importance: "medium",
    suggestedReply: "That was the goal. We are all pretending to be organized until the calendar exposes us.",
  },
  {
    id: "com-3",
    author: "Unknown",
    text: "This is just copied from every AI productivity video.",
    sentiment: "critical",
    importance: "medium",
    suggestedReply: "Fair pushback. I tried to make it specific by showing my real week, but I can go deeper into the results next time.",
  },
];

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
  aiProvider: "local-fallback",
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
          <span class="chip">${appConfig.integrations.gemini ? "Gemini key detected" : "Gemini fallback mode"}</span>
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
        <nav class="sidebar-nav" aria-label="App navigation">
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
          ${featureCard("Thumbnail Designer", "Design fast thumbnail drafts locally with low-token title suggestions and PNG export.")}
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
          <span class="chip">${appConfig.integrations.gemini ? "Gemini connected" : "Gemini fallback mode"}</span>
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
    <section class="app-shell app-v4">
      <aside class="sidebar sidebar-v4">
        <a href="#/app/dashboard">${dnaLogo()}</a>
        <nav class="sidebar-nav" aria-label="App navigation">
          ${navLink("/app/dashboard", "dashboard", "Dashboard")}
          ${navLink("/app/dna", "dna", "Creator DNA")}
          ${navLink("/app/ideas", "spark", "Idea Engine")}
          ${navLink("/app/scripts", "script", "Script Builder")}
          ${navLink("/app/ad-studio", "film", "Ad Studio")}
          ${navLink("/app/thumbnail", "film", "Thumbnail")}
          ${navLink("/app/authenticity", "guard", "Authenticity")}
          ${navLink("/app/youtube-growth", "chart", "YouTube + Growth")}
          ${navLink("/app/community", "spark", "Community")}
          ${navLink("/app/calendar", "calendar", "Calendar")}
          <div class="nav-divider"></div>
          ${navLink("/app/extension", "spark", "Chrome Helper")}
        </nav>
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
            <div class="topbar-title">
              <h1>${escapeHtml(page.title)}</h1>
              <p>${escapeHtml(page.subtitle)}</p>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="badge ${state.authed ? "good" : "warn"}">${state.authed ? "Sync ready" : "Local only"}</span>
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
    "/app/scripts": { title: "Script Builder", subtitle: "Write length-aware scripts and export formatted PDFs.", html: scriptsPageV4() },
    "/app/ad-studio": { title: "Ad Studio", subtitle: "Create ads, short films, promos, and campaign concepts.", html: adStudioPageV4() },
    "/app/thumbnail": { title: "Thumbnail Designer", subtitle: "Design thumbnails locally with optional low-token title help.", html: thumbnailPageV4() },
    "/app/authenticity": { title: "Authenticity Guard", subtitle: "Check whether content sounds like you before publishing.", html: authenticityPageV4() },
    "/app/youtube-growth": { title: "YouTube + Growth", subtitle: "Link a public channel and turn performance into next actions.", html: youtubeGrowthPageV4() },
    "/app/community": { title: "Community Manager", subtitle: "Analyze real comments and create reply drafts in your voice.", html: communityPageV4() },
    "/app/calendar": { title: "Content Calendar", subtitle: "Plan real ideas, scripts, thumbnails, and publishing days.", html: calendarPageV4() },
    "/app/extension": { title: "Chrome Helper", subtitle: "Install the browser mini assistant from this project.", html: extensionPageV4() },
  };
  return pages[route] || pages["/app/dashboard"];
}

function dashboardPageV4() {
  const dna = safeDna();
  const avgAuth = averageScore(state.scripts.map((script) => script.authenticityScore));
  const hasData = state.dna || state.ideas.length || state.scripts.length || state.youtube || state.calendar.length;
  const topVideo = bestVideo();
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero">
        <div>
          <p class="section-kicker">Welcome${state.creator.creatorName ? `, ${escapeHtml(state.creator.creatorName)}` : ""}</p>
          <h2>${hasData ? "Your creator workspace is live." : "Start with your real creator data."}</h2>
          <p class="muted">${hasData ? "Everything here comes from your saved workspace, generated outputs, or linked YouTube channel." : "Build Creator DNA, generate your first idea, or link YouTube to populate this dashboard."}</p>
        </div>
        <div class="action-row">
          <a class="button primary" href="#/app/dna">Build DNA</a>
          <a class="button secondary" href="#/app/youtube-growth">Link YouTube</a>
        </div>
      </div>

      <div class="metric-grid metric-grid-v4">
        ${metric("Creator DNA", state.dna ? `${dna.score}%` : "Not built", state.dna ? "Voice profile saved" : "Add samples", state.dna ? "good" : "warn")}
        ${metric("Avg authenticity", avgAuth ? `${avgAuth}%` : "No scripts", avgAuth ? "From saved scripts" : "Generate a script", avgAuth ? "good" : "warn")}
        ${metric("Ideas", String(state.ideas.length), state.ideas.length ? "Saved in workspace" : "No ideas yet", state.ideas.length ? "good" : "warn")}
        ${metric("Calendar", String(state.calendar.length), burnoutLabel(), state.calendar.length > 8 ? "warn" : "good")}
      </div>

      ${!hasData ? emptyOnboarding() : `
        <div class="dashboard-grid dashboard-grid-v4">
          <article class="dashboard-card">
            <div class="card-topline">
              <div><span class="section-kicker">Next action</span><h3>Keep the loop moving</h3></div>
            </div>
            <div class="quick-actions slim-actions">
              ${quickAction("/app/ideas", "Generate idea", "Start from a topic")}
              ${quickAction("/app/scripts", "Write script", "Turn selected idea into a script")}
              ${quickAction("/app/thumbnail", "Design thumbnail", "Create a visual direction")}
              ${quickAction("/app/authenticity", "Check voice", "Score a draft")}
            </div>
          </article>

          <article class="dashboard-card">
            <div class="card-topline">
              <div><span class="section-kicker">Recent ideas</span><h3>${state.ideas.length ? "Saved ideas" : "No ideas yet"}</h3></div>
              <a class="text-link" href="#/app/ideas">Open</a>
            </div>
            <div class="list-stack">
              ${state.ideas.slice(0, 4).map((idea) => insight(idea.title, idea.hook || idea.concept || "Ready for scripting.")).join("") || emptyMini("Generate your first idea from the Idea Engine.")}
            </div>
          </article>

          <article class="dashboard-card">
            <div class="card-topline">
              <div><span class="section-kicker">YouTube</span><h3>${state.youtube?.channel?.title || "No channel linked"}</h3></div>
              <a class="text-link" href="#/app/youtube-growth">Open</a>
            </div>
            ${state.youtube ? youtubeSummaryCard(topVideo) : emptyMini("Link a public YouTube channel to show real videos, views, and comment tools.")}
          </article>

          <article class="dashboard-card">
            <div class="card-topline">
              <div><span class="section-kicker">Calendar</span><h3>Upcoming work</h3></div>
              <a class="text-link" href="#/app/calendar">Open</a>
            </div>
            <div class="list-stack">
              ${state.calendar.slice(0, 4).map((item) => insight(item.title, `${item.platform || "Content"} - ${item.status || "idea"} - ${item.date || `day ${item.day || ""}`}`)).join("") || emptyMini("Save an idea or script to the calendar when it is ready.")}
            </div>
          </article>
        </div>
      `}
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
                ${["funny", "educational", "cinematic", "emotional", "sarcastic", "professional", "chaotic", "motivational", "calm", "bold"].map((tone) => `<button class="pill-button ${state.creator.tone.includes(tone) ? "active" : ""}" type="button" data-action="toggle-pill">${tone}</button>`).join("")}
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

function scriptsPageV4() {
  const latest = state.scripts[0];
  return `
    <section class="page page-v4">
      <div class="builder-layout script-builder-layout">
        <form class="tool-card compact-form script-options" id="script-form">
          <div class="card-topline">
            <div><span class="section-kicker">Script Builder</span><h3>Compact controls</h3></div>
          </div>
          ${selectCustom("script-idea", "Idea", ideaOptions(), state.selectedIdeaId || "Custom")}
          ${fieldV4("script-custom-idea", "Custom idea", "", "text", "Used when Idea is custom")}
          ${selectCustom("script-platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram", "Podcast", "Ad", "Short film", "Custom"])}
          ${selectCustom("script-length", "Length", ["30 seconds", "60 seconds", "2 minutes", "5 minutes", "8 minutes", "Custom"])}
          ${selectCustom("script-format", "Format", ["talking head", "vlog", "cinematic", "tutorial", "skit", "documentary", "product review", "ad", "short film", "Custom"])}
          ${selectCustom("script-tone", "Tone", ["Use Creator DNA", "funny", "emotional", "cinematic", "direct", "Custom"])}
          ${fieldV4("script-audience", "Audience", state.creator.audience, "text", "Who is this for?")}
          <button class="button primary full-width" type="button" data-action="v4-generate-script">Generate script</button>
        </form>

        <section class="script-workspace">
          <div class="card-topline">
            <div><span class="section-kicker">Script output</span><h3>${latest?.title ? escapeHtml(latest.title) : "No script yet"}</h3></div>
            ${latest ? `<button class="button secondary" type="button" data-action="v4-download-script">Download PDF</button>` : ""}
          </div>
          <div id="script-output">
            ${latest ? scriptOutputV4(latest) : emptyPanel("Generate your first script", "Choose an idea or custom concept. The script length changes based on your selected duration.", "PDF export creates a formatted script document.")}
          </div>
          ${latest ? scriptButtonsV4() : ""}
        </section>
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
  return `
    <article class="dashboard-card script-output-card">
      <div class="score-grid">
        ${scoreChip("Authenticity", `${script.authenticityScore || "?"}%`)}
        ${scoreChip("Generic risk", script.genericRisk || "Low")}
        ${scoreChip("Length", script.lengthLabel || script.targetLength || "Custom")}
        ${scoreChip("Disclosure", script.disclosure || "AI-assisted if used")}
      </div>
      ${sectionBlock("Hook options", listText(script.hookOptions))}
      ${sectionBlock("Full script", script.script)}
      ${sectionBlock("Scene-by-scene", listText(script.scenes || script.sceneBreakdown))}
      ${sectionBlock("Voiceover", script.voiceover)}
      ${sectionBlock("Shot list", listText(script.shotList))}
      ${sectionBlock("B-roll", listText(script.broll || script.bRollSuggestions))}
      ${sectionBlock("On-screen text", listText(script.onScreenText))}
      ${sectionBlock("Caption", script.caption)}
      ${sectionBlock("Hashtags", listText(script.hashtags))}
      ${sectionBlock("Ending options", listText(script.endingOptions))}
      ${sectionBlock("Personalization tip", script.personalizationTip)}
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
  return `
    <section class="page page-v4">
      <div class="builder-layout thumbnail-layout">
        <form class="tool-card compact-form" id="thumbnail-form">
          <div class="card-topline"><div><span class="section-kicker">Thumbnail Designer</span><h3>Canvas-first, low-token</h3></div></div>
          ${selectCustom("thumb-idea", "Idea", ideaOptions(), state.selectedIdeaId || "Custom")}
          ${fieldV4("thumb-title", "Main text", selectedIdea()?.title || "", "text", "Big thumbnail text")}
          ${fieldV4("thumb-subtitle", "Support text", "", "text", "Optional small text")}
          ${selectCustom("thumb-style", "Style", ["clean proof", "bold challenge", "cinematic", "tutorial", "reaction", "Custom"])}
          ${selectCustom("thumb-palette", "Palette", ["cyan coral gold", "lime blue white", "red yellow black", "white teal charcoal", "Custom"])}
          ${selectCustom("thumb-layout", "Layout", ["big text left", "split text visual", "center impact", "minimal", "Custom"])}
          <div class="action-row compact-actions">
            <button class="button primary" type="button" data-action="v4-generate-thumbnail">Generate thumbnail</button>
            <button class="button secondary" type="button" data-action="v4-thumbnail-copy">Suggest title text</button>
          </div>
          <button class="button secondary full-width" type="button" data-action="v4-download-thumbnail">Download PNG</button>
        </form>
        <section class="thumbnail-stage">
          <canvas id="thumbnail-canvas" width="1280" height="720" aria-label="Generated thumbnail preview"></canvas>
          <div id="thumbnail-copy-output" class="dashboard-card mini-output">${emptyMini("Optional AI copy suggestions will appear here.")}</div>
        </section>
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

function youtubeGrowthPageV4() {
  const yt = state.youtube;
  const videos = normalizeList(yt?.videos || yt?.recentVideos);
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero">
        <div>
          <p class="section-kicker">YouTube + Growth</p>
          <h2>${yt?.channel?.title || "Link your public channel"}</h2>
          <p class="muted">Use a channel URL, @handle, or video URL. Public stats and comments work with your YouTube Data API key. Private Analytics like retention/CTR require Google OAuth keys.</p>
        </div>
        <form class="inline-connect" id="youtube-form">
          <input id="youtube-input" placeholder="@handle, channel URL, or video URL">
          <button class="button primary" type="button" data-action="v4-link-youtube">Link channel</button>
        </form>
      </div>

      ${yt ? `
        <div class="metric-grid metric-grid-v4">
          ${metric("Subscribers", formatNumber(yt.channel?.subscribers), "Public channel stat", "good")}
          ${metric("Total views", formatNumber(yt.channel?.views), "Public channel stat", "good")}
          ${metric("Videos fetched", String(videos.length), "Recent uploads", "good")}
          ${metric("Comments loaded", String(state.comments.length), "From selected videos", state.comments.length ? "good" : "warn")}
        </div>
        <div class="dashboard-grid dashboard-grid-v4">
          <article class="dashboard-card span-2">
            <div class="card-topline"><div><span class="section-kicker">Recent videos</span><h3>Public performance</h3></div></div>
            ${videos.length ? barChart(videoChartValues(videos), videos.map((_, index) => index + 1)) : emptyMini("No recent public videos found.")}
            <div class="video-table">
              ${videos.map((video) => videoRowV4(video)).join("")}
            </div>
          </article>
          <article class="dashboard-card">
            <div class="card-topline"><div><span class="section-kicker">Growth coach</span><h3>Recommendations</h3></div></div>
            <div class="list-stack">
              ${growthInsightsFromVideos(videos).map((item) => insight(item.title, item.text)).join("")}
            </div>
          </article>
        </div>
      ` : emptyPanel("No YouTube channel linked", "Paste your public YouTube handle, channel URL, or video URL to fetch real channel/video data.", "Private watch time, retention, and CTR require Google OAuth credentials.")}
    </section>
  `;
}

function videoRowV4(video) {
  return `
    <div class="video-row">
      ${video.thumbnail ? `<img src="${escapeHtml(video.thumbnail)}" alt="">` : `<span class="thumb-placeholder"></span>`}
      <div>
        <strong>${escapeHtml(video.title || "Untitled video")}</strong>
        <small>${formatNumber(video.views)} views - ${formatNumber(video.likes)} likes - ${formatNumber(video.comments)} comments</small>
      </div>
      <button class="button secondary" type="button" data-action="v4-load-comments" data-video-id="${escapeHtml(video.id)}">Load comments</button>
    </div>
  `;
}

function communityPageV4() {
  const commentsList = normalizeList(state.comments);
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero">
        <div>
          <p class="section-kicker">Community Manager</p>
          <h2>${commentsList.length ? "Real comments loaded" : "Load comments from YouTube first"}</h2>
          <p class="muted">Contentus drafts replies in your voice. It does not auto-post without explicit OAuth and posting permissions.</p>
        </div>
        <div class="action-row">
          <a class="button secondary" href="#/app/youtube-growth">Choose video</a>
          <button class="button primary" type="button" data-action="v4-generate-replies" ${commentsList.length ? "" : "disabled"}>Generate reply drafts</button>
        </div>
      </div>
      <div class="dashboard-grid dashboard-grid-v4" id="comments-output">
        ${commentsList.length ? commentsList.map(commentCardV4).join("") : emptyPanel("No comments yet", "Open YouTube + Growth, link a channel, then load comments from a video.", "Reply drafts are generated after comments are loaded.")}
      </div>
    </section>
  `;
}

function commentCardV4(comment) {
  return `
    <article class="dashboard-card comment-card">
      <div class="card-topline">
        <div><span class="section-kicker">${escapeHtml(comment.sentiment || "comment")}</span><h3>${escapeHtml(comment.author || "Viewer")}</h3></div>
        <span class="badge ${comment.sentiment === "toxic" ? "bad" : comment.sentiment === "critical" ? "warn" : "good"}">${escapeHtml(comment.importance || "normal")}</span>
      </div>
      <p>${escapeHtml(comment.text || comment.commentText || "")}</p>
      ${comment.suggestedReply ? sectionBlock("Suggested reply", comment.suggestedReply) : ""}
      <div class="action-row">
        <button class="button secondary" type="button" data-action="copy" data-copy="${escapeHtml(comment.suggestedReply || "")}">Copy reply</button>
        <button class="button secondary" type="button" data-action="v4-comment-to-idea" data-comment-id="${escapeHtml(comment.id)}">Turn into idea</button>
      </div>
    </article>
  `;
}

function calendarPageV4() {
  const items = normalizeList(state.calendar);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero">
        <div>
          <p class="section-kicker">Content Calendar</p>
          <h2>${items.length ? `${items.length} planned items` : "Plan from real ideas and scripts"}</h2>
          <p class="muted">${burnoutLabel()}</p>
        </div>
        <button class="button primary" type="button" data-action="v4-weekly-plan">Generate weekly plan</button>
      </div>
      <div class="calendar-grid calendar-v4">
        ${days.map((day) => `
          <div class="calendar-day" data-day="${day}">
            <strong>${day}</strong>
            ${items.filter((item) => Number(item.day) === day).map((item) => `
              <article class="calendar-item" draggable="true" data-calendar-id="${escapeHtml(item.id)}">
                <span>${escapeHtml(item.platform || "Content")}</span>
                <p>${escapeHtml(item.title)}</p>
                <small>${escapeHtml(item.status || "idea")}</small>
              </article>
            `).join("")}
          </div>
        `).join("")}
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
  if (action === "v4-generate-script") return handleGenerateScriptV4(button);
  if (action === "v4-transform-script") return handleTransformScriptV4(button);
  if (action === "v4-run-auth-from-script") return runAuthFromScriptV4();
  if (action === "v4-save-script-calendar") return saveScriptToCalendar();
  if (action === "v4-download-script") return downloadLatestScriptPdf();
  if (action === "v4-generate-ad") return handleGenerateAdV4(button);
  if (action === "v4-generate-thumbnail") return generateThumbnailCanvas();
  if (action === "v4-thumbnail-copy") return handleThumbnailCopy(button);
  if (action === "v4-download-thumbnail") return downloadThumbnailPng();
  if (action === "v4-score-auth") return handleScoreAuthenticityV4(button);
  if (action === "v4-link-youtube") return handleLinkYouTubeV4(button);
  if (action === "v4-load-comments") return handleLoadCommentsV4(button);
  if (action === "v4-generate-replies") return handleGenerateRepliesV4(button);
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
      tone: customValue("script-tone"),
      audience: document.querySelector("#script-audience")?.value.trim() || state.creator.audience,
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
    saveState();
    render();
    toast("Script updated.");
  });
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
    state.comments = [];
    saveState();
    render();
    toast("YouTube channel linked.");
  });
}

async function handleLoadCommentsV4(button) {
  await withBusy(button, "Loading...", async () => {
    const videoId = button.dataset.videoId;
    const result = await apiJson("/api/youtube/comments", { method: "POST", body: { videoId } });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Could not load comments.");
      return;
    }
    state.comments = normalizeList(result.data.comments);
    saveState();
    routeTo("/app/community");
    toast("Comments loaded.");
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
    state.comments = state.comments.map((comment) => replies.find((reply) => reply.id === comment.id) || comment);
    saveState();
    render();
    toast("Reply drafts generated.");
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

async function handleThumbnailCopy(button) {
  await withBusy(button, "Suggesting...", async () => {
    const payload = {
      idea: selectedIdea() || { title: document.querySelector("#thumb-title")?.value.trim() },
      style: customValue("thumb-style"),
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/thumbnail-copy", { method: "POST", body: payload });
    const suggestions = result.ok ? normalizeList(result.data.suggestions) : fallbackThumbnailSuggestions(payload.idea?.title || "Creator idea");
    document.querySelector("#thumbnail-copy-output").innerHTML = `
      <div class="card-topline"><div><span class="section-kicker">Title options</span><h3>Low-token suggestions</h3></div></div>
      <div class="list-stack">${suggestions.map((item) => insight(item.text || item, item.reason || "Short, specific, and thumbnail-friendly.")).join("")}</div>
    `;
    toast("Thumbnail text suggested.");
  });
}

function generateThumbnailCanvas() {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!canvasNode) return;
  const ctx = canvasNode.getContext("2d");
  const title = document.querySelector("#thumb-title")?.value.trim() || selectedIdea()?.title || "NEW IDEA";
  const subtitle = document.querySelector("#thumb-subtitle")?.value.trim();
  const palette = customValue("thumb-palette");
  const colors = thumbnailPalette(palette);
  ctx.clearRect(0, 0, 1280, 720);

  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, colors.bg1);
  gradient.addColorStop(0.55, colors.bg2);
  gradient.addColorStop(1, "#050706");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let x = 0; x < 1280; x += 80) {
    ctx.fillRect(x, 0, 2, 720);
  }
  for (let y = 0; y < 720; y += 80) {
    ctx.fillRect(0, y, 1280, 2);
  }

  ctx.fillStyle = colors.accent;
  ctx.fillRect(860, 80, 300, 520);
  ctx.fillStyle = "rgba(5,7,6,0.82)";
  ctx.fillRect(890, 110, 240, 460);
  ctx.strokeStyle = colors.accent2;
  ctx.lineWidth = 8;
  ctx.strokeRect(890, 110, 240, 460);

  ctx.fillStyle = "#f5fbf8";
  ctx.font = "900 92px Inter, Arial, sans-serif";
  wrapCanvasText(ctx, title.toUpperCase(), 80, 170, 720, 102);
  if (subtitle) {
    ctx.fillStyle = colors.accent2;
    ctx.font = "800 42px Inter, Arial, sans-serif";
    wrapCanvasText(ctx, subtitle.toUpperCase(), 84, 560, 700, 52);
  }

  ctx.fillStyle = "#050706";
  ctx.fillRect(84, 610, 310, 54);
  ctx.fillStyle = colors.accent2;
  ctx.font = "800 28px Inter, Arial, sans-serif";
  ctx.fillText("CONTENTUS DRAFT", 104, 647);

  state.thumbnails.unshift({
    id: `thumb-${Date.now()}`,
    title,
    subtitle,
    palette,
    createdAt: new Date().toISOString(),
  });
  saveState();
  toast("Thumbnail generated locally.");
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
}

bootstrap();
