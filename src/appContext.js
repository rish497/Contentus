document.documentElement.classList.add("has-js");

export const app = document.querySelector("#app");
export const toastRegion = document.querySelector("#toast-region");
export const canvas = document.querySelector("#motion-bg");

export const STORAGE_KEY = "contentus-workspace-state";
export const AUTH_KEY = "contentus-auth-session";

export const defaultState = {
  workspaceVersion: 4,
  authed: false,
  youtubeConnected: false,
  creator: {
    name: "",
    creatorName: "",
    niche: "",
    audience: "",
    platforms: [],
    tone: [],
    values: "",
    boundaries: "",
    topicsLoved: "",
    topicsAvoided: "",
  },
  dna: null,
  ideas: [],
  scripts: [],
  adProjects: [],
  thumbnails: [],
  voiceovers: [],
  trends: null,
  videoChecks: [],
  calendar: [],
  inspiration: [],
  youtube: null,
  comments: [],
  growthInsights: [],
  google: null,
  googleCalendarEvents: [],
  selectedIdeaId: "",
  selectedScriptId: "",
  selectedAdProjectId: "",
  selectedThumbnailId: "",
  selectedVideoId: "",
  tutorialCompleted: false,
  tutorialStep: 0,
  calendarViewDate: "",
};

export const analytics = {
  channel: "Rish Creates",
  subscribers: 48200,
  summary: {
    averageViews: 18200,
    watchTime: "1.9K hrs",
    retention: "47%",
    ctr: "7.8%",
    engagement: "9.4%",
    growth: "+1,240",
  },
  views: [12, 18, 16, 28, 24, 38, 44, 41, 52, 66, 61, 74],
  videos: [
    {
      id: "yt-1",
      title: "I Let AI Plan My Study Week",
      views: 82000,
      likes: 7200,
      comments: 638,
      retention: 58,
      ctr: 9.8,
      format: "Experiment",
      topic: "AI study systems",
      diagnosis: "Personal experiment plus useful takeaway. The audience stayed because the proof arrived early.",
    },
    {
      id: "yt-2",
      title: "5 Apps Every Student Needs",
      views: 14300,
      likes: 900,
      comments: 74,
      retention: 31,
      ctr: 4.1,
      format: "List",
      topic: "Productivity tools",
      diagnosis: "Clear title, but the angle is generic. Add a stronger personal filter and a specific outcome.",
    },
    {
      id: "yt-3",
      title: "My Exam Week Reset Routine",
      views: 36500,
      likes: 3100,
      comments: 288,
      retention: 49,
      ctr: 8.2,
      format: "Vlog tutorial",
      topic: "Study routine",
      diagnosis: "Strong comments because it felt real. Shorten the intro by 8 seconds.",
    },
  ],
};

export const comments = [
  {
    id: "com-1",
    author: "Anaya",
    text: "Can you show the exact prompt you used for the AI schedule?",
    sentiment: "asking questions",
    importance: "high",
    suggestedReply: "Yes. I will drop the exact prompt in the next video and pin a cleaner version here too.",
  },
  {
    id: "com-2",
    author: "Dev",
    text: "This made me feel better about my messy routine lol",
    sentiment: "positive",
    importance: "medium",
    suggestedReply: "That was the goal. We are all pretending to be organized until the calendar exposes us.",
  },
  {
    id: "com-3",
    author: "Unknown",
    text: "This is just copied from every AI productivity video.",
    sentiment: "critical",
    importance: "medium",
    suggestedReply: "Fair pushback. I tried to make it specific by showing my real week, but I can go deeper into the results next time.",
  },
];


