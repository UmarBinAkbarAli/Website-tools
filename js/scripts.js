export function setupScripts(opts){
  const { scriptInput, fileInput, scriptsBtn, scriptsModal, scriptsList, newScriptForm, newTitle, newText, importBtn, exportBtn, onLoadScript } = opts;

  const STORAGE_KEY = 'teleprompter_scripts';
  const CURRENT_KEY = 'teleprompter_script';

  function readList(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ return []; } }
  function writeList(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); renderList(); }
  function saveCurrentScript(){ localStorage.setItem(CURRENT_KEY, scriptInput.value || ''); }

  scriptInput.addEventListener('input', () => { saveCurrentScript(); });

  scriptsBtn.addEventListener('click', ()=> { scriptsModal.setAttribute('aria-hidden','false'); renderList(); });
  document.getElementById('closeScripts').addEventListener('click', ()=> scriptsModal.setAttribute('aria-hidden','true'));

  newScriptForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = newTitle.value.trim() || 'Untitled';
    const text = newText.value || '';
    const list = readList();
    list.unshift({ id: Date.now(), title, text });
    writeList(list);
    newTitle.value = ''; newText.value = '';
  });

  document.getElementById('clearScript').addEventListener('click', ()=> {
    if(confirm('Clear current script?')){ scriptInput.value=''; saveCurrentScript(); }
  });

  function renderList(){
    const list = readList();
    scriptsList.innerHTML = '';
    list.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<div><strong>${escapeHtml(item.title)}</strong><div class="muted">${(item.text||'').slice(0,80)}</div></div>`;
      const actions = document.createElement('div');
      const load = document.createElement('button'); load.textContent='Load'; load.addEventListener('click', ()=> {
        scriptInput.value = item.text; saveCurrentScript(); scriptsModal.setAttribute('aria-hidden','true');
        onLoadScript && onLoadScript(item.text);
      });
      const del = document.createElement('button'); del.textContent='Delete'; del.addEventListener('click', ()=> {
        if(confirm('Delete "'+item.title+'"?')){ const newList = readList().filter(i=>i.id!==item.id); writeList(newList); }
      });
      actions.appendChild(load); actions.appendChild(del);
      li.appendChild(actions);
      scriptsList.appendChild(li);
    });
  }

  importBtn.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', (e)=> {
    const f = e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => { scriptInput.value = ev.target.result; saveCurrentScript(); alert('Imported'); };
    reader.readAsText(f);
  });

  exportBtn.addEventListener('click', ()=> {
    const txt = scriptInput.value || '';
    const blob = new Blob([txt], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'script.txt'; a.click();
    URL.revokeObjectURL(url);
  });

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  renderList();
}
