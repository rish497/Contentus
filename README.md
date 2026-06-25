# Contentus

Contentus is a Creator DNA operating system for creators. It includes a cursor-reactive landing page, Supabase-backed authentication and saved state, Gemini-powered creator tools, public YouTube channel/comment linking, a thumbnail designer, and a Manifest V3 Chrome helper.

## Run locally

```powershell
npm start
```

Then open:

```text
http://localhost:3000
```

The app reads `.env` automatically when started with `npm start`.

## Auth and saved data

When `SUPABASE_URL` and `SUPABASE_ANON_KEY` are present, Contentus uses Supabase Auth for:

- Sign up
- Sign in
- Sign out
- Saved user workspace state

Creator DNA, ideas, scripts, calendar items, channel data, comments, and saved inspiration are stored in the signed-in user's Supabase auth metadata. For larger production teams, move workspace data into dedicated Supabase tables with Row Level Security.

## What is included

- Landing page with reactive canvas background and DNA logo
- Authentication screen
- Empty-first dashboard that only shows the signed-in user's real saved data
- Creator DNA Profile with text, file upload, voice recording, and YouTube context inputs
- AI Idea Engine
- Script and Story Builder with length-aware generation and PDF export
- AI Ad and Short Film Studio
- Thumbnail Designer with canvas generation and low-token title suggestions
- Authenticity Guard
- YouTube + Growth page using the YouTube Data API for public channel/video stats
- Community Manager with real YouTube comment loading and reply drafts
- Content Calendar with drag-and-drop cards
- Chrome extension popup, side panel, content script, and Manifest V3 config
- Backend API route structure under `server.js`

## Render deployment

This project deploys as a Render Web Service using `render.yaml`.

- Runtime: Node
- Build command: `npm install --omit=dev`
- Start command: `npm start`
- Plan: free

## API keys

Use products with free API-key access or free tiers:

- Supabase for auth/database
- Google Gemini API for AI generation
- YouTube Data API for public channel/video/comment data
- Google OAuth credentials for future private YouTube Analytics access
- Google OAuth redirect URI for Calendar read/write and approved YouTube reply posting
- Firebase as an optional auth/database alternative

Never expose Supabase secret/service-role keys in frontend code. Use the publishable/anon key only with Row Level Security configured.

For Render deployment, add the same environment variables in the Render Dashboard because local `.env` files are not uploaded as production secrets.

For Google OAuth, add this authorized redirect URI in Google Cloud:

```text
http://localhost:3000/api/google/oauth/callback
```

For Render, replace the domain with your deployed Render URL:

```text
https://your-render-service.onrender.com/api/google/oauth/callback
```

Set `SESSION_SECRET` to a long random value so Google refresh tokens can be encrypted and reused.
