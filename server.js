import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = normalizeSupabaseProjectUrl(trimEnv("SUPABASE_URL"));
const SUPABASE_ANON_KEY = trimEnv("SUPABASE_ANON_KEY");
const GEMINI_API_KEY = trimEnv("GEMINI_API_KEY");
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
    sendJson(response, 500, { error: "Internal server error", message: error.message, detail: error.message });
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
      aiProvider: integrationStatus().gemini ? "gemini" : "not-configured",
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

  if (url.pathname.startsWith("/api/ai/") && !configured(GEMINI_API_KEY)) {
    sendJson(response, 501, {
      error: "Gemini API key missing",
      message: "Set GEMINI_API_KEY in .env and Render. Contentus does not generate fake AI output when Gemini is not configured.",
    });
    return;
  }

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

  if (request.method === "POST" && url.pathname === "/api/ai/trends") {
    const result = await analyzeTrendsWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/script") {
    const script = await generateScriptWithAi(body);
    sendJson(response, 200, script);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/credibility") {
    const result = await checkScriptCredibility(body);
    sendJson(response, 200, result);
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

  if (request.method === "POST" && url.pathname === "/api/ai/thumbnail-design") {
    const design = await generateThumbnailDesign(body);
    sendJson(response, 200, design);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/authenticity") {
    const result = await scoreAuthenticityWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/video-checker") {
    const result = await analyzeVideoWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/video-detail") {
    const result = await detailedVideoAnalysisWithAi(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/community-replies") {
    const result = await generateCommunityReplies(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/publish-pack") {
    const result = await generatePublishPack(body);
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/ai/coach") {
    const result = await generateCoachReply(body);
    sendJson(response, 200, result);
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
  if (scopeKey === "upload" || scopeKey === "publisher" || scopeKey === "all") capabilities.upload = true;
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
  if (scopeKey === "upload" || scopeKey === "publisher" || scopeKey === "all") scopes.add("https://www.googleapis.com/auth/youtube.upload");
  return [...scopes];
}

function googleRedirectUri(request) {
  return configured(GOOGLE_REDIRECT_URI)
    ? GOOGLE_REDIRECT_URI
    : `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host}/api/google/oauth/callback`;
}

function requireGoogleOAuthConfig(request) {
  if (integrationStatus().googleOAuth) return null;
  return {
    status: 501,
    payload: {
      error: "Google OAuth is not configured",
      message: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and SESSION_SECRET in .env and Render.",
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
    youtubeUpload: Boolean(stored.capabilities?.upload),
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
  const result = await callGeminiJson(prompt, {
    media: body.media,
    temperature: 0.25,
  });
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
      "personalizationTip": string,
      "cta": string,
      "disclosure": string
    }
  ]
}

Inputs:
${JSON.stringify(body, null, 2)}

Rules: no copying, no fake trend claims, no spam growth tactics, include a real personalization tip for every idea.
`;
  const result = await callGeminiJson(prompt, { temperature: 0.55 });
  const ideas = normalizeArray(result.ideas);
  if (!ideas.length) throw new Error("Gemini did not return any ideas. Try adding more topic or audience context.");
  return ideas;
}

async function analyzeTrendsWithAi(body = {}) {
  const youtubeTrends = /youtube/i.test(body.platform || "") ? await fetchYouTubeTrendingVideos(body.niche || "") : [];
  const prompt = `
Return only JSON:
{
  "platform": string,
  "verdict": string,
  "hitScore": number,
  "momentumScore": number,
  "hitOrMiss": string,
  "whyNow": string,
  "creatorAngle": string,
  "copyRisk": string,
  "audioOpportunity": string,
  "topics": string[],
  "audioSignals": string[],
  "angles": string[]
}

Analyze whether this creator idea fits current platform direction. Encourage originality, not copying.
Platform/niche/idea:
${JSON.stringify(body, null, 2)}

YouTube trending/reference data when available:
${JSON.stringify(youtubeTrends, null, 2)}

For TikTok/Instagram, do not pretend to have private platform trend access. Provide a creator-safe trend brief from the user context and say what must be checked manually.
`;
  return callGeminiJson(prompt, { temperature: 0.42 });
}

async function generateScriptWithAi(body = {}) {
  const lengthLabel = String(body.length || body.existingScript?.lengthLabel || "60 seconds");
  const targetWords = targetWordsFromLength(lengthLabel);
  const prompt = `
You are Contentus Script Builder. Return only JSON. Write a real script the creator can speak on camera.

Input:
${JSON.stringify(body, null, 2)}

Target duration: ${lengthLabel}
Target word count: about ${targetWords} spoken words. A 30 second script must be short. An 8 minute script must be much longer and more developed.

Return this JSON:
{
  "title": string,
  "logline": string,
  "targetLength": string,
  "authenticityScore": number,
  "genericRisk": "Low" | "Medium" | "High",
  "personalizationTip": string,
  "disclosure": string,
  "hookOptions": string[],
  "coldOpen": string,
  "intro": string,
  "beats": [
    {
      "time": string,
      "title": string,
      "intent": string,
      "spokenLines": string,
      "visual": string
    }
  ],
  "outro": string,
  "script": string,
  "visualNotes": string[],
  "shotList": string[],
  "broll": string[],
  "onScreenText": string[],
  "credibilityNotes": string[],
  "caption": string,
  "hashtags": string[],
  "endingOptions": string[]
}

Rules:
- Write in first person as the creator speaking. No "I want to test [title]" templated slop.
- The script must have exact words to say, not vague directions.
- Include a clear point of view, a grounded setup, evidence/proof moments, and a specific ending.
- If the idea involves children, health, safety, money, or claims, add credibility notes and avoid overclaiming.
- Infer CTA, humor, and personal story from Creator DNA. Do not use separate toggles.
- Avoid generic AI filler, inflated claims, and repetitive paragraphs.
`;
  let result = await callGeminiJson(prompt, { temperature: 0.45 });
  if (wordCount(result.script || "") < Math.round(targetWords * 0.45)) {
    result = await callGeminiJson(`${prompt}

The previous script was too short for ${lengthLabel}. Regenerate with about ${targetWords} spoken words and keep the same JSON shape.`, {
      temperature: 0.42,
      maxOutputTokens: 8192,
    });
  }
  const script = { ...result, targetLength: result.targetLength || lengthLabel };
  if (!normalizeArray(script.beats).length && normalizeArray(script.scenes).length) {
    script.beats = normalizeArray(script.scenes).map((scene, index) => ({ time: `Beat ${index + 1}`, title: `Section ${index + 1}`, spokenLines: String(scene), visual: "" }));
  }
  if (wordCount(script.script || "") < Math.round(targetWords * 0.45)) throw new Error("Gemini returned a script that was too short for the requested length. Try again or add more brief details.");
  return script;
}

async function checkScriptCredibility(body = {}) {
  const prompt = `
Return only JSON:
{
  "score": number,
  "verdict": string,
  "claimRisk": string,
  "trustScore": number,
  "originality": number,
  "suggestions": [{"title":string,"reason":string,"implementation":string}]
}

Check this creator script for credibility, overclaims, vague proof, copy risk, unsafe advice, and missing source/experience moments.
Script:
${JSON.stringify(body.script || {}, null, 2)}

Creator DNA:
${JSON.stringify(body.dna || {}, null, 2)}

Be practical and creator-friendly. Do not sound legal-heavy.
`;
  return callGeminiJson(prompt, { temperature: 0.25 });
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

Rules: flag unsafe claims, avoid deepfake/likeness misuse, include an AI disclosure line if AI assisted.
`;
  const result = await callGeminiJson(prompt, { temperature: 0.5 });
  if (!normalizeArray(result.versions).length) throw new Error("Gemini did not return ad/film versions.");
  return result;
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
  const result = await callGeminiJson(prompt, { temperature: 0.35, maxOutputTokens: 350 });
  const suggestions = normalizeArray(result.suggestions);
  if (!suggestions.length) throw new Error(`Gemini did not return thumbnail text suggestions for "${title}".`);
  return suggestions;
}

async function generateThumbnailDesign(body = {}) {
  const prompt = `
Return only JSON:
{
  "title": string,
  "mainText": string,
  "supportText": string,
  "palette": string,
  "textSize": number,
  "textWeight": string,
  "textBox": {"x":number,"y":number,"w":number,"lineHeight":number},
  "focalBox": {"x":number,"y":number,"w":number,"h":number},
  "rationale": string
}

Create a YouTube thumbnail layout plan for a canvas renderer. Keep text short and readable. Do not imitate any specific brand.
Input:
${JSON.stringify(body, null, 2)}

If a selection box is provided, focus the requested update on that region. No fake claims or misleading shock text.
`;
  const design = await callGeminiJson(prompt, { temperature: 0.38, maxOutputTokens: 900 });
  const image = await callGeminiImage(thumbnailImagePrompt(body, design));
  return { ...design, ...image, imageGeneratedBy: "gemini" };
}

function thumbnailImagePrompt(body = {}, design = {}) {
  return `
Create a 16:9 YouTube thumbnail image for this creator concept.

Main text to include exactly: ${design.mainText || body.mainText || body.idea?.title || "Untitled"}
Support text: ${design.supportText || ""}
Idea: ${JSON.stringify(body.idea || {})}
Creator brief: ${body.brief || ""}

Style requirements:
- premium dark creator-tech thumbnail
- high contrast, readable text, one clear focal subject
- energetic but not misleading
- no fake logos, no copyrighted characters, no real celebrity likeness unless uploaded by user
- do not imitate any provided reference image exactly
- no extra random words beyond the requested main/support text
`;
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
  return callGeminiJson(prompt, { temperature: 0.25 });
}

async function analyzeVideoWithAi(body = {}) {
  const youtubeContext = body.youtubeUrl ? await fetchYouTubeContext(body.youtubeUrl) : null;
  const prompt = `
Return only JSON:
{
  "title": string,
  "totalScore": number,
  "audioScore": number,
  "visualScore": number,
  "titleScore": number,
  "thumbnailScore": number,
  "pacingScore": number,
  "targetAudience": string,
  "summary": string,
  "working": string[],
  "improvements": string[],
  "audienceFit": string,
  "editChecklist": string[]
}

Analyze this creator video in simple, readable language. Score audio quality, visuals, title, thumbnail, pacing, and target audience.
Input/context:
${JSON.stringify({ context: body.context, youtubeContext }, null, 2)}
`;
  return callGeminiJson(prompt, { media: body.media, temperature: 0.32, maxOutputTokens: 2200 });
}

async function detailedVideoAnalysisWithAi(body = {}) {
  const prompt = `
Return only JSON:
{
  "verdict": string,
  "graphs": [{"label":string,"value":number}],
  "improvements": string[],
  "followUps": string[],
  "titleSuggestions": string[],
  "thumbnailText": string[]
}

Create a detailed but readable growth diagnosis for this YouTube video using public stats and comments.
${JSON.stringify(body, null, 2)}
`;
  return callGeminiJson(prompt, { temperature: 0.34, maxOutputTokens: 1600 });
}

async function generateCommunityReplies(body = {}) {
  const comments = normalizeArray(body.comments).slice(0, 40);
  const prompt = `
You are Contentus Community Manager. Return only JSON:
{"comments":[{"id":string,"author":string,"text":string,"sentiment":string,"importance":string,"suggestedReply":string,"videoIdea":string}]}

Creator:
${JSON.stringify(body.creator || {}, null, 2)}
Creator DNA:
${JSON.stringify(body.dna || {}, null, 2)}
Comments:
${JSON.stringify(comments, null, 2)}

Rules: draft replies only. Do not claim replies are posted. Write like a real creator, not a support bot. Keep replies under 22 words unless the viewer asked a specific question. No heavy disclaimers unless safety requires it.
`;
  const result = await callGeminiJson(prompt, { temperature: 0.4 });
  const drafted = normalizeArray(result.comments);
  if (!drafted.length && comments.length) throw new Error("Gemini did not return reply drafts.");
  return { comments: drafted };
}

async function generatePublishPack(body = {}) {
  const prompt = `
Return only JSON:
{"title":string,"platforms":[{"name":string,"title":string,"caption":string,"description":string,"hashtags":string[],"notes":string}],"agentNotes":string[]}

Create platform-specific publishing copy from one source video. Preserve Creator DNA. Do not claim direct posting to TikTok/Instagram unless API credentials exist.
${JSON.stringify(body, null, 2)}
`;
  return callGeminiJson(prompt, { temperature: 0.42, maxOutputTokens: 1800 });
}

async function generateCoachReply(body = {}) {
  const prompt = `
Return only JSON: {"reply":string}
You are Contentus Channel Coach. Give concrete, honest, creator-friendly strategy advice.
Use the creator's saved DNA, ideas, scripts, and YouTube public data. Avoid generic motivational fluff.
${JSON.stringify(body, null, 2)}
`;
  return callGeminiJson(prompt, { temperature: 0.45, maxOutputTokens: 1400 });
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

async function fetchYouTubeTrendingVideos(niche = "") {
  if (!configured(YOUTUBE_DATA_API_KEY)) return [];
  try {
    const data = await youtubeApi("videos", {
      part: "snippet,statistics",
      chart: "mostPopular",
      regionCode: process.env.YOUTUBE_REGION_CODE || "US",
      maxResults: "12",
    });
    const words = String(niche || "").toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    return normalizeArray(data.items)
      .map((video) => ({
        title: video.snippet?.title || "",
        channelTitle: video.snippet?.channelTitle || "",
        views: Number(video.statistics?.viewCount || 0),
        likes: Number(video.statistics?.likeCount || 0),
        comments: Number(video.statistics?.commentCount || 0),
        publishedAt: video.snippet?.publishedAt || "",
      }))
      .filter((video) => !words.length || words.some((word) => `${video.title} ${video.channelTitle}`.toLowerCase().includes(word)))
      .slice(0, 8);
  } catch {
    return [];
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

async function callGeminiJson(prompt, options = {}) {
  if (!configured(GEMINI_API_KEY)) throw new Error("Gemini API key is missing. Set GEMINI_API_KEY in .env and restart the server.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts = [{ text: prompt }];
  if (options.media?.data && options.media?.mimeType) {
    parts.push({
      inline_data: {
        mime_type: options.media.mimeType,
        data: options.media.data,
      },
    });
  }

  try {
    const result = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: options.temperature ?? 0.35,
          maxOutputTokens: options.maxOutputTokens || 8192,
          responseMimeType: "application/json",
        },
      }),
    });
    const text = await result.text();
    const payload = parseMaybeJson(text);
    if (!result.ok) {
      throw new Error(payload.error?.message || `Gemini request failed with ${result.status}`);
    }
    const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    const parsed = parseJsonOutput(output);
    if (!parsed) throw new Error("Gemini did not return valid JSON. Try again with a more specific prompt.");
    return parsed;
  } catch (error) {
    throw new Error(error.message || "Gemini request failed.");
  }
}

async function callGeminiImage(prompt, options = {}) {
  if (!configured(GEMINI_API_KEY)) throw new Error("Gemini API key is missing. Set GEMINI_API_KEY in .env and restart the server.");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  try {
    const result = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: prompt }],
        response_format: {
          type: "image",
          mime_type: options.mimeType || "image/png",
          aspect_ratio: options.aspectRatio || "16:9",
          image_size: options.imageSize || "1K",
        },
      }),
    });
    const text = await result.text();
    const payload = parseMaybeJson(text);
    if (!result.ok) throw new Error(payload.error?.message || `Gemini image request failed with ${result.status}`);
    const directImage = payload.output_image || payload.outputImage;
    if (directImage?.data) {
      return {
        imageData: directImage.data,
        imageMimeType: directImage.mime_type || directImage.mimeType || "image/png",
      };
    }
    const outputBlocks = normalizeArray(payload.output || payload.outputs || payload.response);
    const imageBlock = outputBlocks.find((block) => (block.type === "image" || block.mime_type || block.mimeType) && block.data);
    if (imageBlock?.data) {
      return {
        imageData: imageBlock.data,
        imageMimeType: imageBlock.mime_type || imageBlock.mimeType || "image/png",
      };
    }
    throw new Error(`Gemini image model "${model}" did not return image data. Set GEMINI_IMAGE_MODEL to an image-capable Gemini model such as gemini-3.1-flash-image.`);
  } catch (error) {
    throw new Error(error.message || "Gemini image generation failed.");
  }
}

function parseMaybeJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function parseJsonOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    const match = output.match(/```(?:json)?\s*([\s\S]*?)```/) || output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) return null;
    try {
      return JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
}

function fallbackDna(body = {}, youtubeContext = null, mediaNote = "") {
  const creator = body.creator || {};
  const samples = `${body.samples || ""} ${youtubeContext?.transcript || ""} ${youtubeContext?.title || ""}`.toLowerCase();
  const hasPersonal = /\bi\b|\bmy\b|\bwe\b|story|honest|real/.test(samples);
  const hasHumor = /funny|joke|chaos|roast|lol|sarcastic/.test(samples);
  const tones = normalizeArray(creator.tone);
  return {
    score: body.samples || body.media || youtubeContext ? (hasPersonal ? 84 : 72) : 45,
    tone: tones.length ? `${tones.join(", ")} with creator-specific clarity.` : "Not enough samples yet. Add more real content to sharpen tone.",
    humor: hasHumor ? "Self-aware and conversational." : "Not enough humor evidence yet.",
    phrases: extractPhrases(body.samples || ""),
    story: hasPersonal ? "Leads with a real situation, then turns it into a practical takeaway." : "Needs more real examples to infer storytelling style.",
    visual: "Infer from uploaded video, YouTube context, and creator notes when available.",
    themes: splitTopics(creator.topicsLoved || creator.niche || ""),
    audienceType: creator.audience || "Audience not defined yet.",
    editingPace: "Use the creator's platform and samples to choose pacing.",
    hookStyle: "Specific problem or experiment, then fast proof.",
    language: "Clear, direct, and human.",
    emotional: "Supportive and honest.",
    avoid: creator.topicsAvoided || "Generic AI filler, copying, unsafe claims, and undisclosed synthetic media.",
    examplesLike: extractExampleLines(body.samples || "").slice(0, 3),
    examplesUnlike: ["Unlock limitless success today.", "This revolutionary hack guarantees growth.", "Effortlessly transform your life forever."],
    brandValues: creator.values || "",
    mediaNote,
  };
}

function fallbackTrendReport(body = {}, youtubeTrends = []) {
  const hasIdea = Boolean(body.idea);
  const trendTitles = youtubeTrends.map((item) => item.title).filter(Boolean);
  return {
    platform: body.platform || "Platform",
    verdict: hasIdea ? "Promising if you add a sharper personal angle" : "Trend brief ready",
    hitScore: hasIdea ? 72 : 64,
    momentumScore: youtubeTrends.length ? 78 : 58,
    hitOrMiss: hasIdea ? "Lean hit, but only if the idea has proof, a clear stance, and a non-copycat hook." : "Add an idea to get a hit-or-miss score.",
    whyNow: youtubeTrends.length ? "Recent popular videos show attention around adjacent topics." : "Live trend access is limited for this platform, so verify inside the platform before publishing.",
    creatorAngle: "Use the trend as context, then lead with your own test, story, evidence, or opinion.",
    copyRisk: "Medium",
    audioOpportunity: /short|tiktok|reel/i.test(body.platform || "") ? "Check native app trending audio before posting." : "Audio matters less than title, intro, and retention for long-form.",
    topics: trendTitles.length ? trendTitles : [body.niche || "Creator niche", "Audience pain point", "Proof-based experiment"],
    audioSignals: ["Use native platform audio only when it supports the idea.", "Avoid copying a trend beat-for-beat.", "Prioritize clarity over noise."],
    angles: [
      `Test ${body.idea || body.niche || "the trend"} with a real example.`,
      "Compare the common take with your actual experience.",
      "Turn the trend into a useful checklist for your audience.",
    ],
  };
}

function fallbackIdeas(body = {}) {
  const topic = body.topic || "creator workflow";
  const platform = body.platform || "YouTube";
  const type = body.contentType || "content";
  return [
    {
      title: `I Tested ${topic} With My Real Workflow`,
      hook: `I tried ${topic} for my actual content process, and the useful part was not what I expected.`,
      concept: "A real creator experiment that shows the messy baseline, the test, and the practical result.",
      why: "It gives the audience proof instead of generic advice.",
      platform,
      platformFit: `${platform} works because the idea has a clear before/after arc.`,
      contentType: type,
      emotional: "Curiosity plus useful honesty.",
      shortFormVersion: "Show the problem, one surprising result, and one takeaway.",
      longFormVersion: "Document the full process, mistakes, results, and next system.",
      genericRisk: "Low",
      authenticityScore: 84,
      personalizationTip: "Add one screenshot, old draft, calendar, voice note, or behind-the-scenes proof from your own process.",
      cta: "Ask viewers what they want you to test next.",
      disclosure: "Brainstormed with AI, written and edited by me.",
    },
    {
      title: `The ${topic} Mistake That Makes Content Sound Generic`,
      hook: "This looks productive, but it is exactly why the draft stops sounding like you.",
      concept: "Break down one common creator mistake and rewrite it using the creator's real style.",
      why: "It helps the audience improve without copying someone else's voice.",
      platform,
      platformFit: "Strong for education, commentary, and creator trust.",
      contentType: type,
      emotional: "Tough love with a fix.",
      shortFormVersion: "Show a bad line, a better line, and the reason.",
      longFormVersion: "Analyze multiple examples and build a reusable checklist.",
      genericRisk: "Medium",
      authenticityScore: 79,
      personalizationTip: "Use a sentence you actually rejected and explain why.",
      cta: "Invite people to paste a line they want rewritten.",
      disclosure: "AI-assisted if Contentus helped rewrite.",
    },
  ];
}

function fallbackScript(body = {}, targetWords = 150) {
  const idea = body.idea?.title || body.idea || body.existingScript?.title || "Creator idea";
  const format = body.format || body.existingScript?.format || "talking head";
  const subject = String(idea).replace(/^I Tested\s+/i, "").trim();
  const beats = buildFallbackScriptBeats(subject, targetWords, body);
  const script = beats.map((beat) => beat.spokenLines).join("\n\n");
  return {
    title: idea,
    logline: `A ${format} script with a clear stance, proof moments, and exact spoken lines.`,
    targetLength: body.length || "60 seconds",
    authenticityScore: 82,
    genericRisk: "Low",
    personalizationTip: "Add a real screenshot, failed take, comment, or personal example before publishing.",
    disclosure: "AI-assisted draft. Final story and edits should be reviewed by the creator.",
    hookOptions: [
      `I tested ${idea}, and the first result exposed the real problem.`,
      "This sounded like a good idea until I tried it in my actual workflow.",
      "I wanted faster content, but I did not want to sound like everyone else.",
    ],
    coldOpen: beats[0]?.spokenLines || "",
    intro: beats[1]?.spokenLines || "",
    beats: beats.slice(2, -1),
    outro: beats.at(-1)?.spokenLines || "",
    script,
    scenes: beats.map((beat) => beat.title),
    voiceover: "Keep the voice direct, specific, and rooted in the creator's own proof.",
    visualNotes: beats.map((beat) => beat.visual),
    shotList: ["Creator on camera", "Proof artifact", "Screen recording", "Before/after line", "Final takeaway"],
    broll: ["Notes app", "Timeline or calendar", "Draft comparison", "Audience comment", "Publishing checklist"],
    onScreenText: ["The problem", "The test", "The result", "Make it yours"],
    credibilityNotes: ["Verify any safety, health, child-development, or performance claims before publishing.", "Separate personal opinion from factual claim."],
    caption: `${idea}. Created with Creator DNA and checked for generic risk.`,
    hashtags: ["#creatorworkflow", "#contentstrategy", "#aicreator"],
    endingOptions: ["Want the exact workflow?", "Which version sounds more human?", "Send me the next idea to test."],
  };
}

function buildFallbackScriptBeats(subject, targetWords, body = {}) {
  const audience = body.audience || "your audience";
  const base = [
    {
      time: "0:00",
      title: "Cold open",
      intent: "Make the viewer instantly understand the tension.",
      spokenLines: `Some videos look harmless until you ask what they are teaching people to repeat. Today I am looking at ${subject}, not to panic, but to figure out what is actually going on and what parents, creators, or viewers should pay attention to.`,
      visual: "Open on the creator speaking directly, then cut to blurred/example-safe context.",
    },
    {
      time: "0:12",
      title: "Setup",
      intent: "Explain the question without overclaiming.",
      spokenLines: `The question is not "is this automatically bad?" That is too lazy. The better question is: what does this content reward, who is it aimed at, and does the joke stop being funny when kids start copying it?`,
      visual: "Show a simple three-question checklist on screen.",
    },
    {
      time: "0:35",
      title: "What I checked",
      intent: "Give structure and credibility.",
      spokenLines: `I am checking three things: the language, the behavior the game rewards, and how easy it is for a younger viewer to misunderstand the point. I am also separating my opinion from facts, because this topic gets messy fast.`,
      visual: "Checklist fills in: language, rewarded behavior, kid interpretation.",
    },
    {
      time: "1:10",
      title: "The useful middle",
      intent: "Provide the core argument.",
      spokenLines: `The biggest issue is usually not one scary clip. It is repetition. If a kid sees the same joke, the same insult, or the same chaotic reward loop again and again, it can start to feel normal. That does not mean every player is harmed. It means adults should look at patterns, not just labels.`,
      visual: "Show pattern/repetition graphic, not sensational footage.",
    },
    {
      time: "2:00",
      title: "Balanced takeaway",
      intent: "Stay trustworthy.",
      spokenLines: `So my take is this: do not treat every weird Roblox trend like an emergency, but also do not ignore it because it is "just a game." Watch a few minutes, listen to the words, check the comments, and ask whether the joke is something you would be okay hearing offline.`,
      visual: "Creator on camera with calm pacing.",
    },
    {
      time: "Final",
      title: "Ending",
      intent: "Give a clear CTA.",
      spokenLines: `If you want, send me one game or trend you are unsure about, and I will break it down using this same checklist. Not fear, not hype, just a clear look at what the content is actually doing.`,
      visual: "End card with the checklist and comment prompt.",
    },
  ];
  if (targetWords <= 160) return [base[0], base[2], base[4], base[5]];
  if (targetWords <= 360) return base;
  const expanded = [...base];
  while (expanded.map((beat) => beat.spokenLines).join(" ").split(/\s+/).length < targetWords) {
    expanded.splice(-1, 0, {
      time: "Deep dive",
      title: "Example lens",
      intent: "Add detail without inventing facts.",
      spokenLines: `For ${audience}, the practical move is to pause before reacting. Ask: is the content asking for skill, creativity, social pressure, or shock? Those are very different signals. A game can be chaotic and still be fine, but when the main reward is humiliating someone, repeating a phrase, or chasing a harmful stereotype, that deserves a closer look.`,
      visual: "Show the four signal words as clean labels.",
    });
  }
  return expanded;
}

function fallbackCredibility(script = {}) {
  return {
    score: 78,
    verdict: "Mostly usable, needs clearer proof",
    claimRisk: /children|health|money|safety|bad for/i.test(JSON.stringify(script)) ? "Medium-high" : "Medium",
    trustScore: 76,
    originality: 82,
    suggestions: [
      { title: "Separate opinion from fact", reason: "The audience should know what is your take versus verified evidence.", implementation: "Add a line that says: this is my read from the examples I checked, not a medical or safety claim." },
      { title: "Add proof moment", reason: "A concrete example makes the script less generic.", implementation: "Add one real example, screenshot, viewer comment, or clip description before the main takeaway." },
      { title: "Soften overclaims", reason: "Avoid saying something is definitely harmful unless you cite a source.", implementation: "Replace absolute claims with pattern-based language like 'can normalize' or 'is worth checking'." },
    ],
  };
}

function expandScriptLocally(seed, targetWords, body = {}) {
  const idea = body.idea?.title || body.idea || "this idea";
  const beats = [
    seed,
    `Here is the honest setup: ${idea} sounds simple when it is just a note, but content gets harder when it has to fit a real audience, a real platform, and a voice people recognize.`,
    "So first I am showing the messy version. This is the part most polished tutorials skip, but it is the part that makes the result believable.",
    "Next I am turning that mess into a structure: hook, proof, useful middle, personal detail, and a clear ending. The goal is not to make it perfect. The goal is to make it sound like a person with a point of view.",
    "Now I am checking the draft for generic language. If a line sounds like it could belong to anyone, I rewrite it with a detail only this creator would say.",
    "The useful lesson is that speed only matters when the output still carries your taste. Faster generic content is still generic content.",
    "So the next step is simple: use this as a starting point, add your own proof, remove inflated claims, and publish the version your audience can trust.",
  ];
  const words = [];
  while (words.length < targetWords) {
    for (const beat of beats) {
      words.push(...beat.split(/\s+/));
      if (words.length >= targetWords) break;
    }
  }
  return words.slice(0, targetWords).join(" ");
}

function fallbackAdProject(body = {}) {
  const idea = body.idea || "creator product";
  return {
    title: `${body.projectType || "Ad"} for ${idea}`.slice(0, 120),
    concept: `A creator-led concept that makes ${idea} feel useful without exaggerated claims.`,
    script: `Open on the real creator problem. Show the product or story in use. Admit the honest limitation. End with a simple CTA: ${body.cta || "try it if it fits your workflow"}.`,
    sceneList: ["Problem", "Real use", "Proof", "Honest limitation", "CTA"],
    shotList: ["Creator close-up", "Product/action shot", "Result shot", "Caption overlay", "CTA end card"],
    storyboard: ["Hook frame", "Context frame", "Action frame", "Result frame", "CTA frame"],
    voiceover: "Direct, specific, and non-hype.",
    dialogue: ["I wanted this to solve a real problem, not just look good on camera."],
    musicMood: body.mood || "clean and focused",
    visualPrompts: [`Creator studio scene for ${idea}, premium but practical, no fake claims.`],
    caption: `${idea} concept built with Creator DNA and checked for authenticity.`,
    thumbnailText: "Real Test",
    platformVersions: [`${body.platform || "YouTube"} version`, "Short-form cut", "Caption-first version"],
    disclosure: "AI-assisted concept, written and edited by the creator.",
    recommendedVersion: "Cinematic version",
    versions: ["Emotional version", "Funny version", "Cinematic version"].map((name, index) => ({
      name,
      concept: `${name} of ${idea}`,
      script: index === 1 ? "Make the generic version the joke, then show the real creator version." : "Show the problem, proof, and honest CTA.",
      bestForPlatform: body.platform || "YouTube",
      audienceFit: body.audience || "Creator audience",
      authenticityScore: 82 + index * 3,
      viralPotential: index === 1 ? "Medium-high" : "Medium",
      riskLevel: "Low",
      recommended: index === 2,
    })),
  };
}

function fallbackThumbnailCopy(title) {
  const clean = String(title || "Creator Idea").replace(/[^\w\s]/g, "").trim();
  return [
    { text: clean.slice(0, 32) || "I Tested This", reason: "Specific and direct." },
    { text: "AI Exposed This", reason: "Curiosity without a false claim." },
    { text: "Before vs After", reason: "Easy to understand visually." },
  ];
}

function fallbackThumbnailDesign(body = {}) {
  const main = String(body.mainText || body.idea?.title || "BIG IDEA").split(/\s+/).slice(0, 5).join(" ");
  return {
    title: main,
    mainText: main,
    supportText: body.brief ? "REAL TAKE" : "",
    palette: "white teal charcoal",
    textSize: main.length > 22 ? 72 : 94,
    textWeight: "900",
    textBox: { x: 76, y: 150, w: 690, lineHeight: main.length > 22 ? 82 : 100 },
    focalBox: body.selection?.w > 30 ? body.selection : { x: 820, y: 95, w: 340, h: 500 },
    rationale: "Built a high-contrast thumbnail plan with short text, one focal area, and a clear reading path.",
  };
}

function fallbackVideoCheck(body = {}, youtubeContext = null) {
  return {
    title: youtubeContext?.title || "Video analysis",
    totalScore: 74,
    audioScore: body.media ? 72 : 66,
    visualScore: body.media ? 73 : 68,
    titleScore: youtubeContext?.title ? 78 : 70,
    thumbnailScore: 70,
    pacingScore: 72,
    targetAudience: body.context || "Audience needs more context",
    summary: "The idea is understandable, but the report needs real video/audio data for a sharper score. Improve clarity, proof, and opening pace first.",
    working: ["The topic has a clear viewer question.", "A direct creator explanation can build trust."],
    improvements: ["Open with the conflict faster.", "Add a specific proof moment.", "Make the title less broad and more outcome-driven."],
    audienceFit: "Currently fits viewers who want a practical explanation, not hype.",
    editChecklist: ["Check first 10 seconds.", "Normalize audio loudness.", "Use readable thumbnail text.", "Add source/proof for claims."],
  };
}

function fallbackDetailedVideo(video = {}) {
  const views = Number(video.views || 0);
  const likes = Number(video.likes || 0);
  const comments = Number(video.comments || 0);
  const engagement = views ? Math.min(100, Math.round(((likes + comments) / views) * 1000)) : 45;
  return {
    verdict: "Good base, needs sharper packaging",
    graphs: [
      { label: "Click strength", value: Math.min(92, video.thumbnail ? 68 : 52) },
      { label: "Engagement", value: engagement },
      { label: "Repeat potential", value: 74 },
      { label: "Comment fuel", value: comments ? 78 : 42 },
    ],
    improvements: ["Rewrite the title around the viewer payoff.", "Use the first comment questions as follow-up ideas.", "Test a thumbnail with fewer words and one obvious focal point."],
    followUps: ["A direct sequel answering the biggest objection.", "A short-form version with the strongest moment first.", "A community post asking what viewers want tested next."],
    titleSuggestions: [`What ${video.title || "This Video"} Actually Shows`, "I Tested This So You Don't Have To", "The Part Everyone Missed"],
    thumbnailText: ["REAL TEST", "BAD IDEA?", "I CHECKED"],
  };
}

function fallbackPublishPack(body = {}) {
  const title = body.title || body.video?.title || "Untitled video";
  const platforms = normalizeArray(body.platforms).length ? body.platforms : ["YouTube", "TikTok", "Instagram Reels"];
  return {
    title,
    platforms: platforms.map((platform) => ({
      name: platform,
      title: platform === "YouTube" ? title : title.slice(0, 70),
      caption: `My take on ${title}. Built from the original video, adjusted for ${platform}.`,
      description: `A platform-ready version of ${title}. Add final creator review before posting.`,
      hashtags: ["#creator", "#content", "#original"],
      notes: platform === "YouTube" ? "Can be uploaded through Google OAuth upload scope." : "Export-ready copy. Direct posting needs that platform's business API credentials.",
    })),
    agentNotes: ["Review platform rules before posting.", "Do not repost the exact same edit everywhere if audience expectations differ.", "Keep disclosures consistent."],
  };
}

function fallbackCoachReply(body = {}) {
  const hasYoutube = Boolean(body.youtube?.channel);
  const ideaCount = normalizeArray(body.ideas).length;
  return [
    hasYoutube ? `Your next move should start from the videos that already have comments, not from a blank trend chase.` : `First link your YouTube channel so I can use real video signals instead of guessing.`,
    ideaCount ? `You already have ${ideaCount} saved ideas. Pick one and make the hook more specific before generating more.` : `Create 3 ideas around one niche problem before jumping into scripts.`,
    `A strong next step: make one proof-based video, one short answer to a viewer question, and one community post asking what people want tested next.`,
  ].join("\n\n");
}

function fallbackAuthenticity(text = "", dna = {}) {
  const clean = String(text).toLowerCase();
  const genericHits = ["unlock", "revolutionary", "effortless", "ultimate", "guarantee", "game-changing"].filter((word) => clean.includes(word)).length;
  const personalHits = [" i ", " my ", " we ", "real", "honest", "story", "messy", "specific"].filter((word) => ` ${clean} `.includes(word)).length;
  const score = Math.max(35, Math.min(94, 70 + personalHits * 4 - genericHits * 11));
  return {
    authenticityScore: score,
    voiceMatch: Math.max(35, Math.min(96, score + 2)),
    toneMatch: Math.max(35, Math.min(96, score - 1)),
    audienceFit: Math.max(35, Math.min(96, score + 3)),
    originalityScore: Math.max(30, Math.min(95, score - genericHits * 3)),
    genericRisk: genericHits > 1 ? "High" : genericHits ? "Medium" : "Low",
    emotionalBelievability: Math.max(35, Math.min(95, score - 2)),
    brandSafety: genericHits > 1 ? 70 : 90,
    label: score > 84 ? "Strong match" : score > 64 ? "Needs more personal voice" : "Too generic",
    feedback: genericHits ? "Remove inflated AI-style claims and add one real creator detail." : "The draft is reasonably specific. Add more creator proof to strengthen it.",
    suggestions: ["Add a real example.", "Remove broad claims.", "Use one phrase your audience recognizes."],
    rewrittenVersion: "I tried this in my actual workflow, and the useful part was not the shiny promise. It was what it exposed about my process.",
    disclosureRecommendation: clean.includes("ai") ? "AI-assisted disclosure recommended." : "Disclosure optional unless AI visuals, voice, or sponsorship are involved.",
  };
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

function fallbackReply(text = "") {
  if (/\?|how|can you|show/i.test(text)) return "Yeah, I can make a follow-up and show the exact steps.";
  if (/love|thanks|helped/i.test(text)) return "Thank you. Glad it actually helped.";
  if (/wrong|copied|bad|fake/i.test(text)) return "Fair point. I’ll add clearer proof next time.";
  return "Appreciate you watching. Noted for the next one.";
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

function sanitizeUser(user = {}) {
  const metadata = { ...(user.user_metadata || {}) };
  if (metadata.google_oauth) metadata.google_oauth = googlePublicState(metadata.google_oauth);
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
