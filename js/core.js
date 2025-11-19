import {
 initAuth,
  onAuthReady,
  signInGoogle,
  signInWithEmail,
  registerWithEmail,
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

const playBtn = $("playPause");
const editBtn = $("editButton");
const scriptBox = $("scriptInput");
const displayBox = $("displayText");
const textBox = $("textContent");
const speedControl = $("speedControl");
const fontSizeControl = $("fontSizeControl");
const syncBtn = $("authOpen");

let playing = false;
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

    // detect first-time login
    handleFirstLogin(user);
    $("authStatus").textContent = `Signed in: ${user.email || "User"}`;
    $("authPanel").setAttribute("aria-hidden", "true");
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

// login UI
syncBtn.onclick = () => $("authPanel").setAttribute("aria-hidden","false");
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
  const email = $("emailInput")?.value.trim();
  const pass = $("passwordInput")?.value.trim();
  if (!email || !pass) return alert("Enter email + password");

  try {
    const cred = await signInWithEmail(email, pass);
    handleFirstLogin(cred.user);
  } catch (err) {
    alert(err.message);
  }
});

$("btnEmailRegister")?.addEventListener("click", async () => {
  const email = $("emailInput")?.value.trim();
  const pass = $("passwordInput")?.value.trim();
  if (!email || !pass) return alert("Enter email + password");

  try {
    const cred = await registerWithEmail(email, pass);
    await cred.user.sendEmailVerification();
    handleFirstLogin(cred.user);
  } catch (err) {
    alert(err.message);
  }
});


$("logoutBtn").onclick = async () => {
  await signOutUser();
  localStorage.clear();
  location.reload();
};

// =============================
// TELEPROMPTER ENGINE
// =============================
function startScroll() {
  const text = scriptBox.value.trim();
  if (!text) return;

  // if first time showing display (was hidden), set content and reset scroll
  const startingFresh = displayBox.style.display === "none" || displayBox.getAttribute('data-init') !== 'true';

  if (startingFresh) {
    textBox.textContent = text;
    // reset transform origin and position
    textBox.style.transform = '';
    scrollY = 0;
    displayBox.setAttribute('data-init', 'true');
  }

  displayBox.style.display = "block";
  scriptBox.style.display = "none";
  editBtn.style.display = "inline-block";

  playing = true;

  clearInterval(tick);
  tick = setInterval(() => {
    // update scroll position
    scrollY -= parseFloat(speedControl.value);
    // compute transform string: mirror or normal
    if (mirrored) {
  textBox.style.transform = `translateY(${scrollY}px) scaleX(-1)`;
} else {
  textBox.style.transform = `translateY(${scrollY}px)`;
}

    // detect end of text and apply repeat if enabled
    const contentHeight = textBox.getBoundingClientRect().height;
    const containerHeight = displayBox.getBoundingClientRect().height;
    if (Math.abs(scrollY) > (contentHeight - containerHeight)) {
      if (repeatMode) {
        // restart from top
        scrollY = 0;
      } else {
        // stop at end
        stopScroll();
      }
    }
  }, 30);

  playBtn.textContent = "Pause";
}

function stopScroll() {
  playing = false;
  clearInterval(tick);
  playBtn.textContent = "Play";
}

playBtn.onclick = () => (playing ? stopScroll() : startScroll());

editBtn.onclick = () => {
  stopScroll();
  displayBox.style.display = "none";
  scriptBox.style.display = "block";
  editBtn.style.display = "none";
};

// Speed fix
speedControl.oninput = () => {
  // no need to do anything, interval reads value live
};

// Font size fix
fontSizeControl.oninput = () => {
  textBox.style.fontSize = fontSizeControl.value + "px";
};

// mirror toggle
const mirrorToggle = document.getElementById('mirrorToggle');
if (mirrorToggle) {
  mirrored = mirrorToggle.checked;
  mirrorToggle.addEventListener('change', (e) => {
    mirrored = e.target.checked;
    // re-apply transform to reflect mirror immediately
    const translate = `translateY(${scrollY}px)`;
    textBox.style.transform = mirrored ? `scaleX(-1) ${translate}` : translate;
  });
}

// repeat toggle
const repeatToggle = document.getElementById('autoRepeat');
if (repeatToggle) {
  repeatMode = repeatToggle.checked;
  repeatToggle.addEventListener('change', (e) => { repeatMode = e.target.checked; });
}

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
    const txt = safe('scriptInput') ? safe('scriptInput').value : '';
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
    const content = scriptBox ? scriptBox.value : '';
    title.value = document.getElementById('newTitle').value || 'Untitled';
    text.value = content;
    if (modal) modal.setAttribute('aria-hidden', 'false');
  });
}
