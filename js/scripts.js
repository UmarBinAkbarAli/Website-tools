import SyncManager from './sync-manager.js';

const STORAGE_KEY = "teleprompter_scripts";

let modal, listBox, inputBox;
let scripts = [];
let currentEditingId = null;

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

  try {
    scripts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    scripts = [];
  }

  renderScripts(scripts);

  // Open modal NEW mode
  opt.scriptsBtn.onclick = () => {
    currentEditingId = null;
    opt.saveScriptBtn.textContent = "Save";
    opt.newTitle.value = "";
    opt.newText.value = "";
    modal.setAttribute("aria-hidden", "false");
  };

  // Close modal
  document.getElementById("closeScripts").onclick = () => {
    modal.setAttribute("aria-hidden", "true");
  };

  // SAVE / UPDATE
  opt.newScriptForm.onsubmit = async (e) => {
    e.preventDefault();

    const titleVal = opt.newTitle.value.trim() || "Untitled";
    const textVal = opt.newText.value;

    if (currentEditingId) {
      // UPDATE
      const entry = {
        id: currentEditingId,
        title: titleVal,
        text: textVal,
        updatedAt: Date.now()
      };

      scripts = scripts.map(s =>
        String(s.id) === String(entry.id) ? entry : s
      );

      renderScripts(scripts);
      SyncManager.saveOrQueue(entry);

      currentEditingId = null;
      opt.saveScriptBtn.textContent = "Save";

    } else {
      // NEW
      const entry = {
        id: Date.now().toString(),
        title: titleVal,
        text: textVal,
        updatedAt: Date.now()
      };

      scripts.unshift(entry);
      renderScripts(scripts);
      SyncManager.saveOrQueue(entry);
    }

    opt.newTitle.value = "";
    opt.newText.value = "";
    modal.setAttribute("aria-hidden", "true");
  };

  // IMPORT
  opt.importBtn.onclick = () => opt.fileInput.click();
  opt.fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => (inputBox.value = ev.target.result);
    r.readAsText(f);
  };

  // EXPORT
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

  // LOAD
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.onclick = () => {
    inputBox.value = s.text;
    currentEditingId = s.id;
    modal.setAttribute("aria-hidden", "true");
  };

  // EDIT
  const editBtn = document.createElement("button");
  editBtn.textContent = "Edit";
  editBtn.onclick = () => {
    const title = document.getElementById("newTitle");
    const text = document.getElementById("newText");

    title.value = s.title || "";
    text.value = s.text || "";

    currentEditingId = s.id;
    document.getElementById("saveScriptBtn").textContent = "Update";

    modal.setAttribute("aria-hidden", "false");
  };

  // DELETE
  const delBtn = document.createElement("button");
  delBtn.textContent = "Delete";
  delBtn.onclick = () => {
    if (!confirm("Delete?")) return;

    scripts = scripts.filter(x => x.id !== s.id);
    renderScripts(scripts);

    SyncManager.deleteOrQueue(s.id);
  };

  actions.append(loadBtn, editBtn, delBtn);
  li.append(actions);

  return li;
}
  