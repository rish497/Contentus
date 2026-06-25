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
      aiProvider: integrationStatus().gemini ? "gemini" : "local-fallback",
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

  const body = await readJsonBody(request);

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

async function generateCreatorDna(body = {}) {
  const youtubeContext = body.youtubeUrl ? await fetchYouTubeContext(body.youtubeUrl) : null;
  const mediaNote = body.media?.truncated ? "Uploaded media was trimmed before analysis to keep the request lightweight." : "";
  const fallback = fallbackDna(body, youtubeContext, mediaNote);
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
  const result = await callGeminiJson(prompt, fallback, {
    media: body.media,
    temperature: 0.25,
  });
  return {
    ...fallback,
    ...result,
    mediaNote: [mediaNote, youtubeContext?.note, result.mediaNote].filter(Boolean).join(" "),
  };
}

async function generateIdeasWithAi(body = {}) {
  const fallback = fallbackIdeas(body);
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
  const result = await callGeminiJson(prompt, { ideas: fallback }, { temperature: 0.55 });
  return normalizeArray(result.ideas).length ? result.ideas : fallback;
}

async function generateScriptWithAi(body = {}) {
  const lengthLabel = String(body.length || body.existingScript?.lengthLabel || "60 seconds");
  const targetWords = targetWordsFromLength(lengthLabel);
  const fallback = fallbackScript(body, targetWords);
  const prompt = `
You are Contentus Script Builder. Return only JSON. Write a real usable creator script.

Input:
${JSON.stringify(body, null, 2)}

Target duration: ${lengthLabel}
Target word count: about ${targetWords} spoken words. A 30 second script must be short. An 8 minute script must be much longer and more developed.

Return this JSON:
{
  "title": string,
  "targetLength": string,
  "authenticityScore": number,
  "genericRisk": "Low" | "Medium" | "High",
  "personalizationTip": string,
  "disclosure": string,
  "hookOptions": string[],
  "script": string,
  "scenes": string[],
  "voiceover": string,
  "shotList": string[],
  "broll": string[],
  "onScreenText": string[],
  "caption": string,
  "hashtags": string[],
  "endingOptions": string[]
}

Infer CTA, humor, and personal story from Creator DNA. Do not use separate toggles. Avoid generic AI filler.
`;
  const result = await callGeminiJson(prompt, fallback, { temperature: 0.45 });
  const script = { ...fallback, ...result, targetLength: result.targetLength || lengthLabel };
  if (wordCount(script.script) < Math.round(targetWords * 0.45)) {
    script.script = expandScriptLocally(script.script || fallback.script, targetWords, body);
  }
  return script;
}

async function generateAdStudioWithAi(body = {}) {
  const fallback = fallbackAdProject(body);
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
  const result = await callGeminiJson(prompt, fallback, { temperature: 0.5 });
  return { ...fallback, ...result, versions: normalizeArray(result.versions).length ? result.versions : fallback.versions };
}

async function generateThumbnailCopy(body = {}) {
  const title = body.idea?.title || "creator idea";
  const fallback = fallbackThumbnailCopy(title);
  const prompt = `
Return only JSON: {"suggestions":[{"text":string,"reason":string}]}
Create 3 thumbnail text options under 32 characters.
Idea: ${JSON.stringify(body.idea || {})}
Style: ${body.style || "clean proof"}
Creator DNA: ${JSON.stringify(body.dna || {})}
Use very few words. No clickbait lies.
`;
  const result = await callGeminiJson(prompt, { suggestions: fallback }, { temperature: 0.35, maxOutputTokens: 350 });
  return normalizeArray(result.suggestions).length ? result.suggestions : fallback;
}

async function scoreAuthenticityWithAi(body = {}) {
  const fallback = fallbackAuthenticity(body.text || "", body.dna);
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
  return callGeminiJson(prompt, fallback, { temperature: 0.25 });
}

async function generateCommunityReplies(body = {}) {
  const comments = normalizeArray(body.comments).slice(0, 40);
  const fallback = {
    comments: comments.map((comment) => ({
      ...comment,
      sentiment: comment.sentiment || sentimentFor(comment.text || ""),
      importance: comment.importance || importanceFor(comment.text || ""),
      suggestedReply: comment.suggestedReply || fallbackReply(comment.text || ""),
    })),
  };
  const prompt = `
You are Contentus Community Manager. Return only JSON:
{"comments":[{"id":string,"author":string,"text":string,"sentiment":string,"importance":string,"suggestedReply":string,"videoIdea":string}]}

Creator:
${JSON.stringify(body.creator || {}, null, 2)}
Creator DNA:
${JSON.stringify(body.dna || {}, null, 2)}
Comments:
${JSON.stringify(comments, null, 2)}

Rules: draft replies only. Do not claim replies are posted. Be kind, concise, and in the creator's voice. Detect repeated questions and toxic comments.
`;
  const result = await callGeminiJson(prompt, fallback, { temperature: 0.4 });
  return { comments: normalizeArray(result.comments).length ? result.comments : fallback.comments };
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
    return { status: 502, payload: { error: "Could not fetch comments", message: error.message } };
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

async function callGeminiJson(prompt, fallback, options = {}) {
  if (!configured(GEMINI_API_KEY)) return fallback;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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
    const payload = text ? JSON.parse(text) : {};
    if (!result.ok) {
      return { ...fallback, warning: payload.error?.message || `Gemini request failed with ${result.status}` };
    }
    const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    return parseJsonOutput(output, fallback);
  } catch (error) {
    return { ...fallback, warning: error.message };
  }
}

function parseJsonOutput(output, fallback) {
  try {
    return JSON.parse(output);
  } catch {
    const match = output.match(/```(?:json)?\s*([\s\S]*?)```/) || output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[1]);
    } catch {
      return fallback;
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
  const script = expandScriptLocally(`Cold open: I want to test ${idea} in a way that is actually useful, not just another generic AI draft.`, targetWords, body);
  return {
    title: idea,
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
    script,
    scenes: [
      "Cold open with the real problem.",
      `Show the ${format} setup and why the audience should care.`,
      "Walk through the test or story beats.",
      "Reveal the useful result and the honest limitation.",
      "Close with a specific viewer action.",
    ],
    voiceover: "Keep the voice direct, specific, and rooted in the creator's own proof.",
    shotList: ["Creator on camera", "Proof artifact", "Screen recording", "Before/after line", "Final takeaway"],
    broll: ["Notes app", "Timeline or calendar", "Draft comparison", "Audience comment", "Publishing checklist"],
    onScreenText: ["The problem", "The test", "The result", "Make it yours"],
    caption: `${idea}. Created with Creator DNA and checked for generic risk.`,
    hashtags: ["#creatorworkflow", "#contentstrategy", "#aicreator"],
    endingOptions: ["Want the exact workflow?", "Which version sounds more human?", "Send me the next idea to test."],
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
  if (/\?|how|can you|show/i.test(text)) return "Yes. I can turn this into a clearer walkthrough and show the exact process in a follow-up.";
  if (/love|thanks|helped/i.test(text)) return "Thank you. I am glad it helped, and I will keep the next one just as practical.";
  if (/wrong|copied|bad|fake/i.test(text)) return "Fair pushback. I will make the next version more specific with my own proof and clearer sources.";
  return "Appreciate you watching. I am noting this for the next version.";
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
