export function setupKeyboardShortcuts({
  playBtn,
  editBtn,
  speedControl,
  fontSizeControl,
  scriptsBtn,
  syncBtn,
  scriptBox
}) {

  // Capture level to override browser save dialog
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        // Open scripts modal
        if (scriptsBtn) scriptsBtn.click();
      }
    },
    true
  );

  document.addEventListener("keydown", (e) => {

    // ========== BLOCK SHORTCUTS WHEN TYPING IN ANY INPUT/TEXTAREA ==========
    const el = document.activeElement;
    if (
      el &&
      (el.tagName === "INPUT" ||
       el.tagName === "TEXTAREA" ||
       el.isContentEditable)
    ) {
      if (!e.ctrlKey) return;
    }


    switch (e.key.toLowerCase()) {

      case " ":
        e.preventDefault();
        playBtn?.click();
        break;

      case "e":
        e.preventDefault();
        editBtn?.click();
        break;

      case "s":
        if (!e.ctrlKey) {
          e.preventDefault();
          scriptsBtn?.click();
        }
        break;

      case "f":
        e.preventDefault();
        if (!document.fullscreenElement)
          document.documentElement.requestFullscreen().catch(() => {});
        else
          document.exitFullscreen().catch(() => {});
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

      case "l":
        if (e.ctrlKey) {
          e.preventDefault();
          syncBtn?.click();
        }
        break;

      case "q":
        if (e.ctrlKey) {
          e.preventDefault();
          document.getElementById("logoutBtn")?.click();
        }
        break;
    }
  });
}
