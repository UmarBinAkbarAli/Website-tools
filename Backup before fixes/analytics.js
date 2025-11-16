import { app } from './firebase.js';
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics disabled:", e);
}

export function analytics_log(name, params = {}) {
  if (!analytics) return;
  try { logEvent(analytics, name, params); }
  catch(e){ console.warn("Analytics log failed", e); }
}
