import {setupGestures} from './gestures.js';
import {setupScripts} from './scripts.js';
import {ensureFullscreenToggle} from './fullscreen.js';

const playPauseBtn = document.getElementById('playPause');
const speedControl = document.getElementById('speedControl');
const fontSizeControl = document.getElementById('fontSizeControl');
const mirrorToggle = document.getElementById('mirrorToggle');
const autoRepeat = document.getElementById('autoRepeat');
const editButton = document.getElementById('editButton');
const scriptInput = document.getElementById('scriptInput');
const displayText = document.getElementById('displayText');
const textContent = document.getElementById('textContent');
const controls = document.getElementById('controls');

let isPlaying = false;
let scrollY = 0;
let scrollSpeed = parseFloat(speedControl.value);
let scrollTimer = null;
let hideTimeout = null;
controls.classList.remove('hidden'); // ensure visible on load

function applyTransform(){
  const mirror = mirrorToggle && mirrorToggle.checked ? 'scaleX(-1)' : 'scaleX(1)';
  textContent.style.transform = `${mirror} translateY(${scrollY}px)`;
}

function autoFitFont(){
  const maxHeight = displayText.clientHeight - 4;
  let size = parseInt(fontSizeControl.value,10) || 32;
  textContent.style.fontSize = size + 'px';
  while(textContent.scrollHeight > maxHeight && size > 12){
    size = Math.max(12, Math.floor(size * 0.92));
    textContent.style.fontSize = size + 'px';
  }
  const target = parseInt(fontSizeControl.value,10) || 32;
  while(textContent.scrollHeight <= maxHeight && size < target){
    size = Math.min(target, Math.ceil(size * 1.04));
    textContent.style.fontSize = size + 'px';
    if(textContent.scrollHeight > maxHeight) { size = Math.max(12, Math.floor(size*0.92)); textContent.style.fontSize = size+'px'; break; }
  }
}

function startScroll(){
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
  // start the interval for smooth scrolling
  scrollTimer = setInterval(()=> {
    scrollY -= scrollSpeed;
    applyTransform();
    const maxScroll = textContent.scrollHeight - displayText.clientHeight;
    if(Math.abs(scrollY) >= maxScroll){
      if(autoRepeat.checked){ scrollY = 0; applyTransform(); }
      else pauseScroll();
    }
  }, 30);
  // hide controls shortly after starting playback for immersion
  showControlsTemporarily(false, 1500);
}

function pauseScroll(){
  clearInterval(scrollTimer);
  scrollTimer = null;
  isPlaying = false;
  playPauseBtn.textContent = 'Play';
  ensureFullscreenToggle(false);
  showControlsTemporarily(true);
}

function togglePlay(){ isPlaying ? pauseScroll() : startScroll(); }

function enableEdit(){
  pauseScroll();
  displayText.style.display = 'none';
  scriptInput.style.display = 'block';
  editButton.style.display = 'none';
}

// Controls visibility (auto-hide)
function showControlsTemporarily(visible=true, duration=3000){
  if(visible){
    controls.classList.remove('hidden');
    if(hideTimeout){ clearTimeout(hideTimeout); hideTimeout = null; }
    return;
  }
  // schedule hide after duration
  if(hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(()=>{
    controls.classList.add('hidden');
    hideTimeout = null;
  }, duration);
}

// show on tap
displayText.addEventListener('click', ()=> {
  controls.classList.remove('hidden');
  if(isPlaying){
    if(hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(()=> controls.classList.add('hidden'), 3000);
  }
});

// event listeners
playPauseBtn.addEventListener('click', togglePlay);
editButton.addEventListener('click', enableEdit);
speedControl.addEventListener('input', ()=> { scrollSpeed = parseFloat(speedControl.value); });
fontSizeControl.addEventListener('input', ()=> { textContent.style.fontSize = fontSizeControl.value + 'px'; });
mirrorToggle && mirrorToggle.addEventListener('change', applyTransform);
scriptInput.addEventListener('input', ()=> {
  const sample = scriptInput.value.slice(0,10);
  document.body.dir = /[\u0600-\u06FF]/.test(sample) ? 'rtl' : 'ltr';
  // auto-save handled by scripts module
});

// keyboard (desktop)
document.addEventListener('keydown', e => {
  if(e.code === 'Space'){ e.preventDefault(); togglePlay(); }
});

// responsive: recalc font on resize/orientation
window.addEventListener('resize', ()=> {
  if(displayText.style.display !== 'none') autoFitFont();
});

// init modules
setupGestures({onTap:()=>{ togglePlay(); }, onSwipeUp:()=>{ speedControl.value = Math.min(10, +speedControl.value + 0.5); scrollSpeed = +speedControl.value; }, onSwipeDown:()=>{ speedControl.value = Math.max(1, +speedControl.value - 0.5); scrollSpeed = +speedControl.value; }, onPinchChange:(delta)=>{ let s = parseInt(getComputedStyle(textContent).fontSize); s = Math.max(12, Math.min(120, Math.round(s * delta))); textContent.style.fontSize = s + 'px'; fontSizeControl.value = s; }});

setupScripts({ scriptInput, fileInput: document.getElementById('fileInput'), scriptsBtn: document.getElementById('scriptsBtn'), scriptsModal: document.getElementById('scriptsModal'), scriptsList: document.getElementById('scriptsList'), newScriptForm: document.getElementById('newScriptForm'), newTitle: document.getElementById('newTitle'), newText: document.getElementById('newText'), importBtn: document.getElementById('importBtn'), exportBtn: document.getElementById('exportBtn'), onLoadScript: (text)=>{ scriptInput.value = text; localStorage.setItem('teleprompter_script', text); }});

ensureFullscreenToggle(false);

// load saved script (auto)
const saved = localStorage.getItem('teleprompter_script');
if(saved) scriptInput.value = saved;
