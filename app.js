document.documentElement.classList.add("has-js");

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
const canvas = document.querySelector("#motion-bg");

const STORAGE_KEY = "contentus-prototype-state";
const AUTH_KEY = "contentus-auth-session";

const defaultState = {
  authed: false,
  youtubeConnected: false,
  creator: {
    name: "Rishabh",
    creatorName: "",
    niche: "Study productivity, AI tools, and student creator life",
    audience: "Students and beginner creators who want practical, honest systems.",
    platforms: ["YouTube", "Instagram", "TikTok", "Newsletter"],
    tone: ["funny", "educational", "honest", "slightly chaotic"],
    values: "Originality, useful honesty, audience trust, no fake claims, no copying.",
    boundaries: "No deepfakes, no fake testimonials, no manipulative scarcity, no unsafe health or finance claims.",
    topicsLoved: "AI study systems, creator workflows, productivity experiments, behind-the-scenes mistakes.",
    topicsAvoided: "Copying viral creators, fake income promises, exaggerated brand claims.",
  },
  dna: {
    score: 92,
    tone: "Funny, educational, honest, and slightly chaotic.",
    humor: "Self-aware roasts, quick reversals, relatable student chaos.",
    phrases: ["okay, this got out of hand", "future me will hate this", "actually useful, not fake productive"],
    story: "Starts with a messy personal problem, tests a system, then gives the audience a practical takeaway.",
    visual: "Fast cuts, annotated screens, clean captions, proof screenshots, warm desk shots.",
    themes: ["study systems", "AI tools", "creator workflow", "student discipline", "burnout prevention"],
    audienceType: "Ambitious students and creators who want help without being talked down to.",
    editingPace: "Fast intro, calmer explanation, proof-heavy middle, crisp CTA.",
    hookStyle: "Confession, experiment, or self-roast that quickly becomes useful.",
    language: "Simple, direct, playful, no corporate filler.",
    emotional: "Encouraging but honest about the mess.",
    avoid: "Generic hustle content, fake certainty, copying, overclaiming, and robotic CTAs.",
  },
  ideas: [
    {
      id: "idea-1",
      title: "I Let AI Plan My Study Week and It Exposed How Chaotic I Am",
      hook: "I asked AI to fix my study routine. It immediately roasted my entire life.",
      platform: "YouTube",
      contentType: "YouTube video",
      concept: "Use AI to audit a real messy week, then rebuild the schedule with realistic study blocks.",
      why: "It is funny, relatable, and useful for students who feel behind.",
      emotional: "Self-aware chaos turning into practical relief.",
      genericRisk: "Medium",
      personalTip: "Show your real old schedule and one uncomfortable habit the AI caught.",
      cta: "Comment one routine you want me to let AI fix next.",
      status: "scripting",
      source: "Idea Engine",
    },
    {
      id: "idea-2",
      title: "The 12-Second Intro Test for Student YouTubers",
      hook: "If your video takes longer than 12 seconds to become useful, your audience already left.",
      platform: "Shorts",
      contentType: "TikTok/Reel/Short",
      concept: "Explain a quick retention test with before-and-after hook examples.",
      why: "Beginner creators need a simple way to diagnose drop-off.",
      emotional: "Tough love with an easy fix.",
      genericRisk: "Low",
      personalTip: "Use one of your underperforming intros as the example.",
      cta: "Send me your intro and I will rate it.",
      status: "idea",
      source: "Growth Coach",
    },
  ],
  scripts: [
    {
      id: "script-1",
      ideaId: "idea-1",
      title: "AI Planned My Study Week",
      platform: "YouTube",
      authenticityScore: 88,
      genericRisk: "Medium",
      script: "Cold open: I gave AI my actual study week and, unfortunately, it had notes. First, here is the chaos. Then I ask it to rebuild the week with classes, revision, editing, and a real rest day. By the end, we compare the ideal plan with what I can actually follow.",
      shotList: ["Screen recording of calendar", "Desk reset", "AI prompt close-up", "Before/after schedule", "Final honest verdict"],
      caption: "I let AI plan my study week. It was rude, but useful.",
    },
  ],
  calendar: [
    { id: "cal-1", day: 4, title: "AI study week video", platform: "YouTube", status: "filming", contentType: "Growth", notes: "Record intro and calendar audit." },
    { id: "cal-2", day: 7, title: "12-second intro test", platform: "Shorts", status: "scheduled", contentType: "Educational", notes: "Cut from analytics page." },
    { id: "cal-3", day: 12, title: "Creator DNA carousel", platform: "Instagram", status: "idea", contentType: "Community", notes: "Explain voice profile with examples." },
    { id: "cal-4", day: 19, title: "Burnout reset newsletter", platform: "Newsletter", status: "scripting", contentType: "Personal", notes: "Keep it honest and short." },
  ],
  inspiration: [
    {
      id: "insp-1",
      sourceTitle: "YouTube: How I stopped procrastinating",
      sourceUrl: "https://youtube.com/watch?v=demo",
      selectedText: "The creator opens with a personal failure before giving the system.",
      platform: "YouTube",
      analysis: "Use the vulnerability-first pattern, but make the story about your own study workflow.",
      createdAt: "Today",
    },
  ],
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
  authProvider: "local-demo",
  aiProvider: "mock",
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
  return {
    ...structuredClone(base),
    ...saved,
    creator: { ...base.creator, ...saved.creator },
    dna: { ...base.dna, ...saved.dna },
    ideas: saved.ideas || base.ideas,
    scripts: saved.scripts || base.scripts,
    calendar: saved.calendar || base.calendar,
    inspiration: saved.inspiration || base.inspiration,
  };
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
  if (activeRoute === "/" || activeRoute === "/landing") {
    app.className = "app-root";
    app.innerHTML = landingView();
    bindHeroTilt();
    return;
  }

  if (activeRoute === "/login") {
    app.className = "app-root";
    app.innerHTML = authView();
    return;
  }

  if (!state.authed && activeRoute.startsWith("/app")) {
    app.className = "app-root";
    app.innerHTML = authView();
    setAuthNote("Sign in or create an account to save and load your Contentus workspace.");
    return;
  }

  app.className = "app-root";
  app.innerHTML = appShell(activeRoute);
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
                ${["funny", "educational", "cinematic", "emotional", "sarcastic", "professional", "chaotic", "motivational", "calm", "bold"].map((tone) => `<button class="pill-button ${state.creator.tone.includes(tone) ? "active" : ""}" type="button" data-action="toggle-pill">${tone}</button>`).join("")}
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
