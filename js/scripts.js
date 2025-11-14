// js/scripts.js
import { analytics_log } from './analytics.js';
import { getCurrentUser } from './auth.js';
import * as cloud from './cloud.js';

const STORAGE_KEY = 'teleprompter_scripts';
const CURRENT_KEY = 'teleprompter_script';
let lastRenderList = [];

/**
 * Public API:
 * - setupScripts(opts) : initialize script manager UI
 * - renderScripts(list) : set saved list programmatically & render
 */
export function renderScripts(list){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  } catch(e){ console.warn('renderScripts storage fail', e); }
  lastRenderList = Array.isArray(list) ? list.slice() : [];
  _renderListToDom();
}

export function setupScripts(opts){
  const {
    scriptInput,
    fileInput,
    scriptsBtn,
    scriptsModal,
    scriptsList,
    newScriptForm,
    newTitle,
    newText,
    importBtn,
    exportBtn,
    onLoadScript
  } = opts || {};

  function readList(){ 
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return []; } 
  }
  function writeList(list){ 
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list || [])); } catch(e){ console.warn('writeList failed', e); }
    lastRenderList = Array.isArray(list) ? list.slice() : [];
    _renderListToDom(); 
  }

  function saveCurrentScript(){ 
    try { localStorage.setItem(CURRENT_KEY, scriptInput ? scriptInput.value : ''); } catch(e){}
  }

  // keep local draft updated
  if (scriptInput) scriptInput.addEventListener('input', () => { saveCurrentScript(); });

  if (scriptsBtn && scriptsModal) {
    scriptsBtn.addEventListener('click', ()=> { scriptsModal.setAttribute('aria-hidden','false'); _renderListToDom(); });
  }
  if (document.getElementById('closeScripts') && scriptsModal) {
    document.getElementById('closeScripts').addEventListener('click', ()=> scriptsModal.setAttribute('aria-hidden','true'));
  }

  if (newScriptForm) {
    newScriptForm.addEventListener('submit', async e => {
      e.preventDefault();
      const title = (newTitle && newTitle.value.trim()) ? newTitle.value.trim() : 'Untitled';
      const text = (newText && newText.value) ? newText.value : '';
      const list = readList();
      const newId = Date.now();
      const item = { id: newId, title, text };
      list.unshift(item);
      writeList(list);
      if (newTitle) newTitle.value = '';
      if (newText) newText.value = '';

      const user = getCurrentUser();
      if (user) {
        try { await cloud.saveCloudScript(user, item); } catch(e){ console.warn('cloud.saveCloudScript failed', e); }
      }

      analytics_log("script_saved", { id: newId, length: text.length });
    });
  }

  // clear current script
  const clearBtn = document.getElementById('clearScript');
  if (clearBtn) clearBtn.addEventListener('click', ()=> {
    if (!scriptInput) return;
    if(confirm('Clear current script?')){
      scriptInput.value='';
      saveCurrentScript();
    }
  });

  async function handleDelete(itemId){
    const list = readList().filter(i => i.id !== itemId);
    writeList(list);
    const user = getCurrentUser();
    if (user) {
      try { await cloud.deleteCloudScript(user, itemId); } catch(e){ console.warn('cloud.deleteCloudScript failed', e); }
    }
    analytics_log("script_deleted", { id: itemId });
  }

  // render helper uses closure UI refs
  function makeListItem(item){
    const li = document.createElement('li');
    const title = document.createElement('div');
    title.innerHTML = `<strong>${escapeHtml(item.title)}</strong><div class="muted">${(item.text||'').slice(0,80)}</div>`;
    li.appendChild(title);

    const actions = document.createElement('div');
    actions.className = 'script-actions';

    const load = document.createElement('button');
    load.textContent='Load';
    load.addEventListener('click', ()=> {
      if (!scriptInput) return;
      scriptInput.value = item.text;
      saveCurrentScript();
      if (scriptsModal) scriptsModal.setAttribute('aria-hidden','true');
      if (typeof onLoadScript === 'function') onLoadScript(item.text);
    });

    const del = document.createElement('button');
    del.textContent='Delete';
    del.addEventListener('click', async ()=> {
      if (confirm(`Delete "${item.title}"?`)) {
        await handleDelete(item.id);
      }
    });

    actions.appendChild(load);
    actions.appendChild(del);
    li.appendChild(actions);
    return li;
  }

  function _renderListToDom(){
    const list = readList();
    if (scriptsList) {
      scriptsList.innerHTML = '';
      list.forEach(item => {
        scriptsList.appendChild(makeListItem(item));
      });
    }
  }

  // import
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', (e)=> {
      const f = e.target.files[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ev => { 
        if (scriptInput) {
          scriptInput.value = ev.target.result; 
          saveCurrentScript(); 
          alert('Imported'); 
          analytics_log("script_imported", { length: ev.target.result.length });
        }
      };
      reader.readAsText(f);
      // reset input
      fileInput.value = '';
    });
  }

  // export
  if (exportBtn) {
    exportBtn.addEventListener('click', ()=> {
      const txt = scriptInput ? scriptInput.value : '';
      const blob = new Blob([txt], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = 'script.txt'; 
      a.click();
      URL.revokeObjectURL(url);
      analytics_log("script_exported", { length: txt.length });
    });
  }

  // initial draw
  _renderListToDom();
} // setupScripts

// small utility
function escapeHtml(s){
  return (s||'').replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}
