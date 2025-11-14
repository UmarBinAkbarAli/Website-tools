// js/sync-manager.js
// Sync Manager: queue local ops, flush to Firestore when auth available,
// merge cloud+local lists, retry on network/auth change.

// Usage:
// import SyncManager from './sync-manager.js';
// SyncManager.init({ getCurrentUser, onAuthReady, renderScripts, cloud });

const QUEUE_KEY = 'tele_sync_queue';
const STORAGE_KEY = 'teleprompter_scripts';

let queue = [];
let renderCb = null;
let getCurrentUser = null;
let cloudAPI = null;

function persistQueue(){ try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch(e){} }
function loadQueue(){ try { queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch(e){ queue = []; } }

function loadLocalScripts(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch(e){ return []; }
}
function saveLocalScripts(list){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list || [])); } catch(e){}
}

// merge cloud list and local list: cloud wins for same id; local-only get kept
function mergeLists(cloudList, localList){
  const map = new Map();
  // accept cloud entries first
  (cloudList || []).forEach(it => { if(it && it.id != null) map.set(String(it.id), it); });
  // then local entries if id not present
  (localList || []).forEach(it => {
    const k = it && it.id != null ? String(it.id) : null;
    if(k && !map.has(k)) map.set(k, it);
    if(!k){
      // local entry without id — assign an id and keep
      const genId = Date.now() + Math.floor(Math.random()*1000);
      it.id = genId;
      map.set(String(it.id), it);
    }
  });
  // order: cloud items first (by updatedAt desc if present), then remaining locals
  const arr = Array.from(map.values());
  arr.sort((a,b)=>{
    const ta = a.updatedAt || 0, tb = b.updatedAt || 0;
    return tb - ta;
  });
  return arr;
}

async function tryFlush(){
  const user = getCurrentUser && getCurrentUser();
  if(!user || !cloudAPI) return;
  loadQueue();
  if(queue.length === 0){
    // still merge cloud with local (to refresh UI)
    try {
      const cloudList = await cloudAPI.loadCloudScripts(user);
      const merged = mergeLists(cloudList, loadLocalScripts());
      saveLocalScripts(merged);
      renderCb && renderCb(merged);
    } catch(e){
      // ignore
    }
    return;
  }

  // process queue FIFO; stop on first failure (will retry later)
  while(queue.length){
    const op = queue[0];
    try {
      if(op.type === 'save'){
        // write to cloud; ensure id present
        const it = op.item;
        if(!it.id) it.id = Date.now().toString();
        await cloudAPI.saveCloudScript(user, it);
      } else if(op.type === 'delete'){
        await cloudAPI.deleteCloudScript(user, op.id);
      }
      queue.shift();
      persistQueue();
    } catch(err){
      console.warn('sync-manager: flush failed, will retry later', err);
      break;
    }
  }

  // after attempts, refresh cloud list and merge
  try {
    const cloudList = await cloudAPI.loadCloudScripts(user);
    const merged = mergeLists(cloudList, loadLocalScripts());
    saveLocalScripts(merged);
    renderCb && renderCb(merged);
  } catch(e){ console.warn('sync-manager: merge failed', e); }
}

function enqueueSave(item){
  // local write-through
  let local = loadLocalScripts();
  // ensure item has id
  if(!item.id) item.id = Date.now().toString();
  // put at front
  local = [item].concat(local.filter(i => String(i.id) !== String(item.id)));
  saveLocalScripts(local);
  renderCb && renderCb(local);

  // add to queue
  queue.push({ type: 'save', item });
  persistQueue();

  // try flush immediately if user available
  tryFlush();
}

function enqueueDelete(id){
  // local remove
  let local = loadLocalScripts();
  local = local.filter(i => String(i.id) !== String(id));
  saveLocalScripts(local);
  renderCb && renderCb(local);

  // add to queue
  queue.push({ type: 'delete', id });
  persistQueue();

  tryFlush();
}

function onOnline(){ tryFlush(); }

export default {
  init({ getCurrentUser: _gcu, onAuthReady, renderScripts, cloud }){
    getCurrentUser = _gcu;
    renderCb = renderScripts;
    cloudAPI = cloud;
    loadQueue();
    // on auth change, attempt flush and re-merge cloud/local
    onAuthReady(async (user) => {
      if(user){
        // flush and merge
        await tryFlush();
      }
    });
    window.addEventListener('online', onOnline);
    // also try initial flush once if already logged in
    tryFlush();
  },
  saveOrQueue(item){
    enqueueSave(item);
  },
  deleteOrQueue(id){
    enqueueDelete(id);
  },
  tryFlush // exported for debug or forced flush
};
