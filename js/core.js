import {
 initAuth,
  onAuthReady,
  signInGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,          // <-- added
  verifyEmail,          // <-- ADDED
  resendVerification,   // <-- ADD THIS
  getCurrentUser,
  signOutUser
} from "./auth.js";

import SyncManager from './sync-manager.js';
import { analytics_log } from "./analytics.js";
import * as cloud from "./cloud.js";
import { setupGestures } from "./gestures.js";
import { setupScripts, renderScripts } from "./scripts.js";
import { ensureFullscreenToggle } from "./fullscreen.js";
import { setupKeyboardShortcuts } from './keyboard.js';


const $ = id => document.getElementById(id);

// =============================
// UI HELPERS
// =============================
function showError(msg) {
  const box = $("authError");
  if (box) {
    box.innerHTML = `🚫 ${msg}`;
    box.style.display = "block";
  }
}

function clearError() {
  const box = $("authError");
  if (box) box.style.display = "none";
}

function showLoading() {
  const box = $("authLoading");
  if (box) box.style.display = "block";
}

function hideLoading() {
  const box = $("authLoading");
  if (box) box.style.display = "none";
}

const playBtn = $("playPause");
const editBtn = $("editButton");
const scriptBox = $("scriptInput");
const displayBox = $("displayText");
const textBox = $("textContent");
const speedControl = $("speedControl");
const fontSizeControl = $("fontSizeControl");
const syncBtn = $("authOpen");
const toolbar = $("toolbar");        // New: formatting toolbar
const countdownEl = $("countdown");  // New: 3-2-1 overlay
const timeDisplay = $("timeLeft");   // New: time remaining display
const mirrorToggle = $("mirrorToggle"); 
const repeatToggle = $("autoRepeat");

let attemptedLogin = false;
let playing = false;
let countdownActive = false; // Prevent double clicks during countdown
let scrollY = 0;
let tick = null;

// new states
let mirrored = false;
let repeatMode = false;

// =============================
// FIRST TIME LOGIN CHECK
// =============================
function handleFirstLogin(user) {
  if (!user) return;
  const isFirst = user.metadata.creationTime === user.metadata.lastSignInTime;

  if (isFirst) {
    // Example: Show onboarding / popup / default settings
    console.log("FIRST LOGIN DETECTED");
    $("welcomeModal")?.setAttribute("aria-hidden", "false");
  }
}

// =============================
// AUTH
// =============================
initAuth();

onAuthReady(async user => {
  if (user) {

if (!user.emailVerified) {

    // ONLY show modal if user tried to login
    if (attemptedLogin) {
        $("authStatus").textContent = "Email not verified";
        $("authPanel").setAttribute("aria-hidden","false");

        showError("Please verify your email before using cloud sync.");

        const rv = $("resendVerify");
        rv.style.display = "block";
        rv.onclick = async () => {
            rv.style.display = "none";
            showError("Sending verification email...");
            await resendVerification(user);
            showError("Verification email sent again.");
        };
    }

    return; // always stop here
}


    // detect first-time login
    handleFirstLogin(user);
    $("authStatus").textContent = `Signed in: ${user.email || "User"}`;
    $("authPanel").setAttribute("aria-hidden", "true");
    
    // show logout button ONLY NOW
    $("logoutBtn").style.display = "inline-block";

    // Load scripts from cloud
    const list = await cloud.loadCloudScripts(user);
    renderScripts(list);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(list));
  } else {
    $("authStatus").textContent = "Not signed in";
    $("logoutBtn").style.display = "none";
  }
});

// =============================
// AUTO-CHECK EMAIL VERIFICATION
// =============================
setInterval(async () => {
  const user = getCurrentUser();
  if (!user) return;

  await user.reload();

  if (user.emailVerified) {
    // hide error + resend button
    $("authError").style.display = "none";
    $("resendVerify").style.display = "none";

    // close panel
    $("authPanel").setAttribute("aria-hidden", "true");

    // update UI
    $("authStatus").textContent = `Signed in: ${user.email}`;

    // load scripts now that user is verified
    const list = await cloud.loadCloudScripts(user);
    renderScripts(list);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(list));
  }
}, 5000);

// login UI
syncBtn.onclick = () => {
    attemptedLogin = true;
    $("authPanel").setAttribute("aria-hidden", "false");
};

$("authClose").onclick = () => $("authPanel").setAttribute("aria-hidden","true");
$("btnGoogle").onclick = () => signInGoogle();

// Enable Email panel
$("btnEmail").onclick = () => {
  const panel = $("emailPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
};

// =============================
// EMAIL + PASSWORD LOGIN
// =============================
$("btnEmailLogin")?.addEventListener("click", async () => {
  clearError();
  showLoading();

  const email = $("emailInput")?.value.trim();
  const pass = $("passwordInput")?.value.trim();

  if (!email || !pass) {
    hideLoading();
    return showError("Enter email + password");
  }

  try {
    const cred = await signInWithEmail(email, pass);

if (!cred.user.emailVerified) {
  hideLoading();

  // show error
  showError("Please verify your email first.");

  // show resend verification button
  const rv = $("resendVerify");
  if (rv) {
    rv.style.display = "block";
    rv.onclick = async () => {
      rv.style.display = "none";
      showError("Sending verification email...");
      try {
        await resendVerification(cred.user);
        showError("Verification email sent again.");
      } catch (err) {
        showError(err.message);
      }
    };
  }

  return;
}


    handleFirstLogin(cred.user);
  } catch (err) {
    showError(err.message);
  }

  hideLoading();
});

$("btnEmailRegister")?.addEventListener("click", async () => {
  clearError();
  showLoading();

  const email = $("emailInput")?.value.trim();
  const pass = $("passwordInput")?.value.trim();

  if (!email || !pass) {
    hideLoading();
    return showError("Enter email + password");
  }

  try {
    const cred = await registerWithEmail(email, pass);
await verifyEmail(cred.user);

    hideLoading();
    return showError("Verification email sent. Please verify before logging in.");
  } catch (err) {
    hideLoading();
    showError(err.message);
  }
});

$("forgotPass")?.addEventListener("click", async () => {
  clearError();
  showLoading();

  const email = $("emailInput")?.value.trim();

  if (!email) {
    hideLoading();
    return showError("Enter your email first.");
  }

  try {
    await resetPassword(email);
    hideLoading();
    showError("Password reset email sent.");
  } catch (err) {
    hideLoading();
    showError(err.message);
  }
});

$("logoutBtn").onclick = async () => {
  await signOutUser();
  localStorage.clear();
  location.reload();
};

// Update time remaining counter visual
function updateTimeRemaining() {
  if (!timeDisplay) return;
  
  const totalHeight = textBox.getBoundingClientRect().height;
  const viewHeight = displayBox.clientHeight;
  const currentPos = Math.abs(scrollY);
  const remainingPx = Math.max(0, totalHeight - viewHeight - currentPos);

  const speedVal = parseFloat(speedControl.value);
  if (speedVal <= 0 || remainingPx <= 0) {
    timeDisplay.textContent = "00:00";
    return;
  }

  // Approx pixels per second (Interval 30ms)
  const pxPerSec = speedVal * 33.33;
  const secondsLeft = Math.ceil(remainingPx / pxPerSec);

  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');
  timeDisplay.textContent = `${m}:${s}`;
}

function applyTransform() {
  const transform = `translateY(${scrollY}px)`;
  textBox.style.transform = mirrored ? `${transform} scaleX(-1)` : transform;
}

function runCountdownAndStart() {
  if (countdownActive) return;
  countdownActive = true;
  
  let count = 3;
  if (countdownEl) {
    countdownEl.style.display = "flex";
    countdownEl.textContent = count;
  }

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      if (countdownEl) countdownEl.textContent = count;
    } else {
      clearInterval(timer);
      if (countdownEl) countdownEl.style.display = "none";
      countdownActive = false;
      startScroll();
    }
  }, 1000);
}

// =============================
// TELEPROMPTER ENGINE
// =============================
function startScroll() {
  // CHANGED: Use innerHTML for Rich Text
  const text = scriptBox.innerHTML; 
  if (!text) return;

  const startingFresh = displayBox.style.display === "none" || displayBox.getAttribute('data-init') !== 'true';

  if (startingFresh) {
    textBox.innerHTML = text; // CHANGED: innerHTML
    textBox.style.transform = '';
    scrollY = 0;
    displayBox.setAttribute('data-init', 'true');
  }

  displayBox.style.display = "block";
  scriptBox.style.display = "none";
  if (toolbar) toolbar.style.display = "none"; // NEW: Hide toolbar on play
  editBtn.style.display = "inline-block";

  playing = true;
  playBtn.textContent = "Pause";

  clearInterval(tick);
  tick = setInterval(() => {
    scrollY -= parseFloat(speedControl.value);
    applyTransform(); // Use helper
    updateTimeRemaining(); // Update timer

    // Check bounds
    const contentHeight = textBox.getBoundingClientRect().height;
    const containerHeight = displayBox.getBoundingClientRect().height;
    if (Math.abs(scrollY) > (contentHeight - containerHeight)) {
      if (repeatMode) {
        scrollY = 0;
      } else {
        stopScroll();
      }
    }
  }, 30);
}

function stopScroll() {
  playing = false;
  clearInterval(tick);
  playBtn.textContent = "Play";
}

playBtn.onclick = () => {
  if (playing) {
    stopScroll();
  } else {
    // Only use countdown if we are near the top
    if (Math.abs(scrollY) < 5) {
      runCountdownAndStart();
    } else {
      startScroll();
    }
  }
};

editBtn.onclick = () => {
  stopScroll();
  displayBox.style.display = "none";
  scriptBox.style.display = "block";
  if (toolbar) toolbar.style.display = "flex"; // NEW: Show toolbar
  editBtn.style.display = "none";
};

// =============================
// SETTINGS PERSISTENCE
// =============================
const PREF_PREFIX = "tele_pref_";

function saveSetting(key, val) {
  localStorage.setItem(PREF_PREFIX + key, val);
}

function loadSettings() {
  const sSpeed = localStorage.getItem(PREF_PREFIX + "speed");
  const sSize = localStorage.getItem(PREF_PREFIX + "size");
  const sMirror = localStorage.getItem(PREF_PREFIX + "mirror");
  const sRepeat = localStorage.getItem(PREF_PREFIX + "repeat");

  if (sSpeed) speedControl.value = sSpeed;
  if (sSize) {
    fontSizeControl.value = sSize;
    textBox.style.fontSize = sSize + "px";
  }
  if (sMirror === "true") {
    mirrorToggle.checked = true;
    mirrored = true;
    applyTransform(); // Apply mirror immediately on load
  }
  if (sRepeat === "true") {
    repeatToggle.checked = true;
    repeatMode = true;
  }
}

// Attach Listeners
speedControl.addEventListener("input", (e) => saveSetting("speed", e.target.value));

fontSizeControl.addEventListener("input", (e) => {
  textBox.style.fontSize = e.target.value + "px";
  saveSetting("size", e.target.value);
});

if (mirrorToggle) {
  mirrorToggle.addEventListener("change", (e) => {
    mirrored = e.target.checked;
    saveSetting("mirror", mirrored);
    applyTransform();
  });
}

if (repeatToggle) {
  repeatToggle.addEventListener("change", (e) => {
    repeatMode = e.target.checked;
    saveSetting("repeat", repeatMode);
  });
}

// Load settings immediately on startup
loadSettings();

// =============================
// SCRIPTS MANAGER
// =============================
setupScripts({
  scriptInput: scriptBox,
  scriptsBtn: $("scriptsBtn"),
  scriptsModal: $("scriptsModal"),
  scriptsList: $("scriptsList"),
  newScriptForm: $("newScriptForm"),
  newTitle: $("newTitle"),
  newText: $("newText"),
  saveScriptBtn: $("saveScriptBtn"),  // <-- FIXED
  importBtn: $("importBtn"),
  exportBtn: $("exportBtn"),
  fileInput: $("fileInput")
});

// initialize sync manager
SyncManager.init({
  getCurrentUser,
  onAuthReady,
  renderScripts,
  cloud
});

// =============================
// GESTURES
// =============================
setupGestures({ onTap: () => playBtn.click() });

// ===============================
// Keyboard shortcuts call here
// ===============================
setupKeyboardShortcuts({
  playBtn,
  editBtn,
  speedControl,
  fontSizeControl,
  scriptsBtn: $("scriptsBtn"),
  syncBtn: $("authOpen"),
  scriptBox
});

// =============== Shortcut Overlay Hooks ===============
const overlay = document.getElementById('shortcutOverlay');

// helper safe getters
const safe = id => document.getElementById(id);

// button hooks
const SH_PLAY = safe('sh_play');
const SH_EDIT = safe('sh_edit');
const SH_SCRIPTS = safe('sh_scripts');
const SH_FULL = safe('sh_full');
const SH_SPEED_UP = safe('sh_speed_up');
const SH_SPEED_DN = safe('sh_speed_dn');
const SH_FONT_UP = safe('sh_font_up');
const SH_FONT_DN = safe('sh_font_dn');
const SH_SYNC = safe('sh_sync');
const SH_SAVE = safe('sh_save');
const SH_LOGOUT = safe('sh_logout');

// actions (guarded)
if (SH_PLAY) SH_PLAY.onclick = () => safe('playPause') && safe('playPause').click();
if (SH_EDIT) SH_EDIT.onclick = () => safe('editButton') && safe('editButton').click();
if (SH_SCRIPTS) SH_SCRIPTS.onclick = () => safe('scriptsBtn') && safe('scriptsBtn').click();
if (SH_FULL) SH_FULL.onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
};

// speed
if (SH_SPEED_UP) SH_SPEED_UP.onclick = () => {
  const el = safe('speedControl'); if (!el) return;
  el.value = Math.min(Number(el.max || 20), Number(el.value) + 0.5);
  el.dispatchEvent(new Event('input'));
};
if (SH_SPEED_DN) SH_SPEED_DN.onclick = () => {
  const el = safe('speedControl'); if (!el) return;
  el.value = Math.max(Number(el.min || 0.1), Number(el.value) - 0.5);
  el.dispatchEvent(new Event('input'));
};

// font size
if (SH_FONT_UP) SH_FONT_UP.onclick = () => {
  const el = safe('fontSizeControl'); if (!el) return;
  el.value = Math.min(Number(el.max || 200), Number(el.value) + 2);
  el.dispatchEvent(new Event('input'));
};
if (SH_FONT_DN) SH_FONT_DN.onclick = () => {
  const el = safe('fontSizeControl'); if (!el) return;
  el.value = Math.max(Number(el.min || 8), Number(el.value) - 2);
  el.dispatchEvent(new Event('input'));
};

// sync / save / logout
if (SH_SYNC) SH_SYNC.onclick = () => safe('authOpen') && safe('authOpen').click();
if (SH_SAVE) SH_SAVE.onclick = () => {
  const form = document.getElementById('newScriptForm');
  if (form) form.requestSubmit();
  else {
    // fallback: store current script as a quick temp script
    const txt = safe('scriptInput') ? safe('scriptInput').innerHTML : '';
    if (txt) {
      // create a hidden quick-save form submit if you want; fallback: show modal
      safe('scriptsBtn') && safe('scriptsBtn').click();
    }
  }
};
if (SH_LOGOUT) SH_LOGOUT.onclick = () => safe('logoutBtn') && safe('logoutBtn').click();

// dim overlay while playing: toggle .dim when play starts/stops
const playElem = safe('playPause');
if (playElem && overlay) {
  // observe text content to detect playing state by button text
  function updateOverlayDim(){
    if (!overlay) return;
    const isPlaying = playElem.textContent && playElem.textContent.toLowerCase().includes('pause');
    if (isPlaying) overlay.classList.add('dim'); else overlay.classList.remove('dim');
  }
  updateOverlayDim();
  // listen to clicks and input changes that might change play state
  playElem.addEventListener('click', () => setTimeout(updateOverlayDim, 40));
}

// ESC - close any open modal or stop editing
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // close any modal opened (aria-hidden="false")
    document.querySelectorAll('.modal').forEach(el => {
      // keep shortcutOverlay as it may intentionally be visible
      if (el.id === 'shortcutOverlay') return;
      el.setAttribute('aria-hidden', 'true');
    });

    // if editor is visible, hide it and show display (if playing) or keep hidden
    if (scriptBox && scriptBox.style.display !== 'none') {
      // exit edit mode: if display has content keep it hidden state unchanged
      scriptBox.blur();
      // do not automatically start/stop playing — just revert UI
      displayBox.style.display = 'none';
    }
  }
});

// Quick Save: save current script content as update if editing a loaded script else open scripts modal
const quickSaveBtn = document.getElementById('quickSave');
if (quickSaveBtn) {
  quickSaveBtn.addEventListener('click', () => {
    // open scripts modal and pre-fill fields so user can save/update quickly via modal
    const modal = document.getElementById('scriptsModal');
    const title = document.getElementById('newTitle');
    const text = document.getElementById('newText');
    // if content exists in main editor, prefill modal with it
    const content = scriptBox ? scriptBox.innerHTML : '';
    title.value = document.getElementById('newTitle').value || 'Untitled';
    text.innerHTML = content;
    if (modal) modal.setAttribute('aria-hidden', 'false');
  });
}
  