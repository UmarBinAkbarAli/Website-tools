import {
  initAuth,
  onAuthReady,
  signInGoogle,
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

// =============================
// AUTH
// =============================
initAuth();

onAuthReady(async user => {
  if (user) {
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

  textBox.textContent = text;
  displayBox.style.display = "block";
  scriptBox.style.display = "none";
  editBtn.style.display = "inline-block";

  scrollY = 0;
  playing = true;

  clearInterval(tick);
  tick = setInterval(() => {
    scrollY -= parseFloat(speedControl.value);
    textBox.style.transform = `translateY(${scrollY}px)`;
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
