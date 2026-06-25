# contentus

contentus is a polished landing page for an AI creator studio built around Creator DNA and Authenticity Guard. The current version is a static, dependency-free site so it can be published on Render without paid APIs, build tooling, or server setup.

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static server.

## Render deployment

This repo includes `render.yaml` for a Render Static Site:

- `runtime: static`
- `staticPublishPath: .`
- `buildCommand: echo "Static site ready"`
- `SKIP_INSTALL_DEPS=true`

Render's Blueprint sync can create the static service from the repo root. You can also create a Static Site manually in the Render Dashboard and use `.` as the publish directory.

## API policy

The landing page makes no network API calls. Future integrations should use products with a free tier or free API-key access, such as Google Gemini API, YouTube Data API, Supabase, or Firebase. Keep private keys server-side if the project later becomes a dynamic Render Web Service.

## Generated asset

The hero image lives at `assets/contentus-hero.png`. It was generated as a project-bound landing-page visual for contentus and copied into this workspace.
