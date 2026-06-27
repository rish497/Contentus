export function normalizeRoute(hash) {
  const clean = (hash || "#/").replace(/^#/, "") || "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeStringArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

export function riskClass(risk = "") {
  const clean = String(risk).toLowerCase();
  if (clean.includes("high") || clean.includes("too")) return "bad";
  if (clean.includes("medium") || clean.includes("needs")) return "warn";
  return "good";
}

export function averageScore(values) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

export function wrapPdfLine(text, max) {
  if (!text) return [""];
  const words = text.replace(/\r/g, "").split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > max) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function pdfEscape(text) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "contentus";
}

export function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  words.forEach((word) => {
    const test = `${line} ${word}`.trim();
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
}

export function thumbnailPalette(value = "") {
  const clean = value.toLowerCase();
  if (clean.includes("red")) return { bg1: "#210407", bg2: "#111111", accent: "#ff3d4f", accent2: "#ffd447" };
  if (clean.includes("lime")) return { bg1: "#04120d", bg2: "#08152a", accent: "#85ff82", accent2: "#7da7ff" };
  if (clean.includes("white")) return { bg1: "#10201d", bg2: "#050706", accent: "#f5fbf8", accent2: "#5ee8f2" };
  return { bg1: "#061b1f", bg2: "#190c0b", accent: "#5ee8f2", accent2: "#ff7567" };
}

export function formatNumber(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat(undefined, { notation: number >= 10000 ? "compact" : "standard" }).format(number);
}

export function formatDate(value) {
  if (!value) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export function formatInputDate(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthLabel(date) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);
}

export function calendarCells(view) {
  const start = new Date(view.getFullYear(), view.getMonth(), 1);
  const firstDay = start.getDay();
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - firstDay);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, inMonth: date.getMonth() === view.getMonth() };
  });
}

export function calendarRange(view) {
  const start = new Date(view.getFullYear(), view.getMonth(), 1);
  const end = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function isToday(date) {
  return formatInputDate(date) === formatInputDate(new Date());
}
