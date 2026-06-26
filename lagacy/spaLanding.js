// Archived SPA landing renderers from the pre-standalone landing page app shell.
// These functions are intentionally not imported by the current app. They expect
// the original app.js globals/helpers if restored for reference.
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
          <a class="button primary" href="#/login" data-route="/login">${state.authed ? "Open app" : "Start free"}</a>
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
              <a class="button primary" href="#/login" data-route="/login">${state.authed ? "Open your studio" : "Create your account"}</a>
              <a class="button secondary" href="#features">See the system</a>
            </div>
            <div class="hero-proof">
              <span class="chip">Supabase auth</span>
              <span class="chip">Saved creator state</span>
              <span class="chip">Featherless-ready AI routes</span>
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
          <a class="button primary" href="#/login" data-route="/login">${state.authed ? "Open app" : "Start free"}</a>
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
              <a class="button primary" href="#/login" data-route="/login">${state.authed ? "Open your studio" : "Create your account"}</a>
              <a class="button secondary" href="#features">See the system</a>
            </div>
            <div class="hero-proof">
              <span class="chip">Supabase auth</span>
              <span class="chip">Saved creator state</span>
              <span class="chip">Featherless AI routes</span>
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


