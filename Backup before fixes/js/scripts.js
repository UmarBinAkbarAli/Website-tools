import SyncManager from './sync-manager.js';
import { getCurrentUser } from './auth.js';

const STORAGE_KEY = "teleprompter_scripts";

let modal, listBox, inputBox;
let scripts = [];

// -----------------------------
// RENDER LIST
// -----------------------------
export function renderScripts(arr) {
  scripts = arr || [];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));

  if (!listBox) return;

  listBox.innerHTML = "";
  scripts.forEach(s => listBox.appendChild(buildItem(s)));
}

// -----------------------------
// SETUP
// -----------------------------
export function setupScripts(opt) {
  modal = opt.scriptsModal;
  listBox = opt.scriptsList;
  inputBox = opt.scriptInput;

  // Load local first
  try { scripts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { scripts = []; }

  renderScripts(scripts);

  // open modal
  opt.scriptsBtn.onclick = () => {
    modal.setAttribute("aria-hidden", "false");
    renderScripts(scripts);
  };

  // close modal
  document.getElementById("closeScripts").onclick =
    () => modal.setAttribute("aria-hidden", "true");

  // -----------------------------
  // SAVE NEW SCRIPT
  // -----------------------------
  opt.newScriptForm.onsubmit = async e => {
    e.preventDefault();

    const entry = {
  id: Date.now().toString(),
  title: opt.newTitle.value.trim() || "Untitled",
  text: opt.newText.value,
  updatedAt: Date.now()
};


    scripts.unshift(entry);
    renderScripts(scripts);

    opt.newTitle.value = "";
    opt.newText.value = "";

    // ALWAYS QUEUE TO CLOUD
    SyncManager.saveOrQueue(entry);
  };   // <---- YOU WERE MISSING THIS BRACKET !!

  // -----------------------------
  // IMPORT
  // -----------------------------
  opt.importBtn.onclick = () => opt.fileInput.click();

  opt.fileInput.onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => inputBox.value = ev.target.result;
    r.readAsText(f);
  };

  // -----------------------------
  // EXPORT
  // -----------------------------
  opt.exportBtn.onclick = () => {
    const blob = new Blob([inputBox.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.txt";
    a.click();
  };
}

// -----------------------------
// BUILD LIST ITEM
// -----------------------------
function buildItem(s) {
  const li = document.createElement("li");

  li.innerHTML = `
    <div>
      <strong>${s.title}</strong>
      <div class="muted">${(s.text || "").slice(0, 100)}</div>
    </div>
  `;

  const actions = document.createElement("div");

  // LOAD BUTTON
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.onclick = () => {
    inputBox.value = s.text;
    modal.setAttribute("aria-hidden","true");
  };

  // DELETE BUTTON
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => {
    if (!confirm("Delete?")) return;

    scripts = scripts.filter(x => x.id !== s.id);
    renderScripts(scripts);

    // DELETE FROM SYNC MANAGER
    SyncManager.deleteOrQueue(s.id);
  };

  actions.append(loadBtn, delBtn);
  li.append(actions);

  return li;
}
