// js/core.js
import { 
  initAuth,
  onAuthReady,
  signInGoogle,
  getCurrentUser,
  signOutUser
} from './auth.js';

import { analytics_log } from './analytics.js';
import * as cloud from './cloud.js';
import { setupGestures } from './gestures.js';
import { setupScripts, renderScripts } from './scripts.js';
import { ensureFullscreenToggle } from './fullscreen.js';

const byId = id => document.getElementById(id);

const playPauseBtn = byId('playPause');
const speedControl = byId('speedControl');
const fontSizeControl = byId('fontSizeControl');
const mirrorToggle = byId('mirrorToggle');
const autoRepeat = byId('autoRepeat');
const editButton = byId('editButton');
const scriptInput = byId('scriptInput');
const displayText = byId('displayText');
const textContent = byId('textContent');
const controls = byId('controls');

let isPlaying = false;
let scrollY = 0;
let scrollSpeed = parseFloat(speedControl?.value || 3);
let scrollTimer = null;
let hideTimeout = null;
let saveFontDebounce = null;

if (controls) controls.classList.remove('hidden');

// ---------------- AUTH INIT ----------------
initAuth();

onAuthReady(async (user) => {
  console.log("AUTH STATE CHANGED:", user);

  const status = byId("authStatus");
  const logoutBtn = byId("logoutBtn");

  if (user) {
    if (status) status.innerHTML = "Signed in as: " + (user.email || "Google User");
    const authPanel = byId('authPanel');
    if (authPanel) authPanel.setAttribute("aria-hidden", "true");
    if (logoutBtn) logoutBtn.style.display = "inline-block";

    analytics_log("auth_sign_in", { uid: user.uid });

    // Refresh scripts from cloud (defensive)
    try {
      await loadCloudScriptsIntoLocal();
    } catch (err) {
      console.warn("cloud sync error:", err);
    }
  } else {
    if (status) status.innerHTML = "Not signed in";
    if (logoutBtn) logoutBtn.style.display = "none";

    analytics_log("auth_sign_out", {});
  }
});

// ---------------- TELEPROMPTER ----------------

function applyTransform(){
  if (!textContent) return;
  const mirror = (mirrorToggle && mirrorToggle.checked) ? 'scaleX(-1)' : 'scaleX(1)';
  textContent.style.transform = `${mirror} translateY(${scrollY}px)`;
}

function autoFitFont(){
  if (!displayText || !textContent || !fontSizeControl) return;
  const maxHeight = displayText.clientHeight - 4;
  let size = parseInt(fontSizeControl.value,10) || 32;
  textContent.style.fontSize = size + 'px';
  // shrink if overflow
  while(textContent.scrollHeight > maxHeight && size > 12){
    size = Math.max(12, Math.floor(size * 0.92));
    textContent.style.fontSize = size + 'px';
  }
  const target = parseInt(fontSizeControl.value,10) || 32;
  // grow until target but stop if overflows
  while(textContent.scrollHeight <= maxHeight && size < target){
    size = Math.min(target, Math.ceil(size * 1.04));
    textContent.style.fontSize = size + 'px';
    if(textContent.scrollHeight > maxHeight){
      size = Math.max(12, Math.floor(size*0.92));
      textContent.style.fontSize = size+'px';
      break;
    }
  }
}

function startScroll(){
  if (!scriptInput || !textContent || !displayText || !editButton || !playPauseBtn) return;

  const text = scriptInput.value.trim();
  if(!text) return;
  textContent.innerText = text;
  displayText.style.display = 'block';
  scriptInput.style.display = 'none';
  editButton.style.display = 'inline-block';
  playPauseBtn.textContent = 'Pause';
  isPlaying = true;
  scrollY = 0;
  applyTransform();
  autoFitFont();
  ensureFullscreenToggle(true);

  clearInterval(scrollTimer);
  scrollTimer = setInterval(()=> {
    scrollY -= scrollSpeed;
    applyTransform();
    const maxScroll = textContent.scrollHeight - displayText.clientHeight;
    if(Math.abs(scrollY) >= maxScroll){
      if(autoRepeat && autoRepeat.checked){ scrollY = 0; applyTransform(); }
      else pauseScroll();
    }
  }, 30);

  analytics_log("play_toggle", { playing: true });

  showControlsTemporarily(false, 1500);
}

function pauseScroll(){
  clearInterval(scrollTimer);
  scrollTimer = null;
  isPlaying = false;
  if (playPauseBtn) playPauseBtn.textContent = 'Play';
  ensureFullscreenToggle(false);

  analytics_log("play_toggle", { playing: false });

  showControlsTemporarily(true);
}

function togglePlay(){ isPlaying ? pauseScroll() : startScroll(); }

function enableEdit(){
  pauseScroll();
  if (displayText) displayText.style.display = 'none';
  if (scriptInput) scriptInput.style.display = 'block';
  if (editButton) editButton.style.display = 'none';
}

function showControlsTemporarily(visible=true, duration=3000){
  if (!controls) return;
  if(visible){
    controls.classList.remove('hidden');
    if(hideTimeout){ clearTimeout(hideTimeout); hideTimeout = null; }
    return;
  }
  if(hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(()=>{
    controls.classList.add('hidden');
    hideTimeout = null;
  }, duration);
}

// Click display to show controls
if (displayText) {
  displayText.addEventListener('click', ()=> {
    if (!controls) return;
    controls.classList.remove('hidden');
    if(isPlaying){
      if(hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(()=> controls.classList.add('hidden'), 3000);
    }
  });
}

// Input handlers (safe)
if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
if (editButton) editButton.addEventListener('click', enableEdit);
if (speedControl) speedControl.addEventListener('input', ()=> { scrollSpeed = parseFloat(speedControl.value); });

// font size slider update (debounced save)
if (fontSizeControl) {
  fontSizeControl.addEventListener('input', ()=> {
    if (!textContent) return;
    textContent.style.fontSize = fontSizeControl.value + 'px';
    if (saveFontDebounce) clearTimeout(saveFontDebounce);
    saveFontDebounce = setTimeout(()=> {
      localStorage.setItem('teleprompter_fontSize', fontSizeControl.value);
    }, 400);
  });
}

if (mirrorToggle) mirrorToggle.addEventListener('change', applyTransform);

if (scriptInput) {
  scriptInput.addEventListener('input', ()=> {
    const sample = scriptInput.value.slice(0,10);
    document.body.dir = /[\u0600-\u06FF]/.test(sample) ? 'rtl' : 'ltr';
    // auto save
    localStorage.setItem('teleprompter_script', scriptInput.value || '');
  });
}

// keyboard support
document.addEventListener('keydown', e => {
  if(e.code === 'Space'){ e.preventDefault(); togglePlay(); }
});

// responsive
window.addEventListener('resize', ()=> {
  if(displayText && displayText.style.display !== 'none') autoFitFont();
});

// ---------------- INIT MODULES ----------------
setupGestures({
  onTap:()=>{ togglePlay(); },
  onSwipeUp:()=>{ if (speedControl) { speedControl.value = Math.min(10, +speedControl.value + 0.5); scrollSpeed = +speedControl.value; } },
  onSwipeDown:()=>{ if (speedControl) { speedControl.value = Math.max(1, +speedControl.value - 0.5); scrollSpeed = +speedControl.value; } },
  onPinchChange:(delta)=>{ 
    if (!textContent || !fontSizeControl) return;
    let s = parseInt(getComputedStyle(textContent).fontSize);
    s = Math.max(12, Math.min(120, Math.round(s * delta)));
    textContent.style.fontSize = s + 'px';
    fontSizeControl.value = s;
  }
});

// Load saved scripts module
setupScripts({ 
  scriptInput,
  fileInput: byId('fileInput'),
  scriptsBtn: byId('scriptsBtn'),
  scriptsModal: byId('scriptsModal'),
  scriptsList: byId('scriptsList'),
  newScriptForm: byId('newScriptForm'),
  newTitle: byId('newTitle'),
  newText: byId('newText'),
  importBtn: byId('importBtn'),
  exportBtn: byId('exportBtn'),
  onLoadScript: (text)=>{ 
    if (scriptInput) {
      scriptInput.value = text;
      localStorage.setItem('teleprompter_script', text);
    }
  }
});

// restore font size and script if present
try {
  const savedFont = localStorage.getItem('teleprompter_fontSize');
  if (savedFont && fontSizeControl && textContent) {
    fontSizeControl.value = savedFont;
    textContent.style.fontSize = savedFont + 'px';
  }
  const savedScript = localStorage.getItem('teleprompter_script');
  if (savedScript && scriptInput) scriptInput.value = savedScript;
} catch(e){ /* ignore storage errors */ }

ensureFullscreenToggle(false);

// ---------------- CLOUD SYNC ----------------
async function loadCloudScriptsIntoLocal() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const cloudList = await cloud.loadCloudScripts(user);
    if (!Array.isArray(cloudList)) return;
    localStorage.setItem("teleprompter_scripts", JSON.stringify(cloudList));
    console.log("Loaded cloud scripts:", cloudList);
    renderScripts(cloudList);
  } catch (err) {
    console.error("Cloud load error:", err);
  }
}

// ---------------- AUTH PANEL UI ----------------
if (byId("authOpen")) {
  byId("authOpen").onclick = () => {
    const panel = byId("authPanel");
    if (panel) panel.setAttribute("aria-hidden", "false");
  };
}

if (byId("authClose")) {
  byId("authClose").onclick = () => {
    const panel = byId("authPanel");
    if (panel) panel.setAttribute("aria-hidden", "true");
  };
}

if (byId("btnGoogle")) {
  byId("btnGoogle").onclick = async () => {
    try { await signInGoogle(); } catch(e){ console.warn('Google sign in canceled/error', e); }
  };
}

// Disable non-functional buttons (defensive)
["btnGuest", "btnPhone", "btnEmail"].forEach(id => {
  const el = byId(id);
  if (el) {
    el.disabled = true;
    el.style.opacity = "0.4";
    el.style.cursor = "not-allowed";
  }
});

if (byId("logoutBtn")) {
  byId("logoutBtn").onclick = async () => {
    try {
      await signOutUser();
      alert("Logged out!");
    } catch(e){
      console.warn("logout failed:", e);
    }
  };
}
