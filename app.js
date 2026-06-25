document.documentElement.classList.add("has-js");

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");
const revealItems = document.querySelectorAll(".reveal");
const counters = document.querySelectorAll("[data-count-to]");
const guardForm = document.querySelector("#guard-form");
const guardInput = document.querySelector("#guard-input");
const guardOutput = document.querySelector("#guard-output");
const scoreValue = document.querySelector("#score-value");
const scoreBar = document.querySelector("#score-bar");
const scoreFeedback = document.querySelector("#score-feedback");
const toneButtons = document.querySelectorAll(".tone-button");
const joinForm = document.querySelector("#join-form");
const joinEmail = document.querySelector("#join-email");
const joinNote = document.querySelector("#join-note");
const year = document.querySelector("#year");

let activeTone = "direct";

const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

if (year) {
  year.textContent = String(new Date().getFullYear());
}

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const nextState = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(nextState));
    nav.classList.toggle("is-open", nextState);
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navToggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    }
  });
}

const revealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 })
  : null;

revealItems.forEach((item) => {
  if (revealObserver) {
    revealObserver.observe(item);
  } else {
    item.classList.add("is-visible");
  }
});

window.setTimeout(() => {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}, 1400);

const counterObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const target = Number(element.getAttribute("data-count-to") || 0);
        const start = performance.now();
        const duration = 900;

        const tick = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          element.textContent = String(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
        counterObserver.unobserve(element);
      });
    }, { threshold: 0.5 })
  : null;

counters.forEach((counter) => {
  if (counterObserver) {
    counterObserver.observe(counter);
  } else {
    counter.textContent = counter.getAttribute("data-count-to") || "0";
  }
});

toneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTone = button.dataset.tone || "direct";
    toneButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

const scoreDraft = (text, tone) => {
  const clean = text.trim().toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  const personalSignals = ["i ", "my ", "we ", "behind", "messy", "learned", "audience", "story", "process"];
  const genericSignals = ["unlock", "revolutionary", "game-changing", "leverage", "effortlessly", "ultimate guide"];
  const specificity = Math.min(words.length / 90, 1) * 14;
  const personal = personalSignals.reduce((sum, signal) => sum + (clean.includes(signal) ? 4 : 0), 0);
  const genericPenalty = genericSignals.reduce((sum, signal) => sum + (clean.includes(signal) ? 6 : 0), 0);
  const toneBonus = tone === "warm" ? 3 : tone === "sharp" ? 2 : 4;
  const punctuationPenalty = (clean.match(/!/g) || []).length > 3 ? 5 : 0;
  return Math.max(42, Math.min(98, Math.round(66 + specificity + personal + toneBonus - genericPenalty - punctuationPenalty)));
};

const feedbackForScore = (score, tone) => {
  if (score >= 90) {
    return "Excellent voice match. Keep the lived detail, preserve the creator-specific phrasing, and add only a light disclosure note if AI helped shape the draft.";
  }

  if (score >= 78) {
    return tone === "sharp"
      ? "Strong angle. Make the hook more specific and replace any broad claim with a concrete opinion your audience expects from you."
      : "Strong personal angle. Add one concrete lived detail and keep the CTA in your own phrasing.";
  }

  if (score >= 64) {
    return "Good foundation, but it still reads a little broad. Add a personal example, a sharper audience promise, and one phrase you would actually say.";
  }

  return "High generic risk. Rewrite around a real moment, remove inflated claims, and make the audience takeaway more specific before publishing.";
};

if (guardForm && guardInput && scoreValue && scoreBar && scoreFeedback && guardOutput) {
  guardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const score = scoreDraft(guardInput.value, activeTone);
    scoreValue.textContent = String(score);
    scoreBar.style.width = `${score}%`;
    scoreFeedback.textContent = feedbackForScore(score, activeTone);
    guardOutput.setAttribute("aria-label", `Authenticity score ${score}. ${scoreFeedback.textContent}`);
  });
}

if (joinForm && joinEmail && joinNote) {
  const savedEmail = window.localStorage.getItem("contentus-beta-email");
  if (savedEmail) {
    joinEmail.value = savedEmail;
    joinNote.textContent = "Beta reservation saved on this device.";
  }

  joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.localStorage.setItem("contentus-beta-email", joinEmail.value.trim());
    joinNote.textContent = "Reserved locally. Connect a free-tier backend when you are ready to collect real signups.";
    joinEmail.blur();
  });
}
