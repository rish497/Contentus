import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = normalizeSupabaseProjectUrl(trimEnv("SUPABASE_URL"));
const SUPABASE_ANON_KEY = trimEnv("SUPABASE_ANON_KEY");
const GEMINI_API_KEY = trimEnv("GEMINI_API_KEY");
const GOOGLE_CLIENT_ID = trimEnv("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = trimEnv("GOOGLE_CLIENT_SECRET");
const YOUTUBE_DATA_API_KEY = trimEnv("YOUTUBE_DATA_API_KEY");
const FIREBASE_API_KEY = trimEnv("FIREBASE_API_KEY");
const SESSION_SECRET = trimEnv("SESSION_SECRET");
const SUPABASE_AUTH_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const demoDashboard = {
  creator: "Rish Creates",
  niche: "Study productivity, AI tools, and student creator life",
  creatorDnaScore: 92,
  authenticityAverage: 87,
  contentIdeasThisWeek: 14,
  scheduledPosts: 12,
  connectedPlatforms: ["YouTube", "Instagram", "TikTok", "Newsletter"],
  recommendation: "Repeat personal experiment videos and shorten intros by 8-12 seconds.",
};

const youtubeMock = {
  channelName: "Rish Creates",
  subscribers: 48200,
  videos: [
    {
      id: "yt-1",
      title: "I Let AI Plan My Study Week",
      views: 82000,
      likes: 7200,
      comments: 638,
      duration: "8:42",
      uploadDate: "2026-06-12",
      watchTime: 1900,
      retention: 58,
      ctr: 9.8,
      diagnosis: {
        worked: "Personal experiment, clear proof, and fast payoff.",
        failed: "Intro can still be 8 seconds shorter.",
        clicked: "The title promises a funny personal experiment.",
        droppedOff: "Some viewers left during setup before seeing the schedule.",
        betterTitle: "AI Roasted My Study Week, So I Fixed It",
        thumbnailText: "AI Exposed Me",
        repurpose: ["Short hook breakdown", "Newsletter prompt template", "Instagram carousel"],
        followUps: ["Exact prompt walkthrough", "Intro teardown", "One-week reset challenge"],
      },
    },
  ],
};

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey.trim();
    if (!key || process.env[key]) continue;
    let value = rawValue.join("=").trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function trimEnv(key) {
  return (process.env[key] || "").trim();
}

function normalizeSupabaseProjectUrl(value) {
  if (!value) return "";
  return value
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/auth\/v1$/i, "")
    .replace(/\/storage\/v1$/i, "");
}

function configured(value) {
  return Boolean(value && !/^your_|^replace_|^xxx/i.test(value));
}

function integrationStatus() {
  return {
    supabase: configured(SUPABASE_URL) && configured(SUPABASE_ANON_KEY),
    gemini: configured(GEMINI_API_KEY),
    googleOAuth: configured(GOOGLE_CLIENT_ID) && configured(GOOGLE_CLIENT_SECRET),
    youtubeData: configured(YOUTUBE_DATA_API_KEY),
    firebase: configured(FIREBASE_API_KEY),
    sessionSecret: configured(SESSION_SECRET),
  };
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, { error: "Internal server error", detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Contentus running at http://localhost:${PORT}`);
});

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(__dirname, safePath));

  if (!filePath.startsWith(__dirname)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".png" ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    const index = await readFile(path.join(__dirname, "index.html"));
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(index);
  }
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      app: "Contentus",
      mode: integrationStatus().supabase ? "supabase-ready" : "mock",
      integrations: integrationStatus(),
      message: integrationStatus().supabase
        ? "Contentus APIs are running with Supabase auth/state enabled."
        : "Contentus APIs are running in mock mode. Add Supabase URL and anon key for auth/state.",
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, {
      app: "Contentus",
      integrations: integrationStatus(),
      authProvider: integrationStatus().supabase ? "supabase" : "local-demo",
      aiProvider: integrationStatus().gemini ? "gemini" : "mock",
      youtubeProvider: integrationStatus().youtubeData ? "youtube-data-api-key-configured" : "mock",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readJsonBody(request);
    const result = await supabaseAuth("signup", {
      email: body.email,
      password: body.password,
      data: {
        name: body.name || "Contentus Creator",
        contentus_state: body.contentusState || null,
      },
    });
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readJsonBody(request);
    const result = await supabasePasswordLogin(body.email, body.password);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/refresh") {
    const body = await readJsonBody(request);
    const result = await supabaseRefresh(body.refresh_token);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const result = await supabaseLogout(bearerToken(request));
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/user") {
    const result = await supabaseUser(bearerToken(request));
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/user/state") {
    const result = await supabaseUser(bearerToken(request));
    if (result.status >= 400) {
      sendJson(response, result.status, result.payload);
      return;
    }
    sendJson(response, 200, {
      user: sanitizeUser(result.payload),
      contentusState: result.payload.user_metadata?.contentus_state || null,
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/user/state") {
    const body = await readJsonBody(request);
    const result = await supabaseUpdateUserState(bearerToken(request), body.contentusState);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/demo/dashboard") {
    sendJson(response, 200, demoDashboard);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/youtube/mock") {
    sendJson(response, 200, youtubeMock);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/youtube/oauth/start") {
    sendJson(response, 200, {
      mode: "placeholder",
      message: "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and callback URL to enable real OAuth.",
      scopes: [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/yt-analytics.readonly",
      ],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/youtube/oauth/callback") {
    sendJson(response, 200, {
      mode: "placeholder",
      message: "OAuth callback placeholder. Exchange code for tokens in a production implementation.",
    });
    return;
  }

  const body = await readJsonBody(request);

  if (request.method === "POST" && url.pathname === "/api/ai/dna") {
    sendJson(response, 200, {
      score: 94,
      tone: "Funny, educational, honest, and slightly chaotic.",
      hookStyle: "Confession or creator experiment that becomes useful fast.",
      avoid: "Generic hustle language, copying, fake claims, and unsafe likeness use.",
      source: body.samples ? "sample-analysis" : "demo-default",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/ideas") {
    sendJson(response, 200, {
      ideas: [
        {
          title: `I Tested ${body.topic || "AI study planning"} So You Do Not Have To`,
          hook: "I tried it for a week, and the first result was embarrassing but useful.",
          genericRisk: "Low",
          personalizationTip: "Show one real artifact from your workflow.",
          disclosure: "Brainstormed with AI, written and edited by me.",
        },
      ],
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/script") {
    sendJson(response, 200, {
      script: "Cold open with the real problem, show proof, test the system, run Authenticity Guard, then end with one practical CTA.",
      hookOptions: ["AI fixed my calendar, but first it roasted me.", "This is why your AI draft sounds generic."],
      authenticityScore: 89,
      genericRisk: "Low",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/ad-studio") {
    sendJson(response, 200, {
      versions: ["Emotional version", "Funny version", "Cinematic version"],
      recommendedVersion: "Funny version",
      disclosure: "AI-assisted concept, written and edited by me.",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/repurpose") {
    sendJson(response, 200, {
      youtubeTitle: "I Let AI Fix My Content Workflow",
      instagramCaption: "AI should speed up your process, not erase your personality.",
      disclosure: "Brainstormed with AI, written and edited by me.",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/authenticity") {
    const text = String(body.text || "");
    const generic = /unlock|revolutionary|effortless|guarantee/i.test(text);
    sendJson(response, 200, {
      authenticityScore: generic ? 52 : 88,
      voiceMatch: generic ? 48 : 91,
      genericRisk: generic ? "Too generic" : "Low",
      label: generic ? "Needs more personal voice" : "Strong match",
      feedback: generic ? "Add a personal story and remove inflated claims." : "This sounds close to the Creator DNA.",
      rewrittenVersion: "I tried this in my actual workflow, and the useful part was what it exposed about my process.",
      disclosureRecommendation: text.toLowerCase().includes("ai") ? "AI-assisted disclosure recommended." : "Disclosure optional.",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/rights") {
    sendJson(response, 200, {
      flags: [
        "Check unrealistic claims.",
        "Confirm music/image licensing.",
        "Do not use a real person's likeness or voice without consent.",
        "Add AI disclosure if visuals, voice, or scripting used AI.",
      ],
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/disclosure") {
    sendJson(response, 200, {
      label: body.aiVoice ? "Synthetic voice used" : "AI-assisted",
      lines: [
        "Brainstormed with AI, written and edited by me.",
        "This video includes AI-assisted editing.",
      ],
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/inspiration") {
    sendJson(response, 201, {
      saved: true,
      item: {
        id: `insp-${Date.now()}`,
        sourceUrl: body.sourceUrl,
        sourceTitle: body.sourceTitle,
        selectedText: body.selectedText,
        analysis: "Use this as inspiration, not copying. Rebuild around your Creator DNA and audience.",
      },
    });
    return;
  }

  sendJson(response, 404, { error: "API route not found", path: url.pathname });
}

function bearerToken(request) {
  const header = request.headers.authorization || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function authHeaders(token = "") {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function requireSupabase() {
  if (integrationStatus().supabase) return null;
  return {
    status: 501,
    payload: {
      error: "Supabase is not configured",
      message: "Set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then restart the server.",
    },
  };
}

async function supabaseFetch(pathname, options = {}) {
  const missing = requireSupabase();
  if (missing) return missing;

  try {
    const result = await fetch(`${SUPABASE_AUTH_URL}${pathname}`, options);
    const text = await result.text();
    const payload = text ? JSON.parse(text) : {};
    if (!result.ok) {
      return {
        status: result.status,
        payload: normalizeSupabaseError(payload),
      };
    }
    return { status: result.status, payload };
  } catch (error) {
    return {
      status: 502,
      payload: {
        error: "Supabase request failed",
        message: error.message,
      },
    };
  }
}

async function supabaseAuth(action, body) {
  const pathname = action === "signup" ? "/signup" : action;
  const result = await supabaseFetch(pathname, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (result.status < 400) {
    return {
      status: result.status,
      payload: {
        ...result.payload,
        user: result.payload.user ? sanitizeUser(result.payload.user) : undefined,
        message: result.payload.session
          ? "Signed up and signed in."
          : "Signup created. If email confirmation is enabled in Supabase, confirm your email before signing in.",
      },
    };
  }

  return result;
}

async function supabasePasswordLogin(email, password) {
  if (!email || !password) {
    return { status: 400, payload: { error: "Email and password are required." } };
  }

  const result = await supabaseFetch("/token?grant_type=password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (result.status < 400 && result.payload.user) {
    result.payload.user = sanitizeUser(result.payload.user);
  }
  return result;
}

async function supabaseRefresh(refreshToken) {
  if (!refreshToken) return { status: 400, payload: { error: "Refresh token is required." } };

  const result = await supabaseFetch("/token?grant_type=refresh_token", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (result.status < 400 && result.payload.user) {
    result.payload.user = sanitizeUser(result.payload.user);
  }
  return result;
}

async function supabaseLogout(token) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  const result = await supabaseFetch("/logout", {
    method: "POST",
    headers: authHeaders(token),
  });
  if (result.status === 204 || result.status === 200) {
    return { status: 200, payload: { ok: true } };
  }
  return result;
}

async function supabaseUser(token) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  const result = await supabaseFetch("/user", {
    method: "GET",
    headers: authHeaders(token),
  });
  if (result.status < 400) {
    return { status: result.status, payload: sanitizeUser(result.payload) };
  }
  return result;
}

async function supabaseUpdateUserState(token, contentusState) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  if (!contentusState) return { status: 400, payload: { error: "contentusState is required." } };

  const result = await supabaseFetch("/user", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      data: {
        contentus_state: contentusState,
        contentus_saved_at: new Date().toISOString(),
      },
    }),
  });

  if (result.status < 400) {
    return {
      status: result.status,
      payload: {
        ok: true,
        user: sanitizeUser(result.payload),
        savedAt: result.payload.user_metadata?.contentus_saved_at,
      },
    };
  }
  return result;
}

function sanitizeUser(user = {}) {
  return {
    id: user.id,
    email: user.email,
    aud: user.aud,
    role: user.role,
    created_at: user.created_at,
    confirmed_at: user.confirmed_at,
    last_sign_in_at: user.last_sign_in_at,
    user_metadata: user.user_metadata || {},
  };
}

function normalizeSupabaseError(payload = {}) {
  return {
    error: payload.error || payload.code || "Supabase error",
    message: payload.msg || payload.message || payload.error_description || "Supabase request failed.",
    details: payload,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload, null, 2));
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}
