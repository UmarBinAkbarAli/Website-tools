export function setupKeyboardShortcuts({
  playBtn,
  editBtn,
  speedControl,
  fontSizeControl,
  scriptsBtn,
  syncBtn,
  scriptBox
}) {

  document.addEventListener("keydown", (e) => {

    // if typing, ignore shortcuts
    if (document.activeElement === scriptBox) return;

    switch (e.key.toLowerCase()) {

      case " ":
        e.preventDefault();
        playBtn.click();
        break;

      case "e":
        e.preventDefault();
        editBtn.click();
        break;

      case "f":
        e.preventDefault();
        if (!document.fullscreenElement)
          document.documentElement.requestFullscreen().catch(()=>{});
        else
          document.exitFullscreen().catch(()=>{});
        break;

      case "arrowup":
        speedControl.value = Number(speedControl.value) + 0.5;
        speedControl.dispatchEvent(new Event("input"));
        break;

      case "arrowdown":
        speedControl.value = Number(speedControl.value) - 0.5;
        speedControl.dispatchEvent(new Event("input"));
        break;

      case "arrowright":
        fontSizeControl.value = Number(fontSizeControl.value) + 2;
        fontSizeControl.dispatchEvent(new Event("input"));
        break;

      case "arrowleft":
        fontSizeControl.value = Number(fontSizeControl.value) - 2;
        fontSizeControl.dispatchEvent(new Event("input"));
        break;

      case "s":
        if (!e.ctrlKey) {
          e.preventDefault();
          scriptsBtn.click();
        }
        break;

      case "s":
        if (e.ctrlKey) {
          e.preventDefault();
          document.getElementById("newScriptForm").requestSubmit();
        }
        break;

      case "l":
        if (e.ctrlKey) {
          e.preventDefault();
          syncBtn.click();
        }
        break;

      case "q":
        if (e.ctrlKey) {
          e.preventDefault();
          document.getElementById("logoutBtn").click();
        }
        break;
    }
  });
}
