// /js/analytics.js
import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";

// ---------- paste your firebaseConfig here ----------
const firebaseConfig = {
  apiKey: "AIzaSyDXsrypUfViIDCdK5Bs0H-P-J9KXYONajU",
  authDomain: "umar-tools-27994.firebaseapp.com",
  projectId: "umar-tools-27994",
  storageBucket: "umar-tools-27994.firebasestorage.app",
  messagingSenderId: "269972336658",
  appId: "1:269972336658:web:0fbcd8ecd1047b888e68cb",
  // measurementId: "G-XXXXXXX"  // optional, include if present in your config
};
// ----------------------------------------------------

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  // if app already initialized elsewhere, use that instance
  app = getApps()[0];
}

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  // analytics might fail on localhost or if measurementId absent — it's okay
  console.warn("Analytics init failed:", err);
}

/**
 * analytics_log(name: string, params?: object)
 * - No-op if analytics unavailable.
 */
export function analytics_log(name, params = {}) {
  if (!analytics) return;
  try {
    logEvent(analytics, name, params);
  } catch (e) {
    console.warn("analytics_log failed:", e);
  }
}
