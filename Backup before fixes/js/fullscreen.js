export function ensureFullscreenToggle(enter){
  try {
    if(enter){
      const el = document.documentElement;
      if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    }
  } catch(e){} 
}
