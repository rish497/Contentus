# Contentus

Contentus is a polished prototype of a Creator DNA operating system for creators. It includes a cursor-reactive landing page, Supabase-backed authentication and saved state, full dashboard, creator tools, mock/live-ready API routes, and a Chrome extension scaffold.

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

Creator DNA, ideas, scripts, calendar items, and saved inspiration are stored in the signed-in user's Supabase auth metadata for this prototype. For a production app, move larger workspace data into dedicated Supabase tables with Row Level Security.

## What is included

- Landing page with reactive canvas background and DNA logo
- Authentication screen
- Main dashboard with quick actions, cards, charts, and recommendations
- Creator DNA Profile
- AI Idea Engine
- Script and Story Builder
- AI Ad and Short Film Studio
- Repurpose Machine
- Authenticity Guard
- Growth Coach
- Mock YouTube Analytics
- Community Manager
- Creator Rights Shield
- Ethical AI Disclosure Helper
- Content Calendar with drag-and-drop cards
- Chrome extension popup, side panel, content script, and Manifest V3 config
- Mock backend route structure under `server.js`

## Render deployment

This project deploys as a Render Web Service using `render.yaml`.

- Runtime: Node
- Build command: `npm install --omit=dev`
- Start command: `npm start`
- Plan: free

## API keys

The prototype runs without keys. For future real integrations, use products with free API-key access or free tiers:

- Supabase for auth/database
- Google Gemini API for AI generation
- YouTube Data API and YouTube Analytics API for channel analytics
- Firebase as an optional auth/database alternative

Never expose Supabase secret/service-role keys in frontend code. Use the publishable/anon key only with Row Level Security configured.

For Render deployment, add the same environment variables in the Render Dashboard because local `.env` files are not uploaded as production secrets.
