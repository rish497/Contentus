import {
  app,
  toastRegion,
  canvas,
  STORAGE_KEY,
  AUTH_KEY,
  defaultState,
  analytics,
  comments,
} from "./appContext.js";
import {
  averageScore,
  calendarCells,
  calendarRange,
  escapeHtml,
  fallbackThumbnailSuggestions,
  formatDate,
  formatInputDate,
  formatNumber,
  isToday,
  monthLabel,
  normalizeRoute,
  normalizeStringArray,
  pdfEscape,
  riskClass,
  slugify,
  thumbnailPalette,
  wrapCanvasText,
  wrapPdfLine,
} from "./utils.js";

let state = loadState();
let activeRoute = normalizeRoute(location.hash);
let openCalendarDay = null; // date key (YYYY-MM-DD) of the day popup, or null
let sidebarCollapsed = false; // desktop collapse toggle for the left sidebar
let authSession = loadSession();
let appConfig = {
  integrations: {
    supabase: false,
    featherless: false,
    gemini: false,
    googleOAuth: false,
    youtubeData: false,
    firebase: false,
    sessionSecret: false,
  },
  authProvider: "not-configured",
  aiProvider: "local-fallback",
};
const ELEVEN_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel (ElevenLabs premade)
let saveTimer = null;
let elevenVoices = []; // cached list of the account's ElevenLabs voices
let elevenVoicesLoaded = false;
let elevenDefaultVoiceId = ELEVEN_DEFAULT_VOICE_ID;
let voiceoverClips = []; // session-only: generated audio data URLs (not persisted)
let adVoiceoverClips = []; // session-only: generated Ad Studio narration data URLs
const toolTabs = {
  ideas: "current",
  scripts: "current",
  ads: "current",
  thumbnails: "current",
};

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
    adProjects: isLegacyDemo ? [] : (Array.isArray(saved.adProjects) ? saved.adProjects : cleanBase.adProjects),
    thumbnails: isLegacyDemo ? [] : (Array.isArray(saved.thumbnails) ? saved.thumbnails : cleanBase.thumbnails),
    voiceovers: isLegacyDemo ? [] : (Array.isArray(saved.voiceovers) ? saved.voiceovers : cleanBase.voiceovers),
    trends: isLegacyDemo ? null : (saved.trends || null),
    videoChecks: isLegacyDemo ? [] : (Array.isArray(saved.videoChecks) ? saved.videoChecks : cleanBase.videoChecks),
    calendar: isLegacyDemo ? [] : (Array.isArray(saved.calendar) ? saved.calendar : cleanBase.calendar),
    inspiration: isLegacyDemo ? [] : (Array.isArray(saved.inspiration) ? saved.inspiration : cleanBase.inspiration),
    youtube: isLegacyDemo ? null : (saved.youtube || null),
    comments: isLegacyDemo ? [] : (Array.isArray(saved.comments) ? saved.comments : cleanBase.comments),
    growthInsights: isLegacyDemo ? [] : (Array.isArray(saved.growthInsights) ? saved.growthInsights : cleanBase.growthInsights),
    google: isLegacyDemo ? null : (saved.google || null),
    googleCalendarEvents: isLegacyDemo ? [] : (Array.isArray(saved.googleCalendarEvents) ? saved.googleCalendarEvents : cleanBase.googleCalendarEvents),
    selectedIdeaId: isLegacyDemo ? "" : (saved.selectedIdeaId || ""),
    selectedScriptId: isLegacyDemo ? "" : (saved.selectedScriptId || ""),
    selectedAdProjectId: isLegacyDemo ? "" : (saved.selectedAdProjectId || ""),
    selectedThumbnailId: isLegacyDemo ? "" : (saved.selectedThumbnailId || ""),
    selectedVideoId: isLegacyDemo ? "" : (saved.selectedVideoId || ""),
    tutorialCompleted: isLegacyDemo ? false : Boolean(saved.tutorialCompleted),
    tutorialStep: isLegacyDemo ? 0 : Number(saved.tutorialStep || 0),
    calendarViewDate: isLegacyDemo ? "" : (saved.calendarViewDate || ""),
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
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (session?.access_token && session.access_token.length > 6000) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return session;
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
    data = {
      raw: text,
      message: text ? text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220) : `Request failed with status ${response.status}`,
    };
  }
  if (!response.ok && !data.message && !data.error) data.message = `Request failed with status ${response.status}.`;
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

function creatorDisplayName() {
  return state.creator.creatorName || state.creator.email || "Creator";
}

function moneylessApiNote() {
  return "Demo mode uses deterministic local AI. Add Featherless, Supabase, Gemini image, and Google keys later for real integrations.";
}

function dnaLogo(label = true) {
  return `
    <span class="brand">
      <img class="brand-logo" src="contentus.jpg" alt="Contentus" />
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
    mic: "M16 4a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4ZM8 14a8 8 0 0 0 16 0M16 22v6M11 28h10",
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
  if (action === "toggle-sidebar") {
    sidebarCollapsed = !sidebarCollapsed;
    document.querySelector(".app-shell")?.classList.toggle("sidebar-collapsed", sidebarCollapsed);
    return;
  }
  if (action === "login") return handleLogin(actionEl);
  if (action === "signup") return handleSignup(actionEl);
  if (action === "logout") return handleLogout();
  if (action === "copy") return copyText(actionEl.dataset.copy || "");
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
    location.replace("/");
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
  requestAnimationFrame(positionTutorialSpotlight);
  if (activeRoute === "/app/voiceover") initVoiceoverPage();
  if (activeRoute === "/app/ad-studio") initAdStudioPage();
  if (activeRoute === "/app/thumbnail") requestAnimationFrame(drawSelectedThumbnailPreview);
}

function navLink(path, iconName, label) {
  return `<a class="sidebar-link ${activeRoute === path ? "active" : ""}" href="#${path}" data-route="${path}">${icon(iconName)}<span>${label}</span></a>`;
}

function metric(label, value, trend, tone = "good") {
  const isText = !/\d/.test(String(value));
  return `<article class="metric-card"><div class="metric-head"><span class="micro-copy">${label}</span><span class="badge ${tone}">${tone}</span></div><div class="metric-value${isText ? " metric-value-text" : ""}">${value}</div><span class="trend ${tone === "bad" ? "bad" : tone === "warn" ? "warn" : ""}">${trend}</span></article>`;
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

function donutChart(value, label, sub = "", toneOverride = "") {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const tone = toneOverride || (pct >= 75 ? "good" : pct >= 50 ? "warn" : "bad");
  return `
    <div class="donut donut-${tone}" role="img" aria-label="${escapeHtml(label)}: ${pct}%">
      <div class="donut-ring" style="--pct:${pct}">
        <span class="donut-value">${pct}<small>%</small></span>
      </div>
      <strong class="donut-label">${escapeHtml(label)}</strong>
      ${sub ? `<span class="donut-sub muted">${escapeHtml(sub)}</span>` : ""}
    </div>
  `;
}

function countBars(items) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return `<div class="count-bars">${items.map((item) => {
    const value = Number(item.value) || 0;
    return `<div class="count-bar"><span class="count-bar-track"><span class="count-bar-fill" style="height:${Math.round((value / max) * 100)}%"></span></span><strong>${value}</strong><span class="muted">${escapeHtml(item.label)}</span></div>`;
  }).join("")}</div>`;
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

function authViewV4() {
  return `
    <section class="auth-layout restored-auth">
      <div class="auth-copy">
        <a class="auth-brand-link" href="/">
          <img src="contentus.jpg" alt="" class="auth-brand-logo">
          <span><strong>Contentus</strong><small>Creator DNA OS</small></span>
        </a>
        <p class="eyebrow">Open your studio</p>
        <h1>Keep building without losing your voice.</h1>
        <p class="hero-lede">
          Sign in to bring your Creator DNA, ideas, scripts, thumbnails, calendar, and channel data
          back into the same personal workspace.
        </p>
        <div class="hero-proof">
          <span class="chip">Creator DNA</span>
          <span class="chip">Saved workspace</span>
          <span class="chip">${appConfig.integrations.supabase ? "Supabase connected" : "Local storage mode"}</span>
        </div>
      </div>
      <form class="auth-card" id="login-form">
        <h2>Welcome back</h2>
        <p class="muted">${authStatusNoteV4()}</p>
        <div class="auth-choice-note">
          <p><strong>New creator?</strong> Fill the form and choose <span>Create account</span>.</p>
          <p><strong>Returning?</strong> Use <span>Sign in</span> to restore your studio.</p>
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
          <a class="button secondary" href="/">Back</a>
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
    <section class="app-shell app-v4${sidebarCollapsed ? " sidebar-collapsed" : ""}">
      <aside class="sidebar sidebar-v4">
        <a href="#/app/dashboard">${dnaLogo()}</a>
        <nav class="sidebar-nav" aria-label="App navigation" data-tour-target="sidebar">
          ${navLink("/app/dashboard", "dashboard", "Dashboard")}
          ${navLink("/app/dna", "dna", "Creator DNA")}
          ${navLink("/app/ideas", "spark", "Idea Engine")}
          ${navLink("/app/scripts", "script", "Script Builder")}
          ${navLink("/app/ad-studio", "film", "Ad Studio")}
          ${navLink("/app/thumbnail", "film", "Thumbnail")}
          ${navLink("/app/voiceover", "mic", "Voiceover")}
          ${navLink("/app/trends", "chart", "Trend Analyser")}
          ${navLink("/app/video-checker", "guard", "Video Checker")}
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
            <button class="icon-button sidebar-toggle" data-action="toggle-sidebar" type="button" aria-label="Toggle sidebar">${icon("menu")}</button>
            <button class="icon-button mobile-menu" data-action="mobile-menu" type="button" aria-label="Open menu">${icon("menu")}</button>
            <div class="topbar-title">
              <h1>${escapeHtml(page.title)}</h1>
              <p>${escapeHtml(page.subtitle)}</p>
            </div>
          </div>
          <div class="topbar-actions">
            <button class="button secondary help-button" type="button" data-action="v4-restart-tutorial">Help</button>
            <a class="button primary" href="#/app/ideas">New idea</a>
          </div>
        </header>
        <div class="app-content" data-tour-target="page">${page.html}</div>
        ${tutorialOverlayV4()}
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
    "/app/thumbnail": { title: "Thumbnail Designer", subtitle: "Design thumbnails locally or generate a real AI image.", html: thumbnailPageV4() },
    "/app/voiceover": { title: "Voiceover Studio", subtitle: "Turn a script into a real AI narration with ElevenLabs.", html: voiceoverPageV4() },
    "/app/trends": { title: "Trend Analyser", subtitle: "Read what's trending and turn it into angles that fit your voice.", html: trendsPageV4() },
    "/app/video-checker": { title: "Video Checker", subtitle: "Get honest pre-publish feedback on a YouTube link or uploaded clip.", html: videoCheckerPageV4() },
    "/app/authenticity": { title: "Authenticity Guard", subtitle: "Check whether content sounds like you before publishing.", html: authenticityPageV4() },
    "/app/youtube-growth": { title: "YouTube + Growth", subtitle: "Link a public channel and turn performance into next actions.", html: youtubeGrowthPageV4() },
    "/app/community": { title: "Community Manager", subtitle: "Analyze real comments and create reply drafts in your voice.", html: communityPageV4() },
    "/app/calendar": { title: "Content Calendar", subtitle: "Plan real ideas, scripts, thumbnails, and publishing days.", html: calendarPageV4() },
    "/app/extension": { title: "Chrome Helper", subtitle: "Install the browser mini assistant from this project.", html: extensionPageV4() },
  };
  return pages[route] || pages["/app/dashboard"];
}

function tutorialOverlayV4() {
  if (!state.authed || state.tutorialCompleted) return "";
  const steps = tutorialStepsV4();
  const index = Math.min(Math.max(Number(state.tutorialStep || 0), 0), steps.length - 1);
  const step = steps[index];
  return `
    <div class="tutorial-overlay" role="dialog" aria-modal="true" aria-label="Contentus quick tour">
      <div class="tutorial-scrim"></div>
      <div class="tutorial-spotlight" aria-hidden="true"></div>
      <div class="tutorial-card" data-target="${escapeHtml(step.target)}">
        <span class="section-kicker">Quick tour ${index + 1}/${steps.length}</span>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.text)}</p>
        <div class="tutorial-actions">
          <button class="button secondary" type="button" data-action="v4-tutorial-skip">${index === steps.length - 1 ? "Done" : "Skip"}</button>
          <button class="button secondary" type="button" data-action="v4-tutorial-back" ${index === 0 ? "disabled" : ""}>Back</button>
          <button class="button primary" type="button" data-action="v4-tutorial-next">${index === steps.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
    </div>
  `;
}

function tutorialStepsV4() {
  return [
    { target: "sidebar", title: "Use the sidebar as your studio map", text: "Move between Creator DNA, ideas, scripts, thumbnails, YouTube growth, community, and calendar from here." },
    { target: "dashboard-overview", title: "Dashboard shows only your data", text: "New accounts start blank. Metrics fill from your Creator DNA, generated work, linked YouTube channel, and calendar." },
    { target: "page", title: "Start with Creator DNA", text: "Train Contentus with writing, audio, video, or YouTube context so outputs sound like you." },
    { target: "page", title: "Generate and refine content", text: "Use Idea Engine and Script Builder to move from a topic to a publish-ready draft." },
    { target: "youtube-growth", title: "Analyze YouTube performance", text: "Link a channel, choose a video, load comments, and turn audience signals into next posts." },
    { target: "calendar", title: "Plan the work", text: "Use the calendar to schedule content, connect Google Calendar, and sync events when Google is connected." },
  ];
}

function positionTutorialSpotlight() {
  const overlay = document.querySelector(".tutorial-overlay");
  const spotlight = document.querySelector(".tutorial-spotlight");
  const card = document.querySelector(".tutorial-card");
  if (!overlay || !spotlight || !card) return;
  const targetName = card.dataset.target;
  const target = document.querySelector(`[data-tour-target="${CSS.escape(targetName)}"]`) || document.querySelector(".app-content");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const pad = targetName === "sidebar" ? 8 : 14;
  spotlight.style.setProperty("--spot-x", `${Math.max(8, rect.left - pad)}px`);
  spotlight.style.setProperty("--spot-y", `${Math.max(8, rect.top - pad)}px`);
  spotlight.style.setProperty("--spot-w", `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`);
  spotlight.style.setProperty("--spot-h", `${Math.min(window.innerHeight - 16, rect.height + pad * 2)}px`);
}

function dashboardPageV4() {
  const dna = safeDna();
  const avgAuth = averageScore(state.scripts.map((script) => script.authenticityScore));
  const hasData = state.dna || state.ideas.length || state.scripts.length || state.youtube || state.calendar.length;
  const topVideo = bestVideo();
  return `
    <section class="page page-v4">
      <div class="page-hero compact-hero dashboard-hero-v5" data-tour-target="dashboard-overview">
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

      <div class="metric-grid metric-grid-v4 dashboard-metrics-v5">
        ${metric("Creator DNA", state.dna ? `${dna.score}%` : "Not built", state.dna ? "Voice profile saved" : "Add samples", state.dna ? "good" : "warn")}
        ${metric("Avg authenticity", avgAuth ? `${avgAuth}%` : "No scripts", avgAuth ? "From saved scripts" : "Generate a script", avgAuth ? "good" : "warn")}
        ${metric("Ideas", String(state.ideas.length), state.ideas.length ? "Saved in workspace" : "No ideas yet", state.ideas.length ? "good" : "warn")}
        ${metric("Calendar", String(state.calendar.length), burnoutLabel(), state.calendar.length > 8 ? "warn" : "good")}
      </div>

      ${!hasData ? emptyOnboarding() : `
        ${(() => {
          const steps = [Boolean(state.dna), state.ideas.length > 0, state.scripts.length > 0, state.calendar.length > 0, Boolean(state.youtube)];
          const done = steps.filter(Boolean).length;
          const completeness = Math.round((done / steps.length) * 100);
          return `
        <article class="dashboard-card analytics-card">
          <div class="card-topline">
            <div><span class="section-kicker">Workspace analytics</span><h3>Snapshot of your studio</h3></div>
          </div>
          <div class="charts-grid">
            <div class="donut-row">
              ${donutChart(state.dna ? dna.score : 0, "Creator DNA", state.dna ? "Voice profile strength" : "Not built yet")}
              ${donutChart(avgAuth || 0, "Avg authenticity", avgAuth ? "Across saved scripts" : "No scripts yet")}
              ${donutChart(completeness, "Setup complete", `${done} of ${steps.length} steps`)}
            </div>
            <div class="count-panel">
              <span class="micro-copy">Content by type</span>
              ${countBars([
                { label: "Ideas", value: state.ideas.length },
                { label: "Scripts", value: state.scripts.length },
                { label: "Thumbs", value: (state.thumbnails || []).length },
                { label: "Calendar", value: state.calendar.length },
              ])}
            </div>
          </div>
        </article>`;
        })()}

        <div class="dashboard-grid dashboard-grid-v4">
          <article class="dashboard-card">
            <div class="card-topline">
              <div><span class="section-kicker">Next action</span><h3>Keep the loop moving</h3></div>
            </div>
            <div class="quick-actions slim-actions dashboard-action-grid">
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

      <div class="dna-layout">
        <form class="tool-card compact-form dna-form-wide" id="dna-form">
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

        <aside class="dashboard-card" id="dna-output">
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
  const current = currentIdea();
  const showingHistory = toolTabs.ideas === "history";
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
            <div><span class="section-kicker">Output</span><h3>${current ? escapeHtml(current.title || "Saved idea") : "No ideas yet"}</h3></div>
          </div>
          ${generationTabs("ideas", [
            { id: "current", label: "Current", count: current ? 1 : 0 },
            { id: "history", label: "History", count: state.ideas.length },
          ])}
          <div id="ideas-output" class="idea-list">
            ${showingHistory ? ideaHistoryV4(current) : (current ? ideaCardV4(current) : emptyPanel("Your ideas will appear here", "Generate ideas from your topic and Creator DNA. Nothing is pre-filled.", "Every result includes authenticity score, generic risk, and a personalization tip."))}
          </div>
        </section>
      </div>
    </section>
  `;
}

function ideaHistoryV4(current) {
  if (!state.ideas.length) return emptyPanel("No idea history yet", "Generate ideas and they will appear here.", "The latest idea is selected automatically.");
  return `
    <article class="dashboard-card generation-history-card">
      <div class="card-topline">
        <div><span class="section-kicker">Past generations</span><h3>${state.ideas.length} ideas</h3></div>
      </div>
      <div class="generation-history-list">
        ${state.ideas.map((idea) => `
          <button class="generation-history-item ${current && idea.id === current.id ? "active" : ""}" type="button" data-action="v4-select-idea" data-idea-id="${escapeHtml(idea.id)}">
            <span class="generation-history-title">${escapeHtml(idea.title || "Untitled idea")}</span>
            <span class="generation-history-meta">${escapeHtml(idea.platform || idea.contentType || "Idea")} · ${escapeHtml(generationDateLabel(idea))}${idea.authenticityScore ? ` · ${escapeHtml(String(idea.authenticityScore))}% you` : ""}</span>
          </button>
        `).join("")}
      </div>
    </article>
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
      ${hitMissBlock(idea)}
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

function hitVerdictClass(verdict, probability) {
  const value = Number(probability);
  const text = String(verdict || "").toLowerCase();
  if (text.includes("hit") || value >= 65) return "good";
  if (text.includes("miss") || (Number.isFinite(value) && value < 45)) return "bad";
  return "warn";
}

function hitMissBlock(idea) {
  const probability = idea.hitProbability ?? idea.hitScore;
  const verdict = idea.verdict || (Number.isFinite(Number(probability)) ? (Number(probability) >= 65 ? "Likely hit" : Number(probability) < 45 ? "Likely miss" : "Coin flip") : "");
  if (probability == null && !verdict) return "";
  const tone = hitVerdictClass(verdict, probability);
  const pct = Number.isFinite(Number(probability)) ? Math.max(0, Math.min(100, Number(probability))) : null;
  const reasons = normalizeList(idea.hitReasons);
  const risks = normalizeList(idea.missRisks);
  return `
    <div class="hit-miss ${tone}">
      <div class="hit-miss-head">
        <span class="section-kicker">Hit / miss prediction</span>
        <span class="badge ${tone}">${escapeHtml(verdict || "Prediction")}</span>
      </div>
      <div class="hit-miss-body">
        ${pct != null ? `<div class="hit-donut">${donutChart(pct, "Hit potential", verdict || "", tone)}</div>` : ""}
        <div class="hit-miss-cols">
          ${reasons.length ? `<div class="hit-col"><strong>Why it could hit</strong><ul>${reasons.map((r) => `<li>${escapeHtml(typeof r === "string" ? r : r.text || "")}</li>`).join("")}</ul></div>` : ""}
          ${risks.length ? `<div class="miss-col"><strong>Why it could miss</strong><ul>${risks.map((r) => `<li>${escapeHtml(typeof r === "string" ? r : r.text || "")}</li>`).join("")}</ul></div>` : ""}
        </div>
      </div>
    </div>
  `;
}

function generationTabs(tool, tabs) {
  return `
    <div class="mini-tabs" role="tablist" aria-label="${escapeHtml(tool)} generations">
      ${tabs.map((tab) => {
        const active = toolTabs[tool] === tab.id;
        return `
          <button class="mini-tab ${active ? "active" : ""}" type="button" role="tab" aria-selected="${active ? "true" : "false"}" data-action="v4-tool-tab" data-tool="${escapeHtml(tool)}" data-tab="${escapeHtml(tab.id)}">
            <span>${escapeHtml(tab.label)}</span>
            ${tab.count != null ? `<small>${escapeHtml(String(tab.count))}</small>` : ""}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function generationDateLabel(item) {
  const raw = item?.updatedAt || item?.createdAt;
  if (!raw) return "Saved";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Saved";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function currentIdea() {
  return state.ideas.find((idea) => idea.id === state.selectedIdeaId) || state.ideas[0] || null;
}

function currentScript() {
  return state.scripts.find((s) => s.id === state.selectedScriptId) || state.scripts[0] || null;
}

function scriptDateLabel(script) {
  return generationDateLabel(script);
}

function currentAdProject() {
  return (state.adProjects || []).find((project) => project.id === state.selectedAdProjectId) || state.adProjects?.[0] || null;
}

function currentThumbnail() {
  return (state.thumbnails || []).find((item) => item.id === state.selectedThumbnailId) || state.thumbnails?.[0] || null;
}

function scriptHistoryV4(current) {
  if (!state.scripts.length) return "";
  return `
    <article class="dashboard-card script-history">
      <div class="card-topline">
        <div><span class="section-kicker">Saved scripts</span><h3>${state.scripts.length} saved</h3></div>
      </div>
      <div class="script-history-list">
        ${state.scripts.map((s) => `
          <button class="script-history-item ${current && s.id === current.id ? "active" : ""}" type="button" data-action="v4-select-script" data-script-id="${escapeHtml(s.id)}">
            <span class="script-history-title">${escapeHtml(s.title || "Untitled script")}</span>
            <span class="script-history-meta">${escapeHtml(s.lengthLabel || s.targetLength || "Custom")} · ${escapeHtml(scriptDateLabel(s))}${s.authenticityScore ? ` · ${escapeHtml(String(s.authenticityScore))}% you` : ""}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function scriptsPageV4() {
  const latest = currentScript();
  const showingHistory = toolTabs.scripts === "history";
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
            <div><span class="section-kicker">Script output</span><h3>${showingHistory ? "Saved scripts" : (latest?.title ? escapeHtml(latest.title) : "No script yet")}</h3></div>
            ${latest && !showingHistory ? `<button class="button secondary" type="button" data-action="v4-download-script">Download PDF</button>` : ""}
          </div>
          ${generationTabs("scripts", [
            { id: "current", label: "Current", count: latest ? 1 : 0 },
            { id: "history", label: "History", count: state.scripts.length },
          ])}
          <div id="script-output">
            ${showingHistory ? scriptHistoryV4(latest) : (latest ? scriptOutputV4(latest) : emptyPanel("Generate your first script", "Choose an idea or custom concept. The script length changes based on your selected duration.", "PDF export creates a formatted script document."))}
          </div>
          ${latest && !showingHistory ? scriptButtonsV4() : ""}
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
  const sections = normalizeList(script.sections).filter((s) => s && (s.spoken || s.label));
  const hooks = normalizeList(script.hookOptions);
  const wordCount = String(script.script || sections.map((s) => s.spoken || "").join(" ")).trim().split(/\s+/).filter(Boolean).length;

  const manuscript = sections.length
    ? sections.map((s, i) => `
        <div class="codex-beat">
          <div class="codex-gutter"><span class="codex-beat-no">${String(i + 1).padStart(2, "0")}</span></div>
          <div class="codex-line">
            <span class="codex-beat-label">${escapeHtml(s.label || `Beat ${i + 1}`)}</span>
            <p class="codex-spoken">${escapeHtml(s.spoken || "").replace(/\n+/g, "<br>")}</p>
          </div>
        </div>`).join("")
    : `<div class="codex-beat"><div class="codex-gutter"><span class="codex-beat-no">01</span></div><div class="codex-line"><p class="codex-spoken">${escapeHtml(script.script || "").replace(/\n+/g, "<br>")}</p></div></div>`;

  const railBlock = (title, value) => {
    const items = normalizeList(value).filter(Boolean);
    if (!items.length) return "";
    return `<div class="codex-rail-block"><h5>${escapeHtml(title)}</h5><ul>${items.map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.text || "")}</li>`).join("")}</ul></div>`;
  };

  return `
    <article class="dashboard-card script-codex">
      <header class="codex-head">
        <div class="codex-meta-row">
          <span class="codex-filename">${escapeHtml(slugify(script.title || "untitled-script"))}.script</span>
          <div class="codex-meta-chips">
            <span class="codex-chip ${riskClass(script.genericRisk)}">${escapeHtml(script.genericRisk || "Low")} generic risk</span>
            <span class="codex-chip">${escapeHtml(script.lengthLabel || script.targetLength || "Custom")}</span>
            <span class="codex-chip">~${wordCount} words</span>
            <span class="codex-chip good">${script.authenticityScore || "?"}% you</span>
          </div>
        </div>
      </header>

      ${hooks.length ? `
        <div class="codex-hooks">
          <span class="section-kicker">Hook options ??pick your open</span>
          <div class="codex-hook-list">${hooks.map((h) => `<button class="codex-hook" type="button" data-action="v4-copy-text" data-copy="${escapeHtml(h)}">${escapeHtml(h)}</button>`).join("")}</div>
        </div>` : ""}

      <div class="codex-body">
        <div class="codex-manuscript">${manuscript}</div>
        <aside class="codex-rail">
          ${railBlock("Scenes", script.scenes || script.sceneBreakdown)}
          ${script.voiceover ? `<div class="codex-rail-block"><h5>Voiceover</h5><p>${escapeHtml(script.voiceover)}</p></div>` : ""}
          ${railBlock("Shot list", script.shotList)}
          ${railBlock("B-roll", script.broll || script.bRollSuggestions)}
          ${railBlock("On-screen text", script.onScreenText)}
          ${railBlock("Ending options", script.endingOptions)}
        </aside>
      </div>

      <footer class="codex-foot">
        ${script.caption ? `<div class="codex-foot-block"><h5>Caption</h5><p>${escapeHtml(script.caption)}</p></div>` : ""}
        ${normalizeList(script.hashtags).length ? `<div class="codex-foot-block"><h5>Hashtags</h5><p class="codex-tags">${normalizeList(script.hashtags).map((t) => `<span>${escapeHtml(String(t).replace(/^#/, "#"))}</span>`).join("")}</p></div>` : ""}
        ${script.personalizationTip ? `<div class="codex-foot-block"><h5>Make it personal</h5><p>${escapeHtml(script.personalizationTip)}</p></div>` : ""}
        ${script.disclosure ? `<p class="codex-disclosure">${escapeHtml(script.disclosure)}</p>` : ""}
      </footer>
    </article>
  `;
}

function adStudioPageV4() {
  const latest = currentAdProject();
  const showingHistory = toolTabs.ads === "history";
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
          <label class="inline-check" for="ad-generate-voice">
            <input id="ad-generate-voice" type="checkbox" checked>
            <span>Add ElevenLabs narration</span>
          </label>
          <div class="form-field">
            <label for="ad-voice-select">Voice</label>
            <div class="select-wrap">
              <select id="ad-voice-select" data-custom-select="ad-voice-select">
                <option value="${escapeHtml(ELEVEN_DEFAULT_VOICE_ID)}" selected>Default voice (Rachel)</option>
                <option value="Custom">Custom voice ID...</option>
              </select>
            </div>
            <input id="ad-voice-select-custom" class="custom-input" placeholder="Paste an ElevenLabs voice ID" hidden>
            <small class="form-hint" id="ad-voice-load-note">Loading your ElevenLabs voices...</small>
          </div>
          ${selectCustom("ad-voice-model", "Voice model", [
            { value: "eleven_multilingual_v2", label: "Multilingual v2" },
            { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
            { value: "eleven_flash_v2_5", label: "Flash v2.5" },
            { value: "Custom", label: "Custom" },
          ])}
          <button class="button primary full-width" type="button" data-action="v4-generate-ad">Generate project</button>
        </form>
        <section class="output-column">
          <div class="card-topline">
            <div><span class="section-kicker">Ad Studio output</span><h3>${showingHistory ? "Past projects" : (latest?.title ? escapeHtml(latest.title) : "No project yet")}</h3></div>
          </div>
          ${generationTabs("ads", [
            { id: "current", label: "Current", count: latest ? 1 : 0 },
            { id: "history", label: "History", count: state.adProjects?.length || 0 },
          ])}
          <div id="ad-output">${showingHistory ? adHistoryV4(latest) : (latest ? adOutputV4(latest) : emptyPanel("No ad or film project yet", "Generate a real concept from your product, story, audience, and Creator DNA.", "Outputs include emotional, funny, and cinematic versions."))}</div>
        </section>
      </div>
    </section>
  `;
}

function adHistoryV4(current) {
  const projects = normalizeList(state.adProjects);
  if (!projects.length) return emptyPanel("No ad history yet", "Generate an ad, short film, or promo and it will appear here.", "Older projects stay selectable from this tab.");
  return `
    <article class="dashboard-card generation-history-card">
      <div class="card-topline">
        <div><span class="section-kicker">Past generations</span><h3>${projects.length} projects</h3></div>
      </div>
      <div class="generation-history-list">
        ${projects.map((project) => `
          <button class="generation-history-item ${current && project.id === current.id ? "active" : ""}" type="button" data-action="v4-select-ad" data-ad-id="${escapeHtml(project.id)}">
            <span class="generation-history-title">${escapeHtml(project.title || project.concept || "Untitled project")}</span>
            <span class="generation-history-meta">${escapeHtml(project.recommendedVersion || project.projectType || "Ad Studio")} · ${escapeHtml(generationDateLabel(project))}${project.voiceoverAudio ? " · narration" : ""}</span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function adOutputV4(project) {
  const versions = normalizeList(project.versions);
  const narration = resolveAdVoiceoverClip(project);
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
      ${adNarrationBlock(project, narration)}
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

function adNarrationBlock(project, clip) {
  if (clip?.audioUrl) {
    return `
      <section class="script-section ad-narration">
        <h4>ElevenLabs narration</h4>
        <audio class="voiceover-player" controls src="${clip.audioUrl}"></audio>
        <div class="action-row compact-actions">
          <a class="button primary" href="${clip.audioUrl}" download="${escapeHtml(clip.fileName || "contentus-ad-voiceover.mp3")}">Download MP3</a>
        </div>
        <p class="muted voiceover-meta">${escapeHtml(`${clip.characters || 0} characters - ${clip.voiceName || "voice"} - ${formatDate(clip.createdAt)}`)}</p>
      </section>
    `;
  }
  if (!project?.voiceover && !project?.script) return "";
  return `
    <section class="script-section ad-narration">
      <h4>ElevenLabs narration</h4>
      <button class="button secondary" type="button" data-action="v4-generate-ad-voiceover" data-ad-id="${escapeHtml(project.id || "")}">Generate narration</button>
    </section>
  `;
}

function voiceoverPageV4() {
  const latest = voiceoverClips[0];
  const scriptText = latestScriptVoiceoverText();
  return `
    <section class="page page-v4">
      <div class="builder-layout">
        <form class="tool-card compact-form" id="voiceover-form">
          <div class="card-topline"><div><span class="section-kicker">Voiceover Studio</span><h3>ElevenLabs narration</h3></div></div>
          ${textareaV4("voice-text", "Script to narrate", scriptText, "Paste or write the exact words to speak aloud.", "full")}
          ${scriptText ? `<button class="button secondary full-width" type="button" data-action="v4-use-script-voiceover">Reload latest script voiceover</button>` : ""}
          <div class="form-field">
            <label for="voice-select">Voice</label>
            <div class="select-wrap">
              <select id="voice-select" data-custom-select="voice-select">
                <option value="${escapeHtml(ELEVEN_DEFAULT_VOICE_ID)}" selected>Default voice (Rachel)</option>
                <option value="Custom">Custom voice ID...</option>
              </select>
            </div>
            <input id="voice-select-custom" class="custom-input" placeholder="Paste an ElevenLabs voice ID" hidden>
            <small class="form-hint" id="voice-load-note">Loading your ElevenLabs voices...</small>
          </div>
          ${selectCustom("voice-model", "Model", [
            { value: "eleven_multilingual_v2", label: "Multilingual v2 (best quality)" },
            { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (fast, cheaper)" },
            { value: "eleven_flash_v2_5", label: "Flash v2.5 (lowest latency)" },
            { value: "Custom", label: "Custom" },
          ])}
          ${selectCustom("voice-format", "Audio quality", [
            { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps" },
            { value: "mp3_44100_64", label: "MP3 44.1kHz 64kbps" },
            { value: "mp3_22050_32", label: "MP3 22kHz 32kbps (smallest)" },
          ])}
          ${rangeV4("voice-stability", "Stability", 0, 1, 0.05, 0.5)}
          ${rangeV4("voice-style", "Style exaggeration", 0, 1, 0.05, 0)}
          ${rangeV4("voice-speed", "Speed", 0.7, 1.2, 0.05, 1)}
          <button class="button primary full-width" type="button" data-action="v4-generate-voiceover">Generate voiceover</button>
          <small class="form-hint">Audio is generated with your ElevenLabs account. Long scripts are trimmed to keep each clip short ??split them into parts for full narration.</small>
        </form>
        <section class="output-column">
          <div id="voiceover-output">${latest ? voiceOutputV4(latest) : emptyPanel("No voiceover yet", "Paste a script, pick a voice, and generate a real AI narration.", "Pulls from your latest script automatically when one exists.")}</div>
          ${state.voiceovers.length ? voiceoverHistoryV4() : ""}
        </section>
      </div>
    </section>
  `;
}

function voiceOutputV4(clip) {
  return `
    <article class="dashboard-card voiceover-card">
      <div class="card-topline">
        <div><span class="section-kicker">Generated voiceover</span><h3>${escapeHtml(clip.voiceName || "Narration")}</h3></div>
        <span class="badge good">${escapeHtml(clip.modelLabel || clip.modelId || "ElevenLabs")}</span>
      </div>
      <audio class="voiceover-player" controls src="${clip.audioUrl}"></audio>
      <div class="action-row compact-actions">
        <a class="button primary" href="${clip.audioUrl}" download="${escapeHtml(clip.fileName || "contentus-voiceover.mp3")}">Download MP3</a>
      </div>
      <p class="muted voiceover-meta">${escapeHtml(`${clip.characters || 0} characters - ${clip.voiceName || "voice"} - ${formatDate(clip.createdAt)}`)}</p>
      ${sectionBlock("Narrated text", clip.text)}
    </article>
  `;
}

function voiceoverHistoryV4() {
  return `
    <article class="dashboard-card">
      <div class="card-topline"><div><span class="section-kicker">History</span><h3>Recent voiceovers</h3></div></div>
      <div class="list-stack">
        ${state.voiceovers.slice(0, 6).map((item) => insight(item.voiceName || "Voiceover", `${item.characters || 0} chars - ${formatDate(item.createdAt)}`)).join("")}
      </div>
      <small class="form-hint">Audio files aren't stored after you leave. Download clips you want to keep.</small>
    </article>
  `;
}

function rangeV4(id, label, min, max, step, value) {
  return `
    <div class="form-field range-field">
      <label for="${id}">${label} <span class="range-value" data-range-value="${id}">${value}</span></label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>
  `;
}

function latestScriptVoiceoverText() {
  const script = state.scripts?.[0];
  if (!script) return "";
  return String(script.voiceover || script.script || "").trim();
}

function useScriptVoiceoverText() {
  const text = latestScriptVoiceoverText();
  const field = document.querySelector("#voice-text");
  if (!field) return;
  if (!text) {
    toast("No saved script to pull from yet.");
    return;
  }
  field.value = text;
  toast("Loaded latest script voiceover.");
}

async function initVoiceoverPage() {
  await initElevenVoiceControls("voice-select", "voice-load-note");
}

async function initAdStudioPage() {
  await initElevenVoiceControls("ad-voice-select", "ad-voice-load-note");
}

async function initElevenVoiceControls(selectId, noteId) {
  const note = document.querySelector(`#${noteId}`);
  if (elevenVoicesLoaded) {
    fillVoiceSelect(elevenDefaultVoiceId, selectId);
    if (note) note.textContent = elevenVoices.length ? `${elevenVoices.length} voices loaded from your ElevenLabs account.` : "Using the ElevenLabs default voice.";
    return;
  }
  try {
    const result = await apiJson("/api/ai/voices");
    elevenVoicesLoaded = true;
    if (result.ok && result.data.configured) {
      elevenVoices = normalizeList(result.data.voices);
      elevenDefaultVoiceId = result.data.defaultVoiceId || ELEVEN_DEFAULT_VOICE_ID;
      fillVoiceSelect(elevenDefaultVoiceId, selectId);
      if (note) note.textContent = elevenVoices.length ? `${elevenVoices.length} voices loaded from your ElevenLabs account.` : "No custom voices found. Using ElevenLabs default voices.";
    } else if (note) {
      note.textContent = result.data.message || "ElevenLabs not configured. Add ELEVENLABS_API_KEY to load your voices.";
    }
  } catch {
    if (note) note.textContent = "Could not load ElevenLabs voices right now.";
  }
}

function fillVoiceSelect(defaultVoiceId = "", selectId = "voice-select") {
  const select = document.querySelector(`#${selectId}`);
  if (!select || !elevenVoices.length) return;
  const options = elevenVoices.map((voice) =>
    `<option value="${escapeHtml(voice.voiceId)}">${escapeHtml(voice.name)}${voice.category ? ` (${escapeHtml(voice.category)})` : ""}</option>`
  ).join("");
  select.innerHTML = `${options}<option value="Custom">Custom voice ID...</option>`;
  const preferred = elevenVoices.find((voice) => voice.voiceId === defaultVoiceId) || elevenVoices[0];
  if (preferred) select.value = preferred.voiceId;
}

function selectedVoiceId(selectId) {
  const value = customValue(selectId);
  return value && value !== "Custom" ? value : elevenDefaultVoiceId || ELEVEN_DEFAULT_VOICE_ID;
}

function selectedVoiceModel(selectId) {
  const value = customValue(selectId);
  return value && value !== "Custom" ? value : "eleven_multilingual_v2";
}

function selectedOptionLabel(selectId, fallback = "") {
  const select = document.querySelector(`#${selectId}`);
  return select?.selectedOptions?.[0]?.textContent?.trim() || fallback;
}

function voiceNameFor(voiceId) {
  const voice = elevenVoices.find((item) => item.voiceId === voiceId);
  return voice?.name || (voiceId === ELEVEN_DEFAULT_VOICE_ID || voiceId === elevenDefaultVoiceId ? "Rachel (default)" : "Custom voice");
}

function voiceoverClipFromApi(data, options = {}) {
  const text = options.text || "";
  const voiceId = options.voiceId || ELEVEN_DEFAULT_VOICE_ID;
  const fileStem = options.fileStem || "contentus-voiceover";
  return {
    id: `${options.idPrefix || "vo"}-${Date.now()}`,
    text,
    voiceId,
    voiceName: voiceNameFor(voiceId),
    modelId: options.modelId || "",
    modelLabel: options.modelLabel || options.modelId || "ElevenLabs",
    characters: data.characters || text.length,
    audioUrl: `data:${data.audio?.mimeType || "audio/mpeg"};base64,${data.audio?.data || ""}`,
    fileName: `${slugify(fileStem)}.mp3`,
    createdAt: new Date().toISOString(),
  };
}

function thumbnailPageV4() {
  const latest = currentThumbnail();
  const showingHistory = toolTabs.thumbnails === "history";
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
            <button class="button primary" type="button" data-action="v4-generate-thumbnail-ai">Generate AI image</button>
            <button class="button secondary" type="button" data-action="v4-generate-thumbnail">Local canvas draft</button>
          </div>
          <div class="action-row compact-actions">
            <button class="button secondary" type="button" data-action="v4-thumbnail-copy">Suggest title text</button>
            <button class="button secondary" type="button" data-action="v4-download-thumbnail">Download PNG</button>
          </div>
          <small class="form-hint">AI image uses free Pollinations generation — it can take 10-40s. Use "Local canvas draft" for an instant text-only layout.</small>
        </form>
        <section class="thumbnail-stage">
          <div class="card-topline">
            <div><span class="section-kicker">Thumbnail output</span><h3>${showingHistory ? "Past thumbnails" : (latest?.title ? escapeHtml(latest.title) : "Canvas preview")}</h3></div>
          </div>
          ${generationTabs("thumbnails", [
            { id: "current", label: "Current", count: latest ? 1 : 0 },
            { id: "history", label: "History", count: state.thumbnails?.length || 0 },
          ])}
          <div class="thumbnail-tab-panel ${showingHistory ? "" : "active"}">
            <div id="thumb-progress" class="thumb-progress hidden" role="progressbar" aria-label="Generating AI image" aria-valuemin="0" aria-valuemax="100">
              <div class="thumb-progress-track"><div id="thumb-progress-fill" class="thumb-progress-fill"></div></div>
              <span class="thumb-progress-label">Generating AI image… this can take 10-40s</span>
            </div>
            <canvas id="thumbnail-canvas" width="1280" height="720" aria-label="Generated thumbnail preview"></canvas>
            <div id="thumbnail-copy-output" class="dashboard-card mini-output">${emptyMini("Optional AI copy suggestions will appear here.")}</div>
          </div>
          <div class="thumbnail-tab-panel ${showingHistory ? "active" : ""}">
            ${thumbnailHistoryV4(latest)}
          </div>
        </section>
      </div>
    </section>
  `;
}

function thumbnailHistoryV4(current) {
  const thumbnails = normalizeList(state.thumbnails);
  if (!thumbnails.length) return emptyPanel("No thumbnail history yet", "Generate an AI image or local canvas draft and it will appear here.", "New thumbnails include a small preview image.");
  return `
    <article class="dashboard-card generation-history-card">
      <div class="card-topline">
        <div><span class="section-kicker">Past generations</span><h3>${thumbnails.length} thumbnails</h3></div>
      </div>
      <div class="thumbnail-history-grid">
        ${thumbnails.map((thumb) => `
          <button class="thumbnail-history-item ${current && thumb.id === current.id ? "active" : ""}" type="button" data-action="v4-select-thumbnail" data-thumbnail-id="${escapeHtml(thumb.id)}">
            ${thumb.previewDataUrl ? `<img src="${thumb.previewDataUrl}" alt="">` : `<span class="thumb-preview-placeholder">No preview</span>`}
            <span>
              <strong>${escapeHtml(thumb.title || "Untitled thumbnail")}</strong>
              <small>${escapeHtml(thumb.source || thumb.style || thumb.palette || "Thumbnail")} · ${escapeHtml(generationDateLabel(thumb))}</small>
            </span>
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

function trendsPageV4() {
  const data = state.trends;
  return `
    <section class="page page-v4">
      <div class="builder-layout">
        <form class="tool-card compact-form" id="trends-form">
          <div class="card-topline"><div><span class="section-kicker">Trend Analyser</span><h3>Ride trends in your voice</h3></div></div>
          ${fieldV4("trend-niche", "Your niche", state.creator.niche, "text", "e.g. productivity, cooking, indie dev")}
          ${selectCustom("trend-category", "Category", ["Any", "Music", "Gaming", "Education", "Science & Tech", "Entertainment", "Comedy", "People & Blogs", "HowTo & Style", "Sports", "News", "Custom"])}
          ${selectCustom("trend-platform", "Platform", ["YouTube", "TikTok/Reel/Short", "Instagram", "Custom"])}
          ${selectCustom("trend-region", "Region", ["US", "GB", "CA", "AU", "IN", "DE", "BR", "Custom"])}
          <button class="button primary full-width" type="button" data-action="v4-analyze-trends">Analyze trends</button>
          <small class="form-hint">Live trending pulled from YouTube when a Data API key is set; otherwise pattern-based.</small>
        </form>
        <section class="output-column">
          <div id="trends-output">
            ${data ? trendsOutputV4(data) : emptyPanel("No trend analysis yet", "Enter your niche and analyze what's trending right now.", "Each trend includes the underlying format and an angle that fits your voice ??never a copy.")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function trendsOutputV4(data) {
  const trends = normalizeList(data.trends);
  const sources = normalizeList(data.sourceVideos);
  return `
    <article class="dashboard-card">
      <div class="card-topline"><div><span class="section-kicker">Trend read</span><h3>What's working now</h3></div></div>
      ${data.note ? `<p class="form-hint">${escapeHtml(data.note)}</p>` : ""}
      ${sectionBlock("Summary", data.summary)}
      <div class="list-stack">
        ${trends.map((trend) => `
          <article class="trend-card">
            <div class="trend-head"><strong>${escapeHtml(trend.title || "Trend")}</strong>${trend.riskNote ? `<span class="badge warn">Watch out</span>` : ""}</div>
            ${trend.pattern ? `<p class="trend-pattern"><span>Pattern</span> ${escapeHtml(trend.pattern)}</p>` : ""}
            ${trend.why ? `<p class="trend-why"><span>Why it works</span> ${escapeHtml(trend.why)}</p>` : ""}
            ${trend.creatorAngle ? `<p class="trend-angle"><span>Your angle</span> ${escapeHtml(trend.creatorAngle)}</p>` : ""}
            ${trend.riskNote ? `<p class="trend-risk"><span>Risk</span> ${escapeHtml(trend.riskNote)}</p>` : ""}
          </article>
        `).join("")}
      </div>
      ${normalizeList(data.topics).length ? insight("Topic ideas", normalizeList(data.topics).join(" 쨌 ")) : ""}
      ${normalizeList(data.audioTrends).length ? insight("Audio / sound trends (approximate)", normalizeList(data.audioTrends).join(" 쨌 ")) : ""}
      ${sources.length ? `
        <details class="source-list">
          <summary>Trending sources (${sources.length})</summary>
          <ul>${sources.map((v) => `<li>${escapeHtml(v.title || "")}${v.channel ? ` ??${escapeHtml(v.channel)}` : ""}${v.views ? ` 쨌 ${Number(v.views).toLocaleString()} views` : ""}</li>`).join("")}</ul>
        </details>` : ""}
    </article>
  `;
}

function videoCheckerPageV4() {
  const latest = state.videoChecks?.[0];
  return `
    <section class="page page-v4">
      <div class="builder-layout">
        <form class="tool-card compact-form" id="video-check-form">
          <div class="card-topline"><div><span class="section-kicker">Video Checker</span><h3>Honest pre-publish review</h3></div></div>
          ${fieldV4("video-url", "YouTube URL", "", "url", "Paste a public YouTube link")}
          <div class="form-field full">
            <label for="video-file">Or upload a clip</label>
            <input id="video-file" type="file" accept="video/*">
            <small class="form-hint">First ~9MB of the file is analyzed. Use a short representative clip for best results.</small>
          </div>
          ${selectCustom("video-goal", "Goal", ["grow and retain audience", "go viral", "educate", "sell a product", "build trust", "Custom"])}
          <button class="button primary full-width" type="button" data-action="v4-check-video">Check video</button>
        </form>
        <section class="output-column">
          <div id="video-check-output">
            ${latest ? videoCheckOutputV4(latest) : emptyPanel("No video checked yet", "Paste a YouTube link or upload a clip to get scored feedback.", "You get hook, retention, pacing, and audio scores plus concrete fixes.")}
          </div>
        </section>
      </div>
    </section>
  `;
}

function videoCheckOutputV4(result) {
  const tone = result.scoreOverall >= 80 ? "good" : result.scoreOverall >= 60 ? "warn" : "bad";
  return `
    <article class="dashboard-card">
      <div class="card-topline">
        <div><span class="section-kicker">Verdict</span><h3>${escapeHtml(result.title || "Video review")}</h3></div>
        <span class="badge ${tone}">${escapeHtml(result.verdict || "Reviewed")}${result.scoreOverall ? ` 쨌 ${result.scoreOverall}` : ""}</span>
      </div>
      ${result.note ? `<p class="form-hint">${escapeHtml(result.note)}</p>` : ""}
      <div class="score-grid">
        ${scoreChip("Hook", `${result.hookStrength ?? "?"}`)}
        ${scoreChip("Retention", `${result.retention ?? "?"}`)}
        ${scoreChip("Pacing", `${result.pacing ?? "?"}`)}
        ${scoreChip("Audio", `${result.audio ?? "?"}`)}
        ${scoreChip("Clarity", `${result.clarity ?? "?"}`)}
      </div>
      ${sectionBlock("First 3 seconds", result.firstThreeSeconds)}
      ${normalizeList(result.strengths).length ? `<section class="script-section"><h4>Strengths</h4><ul class="check-list good">${normalizeList(result.strengths).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></section>` : ""}
      ${normalizeList(result.improvements).length ? `<section class="script-section"><h4>Fix these (by impact)</h4><ol class="check-list">${normalizeList(result.improvements).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol></section>` : ""}
      ${sectionBlock("Thumbnail advice", result.thumbnailAdvice)}
      ${sectionBlock("Title advice", result.titleAdvice)}
    </article>
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
      ${calendarDayPopupV5(items, googleEvents)}
    </section>
  `;
}

function dayEntriesFor(dateKey, dayNumber, inMonth, items, googleEvents) {
  const appItems = normalizeList(items)
    .filter((item) => item.date === dateKey || (!item.date && Number(item.day) === dayNumber && inMonth))
    .map((item) => ({ kind: "app", id: item.id, title: item.title || "Untitled", time: item.startTime || "", endTime: item.endTime || "", label: item.platform || item.contentType || "Contentus", status: item.status || "", notes: item.notes || "" }));
  const gItems = normalizeList(googleEvents)
    .filter((event) => event.date === dateKey)
    .map((event) => ({ kind: "google", id: event.id || `g-${event.title}`, title: event.title || "Event", time: event.time || "", endTime: "", label: "Google", status: "", notes: event.notes || event.description || "" }));
  return [...gItems, ...appItems].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

function calendarCellV5(cell, items, googleEvents) {
  const dateKey = formatInputDate(cell.date);
  const dayNumber = cell.date.getDate();
  const entries = dayEntriesFor(dateKey, dayNumber, cell.inMonth, items, googleEvents);
  const briefs = entries.slice(0, 2).map((entry) => `
    <article class="calendar-chip ${entry.kind === "google" ? "google-chip" : ""}" ${entry.kind === "app" ? `draggable="true" data-calendar-id="${escapeHtml(entry.id)}"` : ""} title="${escapeHtml(entry.title)}">
      ${entry.time ? `<b>${escapeHtml(entry.time)}</b>` : ""}<span>${escapeHtml(entry.title)}</span>
    </article>`).join("");
  const extra = entries.length > 2 ? `<span class="calendar-more">+${entries.length - 2} more</span>` : "";
  const countBadge = entries.length ? `<span class="calendar-count">${entries.length}</span>` : "";
  return `
    <button class="calendar-day calendar-day-v5 ${cell.inMonth ? "" : "muted-day"} ${isToday(cell.date) ? "today" : ""} ${entries.length ? "has-items" : ""}" type="button" data-day="${dayNumber}" data-action="v4-open-day" data-date="${dateKey}">
      <span class="calendar-day-head"><strong>${dayNumber}</strong>${countBadge}</span>
      <span class="calendar-chips">${briefs}${extra}</span>
    </button>
  `;
}

function calendarDayPopupV5(items, googleEvents) {
  if (!openCalendarDay) return "";
  const date = new Date(`${openCalendarDay}T00:00:00`);
  const dayNumber = date.getDate();
  const entries = dayEntriesFor(openCalendarDay, dayNumber, true, items, googleEvents);
  const heading = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const rows = entries.length
    ? entries.map((entry) => `
        <div class="day-timeline-row ${entry.kind === "google" ? "google" : ""}">
          <div class="day-timeline-time">${entry.time ? escapeHtml(entry.time) + (entry.endTime ? `??{escapeHtml(entry.endTime)}` : "") : "All day"}</div>
          <div class="day-timeline-body">
            <strong>${escapeHtml(entry.title)}</strong>
            <small>${escapeHtml(entry.label)}${entry.status ? " 쨌 " + escapeHtml(entry.status) : ""}</small>
            ${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ""}
          </div>
        </div>`).join("")
    : `<p class="muted">Nothing scheduled for this day yet.</p>`;
  return `
    <div class="day-popup-overlay" data-action="v4-close-day">
      <div class="day-popup" role="dialog" aria-modal="true" data-stop="1">
        <header class="day-popup-head">
          <div><span class="section-kicker">Day timetable</span><h3>${escapeHtml(heading)}</h3></div>
          <button class="icon-button" type="button" data-action="v4-close-day" aria-label="Close">??/button>
        </header>
        <div class="day-timeline">${rows}</div>
      </div>
    </div>
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

document.addEventListener("input", (event) => {
  const range = event.target.closest('input[type="range"]');
  if (!range) return;
  const valueLabel = document.querySelector(`[data-range-value="${range.id}"]`);
  if (valueLabel) valueLabel.textContent = range.value;
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
  if (action === "v4-tool-tab") {
    if (button.dataset.tool && button.dataset.tab) toolTabs[button.dataset.tool] = button.dataset.tab;
    render();
    return;
  }
  if (action === "v4-generate-ideas") return handleGenerateIdeasV4(button);
  if (action === "v4-select-idea") {
    state.selectedIdeaId = button.dataset.ideaId || "";
    toolTabs.ideas = "current";
    saveState();
    render();
    return;
  }
  if (action === "v4-use-idea") return handleUseIdeaV4(button.dataset.ideaId);
  if (action === "v4-save-idea-calendar") return saveIdeaToCalendar(button.dataset.ideaId);
  if (action === "v4-generate-script") return handleGenerateScriptV4(button);
  if (action === "v4-transform-script") return handleTransformScriptV4(button);
  if (action === "v4-run-auth-from-script") return runAuthFromScriptV4();
  if (action === "v4-save-script-calendar") return saveScriptToCalendar();
  if (action === "v4-download-script") return downloadLatestScriptPdf();
  if (action === "v4-select-script") {
    state.selectedScriptId = button.dataset.scriptId;
    toolTabs.scripts = "current";
    saveState();
    render();
    return;
  }
  if (action === "v4-generate-ad") return handleGenerateAdV4(button);
  if (action === "v4-select-ad") {
    state.selectedAdProjectId = button.dataset.adId || "";
    toolTabs.ads = "current";
    saveState();
    render();
    return;
  }
  if (action === "v4-generate-ad-voiceover") return handleGenerateAdVoiceoverV4(button);
  if (action === "v4-generate-voiceover") return handleGenerateVoiceoverV4(button);
  if (action === "v4-use-script-voiceover") return useScriptVoiceoverText();
  if (action === "v4-generate-thumbnail") return generateThumbnailCanvas();
  if (action === "v4-generate-thumbnail-ai") return handleThumbnailImageV4(button);
  if (action === "v4-thumbnail-copy") return handleThumbnailCopy(button);
  if (action === "v4-download-thumbnail") return downloadThumbnailPng();
  if (action === "v4-select-thumbnail") {
    state.selectedThumbnailId = button.dataset.thumbnailId || "";
    toolTabs.thumbnails = "current";
    saveState();
    render();
    return;
  }
  if (action === "v4-analyze-trends") return handleAnalyzeTrendsV4(button);
  if (action === "v4-check-video") return handleCheckVideoV4(button);
  if (action === "v4-copy-text") return copyText(button.dataset.copy || "");
  if (action === "v4-score-auth") return handleScoreAuthenticityV4(button);
  if (action === "v4-link-youtube") return handleLinkYouTubeV4(button);
  if (action === "v4-select-video") return handleSelectVideoV4(button.dataset.videoId);
  if (action === "v4-load-comments") return handleLoadCommentsV4(button);
  if (action === "v4-generate-replies") return handleGenerateRepliesV4(button);
  if (action === "v4-post-reply") return handlePostReplyV4(button);
  if (action === "v4-google-connect") return handleGoogleConnectV4(button);
  if (action === "v4-load-calendar") return handleLoadGoogleCalendarV4(button);
  if (action === "v4-add-calendar-event") return handleAddCalendarEventV4(button);
  if (action === "v4-calendar-nav") return handleCalendarNavV4(button.dataset.direction);
  if (action === "v4-open-day") {
    openCalendarDay = button.dataset.date;
    return render();
  }
  if (action === "v4-close-day") {
    // Ignore clicks that land inside the popup body (the overlay is the backdrop).
    if (button.classList.contains("day-popup-overlay") && event.target.closest("[data-stop]")) return;
    openCalendarDay = null;
    return render();
  }
  if (action === "v4-tutorial-next") return handleTutorialNav(1);
  if (action === "v4-tutorial-back") return handleTutorialNav(-1);
  if (action === "v4-tutorial-skip") return finishTutorial();
  if (action === "v4-restart-tutorial") return restartTutorial();
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
    state.selectedIdeaId = ideas[0]?.id || state.selectedIdeaId;
    toolTabs.ideas = "current";
    saveState();
    render();
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
    state.selectedScriptId = script.id;
    toolTabs.scripts = "current";
    saveState();
    render();
    toast("Script generated.");
  });
}

async function handleTransformScriptV4(button) {
  const latest = currentScript();
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
    const index = state.scripts.findIndex((s) => s.id === latest.id);
    if (index >= 0) state.scripts[index] = { ...latest, ...result.data, id: latest.id, updatedAt: new Date().toISOString() };
    saveState();
    render();
    toast("Script updated.");
  });
}

function runAuthFromScriptV4() {
  const latest = currentScript();
  if (!latest) return;
  state.pendingAuthText = latest.script || "";
  routeTo("/app/authenticity");
  setTimeout(() => {
    const input = document.querySelector("#auth-input");
    if (input) input.value = state.pendingAuthText;
  }, 0);
}

function saveScriptToCalendar() {
  const script = currentScript();
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
    const project = { id: `ad-${Date.now()}`, ...result.data, createdAt: new Date().toISOString() };
    state.adProjects = [project, ...(state.adProjects || [])].slice(0, 20);
    state.selectedAdProjectId = project.id;
    toolTabs.ads = "current";
    let toastMessage = "Project generated.";
    if (document.querySelector("#ad-generate-voice")?.checked) {
      if (button) button.textContent = "Adding voice...";
      const voiceResult = await generateAdVoiceoverClip(project);
      toastMessage = voiceResult.ok ? (voiceResult.note || "Project generated with narration.") : `Project generated. ${voiceResult.message}`;
    }
    saveState();
    render();
    toast(toastMessage);
  });
}

async function handleGenerateAdVoiceoverV4(button) {
  await withBusy(button, "Generating...", async () => {
    const project = (state.adProjects || []).find((item) => item.id === button.dataset.adId) || state.adProjects?.[0];
    if (!project) {
      toast("Generate an ad or film project first.");
      return;
    }
    const result = await generateAdVoiceoverClip(project);
    if (!result.ok) {
      toast(result.message || "Narration generation failed.");
      return;
    }
    state.selectedAdProjectId = project.id;
    toolTabs.ads = "current";
    saveState();
    render();
    toast(result.note || "Narration generated.");
  });
}

async function generateAdVoiceoverClip(project) {
  const text = adVoiceoverText(project);
  if (!text) return { ok: false, message: "No voiceover text was available." };
  const voiceId = selectedVoiceId("ad-voice-select");
  const modelId = selectedVoiceModel("ad-voice-model");
  const result = await apiJson("/api/ai/voiceover", {
    method: "POST",
    body: {
      text,
      voiceId,
      modelId,
      outputFormat: "mp3_44100_128",
      stability: 0.5,
      style: 0,
      speed: 1,
    },
  });
  if (!result.ok || !result.data.audio?.data) {
    return { ok: false, message: result.data.message || result.data.error || "Narration generation failed." };
  }
  const clip = voiceoverClipFromApi(result.data, {
    text,
    voiceId,
    modelId,
    modelLabel: selectedOptionLabel("ad-voice-model", modelId),
    idPrefix: "advo",
    fileStem: `${project.title || project.concept || "ad-studio"} narration`,
  });
  adVoiceoverClips = [clip, ...adVoiceoverClips].slice(0, 20);
  project.voiceoverClipId = clip.id;
  project.voiceoverAudio = {
    id: clip.id,
    voiceId,
    voiceName: clip.voiceName,
    modelId,
    modelLabel: clip.modelLabel,
    characters: clip.characters,
    fileName: clip.fileName,
    createdAt: clip.createdAt,
  };
  return { ok: true, note: result.data.note || "Narration generated." };
}

function adVoiceoverText(project = {}) {
  const voiceover = String(project.voiceover || "").trim();
  if (voiceover.length > 40 && !/^(direct|keep the voice|use a|voice style)/i.test(voiceover)) return voiceover;
  return String(project.script || project.concept || "").trim();
}

function resolveAdVoiceoverClip(project = {}) {
  const id = project.voiceoverClipId || project.voiceoverAudio?.id;
  return adVoiceoverClips.find((clip) => clip.id === id) || null;
}

async function handleGenerateVoiceoverV4(button) {
  await withBusy(button, "Generating...", async () => {
    const text = document.querySelector("#voice-text")?.value.trim();
    if (!text) {
      toast("Add a script or some text to narrate first.");
      return;
    }
    const voiceId = selectedVoiceId("voice-select");
    const modelId = selectedVoiceModel("voice-model");
    const payload = {
      text,
      voiceId,
      modelId,
      outputFormat: customValue("voice-format"),
      stability: Number(document.querySelector("#voice-stability")?.value ?? 0.5),
      style: Number(document.querySelector("#voice-style")?.value ?? 0),
      speed: Number(document.querySelector("#voice-speed")?.value ?? 1),
    };
    const result = await apiJson("/api/ai/voiceover", { method: "POST", body: payload });
    if (!result.ok || !result.data.audio?.data) {
      toast(result.data.message || result.data.error || "Voiceover generation failed.");
      return;
    }
    const clip = voiceoverClipFromApi(result.data, {
      text,
      voiceId,
      modelId,
      modelLabel: selectedOptionLabel("voice-model", modelId),
      idPrefix: "vo",
      fileStem: `${voiceNameFor(voiceId)} ${text.slice(0, 24)}`,
    });
    voiceoverClips = [clip, ...voiceoverClips].slice(0, 20);
    // Persist only lightweight metadata; the audio itself stays in memory for this session.
    state.voiceovers = [{ id: clip.id, voiceName: clip.voiceName, modelId, characters: clip.characters, createdAt: clip.createdAt }, ...(state.voiceovers || [])].slice(0, 20);
    saveState();
    const node = document.querySelector("#voiceover-output");
    if (node) node.innerHTML = voiceOutputV4(clip);
    toast(result.data.note || "Voiceover generated.");
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
    const loaded = normalizeList(result.data.comments).map((comment) => ({
      ...comment,
      videoId: comment.videoId || videoId,
      videoTitle: videoTitleFor(comment.videoId || videoId),
    }));
    state.comments = loaded;
    saveState();
    // We are already on /app/community, so setting the same hash fires no
    // hashchange event. Re-render directly so loaded comments actually show.
    if (activeRoute === "/app/community") {
      render();
    } else {
      routeTo("/app/community");
    }
    toast(loaded.length ? `Loaded ${loaded.length} comments.` : "No comments found for this video.");
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

async function handleGoogleConnectV4(button) {
  if (!authSession?.access_token) {
    toast("Sign in to Contentus first, then connect Google.");
    routeTo("/login");
    return;
  }

  await withBusy(button, "Connecting...", async () => {
    if (authSession?.refresh_token) await tryRefreshSession();
    const scope = button.dataset.scope || "all";
    const result = await apiJson(`/api/google/oauth/start?scope=${encodeURIComponent(scope)}`, { auth: true });
    if (!result.ok || !result.data.authUrl) {
      const message = result.status === 401
        ? "Your Contentus session expired. Sign in again, then connect Google."
        : (result.data.message || result.data.error || `Google OAuth start failed with status ${result.status}.`);
      toast(message);
      if (result.status === 401) routeTo("/login");
      return;
    }
    location.href = result.data.authUrl;
  });
}

function commentToIdea(commentId) {
  const comment = state.comments.find((item) => item.id === commentId);
  if (!comment) return;
  const idea = {
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
    createdAt: new Date().toISOString(),
  };
  state.ideas.unshift(idea);
  state.selectedIdeaId = idea.id;
  toolTabs.ideas = "current";
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
  openCalendarDay = null;
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

function handleTutorialNav(delta) {
  const max = tutorialStepsV4().length - 1;
  const next = Number(state.tutorialStep || 0) + delta;
  if (next > max) {
    finishTutorial();
    return;
  }
  state.tutorialStep = Math.max(0, next);
  saveState();
  render();
}

function finishTutorial() {
  state.tutorialCompleted = true;
  state.tutorialStep = 0;
  saveState();
  render();
  toast("Tutorial completed.");
}

function restartTutorial() {
  state.tutorialCompleted = false;
  state.tutorialStep = 0;
  saveState();
  render();
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

  const thumbnail = {
    id: `thumb-${Date.now()}`,
    title,
    subtitle,
    palette,
    source: "local-canvas",
    previewDataUrl: captureThumbnailPreview(),
    createdAt: new Date().toISOString(),
  };
  state.thumbnails = [thumbnail, ...(state.thumbnails || [])].slice(0, 20);
  state.selectedThumbnailId = thumbnail.id;
  toolTabs.thumbnails = "current";
  saveState();
  render();
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

async function handleThumbnailImageV4(button) {
  const payload = {
    title: document.querySelector("#thumb-title")?.value.trim() || selectedIdea()?.title || "",
    subtitle: document.querySelector("#thumb-subtitle")?.value.trim() || "",
    style: customValue("thumb-style"),
    palette: customValue("thumb-palette"),
    idea: selectedIdea() || null,
    dna: state.dna,
  };

  const original = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Generating…";
  }
  startThumbProgress();
  try {
    const result = await apiJson("/api/ai/thumbnail-image", { method: "POST", body: payload });
    if (!result.ok || !result.data.image?.data) {
      // Do not silently revert to the local canvas — keep the current preview and let the user retry.
      finishThumbProgress(false);
      toast(result.data?.note || result.data?.message || result.data?.error || "AI image generation failed. Please try again.");
      return;
    }
    await drawImageOnThumbnailCanvas(result.data.image);
    finishThumbProgress(true);
    const thumbnail = {
      id: `thumb-${Date.now()}`,
      title: payload.title,
      subtitle: payload.subtitle,
      style: payload.style,
      palette: payload.palette,
      source: "ai-image",
      previewDataUrl: captureThumbnailPreview(),
      createdAt: new Date().toISOString(),
    };
    state.thumbnails = [thumbnail, ...(state.thumbnails || [])].slice(0, 20);
    state.selectedThumbnailId = thumbnail.id;
    toolTabs.thumbnails = "current";
    saveState();
    render();
    toast("AI thumbnail generated.");
  } catch (error) {
    finishThumbProgress(false);
    toast("AI image generation failed. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

let thumbProgressTimer = null;

// Pollinations gives no real progress signal, so animate an eased bar toward ~92%
// and snap to 100% on completion — enough to reassure during the 10-40s wait.
function startThumbProgress() {
  const wrap = document.querySelector("#thumb-progress");
  const fill = document.querySelector("#thumb-progress-fill");
  if (!wrap || !fill) return;
  wrap.classList.remove("hidden");
  let pct = 0;
  fill.style.width = "0%";
  wrap.setAttribute("aria-valuenow", "0");
  clearInterval(thumbProgressTimer);
  thumbProgressTimer = setInterval(() => {
    pct += Math.max(0.5, (92 - pct) * 0.045);
    if (pct > 92) pct = 92;
    fill.style.width = `${pct.toFixed(1)}%`;
    wrap.setAttribute("aria-valuenow", String(Math.round(pct)));
  }, 240);
}

function finishThumbProgress(ok = true) {
  const wrap = document.querySelector("#thumb-progress");
  const fill = document.querySelector("#thumb-progress-fill");
  clearInterval(thumbProgressTimer);
  thumbProgressTimer = null;
  if (!wrap || !fill) return;
  fill.style.width = ok ? "100%" : "0%";
  wrap.setAttribute("aria-valuenow", ok ? "100" : "0");
  setTimeout(() => {
    wrap.classList.add("hidden");
    fill.style.width = "0%";
  }, ok ? 600 : 250);
}

function captureThumbnailPreview() {
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!canvasNode) return "";
  try {
    return canvasNode.toDataURL("image/jpeg", 0.72);
  } catch {
    return "";
  }
}

function drawSelectedThumbnailPreview() {
  const thumbnail = currentThumbnail();
  const canvasNode = document.querySelector("#thumbnail-canvas");
  if (!thumbnail?.previewDataUrl || !canvasNode) return;
  const ctx = canvasNode.getContext("2d");
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
    ctx.drawImage(img, 0, 0, canvasNode.width, canvasNode.height);
  };
  img.src = thumbnail.previewDataUrl;
}

function drawImageOnThumbnailCanvas(image) {
  return new Promise((resolve) => {
    const canvasNode = document.querySelector("#thumbnail-canvas");
    if (!canvasNode) return resolve();
    const ctx = canvasNode.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvasNode.width, canvasNode.height);
      ctx.drawImage(img, 0, 0, canvasNode.width, canvasNode.height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:${image.mimeType || "image/png"};base64,${image.data}`;
  });
}

async function handleAnalyzeTrendsV4(button) {
  await withBusy(button, "Analyzing...", async () => {
    const payload = {
      niche: document.querySelector("#trend-niche")?.value.trim() || state.creator.niche,
      category: customValue("trend-category"),
      platform: customValue("trend-platform"),
      regionCode: customValue("trend-region"),
      creator: state.creator,
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/trends", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Trend analysis failed.");
      return;
    }
    state.trends = { ...result.data, createdAt: new Date().toISOString() };
    saveState();
    const node = document.querySelector("#trends-output");
    if (node) node.innerHTML = trendsOutputV4(state.trends);
    toast("Trends analyzed.");
  });
}

async function handleCheckVideoV4(button) {
  await withBusy(button, "Reviewing...", async () => {
    const url = document.querySelector("#video-url")?.value.trim();
    const file = document.querySelector("#video-file")?.files?.[0];
    if (!url && !file) {
      toast("Add a YouTube URL or upload a clip first.");
      return;
    }
    const media = file ? await fileToBase64(file) : null;
    const payload = {
      youtubeUrl: url,
      media,
      goal: customValue("video-goal"),
      creator: state.creator,
      dna: state.dna,
    };
    const result = await apiJson("/api/ai/video-check", { method: "POST", body: payload });
    if (!result.ok) {
      toast(result.data.message || result.data.error || "Video check failed.");
      return;
    }
    const check = {
      id: `check-${Date.now()}`,
      title: url ? "YouTube video review" : file?.name || "Uploaded clip review",
      createdAt: new Date().toISOString(),
      ...result.data,
    };
    state.videoChecks.unshift(check);
    state.videoChecks = state.videoChecks.slice(0, 20);
    saveState();
    const node = document.querySelector("#video-check-output");
    if (node) node.innerHTML = videoCheckOutputV4(check);
    toast("Video checked.");
  });
}

function downloadLatestScriptPdf() {
  const script = currentScript();
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

function calendarViewDate() {
  const base = state.calendarViewDate || formatInputDate(new Date()).slice(0, 7);
  const [year, month] = base.split("-").map(Number);
  return new Date(year, month - 1, 1);
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

export { bootstrap };

