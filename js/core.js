import {
  initAuth,
  onAuthReady,
  signInGoogle,
  signInWithEmail,
  registerWithEmail,
  resetPassword,
  verifyEmail,
  resendVerification,
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
const toolbar = $("toolbar");
const countdownEl = $("countdown");
const timeDisplay = $("timeLeft");
const mirrorToggle = $("mirrorToggle"); 
const repeatToggle = $("autoRepeat");
const wpmDisplay = $("wpmDisplay");
const bgColorPicker = $("bgColorPicker");
const textColorPicker = $("textColorPicker");
const greenScreenBtn = $("greenScreenBtn");
const prevMarkerBtn = $("prevMarkerBtn");
const nextMarkerBtn = $("nextMarkerBtn");
const btnCaps = $("btnCaps");
const btnAlign = $("btnAlign");
const btnSpacing = $("btnSpacing");

// NEW CONTROLS
const widthControl = $("widthControl");
const fontControl = $("fontControl");
const guideToggle = $("guideToggle");
const focusGuide = $("focusGuide");

let attemptedLogin = false;
let playing = false;
let countdownActive = false;
let scrollY = 0;
let tick = null;
let mirrored = false;
let repeatMode = false;
let isCaps = false;      // <-- PASTE THIS
let isCentered = false;  // <-- PASTE THIS
let spacingLevel = 1;    // <-- PASTE THIS

// =============================
// FIRST TIME LOGIN CHECK
// =============================
function handleFirstLogin(user) {
  if (!user) return;
  const isFirst = user.metadata.creationTime === user.metadata.lastSignInTime;

  if (isFirst) {
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
        if (attemptedLogin) {
            $("authStatus").textContent = "Email not verified";
            $("authPanel").setAttribute("aria-hidden","false");
            showError("Please verify your email before using cloud sync.");
            const rv = $("resendVerify");
            if(rv) {
              rv.style.display = "block";
              rv.onclick = async () => {
                  rv.style.display = "none";
                  showError("Sending verification email...");
                  await resendVerification(user);
                  showError("Verification email sent again.");
              };
            }
        }
        return; 
    }

    handleFirstLogin(user);
    $("authStatus").textContent = `Signed in: ${user.email || "User"}`;
    $("authPanel").setAttribute("aria-hidden", "true");
    $("logoutBtn").style.display = "inline-block";

    const list = await cloud.loadCloudScripts(user);
    renderScripts(list);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(list));
  } else {
    $("authStatus").textContent = "Not signed in";
    $("logoutBtn").style.display = "none";
  }
});

// Auto-check email verification
setInterval(async () => {
  const user = getCurrentUser();
  if (!user) return;
  await user.reload();
  if (user.emailVerified) {
    $("authError").style.display = "none";
    const rv = $("resendVerify");
    if(rv) rv.style.display = "none";
    $("authPanel").setAttribute("aria-hidden", "true");
    $("authStatus").textContent = `Signed in: ${user.email}`;
    const list = await cloud.loadCloudScripts(user);
    renderScripts(list);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(list));
  }
}, 5000);

syncBtn.onclick = () => {
    attemptedLogin = true;
    $("authPanel").setAttribute("aria-hidden", "false");
};

$("authClose").onclick = () => $("authPanel").setAttribute("aria-hidden","true");
$("btnGoogle").onclick = () => signInGoogle();

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
      showError("Please verify your email first.");
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

// =============================
// TELEPROMPTER ENGINE
// =============================

function updateWPM() {
  if (!wpmDisplay) return;
  const text = textBox.innerText || "";
  const wordCount = text.split(/\s+/).length;
  if (wordCount === 0) {
    wpmDisplay.textContent = "0 WPM";
    return;
  }
  
  // Calculate total duration in minutes based on current speed
  // Speed 1 ~= 33px/sec. Total Height / (Speed * 33) = Seconds.
  const speed = parseFloat(speedControl.value) || 1;
  const totalHeight = textBox.getBoundingClientRect().height;
  const pixelsPerSecond = speed * 33.33;
  const durationSeconds = totalHeight / pixelsPerSecond;
  
  if (durationSeconds <= 0) return;
  
  const wpm = Math.round(wordCount / (durationSeconds / 60));
  wpmDisplay.textContent = `${wpm} WPM`;
}


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

  const pxPerSec = speedVal * 33.33;
  const secondsLeft = Math.ceil(remainingPx / pxPerSec);

  const m = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');
  timeDisplay.textContent = `${m}:${s}`;
}

function applyTransform() {
  if (mirrored) {
    textBox.style.transform = `scaleX(-1) translateY(${scrollY}px)`;
  } else {
    textBox.style.transform = `translateY(${scrollY}px)`;
  }
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

function startScroll() {
  // Use innerHTML because it's a contenteditable div now
  const text = scriptBox.innerHTML; 
  if (!text) return;

  const startingFresh = displayBox.style.display === "none" || displayBox.getAttribute('data-init') !== 'true';

  if (startingFresh) {
    textBox.innerHTML = text;
    textBox.style.transform = '';
    scrollY = 0;
    displayBox.setAttribute('data-init', 'true');
  }

  displayBox.style.display = "block";
  updateWPM(); // <--- PASTE THIS HERE
  scriptBox.style.display = "none";
  if (toolbar) toolbar.style.display = "none";
  editBtn.style.display = "inline-block";

  playing = true;
  playBtn.textContent = "Pause";

  // Show guide if enabled
  if (guideToggle && guideToggle.checked) focusGuide.style.display = "block";

  clearInterval(tick);
  tick = setInterval(() => {
    scrollY -= parseFloat(speedControl.value || 1);
    applyTransform();
    updateTimeRemaining();

    // keep voice module updated with scroll position on every tick
    if (voiceModule && typeof voiceModule.setScrollY === "function") {
      try { voiceModule.setScrollY(scrollY); } catch (e) { /* ignore */ }
    }

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
  focusGuide.style.display = "none"; // Hide guide when stopped
}

playBtn.onclick = () => {
  if (playing) {
    stopScroll();
  } else {
    const isAtTop = Math.abs(scrollY) < 5;
    const isFromEditMode = displayBox.style.display === "none";

    if (isAtTop || isFromEditMode) {
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
  if (toolbar) toolbar.style.display = "flex";
  editBtn.style.display = "none";
  focusGuide.style.display = "none";
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
  const sWidth = localStorage.getItem(PREF_PREFIX + "width");
  const sFont = localStorage.getItem(PREF_PREFIX + "font");
  const sGuide = localStorage.getItem(PREF_PREFIX + "guide");
  const sCaps = localStorage.getItem(PREF_PREFIX + "caps");
  const sAlign = localStorage.getItem(PREF_PREFIX + "align");
  const sSpacing = localStorage.getItem(PREF_PREFIX + "spacing");

  if (sSpeed) speedControl.value = sSpeed;
  if (sSize) {
    fontSizeControl.value = sSize;
    textBox.style.fontSize = sSize + "px";
  }
  if (sMirror === "true") {
    mirrorToggle.checked = true;
    mirrored = true;
  }
  if (sRepeat === "true") {
    repeatToggle.checked = true;
    repeatMode = true;
  }
  
  // Load Saved Colors
  const sBg = localStorage.getItem(PREF_PREFIX + "bgColor");
  const sTxt = localStorage.getItem(PREF_PREFIX + "textColor");
  
  if (sBg) {
    bgColorPicker.value = sBg;
    document.documentElement.style.setProperty('--bg-color', sBg);
  }
  if (sTxt) {
    textColorPicker.value = sTxt;
    document.documentElement.style.setProperty('--text-color', sTxt);
  }

  // Load Width
  if (sWidth) {
    widthControl.value = sWidth;
    displayBox.style.width = `min(980px, ${sWidth}%)`;
  }
  
  // Load Font
  if (sFont) {
    fontControl.value = sFont;
    updateFontClass(sFont);
  }
  
  // Load Guide
  if (sGuide === "true") {
    guideToggle.checked = true;
  }
  
  // All Caps
  if(sCaps === "true") {
    isCaps = true;
    toggleTextClass("text-caps", true);
    if(btnCaps) btnCaps.style.color = "#00e5ff";
  }
  //Alignment
  if(sAlign === "true") {
    isCentered = true;
    toggleTextClass("text-center", true);
    if(btnAlign) btnAlign.style.color = "#00e5ff";
  }
  // line-height
  if(sSpacing) {
    spacingLevel = parseInt(sSpacing);
    toggleTextClass(`spacing-${spacingLevel}`, true);
    if(btnSpacing) btnSpacing.innerHTML = spacingLevel === 1 ? "↕" : (spacingLevel === 2 ? "↕+" : "↕++");
  }

  applyTransform();
}

// === Width Logic ===
widthControl.addEventListener("input", (e) => {
  const w = e.target.value;
  displayBox.style.width = `min(980px, ${w}%)`;
  saveSetting("width", w);
});

// === Font Logic ===
function updateFontClass(val) {
  textBox.classList.remove("font-serif", "font-mono");
  if(val === "serif") textBox.classList.add("font-serif");
  if(val === "mono") textBox.classList.add("font-mono");
}
fontControl.addEventListener("change", (e) => {
  updateFontClass(e.target.value);
  saveSetting("font", e.target.value);
});

// === Guide Logic ===
guideToggle.addEventListener("change", (e) => {
  saveSetting("guide", e.target.checked);
  // If currently playing, update visibility immediately
  if(playing) {
    focusGuide.style.display = e.target.checked ? "block" : "none";
  }
});

speedControl.addEventListener("input", (e) => {
  saveSetting("speed", e.target.value);
  updateWPM(); // Updates WPM when you change speed
});

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
  saveScriptBtn: $("saveScriptBtn"),
  importBtn: $("importBtn"),
  exportBtn: $("exportBtn"),
  fileInput: $("fileInput")
});

SyncManager.init({
  getCurrentUser,
  onAuthReady,
  renderScripts,
  cloud
});

setupGestures({ onTap: () => playBtn.click() });

setupKeyboardShortcuts({
  playBtn,
  editBtn,
  speedControl,
  fontSizeControl,
  scriptsBtn: $("scriptsBtn"),
  syncBtn: $("authOpen"),
  scriptBox
});

// =============================
// SHORTCUT OVERLAY
// =============================
const overlay = document.getElementById('shortcutOverlay');
const safe = id => document.getElementById(id);

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

if (SH_PLAY) SH_PLAY.onclick = () => safe('playPause') && safe('playPause').click();
if (SH_EDIT) SH_EDIT.onclick = () => safe('editButton') && safe('editButton').click();
if (SH_SCRIPTS) SH_SCRIPTS.onclick = () => safe('scriptsBtn') && safe('scriptsBtn').click();
if (SH_FULL) SH_FULL.onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
  else document.exitFullscreen().catch(()=>{});
};

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

if (SH_SYNC) SH_SYNC.onclick = () => safe('authOpen') && safe('authOpen').click();
if (SH_SAVE) SH_SAVE.onclick = () => {
  const form = document.getElementById('newScriptForm');
  if (form) form.requestSubmit();
  else {
    const txt = safe('scriptInput') ? safe('scriptInput').innerHTML : '';
    if (txt) {
      safe('scriptsBtn') && safe('scriptsBtn').click();
    }
  }
};
if (SH_LOGOUT) SH_LOGOUT.onclick = () => safe('logoutBtn') && safe('logoutBtn').click();

const playElem = safe('playPause');
if (playElem && overlay) {
  function updateOverlayDim(){
    if (!overlay) return;
    const isPlaying = playElem.textContent && playElem.textContent.toLowerCase().includes('pause');
    if (isPlaying) overlay.classList.add('dim'); else overlay.classList.remove('dim');
  }
  updateOverlayDim();
  playElem.addEventListener('click', () => setTimeout(updateOverlayDim, 40));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(el => {
      if (el.id === 'shortcutOverlay') return;
      el.setAttribute('aria-hidden', 'true');
    });

    if (scriptBox && scriptBox.style.display !== 'none') {
      scriptBox.blur();
      displayBox.style.display = 'none';
      focusGuide.style.display = 'none'; // Hide guide if escaping to edit mode
    }
  }
});

const quickSaveBtn = document.getElementById('quickSave');
if (quickSaveBtn) {
  quickSaveBtn.addEventListener('click', () => {
    const modal = document.getElementById('scriptsModal');
    const title = document.getElementById('newTitle');
    const text = document.getElementById('newText');
    const content = scriptBox ? scriptBox.innerHTML : '';
    title.value = document.getElementById('newTitle').value || 'Untitled';
    text.innerHTML = content;
    if (modal) modal.setAttribute('aria-hidden', 'false');
  });
}

// =============================
// CLEAN PASTE HANDLER
// =============================
const modalEditor = document.getElementById('newText');
[scriptBox, modalEditor].forEach(el => {
  if(!el) return;
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    document.execCommand("insertText", false, text);
  });
});

// =============================
// MINOR FEATURES (Colors, Green Screen, Jump)
// =============================

// 1. Color Pickers
function updateColors() {
  document.documentElement.style.setProperty('--bg-color', bgColorPicker.value);
  document.documentElement.style.setProperty('--text-color', textColorPicker.value);
  saveSetting("bgColor", bgColorPicker.value);
  saveSetting("textColor", textColorPicker.value);
}

bgColorPicker.addEventListener("input", updateColors);
textColorPicker.addEventListener("input", updateColors);

// 2. Green Screen Toggle
let chromaMode = false;
greenScreenBtn.addEventListener("click", () => {
  chromaMode = !chromaMode;
  if (chromaMode) {
    document.body.classList.add("chroma-mode");
    if(ensureFullscreenToggle) ensureFullscreenToggle(true); // Auto fullscreen
  } else {
    document.body.classList.remove("chroma-mode");
  }
});

// =============================
// MANUAL DRAG SCROLLING & TAP INTERACTION
// =============================
let isDragging = false;
let startDragY = 0;
let startScrollY = 0;
let hasMoved = false; // Fix to separate Drags from Clicks

// 1. Drag Start
displayBox.addEventListener('mousedown', startDrag);
displayBox.addEventListener('touchstart', startDrag, {passive: false});

function startDrag(e) {
  if(playing) return; // Only allow drag when paused
  if(e.target.tagName === 'BUTTON') return; 

  isDragging = true;
  hasMoved = false; // Reset movement flag
  
  startDragY = e.pageY || e.touches[0].pageY;
  startScrollY = scrollY;
  
  displayBox.classList.add('is-dragging');
}

// 2. Drag Move
window.addEventListener('mousemove', doDrag);
window.addEventListener('touchmove', doDrag, {passive: false});

function doDrag(e) {
  if(!isDragging) return;
  
  // Prevent browser scrolling
  if(e.cancelable) e.preventDefault();

  const currentY = e.pageY || e.touches[0].pageY;
  const diff = currentY - startDragY;
  
  // Only mark as "moved" if dragged more than 5 pixels (prevents sensitive clicks)
  if(Math.abs(diff) > 5) hasMoved = true;

  // Update scroll
  scrollY = startScrollY + diff;
  applyTransform();
}

// 3. Drag End
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function endDrag() {
  isDragging = false;
  displayBox.classList.remove('is-dragging');
}

// 4. Tap to Play (Smart Click Handler)
// This replaces the old click listener. It checks 'hasMoved' to ensure
// we don't accidentally Play/Pause when we just wanted to Drag.
displayBox.addEventListener("click", (e) => {
  if (hasMoved) {
    hasMoved = false; // Reset and ignore the click
    return; 
  }
  
  if (e.target.tagName === 'BUTTON') return;
  if (playBtn) playBtn.click();
});

// =============================
// CHAPTER MARKER LOGIC
// =============================

function jumpToMarker(direction) {
  // 1. Find all markers in the text
  const markers = Array.from(textBox.querySelectorAll('hr.chapter-marker'));
  
  if (markers.length === 0) {
    // If no markers, maybe jump by paragraph?
    return; 
  }

  // 2. Get current scroll position (positive)
  const currentScroll = Math.abs(scrollY);
  
  // 3. Find the visual center of the screen (where the user is reading)
  const viewCenter = displayBox.clientHeight / 3; 
  const currentReadingPos = currentScroll + viewCenter;

  let targetY = null;

  if (direction === 'next') {
    // Find first marker BELOW current reading position
    const next = markers.find(m => m.offsetTop > currentReadingPos + 50); // +50 buffer
    if (next) targetY = next.offsetTop;
  } else {
    // Find first marker ABOVE current reading position (searching backwards)
    // We reverse the array to find the closest one above
    const prev = markers.reverse().find(m => m.offsetTop < currentReadingPos - 50);
    if (prev) targetY = prev.offsetTop;
  }

  // 4. Execute Jump
  if (targetY !== null) {
    // Align marker to top-third of screen
    scrollY = -(targetY - viewCenter);
    applyTransform();
  }
}

// Wire up buttons
if(prevMarkerBtn) prevMarkerBtn.onclick = () => jumpToMarker('prev');
if(nextMarkerBtn) nextMarkerBtn.onclick = () => jumpToMarker('next');

// =============================
// TEXT FORMATTING (Caps, Align, Spacing)
// =============================

// 1. All Caps Toggle
if(btnCaps) {
  btnCaps.onclick = () => {
    isCaps = !isCaps;
    toggleTextClass("text-caps", isCaps);
    saveSetting("caps", isCaps);
    btnCaps.style.color = isCaps ? "#00e5ff" : "white";
  };
}

// 2. Alignment Toggle (Left <-> Center)
if(btnAlign) {
  btnAlign.onclick = () => {
    isCentered = !isCentered;
    toggleTextClass("text-center", isCentered);
    saveSetting("align", isCentered);
    btnAlign.style.color = isCentered ? "#00e5ff" : "white";
  };
}

// 3. Line Spacing Cycle (Normal -> Wide -> Extra)
if(btnSpacing) {
  btnSpacing.onclick = () => {
    // Remove current class
    toggleTextClass(`spacing-${spacingLevel}`, false);
    
    // Cycle to next
    spacingLevel++;
    if(spacingLevel > 3) spacingLevel = 1;
    
    // Add new class
    toggleTextClass(`spacing-${spacingLevel}`, true);
    saveSetting("spacing", spacingLevel);
    
    // Visual indicator (optional)
    btnSpacing.innerHTML = spacingLevel === 1 ? "↕" : (spacingLevel === 2 ? "↕+" : "↕++");
  };
}

// Helper: Applies class to BOTH Editor and Prompter
function toggleTextClass(className, active) {
  const elements = [textBox, scriptBox]; // Apply to both
  elements.forEach(el => {
    if(!el) return;
    if(active) el.classList.add(className);
    else el.classList.remove(className);
  });
}

// =============================
// VOICE RECOGNITION (NEW)
// =============================
import { initVoiceHighlighter } from './Speech/voice-highlighter.js';

let voiceModule = null;

const voiceStartBtn = $("voiceStart");
const voiceStopBtn = $("voiceStop");
const voiceResetBtn = $("voiceReset");
const voiceStatus = $("voiceStatus");

function initVoiceFeature() {
  voiceModule = initVoiceHighlighter({
    textBoxId: "textContent",
    displayBoxId: "displayText",
    highlighterId: "voiceHighlighter",
    lookahead: 50,
    minConfidence: 0.5,
    smoothing: 0.12
  });
}

// Enable voice buttons when play starts
const originalStartScroll = startScroll;
startScroll = function() {
  originalStartScroll.call(this);
  
  // Build word map immediately after starting play
  if (voiceModule) {
    console.log("[Core] Building voice word map from startScroll");
    voiceModule.buildWordMap();
  }
  
  // ENABLE VOICE MODULE when play starts (modified)
  if (typeof startScroll === "function" && voiceModule) {
    const originalStartScroll = startScroll;
    startScroll = function() {
      originalStartScroll.call(this);

      try {
        console.log("[Core] Building voice word map from startScroll");
        const mapCount = voiceModule.buildWordMap && voiceModule.buildWordMap();
        if (!mapCount) console.warn("[Core] voice buildWordMap returned 0 or undefined");
        if (voiceModule.setScrollY) voiceModule.setScrollY(scrollY);
      } catch (e) {
        console.warn("[Core] voice init in startScroll failed", e);
      }

      // Enable voice UI
      if (voiceStartBtn) voiceStartBtn.disabled = false;
      if (voiceResetBtn) voiceResetBtn.disabled = false;
    };
  }
};

// Disable voice buttons when stopping
const originalStopScroll = stopScroll;
stopScroll = function() {
  // STOP VOICE FIRST if active
  if (voiceModule) voiceModule.stop();
  
  originalStopScroll.call(this);
  
  // DISABLE VOICE BUTTONS
  if (voiceStartBtn) voiceStartBtn.disabled = true;
  if (voiceStopBtn) voiceStopBtn.disabled = true;
  if (voiceResetBtn) voiceResetBtn.disabled = true;
  if (voiceStatus) voiceStatus.textContent = "🎤 Ready";
};

// Voice Start Button
if (voiceStartBtn) {
  voiceStartBtn.onclick = () => {
    if (!voiceModule) initVoiceFeature();
    
    if (!playing) {
      alert("Start playing first!");
      return;
    }
    
    // CRITICAL FIX: Build word map RIGHT NOW before starting recognition
    if (voiceModule) {
      const mapCount = voiceModule.buildWordMap();
      if (mapCount === 0) {
        alert("No text found! Make sure script is loaded.");
        return;
      }
      console.log(`[Core] Voice word map built: ${mapCount} words`);
    }
    
    const success = voiceModule.start();
    if (success) {
      voiceStartBtn.disabled = true;
      voiceStopBtn.disabled = false;
      if (voiceStatus) voiceStatus.textContent = "🎤 Listening...";
    } else {
      alert("Voice recognition failed. Check browser support.");
    }
  };
}

// Voice Stop Button
if (voiceStopBtn) {
  voiceStopBtn.onclick = () => {
    if (voiceModule) voiceModule.stop();
    voiceStartBtn.disabled = false;
    voiceStopBtn.disabled = true;
    if (voiceStatus) voiceStatus.textContent = "🎤 Stopped";
  };
}

// Voice Reset Button
if (voiceResetBtn) {
  voiceResetBtn.onclick = () => {
    if (voiceModule) voiceModule.reset();
    if (voiceStatus) voiceStatus.textContent = "🎤 Reset";
  };
}

// CRITICAL FIX: Only apply main scroll if voice is NOT recording
const originalApplyTransform = applyTransform;
applyTransform = function() {
  // If voice is recording, DON'T update scroll (voice controls it)
  if (voiceModule && voiceModule.isVoiceActive && voiceModule.isVoiceActive()) {
    return;
  }
  
  originalApplyTransform.call(this);
};

// Sync mirror state with voice module
if (mirrorToggle) {
  mirrorToggle.addEventListener("change", (e) => {
    if (voiceModule) voiceModule.setMirrored(e.target.checked);
  });
}