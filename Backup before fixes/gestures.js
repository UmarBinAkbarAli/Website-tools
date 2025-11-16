export function setupGestures(handlers = {}){
  const el = document.getElementById('displayText') || document.body;
  let startX=0, startY=0, startTime=0;
  let touchCount=0;
  let pinchStartDist = null;
  let lastScale=1;

  el.addEventListener('touchstart', e => {
    touchCount = e.touches.length;
    startTime = Date.now();
    if(e.touches.length === 1){
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    } else if(e.touches.length === 2){
      pinchStartDist = distance(e.touches[0], e.touches[1]);
      lastScale = 1;
    }
  }, {passive:true});

  el.addEventListener('touchmove', e => {
    if(e.touches.length === 2 && pinchStartDist){
      const d = distance(e.touches[0], e.touches[1]);
      const scale = d / pinchStartDist;
      if(Math.abs(scale - lastScale) > 0.03){
        handlers.onPinchChange && handlers.onPinchChange(scale);
        lastScale = scale;
      }
    }
  }, {passive:true});

  el.addEventListener('touchend', e => {
    const duration = Date.now() - startTime;
    if(touchCount === 1 && duration < 300){
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if(absY > 30 && absY > absX){
        if(dy < 0) handlers.onSwipeUp && handlers.onSwipeUp();
        else handlers.onSwipeDown && handlers.onSwipeDown();
        return;
      }
      handlers.onTap && handlers.onTap();
    }
    if(e.touches.length === 0) { pinchStartDist = null; lastScale = 1; }
  }, {passive:true});

  function distance(a,b){ const dx=a.clientX-b.clientX, dy=a.clientY-b.clientY; return Math.hypot(dx,dy); }
}
