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
  inputBox = opt.scriptInput; // This is now a DIV, not textarea

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
    opt.newText.innerHTML = ""; // FIXED: innerHTML
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
    const textVal = opt.newText.innerHTML; // FIXED: innerHTML

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
    opt.newText.innerHTML = ""; // FIXED: innerHTML
    modal.setAttribute("aria-hidden", "true");
  };

// IMPORT
  opt.importBtn.onclick = () => opt.fileInput.click();
  opt.fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    const fileName = f.name.toLowerCase();
    const fileType = fileName.substring(fileName.lastIndexOf('.') + 1);
    
    // Function to set the content (used by all file types)
    const setContent = (content) => {
      inputBox.innerHTML = content;
      // Set the title automatically for convenience
      opt.newTitle.value = fileName.replace(`.${fileType}`, '').substring(0, 50) || 'Imported Script';
      e.target.value = ''; // Reset input
    };
    
    // ----------------------------------------------------------------
    // 1. DOCX Handling (Your existing code)
    // ----------------------------------------------------------------
    if (fileType === 'docx') {
      if (typeof window.mammoth === 'undefined') {
        return alert("DOCX parser not loaded. Please ensure the app is online.");
      }
      const r = new FileReader();
      r.onload = (ev) => {
        window.mammoth.convertToHtml({ arrayBuffer: ev.target.result })
          .then((result) => setContent(result.value))
          .catch((err) => {
            alert("Error parsing DOCX file: " + err.message);
            console.error(err);
          });
      };
      r.readAsArrayBuffer(f);

    // ----------------------------------------------------------------
    // 2. PDF Handling (NEW STRUCTURAL FIX)
    // ----------------------------------------------------------------
    } else if (fileType === 'pdf') {
      if (typeof pdfjsLib === 'undefined') {
        return alert("PDF parser not loaded. Please ensure the app is online.");
      }
      const r = new FileReader();
      r.onload = async (ev) => {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: ev.target.result }).promise;
          let fullText = '';
          
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            
            // Extract text items and join them with spaces. 
            // We insert a double newline after each page for better separation.
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n'; 
          }
          
          // IMPROVEMENT: Convert raw text into structured HTML paragraphs.
          // We split by double newline (\n\n) to correctly create paragraphs.
          const htmlContent = fullText.split('\n\n').map(p => 
            p.trim() ? `<p>${p.trim().replace(/\n/g, '<br>')}</p>` : ''
          ).join('');
          
          setContent(htmlContent);

        } catch (err) {
          alert("Error processing PDF: " + err.message);
          console.error(err);
        }
      };
      r.readAsArrayBuffer(f);
      
    // ----------------------------------------------------------------
    // 3. TXT Handling
    // ----------------------------------------------------------------
    } else if (fileType === 'txt') {
      const r = new FileReader();
      r.onload = (ev) => setContent(ev.target.result);
      r.readAsText(f);
      
    } else {
      alert("Unsupported file type: " + fileType);
    }
  };

  // EXPORT
  opt.exportBtn.onclick = () => {
    // FIXED: innerText for plain text export, or innerHTML if you want HTML
    const blob = new Blob([inputBox.innerText], { type: "text/plain" });
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

  // Strip HTML for the preview snippet
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = s.text || "";
  const plainText = tempDiv.innerText.slice(0, 100);

  li.innerHTML = `
    <div>
      <strong>${s.title}</strong>
      <div class="muted">${plainText}...</div>
    </div>
  `;

  const actions = document.createElement("div");

  // LOAD
  const loadBtn = document.createElement("button");
  loadBtn.textContent = "Load";
  loadBtn.onclick = () => {
    inputBox.innerHTML = s.text; // FIXED: innerHTML
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
    text.innerHTML = s.text || ""; // FIXED: innerHTML

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