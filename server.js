import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const WORKSPACE_STATE_DIR = path.join(__dirname, ".contentus-state");
const WORKSPACE_STATE_FILE = path.join(WORKSPACE_STATE_DIR, "workspaces.json");
const SUPABASE_URL = normalizeSupabaseProjectUrl(trimEnv("SUPABASE_URL"));
const SUPABASE_ANON_KEY = trimEnv("SUPABASE_ANON_KEY");
const FEATHERLESS_API_KEY = trimEnv("FEATHERLESS_API_KEY") || trimEnv("FEATHERLESS_API_KRY");
const FEATHERLESS_BASE_URL = (trimEnv("FEATHERLESS_BASE_URL") || "https://api.featherless.ai/v1").replace(/\/+$/, "");
const FEATHERLESS_MODEL = trimEnv("FEATHERLESS_MODEL") || "Qwen/Qwen2.5-72B-Instruct";
const FEATHERLESS_VISION_MODEL = trimEnv("FEATHERLESS_VISION_MODEL") || "Qwen/Qwen2.5-VL-72B-Instruct";
const GEMINI_API_KEY = trimEnv("GEMINI_API_KEY");
const ELEVENLABS_API_KEY = trimEnv("ELEVENLABS_API_KEY");
const ELEVENLABS_BASE_URL = (trimEnv("ELEVENLABS_BASE_URL") || "https://api.elevenlabs.io/v1").replace(/\/+$/, "");
const ELEVENLABS_MODEL = trimEnv("ELEVENLABS_MODEL") || "eleven_multilingual_v2";
const ELEVENLABS_DEFAULT_VOICE = trimEnv("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM"; // Rachel (ElevenLabs premade)
const ELEVENLABS_MAX_CHARS = Number(trimEnv("ELEVENLABS_MAX_CHARS") || 5000);
const IMAGE_PROVIDER = (trimEnv("IMAGE_PROVIDER") || "pollinations").toLowerCase();
const POLLINATIONS_BASE_URL = (trimEnv("POLLINATIONS_BASE_URL") || "https://image.pollinations.ai").replace(/\/+$/, "");
const POLLINATIONS_MODEL = trimEnv("POLLINATIONS_MODEL") || "flux";
const POLLINATIONS_API_KEY = trimEnv("POLLINATIONS_API_KEY");
const GOOGLE_CLIENT_ID = trimEnv("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = trimEnv("GOOGLE_CLIENT_SECRET");
const GOOGLE_REDIRECT_URI = trimEnv("GOOGLE_REDIRECT_URI");
const YOUTUBE_DATA_API_KEY = trimEnv("YOUTUBE_DATA_API_KEY");
const FIREBASE_API_KEY = trimEnv("FIREBASE_API_KEY");
const SESSION_SECRET = trimEnv("SESSION_SECRET");
const SUPABASE_AUTH_URL = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : "";
const googleOAuthStates = new Map();

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

class ApiError extends Error {
  constructor(status, error, message = "") {
    super(message || error);
    this.status = status;
    this.publicError = error;
    this.publicMessage = message;
  }
}

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
  const googleClient = configured(GOOGLE_CLIENT_ID) && configured(GOOGLE_CLIENT_SECRET);
  return {
    supabase: configured(SUPABASE_URL) && configured(SUPABASE_ANON_KEY),
    featherless: configured(FEATHERLESS_API_KEY),
    gemini: configured(GEMINI_API_KEY),
    elevenlabs: configured(ELEVENLABS_API_KEY),
    pollinations: true,
    imageProvider: IMAGE_PROVIDER,
    googleOAuth: googleClient && configured(GOOGLE_REDIRECT_URI),
    googleOAuthClient: googleClient,
    googleRedirectUri: configured(GOOGLE_REDIRECT_URI),
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
    sendJson(response, error.status || 500, {
      error: error.publicError || "Internal server error",
      message: error.publicMessage || error.message,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Contentus running at http://localhost:${PORT}`);
});

async function serveStatic(response, pathname) {
  const safePath = pathname === "/" ? "/Landing Page.dc.html" : decodeURIComponent(pathname);
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
      mode: integrationStatus().supabase ? "supabase-ready" : "local-only",
      integrations: integrationStatus(),
      message: integrationStatus().supabase
        ? "Contentus APIs are running with Supabase auth/state enabled."
        : "Contentus APIs are running. Add Supabase URL and anon key for account storage.",
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, {
      app: "Contentus",
      integrations: integrationStatus(),
      authProvider: integrationStatus().supabase ? "supabase" : "not-configured",
      aiProvider: integrationStatus().featherless ? "featherless" : "not-configured",
      youtubeProvider: integrationStatus().youtubeData ? "youtube-data-api" : "not-configured",
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readJsonBody(request);
    const result = await supabaseAuth("signup", {
      email: body.email,
      password: body.password,
      data: {
        name: body.name || "",
      },
    });
    if (result.status < 400 && body.contentusState) {
      const user = result.payload.user || result.payload.session?.user;
      if (user?.id) await saveWorkspaceState(user.id, body.contentusState);
    }
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
      contentusState: await loadWorkspaceState(result.payload.id),
    });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/user/state") {
    const body = await readJsonBody(request);
    const result = await supabaseUpdateUserState(bearerToken(request), body.contentusState);
    sendJson(response, result.status, result.payload);
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

  if (request.method === "GET" && url.pathname === "/api/google/oauth/start") {
    const result = await googleOAuthStart(request, url);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/google/oauth/callback") {
    await googleOAuthCallback(request, response, url);
    return;
  }

  const body = await readJsonBody(request);

  if (request.method === "GET" && url.pathname === "/api/calendar/events") {
    const result = await googleCalendarEvents(request, url);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/calendar/events") {
    const result = await googleCalendarCreateEvent(request, body);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/youtube/channel") {
    const result = await fetchYouTubeChannel(body.input);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/youtube/comments") {
    const result = await fetchYouTubeComments(body.videoId);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/youtube/reply") {
    const result = await postYouTubeReply(request, body);
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/dna") {
    const dna = await generateCreatorDna(body);
    sendJson(response, 200, { dna });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/ideas") {
    const ideas = await generateIdeasWithAi(body);
    sendJson(response, 200, { ideas });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/script") {
    const script = await generateScriptWithAi(body);
    sendJson(response, 200, script);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/ad-studio") {
    const project = await generateAdStudioWithAi(body);
    sendJson(response, 200, project);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/thumbnail-copy") {
    const suggestions = await generateThumbnailCopy(body);
    sendJson(response, 200, { suggestions });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/authenticity") {
    const result = await scoreAuthenticityWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/community-replies") {
    const result = await generateCommunityReplies(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/trends") {
    const result = await analyzeTrendsWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/video-check") {
    const result = await analyzeVideoWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/thumbnail-image") {
    const result = await generateThumbnailImage(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/ai/voices") {
    const result = await listElevenLabsVoices();
    sendJson(response, result.status, result.payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/voiceover") {
    const result = await generateVoiceoverWithAi(body);
    sendJson(response, result.status, result.payload);
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

async function googleOAuthStart(request, url) {
  const missing = requireGoogleOAuthConfig(request);
  if (missing) return missing;
  const token = bearerToken(request);
  const user = await supabaseUser(token);
  if (user.status >= 400) return user;

  const scopeKey = url.searchParams.get("scope") || "all";
  const scopes = googleScopes(scopeKey);
  const state = crypto.randomBytes(24).toString("hex");
  googleOAuthStates.set(state, {
    token,
    scopeKey,
    createdAt: Date.now(),
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri(request));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  return {
    status: 200,
    payload: {
      authUrl: authUrl.toString(),
      scopes,
      message: configured(SESSION_SECRET)
        ? "Google OAuth ready."
        : "Google OAuth ready. Add SESSION_SECRET to keep refresh access after the token expires.",
    },
  };
}

async function googleOAuthCallback(request, response, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const entry = googleOAuthStates.get(state);
  googleOAuthStates.delete(state);

  if (!code || !entry || Date.now() - entry.createdAt > 10 * 60 * 1000) {
    redirectHtml(response, "/#/app/calendar", "Google connection expired. Return to Contentus and try again.");
    return;
  }

  const tokenResult = await exchangeGoogleCode(code, googleRedirectUri(request));
  if (!tokenResult.ok) {
    redirectHtml(response, "/#/app/calendar", tokenResult.message);
    return;
  }

  const existing = await supabaseUserRaw(entry.token);
  if (existing.status >= 400) {
    redirectHtml(response, "/#/login", "Sign in to Contentus again before connecting Google.");
    return;
  }

  const stored = buildStoredGoogleAuth(existing.payload.user_metadata?.google_oauth, tokenResult.payload, entry.scopeKey);
  const update = await supabaseUpdateUserMetadata(entry.token, { google_oauth: stored });
  if (update.status >= 400) {
    redirectHtml(response, "/#/app/calendar", update.payload.message || "Could not save Google connection.");
    return;
  }

  const route = entry.scopeKey === "youtube" ? "/#/app/community" : "/#/app/calendar";
  redirectHtml(response, route, "Google connected. Return to Contentus.");
}

async function googleCalendarEvents(request, url) {
  const auth = await googleAccessForRequest(request, "calendar");
  if (auth.status >= 400) return auth;
  const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
  const timeMax = url.searchParams.get("timeMax") || new Date(Date.now() + 31 * 86400000).toISOString();
  const result = await googleApiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", auth.accessToken, {
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  if (!result.ok) return { status: result.status, payload: result.payload };
  return {
    status: 200,
    payload: {
      google: googlePublicState(auth.stored),
      events: normalizeArray(result.payload.items).map(calendarEventFromGoogle),
    },
  };
}

async function googleCalendarCreateEvent(request, body = {}) {
  const auth = await googleAccessForRequest(request, "calendar");
  if (auth.status >= 400) return auth;
  if (!body.title || !body.date) {
    return { status: 400, payload: { error: "Title and date are required." } };
  }
  const start = `${body.date}T${body.startTime || "10:00"}:00`;
  const end = `${body.date}T${body.endTime || "11:00"}:00`;
  const result = await googleApiFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", auth.accessToken, {}, {
    method: "POST",
    body: {
      summary: body.title,
      description: [body.platform, body.notes].filter(Boolean).join("\n\n"),
      start: { dateTime: start, timeZone: "Asia/Kolkata" },
      end: { dateTime: end, timeZone: "Asia/Kolkata" },
    },
  });
  if (!result.ok) return { status: result.status, payload: result.payload };
  return { status: 201, payload: { event: calendarEventFromGoogle(result.payload), google: googlePublicState(auth.stored) } };
}

async function postYouTubeReply(request, body = {}) {
  const auth = await googleAccessForRequest(request, "youtube");
  if (auth.status >= 400) return auth;
  if (!body.parentId || !body.text) {
    return { status: 400, payload: { error: "parentId and text are required." } };
  }
  const result = await googleApiFetch("https://www.googleapis.com/youtube/v3/comments", auth.accessToken, { part: "snippet" }, {
    method: "POST",
    body: {
      snippet: {
        parentId: body.parentId,
        textOriginal: body.text,
      },
    },
  });
  if (!result.ok) return { status: result.status, payload: result.payload };
  return { status: 201, payload: { ok: true, replyId: result.payload.id, google: googlePublicState(auth.stored) } };
}

async function exchangeGoogleCode(code, redirectUri) {
  try {
    const result = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const payload = await result.json();
    if (!result.ok) return { ok: false, message: payload.error_description || payload.error || "Google token exchange failed." };
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function googleAccessForRequest(request, capability) {
  const token = bearerToken(request);
  const user = await supabaseUserRaw(token);
  if (user.status >= 400) return user;
  let stored = user.payload.user_metadata?.google_oauth;
  if (!stored || !stored.capabilities?.[capability]) {
    return {
      status: 401,
      payload: {
        error: "Google not connected",
        message: capability === "calendar"
          ? "Connect Google Calendar before loading or creating calendar events."
          : "Connect Google with YouTube posting permission before posting replies.",
      },
    };
  }
  if (stored.expires_at && stored.expires_at < Date.now() + 60000) {
    const refreshed = await refreshGoogleToken(stored);
    if (!refreshed.ok) {
      return {
        status: 401,
        payload: {
          error: "Reconnect Google",
          message: "Reconnect Google. Add SESSION_SECRET to keep refresh access after the token expires.",
        },
      };
    }
    stored = { ...stored, ...refreshed.stored };
    await supabaseUpdateUserMetadata(token, { google_oauth: stored });
  }
  return { status: 200, accessToken: stored.access_token, stored };
}

async function refreshGoogleToken(stored = {}) {
  const refreshToken = decryptGoogleRefreshToken(stored.refresh_token_enc);
  if (!refreshToken) return { ok: false };
  try {
    const result = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload = await result.json();
    if (!result.ok) return { ok: false };
    return {
      ok: true,
      stored: {
        access_token: payload.access_token,
        expires_at: Date.now() + Number(payload.expires_in || 3600) * 1000,
      },
    };
  } catch {
    return { ok: false };
  }
}

async function googleApiFetch(baseUrl, accessToken, params = {}, options = {}) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const result = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await result.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      payload: {
        error: payload.error?.message || payload.error || "Google API request failed.",
        message: payload.error?.message || payload.error_description || "Google API request failed.",
        details: payload,
      },
    };
  }
  return { ok: true, status: result.status, payload };
}

function buildStoredGoogleAuth(existing = {}, tokenPayload = {}, scopeKey = "all") {
  const capabilities = { ...(existing?.capabilities || {}) };
  if (scopeKey === "calendar" || scopeKey === "all") capabilities.calendar = true;
  if (scopeKey === "youtube" || scopeKey === "all") capabilities.youtube = true;
  const stored = {
    ...existing,
    access_token: tokenPayload.access_token,
    expires_at: Date.now() + Number(tokenPayload.expires_in || 3600) * 1000,
    capabilities,
    saved_at: new Date().toISOString(),
    reconnect_required: !configured(SESSION_SECRET),
  };
  if (tokenPayload.refresh_token && configured(SESSION_SECRET)) {
    stored.refresh_token_enc = encryptGoogleRefreshToken(tokenPayload.refresh_token);
    stored.reconnect_required = false;
  }
  return stored;
}

function googleScopes(scopeKey = "all") {
  const scopes = new Set(["openid", "email", "profile"]);
  if (scopeKey === "calendar" || scopeKey === "all") scopes.add("https://www.googleapis.com/auth/calendar.events");
  if (scopeKey === "youtube" || scopeKey === "all") scopes.add("https://www.googleapis.com/auth/youtube.force-ssl");
  return [...scopes];
}

function googleRedirectUri(request) {
  return configured(GOOGLE_REDIRECT_URI)
    ? GOOGLE_REDIRECT_URI
    : `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host}/api/google/oauth/callback`;
}

function requireGoogleOAuthConfig(request) {
  if (integrationStatus().googleOAuth) return null;
  const missing = [];
  if (!configured(GOOGLE_CLIENT_ID)) missing.push("GOOGLE_CLIENT_ID");
  if (!configured(GOOGLE_CLIENT_SECRET)) missing.push("GOOGLE_CLIENT_SECRET");
  if (!configured(GOOGLE_REDIRECT_URI)) missing.push("GOOGLE_REDIRECT_URI");
  return {
    status: 501,
    payload: {
      error: "Google OAuth is not configured",
      message: `Set ${missing.join(", ")} in .env and Render, then restart the server.`,
      missing,
    },
  };
}

function encryptGoogleRefreshToken(value) {
  if (!configured(SESSION_SECRET) || !value) return "";
  const key = crypto.createHash("sha256").update(SESSION_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptGoogleRefreshToken(value = "") {
  if (!configured(SESSION_SECRET) || !value) return "";
  try {
    const [ivText, tagText, encryptedText] = value.split(".");
    const key = crypto.createHash("sha256").update(SESSION_SECRET).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64"));
    decipher.setAuthTag(Buffer.from(tagText, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function googlePublicState(stored = {}) {
  return {
    calendar: Boolean(stored.capabilities?.calendar),
    youtubePosting: Boolean(stored.capabilities?.youtube),
    reconnectRequired: Boolean(stored.reconnect_required),
    expiresAt: stored.expires_at,
  };
}

function calendarEventFromGoogle(event = {}) {
  const startValue = event.start?.dateTime || event.start?.date || "";
  const endValue = event.end?.dateTime || event.end?.date || "";
  return {
    id: event.id,
    googleEventId: event.id,
    title: event.summary || "Untitled event",
    date: startValue.slice(0, 10),
    time: startValue.includes("T") ? `${startValue.slice(11, 16)}${endValue ? `-${endValue.slice(11, 16)}` : ""}` : "All day",
    start: startValue,
    end: endValue,
    source: "google",
  };
}

function redirectHtml(response, route, message) {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><meta charset="utf-8"><script>localStorage.setItem("contentus-google-message", ${JSON.stringify(message)}); location.replace(${JSON.stringify(route)});</script><p>${message}</p>`);
}

async function generateCreatorDna(body = {}) {
  const youtubeContext = body.youtubeUrl ? await fetchYouTubeContext(body.youtubeUrl) : null;
  const mediaNote = body.media?.truncated ? "Uploaded media was trimmed before analysis to keep the request lightweight." : "";
  const prompt = `
You are Contentus, a creator voice profiler. Analyze the creator's real samples and return only JSON.

Creator profile:
${JSON.stringify(body.creator || {}, null, 2)}

Written samples and transcripts:
${String(body.samples || "").slice(0, 18000)}

YouTube context:
${JSON.stringify(youtubeContext || {}, null, 2)}

Return this JSON shape:
{
  "score": number,
  "tone": string,
  "humor": string,
  "phrases": string[],
  "story": string,
  "visual": string,
  "themes": string[],
  "audienceType": string,
  "editingPace": string,
  "hookStyle": string,
  "language": string,
  "emotional": string,
  "avoid": string,
  "examplesLike": string[],
  "examplesUnlike": string[],
  "brandValues": string,
  "mediaNote": string
}

Rules: do not invent private facts. If data is thin, say what is uncertain. Preserve originality and warn against copying.
`;
  const result = await callFeatherlessJson(prompt, {
    media: body.media,
    temperature: 0.25,
  });
  if (!result || typeof result !== "object" || !Number.isFinite(Number(result.score))) {
    throw new ApiError(502, "Creator DNA generation failed", "Featherless returned an invalid Creator DNA profile.");
  }
  return {
    ...result,
    mediaNote: [mediaNote, youtubeContext?.note, result.mediaNote].filter(Boolean).join(" "),
  };
}

async function generateIdeasWithAi(body = {}) {
  const prompt = `
Generate 5 original Contentus ideas for a creator. Return only JSON:
{
  "ideas": [
    {
      "title": string,
      "hook": string,
      "concept": string,
      "why": string,
      "platform": string,
      "platformFit": string,
      "contentType": string,
      "emotional": string,
      "shortFormVersion": string,
      "longFormVersion": string,
      "genericRisk": "Low" | "Medium" | "High",
      "authenticityScore": number,
      "hitProbability": number,
      "verdict": "Likely hit" | "Coin flip" | "Likely miss",
      "hitReasons": string[],
      "missRisks": string[],
      "personalizationTip": string,
      "cta": string,
      "disclosure": string
    }
  ]
}

Inputs:
${JSON.stringify(body, null, 2)}

Rules: no copying, no fake trend claims, no spam growth tactics, include a real personalization tip for every idea.
For hit/miss: "hitProbability" is an honest 0-100 estimate of whether this idea will perform for THIS creator on THIS platform/goal — not hype. Base it on hook strength, audience fit, originality vs. saturation, and emotional pull. "verdict" must agree with the number (>=65 hit, 45-64 coin flip, <45 miss). "hitReasons" are 2-3 concrete reasons it could land; "missRisks" are 1-3 honest reasons it could flop. Be willing to predict a miss.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.55 });
  const ideas = normalizeArray(result.ideas);
  if (!ideas.length) {
    throw new ApiError(502, "Idea generation failed", "Featherless returned no ideas.");
  }
  return ideas;
}

async function generateScriptWithAi(body = {}) {
  const lengthLabel = String(body.length || body.existingScript?.lengthLabel || "60 seconds");
  const targetWords = targetWordsFromLength(lengthLabel);
  const prompt = `
You are a scriptwriter for a specific creator. Write the ACTUAL WORDS they will say out loud on camera. Return only JSON.

Input:
${JSON.stringify(body, null, 2)}

Target duration: ${lengthLabel} (about ${targetWords} spoken words). 30s = tight and punchy. 8 min = long and fully developed with several main points.

CRITICAL RULES — this is what makes a script good instead of AI slop:
- Write the literal spoken lines, the way the creator would actually talk. First person. Conversational. Contractions.
- NEVER narrate the process of making the video. Banned: "Cold open:", "Here is the honest setup", "first I am showing the messy version", "the goal is to make it sound like a person", "not just another generic AI draft", "let me turn this into a structure". If a line describes the script instead of being the script, it is wrong.
- No filler, no hype, no "in today's video". Open with a real hook line they say in the first 3 seconds.
- Match the creator's voice, humor, and phrasing from their Creator DNA. Use their actual vibe.
- Be specific to the topic. Reference concrete details, examples, numbers, or moments — not vague generalities.
- Each section's "spoken" text is ONLY the words said aloud. Stage directions/visuals go in shotList/broll/onScreenText, never inside spoken lines.

Return this JSON:
{
  "title": string,
  "targetLength": string,
  "authenticityScore": number,
  "genericRisk": "Low" | "Medium" | "High",
  "personalizationTip": string,
  "disclosure": string,
  "hookOptions": string[],
  "sections": [{ "label": string, "spoken": string }],
  "scenes": string[],
  "voiceover": string,
  "shotList": string[],
  "broll": string[],
  "onScreenText": string[],
  "caption": string,
  "hashtags": string[],
  "endingOptions": string[]
}

"sections" is the spoken script broken into labeled beats, e.g. labels like "Hook", "Setup", "Main point 1", "Main point 2", "Payoff", "Call to action". For short videos use 3-5 sections; for long videos use more. Each "spoken" value is the exact words to say for that beat.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.6 });
  const sections = normalizeArray(result.sections).filter((s) => s && (s.spoken || s.label));
  const script = { ...result, sections, targetLength: result.targetLength || lengthLabel };
  if (sections.length) {
    script.script = sections.map((s) => `${(s.label || "").toUpperCase()}\n${(s.spoken || "").trim()}`.trim()).join("\n\n");
  } else if (!String(script.script || "").trim()) {
    throw new ApiError(502, "Script generation failed", "Featherless returned no script text.");
  }
  return script;
}

async function generateAdStudioWithAi(body = {}) {
  const prompt = `
You are Contentus Ad and Short Film Studio. Return only JSON.

Input:
${JSON.stringify(body, null, 2)}

Return:
{
  "title": string,
  "concept": string,
  "script": string,
  "sceneList": string[],
  "shotList": string[],
  "storyboard": string[],
  "voiceover": string,
  "dialogue": string[],
  "musicMood": string,
  "visualPrompts": string[],
  "caption": string,
  "thumbnailText": string,
  "platformVersions": string[],
  "disclosure": string,
  "recommendedVersion": string,
  "versions": [
    {
      "name": "Emotional version" | "Funny version" | "Cinematic version",
      "concept": string,
      "script": string,
      "bestForPlatform": string,
      "audienceFit": string,
      "authenticityScore": number,
      "viralPotential": string,
      "riskLevel": string,
      "recommended": boolean
    }
  ]
}

Rules: flag unsafe claims, avoid deepfake/likeness misuse, include an AI disclosure line if AI assisted. "voiceover" must be the exact words a narrator can speak, not direction about tone.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.5 });
  if (!result || typeof result !== "object" || !String(result.script || result.concept || "").trim()) {
    throw new ApiError(502, "Ad Studio generation failed", "Featherless returned an invalid ad or film project.");
  }
  return { ...result, versions: normalizeArray(result.versions) };
}

async function generateThumbnailCopy(body = {}) {
  const title = body.idea?.title || "creator idea";
  const prompt = `
Return only JSON: {"suggestions":[{"text":string,"reason":string}]}
Create 3 thumbnail text options under 32 characters.
Idea: ${JSON.stringify(body.idea || {})}
Style: ${body.style || "clean proof"}
Creator DNA: ${JSON.stringify(body.dna || {})}
Use very few words. No clickbait lies.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.35, maxOutputTokens: 350 });
  const suggestions = normalizeArray(result.suggestions);
  if (!suggestions.length) {
    throw new ApiError(502, "Thumbnail copy generation failed", "Featherless returned no thumbnail copy suggestions.");
  }
  return suggestions;
}

async function scoreAuthenticityWithAi(body = {}) {
  const prompt = `
You are Contentus Authenticity Guard. Compare the content with the Creator DNA. Return only JSON:
{
  "authenticityScore": number,
  "voiceMatch": number,
  "toneMatch": number,
  "audienceFit": number,
  "originalityScore": number,
  "genericRisk": string,
  "emotionalBelievability": number,
  "brandSafety": number,
  "label": string,
  "feedback": string,
  "suggestions": string[],
  "rewrittenVersion": string,
  "disclosureRecommendation": string
}

Creator:
${JSON.stringify(body.creator || {}, null, 2)}

Creator DNA:
${JSON.stringify(body.dna || {}, null, 2)}

Content:
${String(body.text || "").slice(0, 14000)}

Rules: encourage originality, flag generic AI style, risky claims, copied inspiration, and missing disclosure.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.25 });
  if (!result || typeof result !== "object" || !Number.isFinite(Number(result.authenticityScore))) {
    throw new ApiError(502, "Authenticity scoring failed", "Featherless returned an invalid authenticity report.");
  }
  return result;
}

async function generateCommunityReplies(body = {}) {
  const comments = normalizeArray(body.comments).slice(0, 40);
  const prompt = `
You write reply drafts AS the creator, replying to their own YouTube viewers. Return only JSON:
{"comments":[{"id":string,"author":string,"text":string,"sentiment":string,"importance":string,"suggestedReply":string,"videoIdea":string}]}

Creator:
${JSON.stringify(body.creator || {}, null, 2)}
Creator DNA:
${JSON.stringify(body.dna || {}, null, 2)}
Comments:
${JSON.stringify(comments, null, 2)}

Write each suggestedReply the way a real creator types a reply on their phone:
- Short. Usually one sentence, sometimes two. Often under 12 words.
- Sound like a person, not a brand. Casual, warm, a little personality. Lowercase and "haha", emojis, "ngl", etc. are fine if they fit the creator's voice.
- Reply to the SPECIFIC thing the viewer said. Reference their actual words. Never generic ("Thanks for watching!", "Glad you enjoyed!").
- If they asked a question, just answer it directly.
- Match the creator's tone from their DNA. If their voice is chaotic/funny, be that. If calm, be that.

Do NOT:
- Add disclaimers, hedging, or "as an AI" anything.
- Add hashtags, calls to subscribe, or marketing lines unless the creator clearly does that.
- Over-apologize, over-explain, or sound customer-support-y.
- Use corporate filler ("We appreciate your feedback", "Rest assured", "Kindly note").

For toxic/troll comments: write a short, unbothered, classy reply (or note it is best ignored) — never escalate.
sentiment = positive | neutral | negative. importance = high | medium | low (questions and repeated themes are high).
videoIdea = a short next-video idea only when the comment clearly suggests one, else "".
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.7 });
  const replies = normalizeArray(result.comments);
  if (!replies.length && comments.length) {
    throw new ApiError(502, "Community replies failed", "Featherless returned no reply drafts.");
  }
  return { comments: replies };
}

async function analyzeTrendsWithAi(body = {}) {
  const regionCode = (body.regionCode || "US").toUpperCase().slice(0, 2);
  const niche = body.niche || body.creator?.niche || "general creator content";
  const platform = body.platform || "YouTube";
  const categoryId = trendCategoryId(body.category);

  let sourceVideos = [];
  let note = "";
  if (configured(YOUTUBE_DATA_API_KEY)) {
    try {
      const data = await youtubeApi("videos", {
        part: "snippet,statistics",
        chart: "mostPopular",
        regionCode,
        videoCategoryId: categoryId,
        maxResults: "20",
      });
      sourceVideos = normalizeArray(data.items).map((item) => ({
        title: item.snippet?.title || "",
        channel: item.snippet?.channelTitle || "",
        views: Number(item.statistics?.viewCount || 0),
        tags: normalizeArray(item.snippet?.tags).slice(0, 6),
      })).filter((v) => v.title);
    } catch (error) {
      note = `Live YouTube trends could not be fetched (${error.message}); Featherless analyzed the available creator context only.`;
    }
  } else {
    note = "Set YOUTUBE_DATA_API_KEY to pull live YouTube trends. Featherless analyzed the available creator context only.";
  }

  const prompt = `
You are Contentus Trend Analyser. Help a specific creator ride trends without copying. Return only JSON:
{
  "summary": string,
  "trends": [{ "title": string, "pattern": string, "why": string, "creatorAngle": string, "riskNote": string }],
  "topics": string[],
  "audioTrends": string[]
}

Creator niche: ${niche}
Platform: ${platform}
Region: ${regionCode}
${sourceVideos.length ? `Currently trending videos (real, from YouTube mostPopular):\n${JSON.stringify(sourceVideos.slice(0, 20), null, 2)}` : "No live trending feed available; infer durable trend patterns for this niche/platform."}
Creator DNA: ${JSON.stringify(body.dna || {}, null, 2)}

Rules: identify the underlying FORMAT/PATTERN behind what is trending, not just the topics. For each trend give a "creatorAngle" that fits THIS creator's niche and voice — never tell them to copy a video. "riskNote" flags saturation, fad risk, or licensing/audio concerns. "audioTrends" approximates trending sounds/music styles for the platform (note these are approximations, not licensed picks). Be honest when a trend is already saturated.
`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.5 });
  const trends = normalizeArray(result.trends);
  const topics = normalizeArray(result.topics);
  const audioTrends = normalizeArray(result.audioTrends);
  if (!trends.length && !topics.length && !audioTrends.length) {
    throw new ApiError(502, "Trend analysis failed", "Featherless returned no trend insights.");
  }
  return {
    summary: result.summary || "",
    trends,
    topics,
    audioTrends,
    sourceVideos: sourceVideos.slice(0, 10),
    note,
  };
}

function trendCategoryId(category) {
  const map = {
    "music": "10",
    "gaming": "20",
    "education": "27",
    "science & tech": "28",
    "tech": "28",
    "entertainment": "24",
    "people & blogs": "22",
    "comedy": "23",
    "howto & style": "26",
    "sports": "17",
    "news": "25",
  };
  return map[String(category || "").toLowerCase()] || undefined;
}

async function analyzeVideoWithAi(body = {}) {
  let youtubeContext = null;
  let note = "";
  if (body.youtubeUrl) {
    youtubeContext = await fetchYouTubeContext(body.youtubeUrl);
    if (youtubeContext?.note) note = youtubeContext.note;
  }
  if (!body.media && !youtubeContext) {
    note = "Add a YouTube URL or upload a video/clip to analyze.";
  }

  const prompt = `
You are Contentus Video Checker. Review a creator's video before they publish and give honest, specific feedback. Return only JSON:
{
  "scoreOverall": number,
  "verdict": "Ready to post" | "Fix a few things" | "Needs work",
  "hookStrength": number,
  "retention": number,
  "pacing": number,
  "audio": number,
  "clarity": number,
  "firstThreeSeconds": string,
  "strengths": string[],
  "improvements": string[],
  "thumbnailAdvice": string,
  "titleAdvice": string
}

Goal of the video: ${body.goal || "grow and retain audience"}
Creator: ${JSON.stringify(body.creator || {}, null, 2)}
Creator DNA: ${JSON.stringify(body.dna || {}, null, 2)}
${youtubeContext ? `YouTube context:\n${JSON.stringify(youtubeContext, null, 2)}` : ""}
${body.media ? "An uploaded video/clip is attached — analyze the actual footage (hook, pacing, audio, visuals, retention risks)." : "No footage attached; base feedback on the provided title/description/transcript context."}

Rules: all numeric scores are 0-100 and honest — do not inflate. "firstThreeSeconds" critiques the opening hook specifically. "improvements" are concrete, ordered by impact. Be willing to say a video needs work.
`;
  const result = await callFeatherlessJson(prompt, { media: body.media, temperature: 0.4 });
  if (!result || typeof result !== "object" || !Number.isFinite(Number(result.scoreOverall))) {
    throw new ApiError(502, "Video analysis failed", "Featherless returned an invalid video analysis.");
  }
  return {
    ...result,
    note,
  };
}

async function generateThumbnailImage(body = {}) {
  const title = (body.title || body.idea?.title || "Creator idea").slice(0, 120);
  const subtitle = (body.subtitle || "").slice(0, 80);
  const style = body.style || "clean proof";
  const palette = body.palette || "high-contrast cyan, coral, gold on near-black";

  // Headlines like "I Tested AI With My Real Workflow" are abstract — feeding them
  // straight to the image model makes it render gibberish "text" and unrelated art.
  // So first turn the headline into a concrete visual SCENE, then render that.
  const scene = await describeThumbnailScene({ title, subtitle, style, palette, dna: body.dna });
  const imagePrompt = `${scene} Cinematic, dramatic lighting, bold high-contrast colors (${palette}), ${style} style, professional YouTube thumbnail composition with one clear focal subject and generous empty negative space on the LEFT third for a headline overlay. Photoreal, sharp, punchy, high detail. Absolutely no text, no letters, no words, no captions, no numbers, no logos, no watermark, no typography of any kind.`.replace(/\s+/g, " ").trim();

  const image = await generateImage(imagePrompt);
  if (!image.data) {
    return {
      image: null,
      prompt: imagePrompt,
      note: image.warning || "Image generation is unavailable right now. Use the local canvas designer meanwhile.",
    };
  }
  return { image, prompt: imagePrompt, note: "", provider: image.provider, scene };
}

// Converts an abstract video headline into one concrete, literal visual scene the
// image model can actually draw (no text/title echoed back). Falls back to a simple
// symbolic description if the text model is unavailable.
async function describeThumbnailScene({ title, subtitle, style, palette, dna }) {
  const prompt = `You write prompts for an AI image generator that creates YouTube thumbnail BACKGROUNDS.
Turn the video below into ONE concrete, literal visual scene a text-to-image model can draw: name a real subject, setting, objects, action, and mood using concrete nouns.
Hard rules:
- Describe ONLY what is visually in the frame.
- Do NOT include any text, words, letters, numbers, captions, or the video title itself.
- Do NOT mention "thumbnail", "text overlay", or "headline".
- Keep it to 1-2 vivid sentences.
Return JSON only: { "scene": string }

Video title: ${title}
${subtitle ? `Subtitle: ${subtitle}` : ""}
Desired mood/style: ${style}
Color palette: ${palette}
${dna?.visual ? `Creator's visual style to honor: ${dna.visual}` : ""}`;
  const result = await callFeatherlessJson(prompt, { temperature: 0.8, maxOutputTokens: 220 });
  const scene = (typeof result?.scene === "string" && result.scene.trim()) ? result.scene.trim() : "";
  if (!scene) {
    throw new ApiError(502, "Thumbnail scene generation failed", "Featherless returned no usable image prompt.");
  }
  return scene.slice(0, 600);
}

// Picks the image provider (default Pollinations, keyless) and falls back to the
// other provider if the preferred one returns no image.
async function generateImage(prompt) {
  const order = IMAGE_PROVIDER === "gemini" ? ["gemini", "pollinations"] : ["pollinations", "gemini"];
  let lastWarning = "";
  for (const provider of order) {
    const result = provider === "gemini" ? await callGeminiImage(prompt) : await callPollinationsImage(prompt);
    if (result.data) return { ...result, provider };
    lastWarning = result.warning || lastWarning;
  }
  return { warning: lastWarning || "No image provider returned data." };
}

// Pollinations is free and keyless. An optional token lifts anonymous rate limits.
async function callPollinationsImage(prompt) {
  const params = new URLSearchParams({
    width: "1280",
    height: "720",
    model: POLLINATIONS_MODEL,
    nologo: "true",
    referrer: "contentus",
    seed: String(Math.floor(Math.random() * 1_000_000)),
  });
  const url = `${POLLINATIONS_BASE_URL}/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
  const headers = {};
  if (configured(POLLINATIONS_API_KEY)) headers.Authorization = `Bearer ${POLLINATIONS_API_KEY}`;
  try {
    const result = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
    if (!result.ok) {
      const detail = await result.text().catch(() => "");
      return { warning: detail?.slice(0, 200) || `Pollinations request failed with ${result.status}` };
    }
    const mimeType = result.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      const detail = await result.text().catch(() => "");
      return { warning: detail?.slice(0, 200) || "Pollinations returned a non-image response." };
    }
    const buffer = Buffer.from(await result.arrayBuffer());
    if (!buffer.length) return { warning: "Pollinations returned no image data." };
    return { data: buffer.toString("base64"), mimeType };
  } catch (error) {
    return { warning: error.name === "TimeoutError" ? "Pollinations image timed out." : error.message };
  }
}

async function callGeminiImage(prompt) {
  if (!configured(GEMINI_API_KEY)) return { warning: "GEMINI_API_KEY not configured." };
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";
  try {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 0.8 },
      }),
    });
    const text = await result.text();
    const payload = text ? JSON.parse(text) : {};
    if (!result.ok) {
      return { warning: payload.error?.message || `Image request failed with ${result.status}` };
    }
    const parts = payload.candidates?.[0]?.content?.parts || [];
    const inline = parts.find((part) => part.inline_data?.data || part.inlineData?.data);
    const data = inline?.inline_data?.data || inline?.inlineData?.data || "";
    const mimeType = inline?.inline_data?.mime_type || inline?.inlineData?.mimeType || "image/png";
    if (!data) return { warning: "Model returned no image data." };
    return { data, mimeType };
  } catch (error) {
    return { warning: error.message };
  }
}

// Lists the account's ElevenLabs voices (premade + cloned) so the studio dropdown
// reflects the real voices the creator has, not a hardcoded list.
async function listElevenLabsVoices() {
  if (!configured(ELEVENLABS_API_KEY)) {
    return {
      status: 200,
      payload: {
        configured: false,
        voices: [],
        defaultVoiceId: ELEVENLABS_DEFAULT_VOICE,
        message: "Set ELEVENLABS_API_KEY in .env and restart to load your ElevenLabs voices.",
      },
    };
  }
  try {
    const result = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await result.text();
    const payload = text ? JSON.parse(text) : {};
    if (!result.ok) {
      return { status: result.status, payload: { configured: true, voices: [], error: payload.detail?.message || payload.detail || `ElevenLabs voices request failed with ${result.status}` } };
    }
    const voices = normalizeArray(payload.voices).map((voice) => ({
      voiceId: voice.voice_id,
      name: voice.name || "Voice",
      category: voice.category || "",
      previewUrl: voice.preview_url || "",
    })).filter((voice) => voice.voiceId);
    return {
      status: 200,
      payload: { configured: true, voices, defaultVoiceId: ELEVENLABS_DEFAULT_VOICE },
    };
  } catch (error) {
    return { status: 502, payload: { configured: true, voices: [], error: error.name === "TimeoutError" ? "ElevenLabs voices request timed out." : error.message } };
  }
}

// Renders text to a short voiceover with ElevenLabs Text-to-Speech and returns the
// audio as base64 so it travels through the existing JSON API, like generated images.
async function generateVoiceoverWithAi(body = {}) {
  const rawText = String(body.text || "").trim();
  if (!rawText) {
    return { status: 400, payload: { error: "Add a script or some text to narrate." } };
  }
  if (!configured(ELEVENLABS_API_KEY)) {
    return {
      status: 501,
      payload: {
        error: "ElevenLabs is not configured",
        message: "Set ELEVENLABS_API_KEY in .env and Render, then restart the server.",
      },
    };
  }

  const truncated = rawText.length > ELEVENLABS_MAX_CHARS;
  const text = truncated ? rawText.slice(0, ELEVENLABS_MAX_CHARS) : rawText;
  const voiceId = String(body.voiceId || ELEVENLABS_DEFAULT_VOICE).trim() || ELEVENLABS_DEFAULT_VOICE;
  const modelId = String(body.modelId || ELEVENLABS_MODEL).trim() || ELEVENLABS_MODEL;
  const outputFormat = String(body.outputFormat || "mp3_44100_128").trim();
  const voiceSettings = {
    stability: clampNumber(body.stability, 0, 1, 0.5),
    similarity_boost: clampNumber(body.similarityBoost, 0, 1, 0.75),
    style: clampNumber(body.style, 0, 1, 0),
    use_speaker_boost: body.speakerBoost !== false,
    speed: clampNumber(body.speed, 0.7, 1.2, 1),
  };

  try {
    const result = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: modelId, voice_settings: voiceSettings }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!result.ok) {
      const detail = await result.text().catch(() => "");
      let message = `ElevenLabs request failed with ${result.status}`;
      try {
        const parsed = JSON.parse(detail);
        message = parsed.detail?.message || parsed.detail || message;
      } catch {
        if (detail) message = detail.slice(0, 200);
      }
      return { status: result.status, payload: { error: "Voiceover generation failed", message } };
    }

    const buffer = Buffer.from(await result.arrayBuffer());
    if (!buffer.length) {
      return { status: 502, payload: { error: "ElevenLabs returned no audio." } };
    }
    return {
      status: 200,
      payload: {
        audio: { data: buffer.toString("base64"), mimeType: "audio/mpeg" },
        voiceId,
        modelId,
        characters: text.length,
        note: truncated ? `Text was trimmed to ${ELEVENLABS_MAX_CHARS} characters for this voiceover. Split longer scripts into parts.` : "",
      },
    };
  } catch (error) {
    return { status: 502, payload: { error: "Voiceover generation failed", message: error.name === "TimeoutError" ? "ElevenLabs request timed out." : error.message } };
  }
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

async function fetchYouTubeChannel(input = "") {
  if (!configured(YOUTUBE_DATA_API_KEY)) {
    return {
      status: 501,
      payload: {
        error: "YouTube Data API key missing",
        message: "Set YOUTUBE_DATA_API_KEY in .env and restart the server.",
      },
    };
  }

  try {
    const channelId = await resolveYouTubeChannelId(input);
    if (!channelId) {
      return { status: 404, payload: { error: "Channel not found", message: "Use a public channel URL, @handle, or video URL." } };
    }

    const channelData = await youtubeApi("channels", {
      part: "snippet,statistics",
      id: channelId,
      maxResults: "1",
    });
    const item = channelData.items?.[0];
    if (!item) return { status: 404, payload: { error: "Channel not found" } };

    const searchData = await youtubeApi("search", {
      part: "snippet",
      channelId,
      order: "date",
      type: "video",
      maxResults: "12",
    });
    const videoIds = normalizeArray(searchData.items).map((video) => video.id?.videoId).filter(Boolean);
    const videosData = videoIds.length
      ? await youtubeApi("videos", { part: "snippet,statistics,contentDetails", id: videoIds.join(","), maxResults: String(videoIds.length) })
      : { items: [] };

    const videos = normalizeArray(videosData.items).map((video) => ({
      id: video.id,
      title: video.snippet?.title || "",
      description: video.snippet?.description || "",
      publishedAt: video.snippet?.publishedAt || "",
      thumbnail: bestThumbnail(video.snippet?.thumbnails),
      views: Number(video.statistics?.viewCount || 0),
      likes: Number(video.statistics?.likeCount || 0),
      comments: Number(video.statistics?.commentCount || 0),
      duration: video.contentDetails?.duration || "",
    }));

    return {
      status: 200,
      payload: {
        source: "youtube-data-api",
        channel: {
          id: item.id,
          title: item.snippet?.title || "",
          description: item.snippet?.description || "",
          thumbnail: bestThumbnail(item.snippet?.thumbnails),
          subscribers: Number(item.statistics?.subscriberCount || 0),
          views: Number(item.statistics?.viewCount || 0),
          videoCount: Number(item.statistics?.videoCount || 0),
        },
        videos,
        privateAnalyticsNote: "Public YouTube Data API stats are connected. Private watch time, retention, and CTR require Google OAuth credentials.",
      },
    };
  } catch (error) {
    return { status: 502, payload: { error: "YouTube request failed", message: error.message } };
  }
}

async function fetchYouTubeComments(videoId = "") {
  if (!configured(YOUTUBE_DATA_API_KEY)) {
    return { status: 501, payload: { error: "YouTube Data API key missing", message: "Set YOUTUBE_DATA_API_KEY in .env." } };
  }
  if (!videoId) return { status: 400, payload: { error: "videoId is required." } };

  try {
    const data = await youtubeApi("commentThreads", {
      part: "snippet",
      videoId,
      maxResults: "50",
      order: "relevance",
      textFormat: "plainText",
    });
    const comments = normalizeArray(data.items).map((item) => {
      const top = item.snippet?.topLevelComment?.snippet || {};
      const text = top.textDisplay || top.textOriginal || "";
      return {
        id: item.id,
        videoId,
        author: top.authorDisplayName || "Viewer",
        text,
        sentiment: sentimentFor(text),
        importance: importanceFor(text),
        likeCount: Number(top.likeCount || 0),
        publishedAt: top.publishedAt || "",
      };
    });
    return { status: 200, payload: { comments } };
  } catch (error) {
    const message = stripHtml(error.message || "");
    if (/disabled comments|comments.*disabled|has disabled comments/i.test(message)) {
      return {
        status: 409,
        payload: {
          error: "Comments disabled",
          commentsDisabled: true,
          message: "Comments are disabled for this video. Choose another video.",
        },
      };
    }
    return { status: 502, payload: { error: "Could not fetch comments", message } };
  }
}

async function resolveYouTubeChannelId(input = "") {
  const clean = String(input).trim();
  const channelId = extractChannelId(clean);
  if (channelId) return channelId;

  const videoId = extractVideoId(clean);
  if (videoId) {
    const data = await youtubeApi("videos", { part: "snippet", id: videoId, maxResults: "1" });
    return data.items?.[0]?.snippet?.channelId || "";
  }

  const handle = extractHandle(clean);
  if (handle) {
    try {
      const direct = await youtubeApi("channels", { part: "id", forHandle: handle.replace(/^@/, ""), maxResults: "1" });
      if (direct.items?.[0]?.id) return direct.items[0].id;
    } catch {
      // Fall through to search; forHandle is not available in every project/API version.
    }
  }

  const q = handle || clean.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const search = await youtubeApi("search", { part: "snippet", q, type: "channel", maxResults: "1" });
  return search.items?.[0]?.snippet?.channelId || "";
}

async function fetchYouTubeContext(input = "") {
  const videoId = extractVideoId(input);
  if (!videoId || !configured(YOUTUBE_DATA_API_KEY)) return null;
  try {
    const data = await youtubeApi("videos", { part: "snippet", id: videoId, maxResults: "1" });
    const snippet = data.items?.[0]?.snippet || {};
    const captions = await fetchPublicCaptions(videoId);
    return {
      videoId,
      title: snippet.title || "",
      description: snippet.description || "",
      channelTitle: snippet.channelTitle || "",
      transcript: captions,
      note: captions ? "YouTube captions were included when available." : "No public captions were available, so Contentus used video title and description only.",
    };
  } catch (error) {
    return { note: `YouTube context could not be fetched: ${error.message}` };
  }
}

async function fetchPublicCaptions(videoId) {
  try {
    const result = await fetch(`https://video.google.com/timedtext?fmt=json3&lang=en&v=${encodeURIComponent(videoId)}`);
    if (!result.ok) return "";
    const text = await result.text();
    if (!text) return "";
    const data = JSON.parse(text);
    return normalizeArray(data.events)
      .flatMap((event) => normalizeArray(event.segs).map((seg) => seg.utf8 || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 18000);
  } catch {
    return "";
  }
}

async function youtubeApi(resource, params = {}) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
  Object.entries({ ...params, key: YOUTUBE_DATA_API_KEY }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const result = await fetch(url);
  const text = await result.text();
  const data = text ? JSON.parse(text) : {};
  if (!result.ok) {
    throw new Error(data.error?.message || `YouTube API ${result.status}`);
  }
  return data;
}

async function callFeatherlessJson(prompt, options = {}) {
  if (!configured(FEATHERLESS_API_KEY)) {
    throw new ApiError(501, "Featherless API is not configured", "Set FEATHERLESS_API_KEY in .env and restart the server.");
  }
  const mediaPayload = featherlessMessageContent(prompt, options.media);
  const model = mediaPayload.usesImage ? FEATHERLESS_VISION_MODEL : FEATHERLESS_MODEL;

  try {
    const result = await fetch(`${FEATHERLESS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FEATHERLESS_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Return valid JSON only. Do not include markdown fences or explanatory text." },
          { role: "user", content: mediaPayload.content },
        ],
        temperature: options.temperature ?? 0.35,
        max_tokens: options.maxOutputTokens || 8192,
      }),
    });
    const text = await result.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiError(502, "Featherless returned invalid JSON", text.slice(0, 240));
    }
    if (!result.ok) {
      throw new ApiError(result.status, "Featherless request failed", payload.error?.message || `Featherless request failed with ${result.status}`);
    }
    const output = payload.choices?.[0]?.message?.content || "";
    if (!output.trim()) {
      throw new ApiError(502, "Featherless returned no content", "The model response was empty.");
    }
    const parsed = parseJsonOutput(output);
    if (mediaPayload.warning && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...parsed, warning: [parsed.warning, mediaPayload.warning].filter(Boolean).join(" ") };
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Featherless request failed", error.name === "TimeoutError" ? "Featherless request timed out." : error.message);
  }
}

function featherlessMessageContent(prompt, media = null) {
  if (!media?.data || !media?.mimeType) {
    return { content: prompt, usesImage: false, warning: "" };
  }

  if (/^image\//i.test(media.mimeType)) {
    return {
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.data}` } },
      ],
      usesImage: true,
      warning: "",
    };
  }

  const metadata = [
    `Uploaded media name: ${media.name || "unnamed"}`,
    `Uploaded media type: ${media.mimeType}`,
    media.truncated ? "Uploaded media was trimmed before analysis." : "",
  ].filter(Boolean).join("\n");

  return {
    content: `${prompt}\n\n${metadata}\n\nThe configured Featherless chat route cannot directly inspect this non-image binary. Be transparent about that limitation and rely only on provided text, URL context, and metadata.`,
    usesImage: false,
    warning: "Featherless skipped direct non-image media inspection; add transcript text for better analysis.",
  };
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    const match = output.match(/```(?:json)?\s*([\s\S]*?)```/) || output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) {
      throw new ApiError(502, "Featherless returned invalid JSON", "The model did not return parseable JSON.");
    }
    try {
      return JSON.parse(match[1]);
    } catch {
      throw new ApiError(502, "Featherless returned invalid JSON", "The model returned malformed JSON.");
    }
  }
}

function targetWordsFromLength(label = "") {
  const clean = String(label).toLowerCase();
  const customNumber = Number(clean.match(/\d+/)?.[0] || 0);
  if (clean.includes("second")) return Math.max(55, Math.round(customNumber * 2.4));
  if (clean.includes("minute") || clean.includes("min")) return Math.max(150, customNumber * 145);
  if (clean.includes("8")) return 1160;
  if (clean.includes("5")) return 725;
  if (clean.includes("2")) return 300;
  return 150;
}

function wordCount(text = "") {
  return String(text).split(/\s+/).filter(Boolean).length;
}

function extractVideoId(input = "") {
  const clean = String(input);
  return clean.match(/[?&]v=([^&]+)/)?.[1]
    || clean.match(/youtu\.be\/([^?&/]+)/)?.[1]
    || clean.match(/youtube\.com\/shorts\/([^?&/]+)/)?.[1]
    || "";
}

function extractChannelId(input = "") {
  return String(input).match(/youtube\.com\/channel\/([^?&/]+)/)?.[1] || (String(input).startsWith("UC") ? String(input).trim() : "");
}

function extractHandle(input = "") {
  const clean = String(input).trim();
  return clean.match(/youtube\.com\/(@[^?&/]+)/)?.[1]
    || clean.match(/^@[\w.-]+$/)?.[0]
    || "";
}

function bestThumbnail(thumbnails = {}) {
  return thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function splitTopics(value = "") {
  return String(value).split(/,|\n/).map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

function extractPhrases(samples = "") {
  return String(samples)
    .split(/[.!?\n]/)
    .map((line) => line.trim())
    .filter((line) => line.split(/\s+/).length >= 3 && line.split(/\s+/).length <= 10)
    .slice(0, 6);
}

function extractExampleLines(samples = "") {
  return String(samples)
    .split(/\n|[.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .slice(0, 6);
}

function sentimentFor(text = "") {
  const clean = text.toLowerCase();
  if (/hate|trash|stupid|idiot|kill|ugly|harass/.test(clean)) return "toxic";
  if (/\?|how|can you|please|tutorial|show/.test(clean)) return "asking questions";
  if (/love|thanks|helped|great|amazing|excited/.test(clean)) return "positive";
  if (/wrong|copied|bad|boring|fake/.test(clean)) return "critical";
  return "neutral";
}

function importanceFor(text = "") {
  const clean = text.toLowerCase();
  if (/\?|tutorial|show|exact|prompt|part 2|video/.test(clean)) return "high";
  if (/hate|trash|wrong|copied/.test(clean)) return "medium";
  return "normal";
}

function stripHtml(value = "") {
  return String(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
    const migrated = await migrateMetadataWorkspaceState(result.payload);
    const payload = migrated || result.payload;
    payload.user = sanitizeUser(payload.user);
    return { status: result.status, payload };
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
    const migrated = await migrateMetadataWorkspaceState(result.payload);
    const payload = migrated || result.payload;
    payload.user = sanitizeUser(payload.user);
    return { status: result.status, payload };
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

async function supabaseUserRaw(token) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  return supabaseFetch("/user", {
    method: "GET",
    headers: authHeaders(token),
  });
}

async function supabaseUpdateUserState(token, contentusState) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  if (!contentusState) return { status: 400, payload: { error: "contentusState is required." } };

  const user = await supabaseUserRaw(token);
  if (user.status >= 400) return user;
  const savedAt = new Date().toISOString();
  await saveWorkspaceState(user.payload.id, { ...contentusState, contentus_saved_at: savedAt });
  return {
    status: 200,
    payload: {
      ok: true,
      user: sanitizeUser(user.payload),
      savedAt,
    },
  };
}

async function supabaseUpdateUserMetadata(token, data = {}) {
  if (!token) return { status: 401, payload: { error: "Missing access token." } };
  const result = await supabaseFetch("/user", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ data }),
  });
  if (result.status < 400) {
    return { status: result.status, payload: { ok: true, user: sanitizeUser(result.payload) } };
  }
  return result;
}

async function migrateMetadataWorkspaceState(sessionPayload = {}) {
  const user = sessionPayload.user;
  const metadata = user?.user_metadata || {};
  if (!user?.id || !metadata.contentus_state) return null;

  await saveWorkspaceState(user.id, {
    ...metadata.contentus_state,
    contentus_saved_at: metadata.contentus_saved_at || new Date().toISOString(),
  });

  const clearResult = await supabaseFetch("/user", {
    method: "PUT",
    headers: authHeaders(sessionPayload.access_token),
    body: JSON.stringify({
      data: {
        contentus_state: null,
        contentus_saved_at: null,
      },
    }),
  });

  if (clearResult.status >= 400 || !sessionPayload.refresh_token) {
    const cleanedUser = {
      ...user,
      user_metadata: {
        ...metadata,
        contentus_state: undefined,
        contentus_saved_at: undefined,
      },
    };
    return { ...sessionPayload, user: cleanedUser };
  }

  const refreshed = await supabaseFetch("/token?grant_type=refresh_token", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: sessionPayload.refresh_token }),
  });

  if (refreshed.status < 400 && refreshed.payload.user) return refreshed.payload;
  return { ...sessionPayload, user: clearResult.payload || user };
}

async function readWorkspaceStore() {
  try {
    return JSON.parse(await readFile(WORKSPACE_STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeWorkspaceStore(store) {
  await mkdir(WORKSPACE_STATE_DIR, { recursive: true });
  await writeFile(WORKSPACE_STATE_FILE, JSON.stringify(store, null, 2));
}

async function saveWorkspaceState(userId, contentusState) {
  if (!userId) return;
  const store = await readWorkspaceStore();
  store[userId] = {
    contentusState,
    savedAt: new Date().toISOString(),
  };
  await writeWorkspaceStore(store);
}

async function loadWorkspaceState(userId) {
  if (!userId) return null;
  const store = await readWorkspaceStore();
  return store[userId]?.contentusState || null;
}

function sanitizeUser(user = {}) {
  const metadata = { ...(user.user_metadata || {}) };
  if (metadata.google_oauth) metadata.google_oauth = googlePublicState(metadata.google_oauth);
  delete metadata.contentus_state;
  delete metadata.contentus_saved_at;
  return {
    id: user.id,
    email: user.email,
    aud: user.aud,
    role: user.role,
    created_at: user.created_at,
    confirmed_at: user.confirmed_at,
    last_sign_in_at: user.last_sign_in_at,
    user_metadata: metadata,
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
