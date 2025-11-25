// voice-highlighter.js
// Self-contained voice-highlighter module
// Exports: initVoiceHighlighter(options), startRecognition(), stopRecognition()

export function initVoiceHighlighter(opts = {}) {
  // Required DOM IDs / elements (pass or fallback to defaults)
  const textBox = document.getElementById(opts.textBoxId || "textContent");
  const displayBox = document.getElementById(opts.displayBoxId || "displayText");
  const highlighterId = opts.highlighterId || "voiceHighlighter";
  let hl = document.getElementById(highlighterId);

  // create highlighter if missing
  if (!hl) {
    hl = document.createElement("div");
    hl.id = highlighterId;
    hl.className = "voice-highlight";
    // place outside textBox so textBox.innerHTML won't remove it
    displayBox.appendChild(hl);
  }

  // Globals for highlight / scroll
  let highlightX = 0;
  let highlightY = 0;
  let highlightW = 0;
  let highlightH = 0;
  let highlightVisible = false;
  let lastMatchIndex = -1;
  let wordMap = [];
  let recognition = null;

  // Config
  const lookahead = typeof opts.lookahead === "number" ? opts.lookahead : 80;
  const minConfidence = typeof opts.minConfidence === "number" ? opts.minConfidence : 0.40;
  const smoothing = typeof opts.smoothing === "number" ? opts.smoothing : 0.15;

  // simple fuzzy similarity (fast)
  function similarity(a = "", b = "") {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (!a || !b) return 0;
    let matches = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) if (a[i] === b[i]) matches++;
    return matches / Math.max(a.length, b.length);
  }

  // Build word map from textBox content (clean text)
  function buildWordMap() {
    const raw = textBox.textContent || textBox.innerText || "";
    const plain = raw.replace(/\s+/g, " ").trim();
    const words = plain ? plain.split(" ") : [];
    textBox.innerHTML = words.map((w, i) => `<span class="w" data-i="${i}">${escapeHtml(w)}</span>`).join(" ");
    wordMap = Array.from(textBox.querySelectorAll(".w")).map((el, i) => ({
      el,
      index: i,
      word: el.innerText.toLowerCase()
    }));
    // reset last index when new script loaded
    lastMatchIndex = -1;
    highlightVisible = false;
    hl.style.display = "none";
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Apply transform (scrollY come from external engine or from this module)
  let scrollY = 0;
  let mirrored = false; // can be toggled externally

  function applyTransform() {
    if (!textBox) return;
    if (mirrored) {
      textBox.style.transform = `scaleX(-1) translateY(${scrollY}px)`;
    } else {
      textBox.style.transform = `translateY(${scrollY}px)`;
    }

    if (hl && highlightVisible) {
      if (mirrored) {
        hl.style.transform = `scaleX(-1) translate(${highlightX}px, ${highlightY + scrollY}px)`;
      } else {
        hl.style.transform = `translate(${highlightX}px, ${highlightY + scrollY}px)`;
      }
      hl.style.width = highlightW + "px";
      hl.style.height = highlightH + "px";
      hl.style.display = "block";
    } else if (hl) {
      hl.style.display = "none";
    }
  }

  // Public helper to set mirrored
  function setMirrored(v) {
    mirrored = !!v;
    applyTransform();
  }

  // Smoothly move view to a target word index (targetIndex)
  function scrollToWordIndex(targetIndex) {
    if (!wordMap.length) return;
    const totalWords = wordMap.length;
    const percent = targetIndex / Math.max(1, totalWords);
    const totalH = textBox.getBoundingClientRect().height;
    const viewH = displayBox.clientHeight;
    const maxScroll = Math.max(0, totalH - viewH);
    const targetY = -(percent * maxScroll);
    scrollY = scrollY * (1 - smoothing) + targetY * smoothing;
    applyTransform();
  }

  // The core matching + highlight logic; pass recognized transcript string
  function onTranscript(transcript) {
    if (!transcript || !wordMap.length) return;
    const spokenWords = transcript.trim().split(/\s+/).map(s => s.toLowerCase());
    if (!spokenWords.length) return;
    const lastWord = spokenWords.pop();
    const prevWord = spokenWords.length ? spokenWords.pop() : null;

    // 1) Prefer forward candidates
    let best = null;
    let bestScore = 0;
    for (let i = Math.max(0, lastMatchIndex + 1); i < Math.min(wordMap.length, lastMatchIndex + 1 + lookahead); i++) {
      const w = wordMap[i];
      let score = similarity(lastWord, w.word);
      if (prevWord && i > 0) score += 0.6 * similarity(prevWord, wordMap[i - 1].word);
      if (score > bestScore) { bestScore = score; best = w; }
    }

    // 2) Fallback: global best
    if (!best) {
      for (let i = 0; i < wordMap.length; i++) {
        const w = wordMap[i];
        const score = similarity(lastWord, w.word);
        if (score > bestScore) { bestScore = score; best = w; }
      }
    }

    // 3) Confidence
    if (!best || bestScore < minConfidence) {
      // unreliable recognition — ignore
      return;
    }

    // 4) If best is <= lastMatchIndex, try to find next occurrence after lastMatchIndex
    if (best.index <= lastMatchIndex) {
      for (let j = lastMatchIndex + 1; j < wordMap.length; j++) {
        if (wordMap[j].word === best.word) { best = wordMap[j]; break; }
      }
    }

    // 5) Commit
    lastMatchIndex = best.index;

    // Position highlight
    const rect = best.el.getBoundingClientRect();
    const parentRect = textBox.getBoundingClientRect();
    highlightX = rect.left - parentRect.left;
    highlightY = rect.top - parentRect.top;
    highlightW = rect.width;
    highlightH = rect.height;
    highlightVisible = true;

    // Apply highlight and scroll
    if (hl) {
      hl.style.display = "block";
      hl.style.width = highlightW + "px";
      hl.style.height = highlightH + "px";
      hl.style.transform = `translate(${highlightX}px, ${highlightY + scrollY}px)`;
    }

    // Scroll toward that word
    scrollToWordIndex(best.index);
  }

  // Recognition setup and control
  function initRecognition(lang = "en-US", continuous = true, interim = false) {
    const ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!ctor) {
      console.warn("SpeechRecognition not available in this browser");
      return null;
    }
    recognition = new ctor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interim;

    recognition.onresult = (event) => {
      try {
        // join all final results into a single transcript
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i][0].transcript) {
            final += " " + event.results[i][0].transcript;
          }
        }
        final = final.trim();
        if (final) onTranscript(final);
      } catch (e) {
        console.warn("recognition.onresult error", e);
      }
    };

    recognition.onend = () => {
  recognition._running = false;   // <-- IMPORTANT FIX
  console.log("recognition ended");
};


    recognition.onerror = (e) => {
      console.log("recognition error", e && e.error);
    };

    return recognition;
  }

  // Public start/stop
  function startRecognition(opts = {}) {
    if (!recognition) recognition = initRecognition(opts.lang || "en-US", typeof opts.continuous !== "undefined" ? opts.continuous : true, opts.interim || false);
    try {
      // prevent double-start
        if (recognition._running) return false;
        recognition._running = true;

        recognition.start();
        return true;

    } catch (e) {
      console.warn("recognition start failed", e);
      return false;
    }
  }

function stopRecognition() {
  try {
    if (recognition) {
      recognition._running = false;   // <-- IMPORTANT
      recognition.stop();
    }
  } catch (e) {}
}

  // Public API
  return {
    buildWordMap,
    startRecognition,
    stopRecognition,
    onTranscript,
    setMirrored,
    get state() {
      return { highlightVisible, lastMatchIndex, wordMapLen: wordMap.length, scrollY };
    },
    // Expose internal for debug if necessary
    _debug: {
      wordMap: () => wordMap,
      recognition: () => recognition
    }
  };
}
