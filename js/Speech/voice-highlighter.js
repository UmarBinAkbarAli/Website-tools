// voice-highlighter.js
// Self-contained voice-highlighter module
// Exports: initVoiceHighlighter(options), startRecognition(), stopRecognition()

export function initVoiceHighlighter(opts = {}) {
  const textBox = document.getElementById(opts.textBoxId || "textContent");
  const displayBox = document.getElementById(opts.displayBoxId || "displayText");
  const highlighterId = opts.highlighterId || "voiceHighlighter";
  
  // DEBUG
  const DEBUG = true;
  const log = (msg, data) => {
    if (DEBUG) console.log(`[Voice] ${msg}`, data || "");
  };
  
  let hl = document.getElementById(highlighterId);
  if (!hl) {
    hl = document.createElement("div");
    hl.id = highlighterId;
    hl.className = "voice-highlight";
    displayBox.appendChild(hl);
  }

  // === STATE ===
  let recognition = null;
  let isRecording = false;
  let voiceScrollY = 0;
  let mirrored = false;
  let lastMatchedIndex = -1;
  let tempMatchedIndex = -1;
  let wordSpans = [];
  let lastRecognizedTime = 0;

  // === CONFIG ===
  const LOOKAHEAD = opts.lookahead || 50;
  const MIN_CONFIDENCE = opts.minConfidence || 0.5;
  const SMOOTH_FACTOR = opts.smoothing || 0.12;

  // === HELPERS ===
  function levenshtein(a = "", b = "") {
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();
    if (!a || !b) return 0;
    if (a === b) return 1.0;
    
    const maxLen = Math.max(a.length, b.length);
    let diff = Math.abs(a.length - b.length);
    
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) diff++;
    }
    
    return Math.max(0, 1.0 - (diff / maxLen));
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function buildWordMap() {
    try {
      const text = (textBox.textContent || textBox.innerText || "").trim();
      const words = text.split(/\s+/).filter(w => w.length > 0);

      console.log("[Voice] buildWordMap: raw text length", text.length, "words:", words.length);

      textBox.innerHTML = words
        .map((w, i) => `<span class="voice-word" data-idx="${i}">${escapeHtml(w)}</span>`)
        .join(" ");

      wordSpans = Array.from(textBox.querySelectorAll(".voice-word")).map((el, i) => ({
        el,
        idx: i,
        text: (el.innerText || el.textContent || "").toLowerCase()
      }));

      // Reset tracking
      lastMatchedIndex = -1;
      tempMatchedIndex = -1;
      voiceScrollY = voiceScrollY || 0;
      hl.style.display = "none";

      // Estimate current reading index based on visible area so matching prefers nearby words
      try {
        const viewHeight = (displayBox && displayBox.clientHeight) ? displayBox.clientHeight : 0;
        const viewCenter = viewHeight * 0.35; // top-third reading sweet spot
        const contentOffset = Math.max(0, -voiceScrollY || 0);
        const currentReadingPos = contentOffset + viewCenter;

        let nearest = null;
        for (const w of wordSpans) {
          const d = Math.abs((w.el.offsetTop || 0) - currentReadingPos);
          if (!nearest || d < nearest.d) nearest = { idx: w.idx, d };
        }
        if (nearest) {
          lastMatchedIndex = Math.max(0, nearest.idx - 1);
          tempMatchedIndex = lastMatchedIndex;
          console.log("[Voice] buildWordMap: estimated base index", lastMatchedIndex, "for readingPos", currentReadingPos);
        }
      } catch (e) {
        // non-fatal
        console.warn("[Voice] buildWordMap: estimate failed", e);
      }

      return wordSpans.length;
    } catch (e) {
      console.error("[Voice] buildWordMap failed:", e);
      return 0;
    }
  }

  function updateHighlight(wordSpan) {
    if (!wordSpan || !wordSpan.el) {
      log("updateHighlight: invalid wordSpan");
      return;
    }
    
    try {
      const rect = wordSpan.el.getBoundingClientRect();
      const parentRect = textBox.getBoundingClientRect();
      
      const x = rect.left - parentRect.left;
      const y = rect.top - parentRect.top;
      
      log("updateHighlight: word", wordSpan.text, "at index", wordSpan.idx);
      
      if (mirrored) {
        hl.style.transform = `scaleX(-1) translate(${x}px, calc(${y}px + ${voiceScrollY}px))`;
      } else {
        hl.style.transform = `translate(${x}px, calc(${y}px + ${voiceScrollY}px))`;
      }
      
      hl.style.width = rect.width + "px";
      hl.style.height = rect.height + "px";
      hl.style.display = "block";
    } catch (e) {
      console.warn("updateHighlight error:", e);
    }
  }

  function centerWordInView(wordSpan) {
    if (!wordSpan || !wordSpan.el) return;
    
    try {
      const wordTop = wordSpan.el.offsetTop;
      const textHeight = textBox.scrollHeight;
      const viewHeight = displayBox.clientHeight;
      
      const targetViewPos = viewHeight * 0.35;
      const targetScrollY = -(wordTop - targetViewPos);
      
      voiceScrollY = voiceScrollY * (1 - SMOOTH_FACTOR) + targetScrollY * SMOOTH_FACTOR;
      voiceScrollY = Math.max(-(textHeight - viewHeight), Math.min(0, voiceScrollY));
      
      log("centerWordInView: voiceScrollY", voiceScrollY.toFixed(2));
      
      applyVoiceTransform();
    } catch (e) {
      console.warn("centerWordInView error:", e);
    }
  }

  function applyVoiceTransform() {
    if (!textBox) return;
    if (mirrored) {
      textBox.style.transform = `scaleX(-1) translateY(${voiceScrollY}px)`;
    } else {
      textBox.style.transform = `translateY(${voiceScrollY}px)`;
    }
  }

  // NEW: Compute score with distance penalty and bigram boost
  function computeMatchScore(spokenWord, candidateIdx, baseIndex, prevSpokenWord) {
    const candidate = wordSpans[candidateIdx];
    if (!candidate) return -Infinity;
    
    // lowercase inputs
    const s = (spokenWord || "").toLowerCase();
    const c = (candidate.text || "").toLowerCase();

    // base similarity (use levenshtein distance normalized)
    let sim = 1 - (levenshtein(s, c) / Math.max(1, Math.max(s.length, c.length)));
    // normalize to -1..1 style by centering around 0
    let score = sim;

    // exact match strong boost
    if (s === c) score += 0.35;

    // prefer candidates just ahead of base index
    const expected = (baseIndex == null ? -1 : baseIndex) + 1;
    const distance = candidateIdx - expected;
    const absDist = Math.abs(distance);

    // penalize distance but cap penalty
    const distPenalty = Math.min(1, absDist / Math.max(1, Math.floor((LOOKAHEAD || 6) * 0.9)));
    score -= distPenalty * 0.5;

    // small penalty if candidate before or equal to expected (we want forward flow)
    if (distance <= 0) score -= 0.12;

    // don't over-penalize very short common words if they match exactly
    if (s.length <= 3 && s === c) score += 0.05;

    // reward continuity with previous spoken word (optional)
    if (prevSpokenWord && candidateIdx > 0) {
      const prevCandidate = wordSpans[candidateIdx - 1];
      if (prevCandidate) {
        const prevSim = 1 - (levenshtein((prevSpokenWord||"").toLowerCase(), prevCandidate.text) / Math.max(1, Math.max(prevSpokenWord.length, prevCandidate.text.length)));
        if (prevSim > 0.6) score += 0.12;
      }
    }

    // final scaling
    return score;
  }

  // NEW: Match word with context
  function matchWordFromBase(spokenWord, baseIndex, prevSpokenWord = null) {
    if (!spokenWord || !wordSpans.length) {
      log("matchWordFromBase: early exit - word empty or no wordSpans", { spokenWord, spanCount: wordSpans.length });
      return null;
    }
    spokenWord = spokenWord.toLowerCase().trim();

    let bestMatch = null;
    let bestScore = -Infinity;

    // Forward window search (preferred)
    const fStart = Math.max(0, baseIndex + 1);
    const fEnd = Math.min(wordSpans.length, baseIndex + 1 + Math.max(LOOKAHEAD, 6));
    
    log("matchWordFromBase: forward search range", { baseIndex, fStart, fEnd, spokenWord });
    
    for (let i = fStart; i < fEnd; i++) {
      const score = computeMatchScore(spokenWord, i, baseIndex, prevSpokenWord);
      if (score > bestScore) { bestScore = score; bestMatch = wordSpans[i]; }
    }

    // Wider scan if no confident forward match
    if (bestScore < MIN_CONFIDENCE) {
      const globalEnd = Math.min(wordSpans.length, baseIndex + 1 + LOOKAHEAD * 4);
      const globalStart = Math.max(0, baseIndex - LOOKAHEAD);
      log("matchWordFromBase: wider search (forward failed)", { globalStart, globalEnd, bestScore, MIN_CONFIDENCE });
      
      for (let i = globalStart; i < globalEnd; i++) {
        const score = computeMatchScore(spokenWord, i, baseIndex, prevSpokenWord);
        if (score > bestScore) { bestScore = score; bestMatch = wordSpans[i]; }
      }
    }

    // Final guard
    if (!bestMatch || bestScore < MIN_CONFIDENCE * 0.9) {
      log("matchWordFromBase: NO MATCH", { spokenWord, bestScore, threshold: MIN_CONFIDENCE * 0.9 });
      return null;
    }

    log("matchWordFromBase: MATCH FOUND", { spokenWord, matchedWord: bestMatch.text, score: bestScore.toFixed(3), idx: bestMatch.idx });
    return bestMatch;
  }

  // NEW: Process recognition result with context tracking
  function onRecognitionResult(transcript, isFinal = false) {
    if (!transcript) {
      log("onRecognitionResult: empty transcript");
      return;
    }
    
    log("onRecognitionResult:", { transcript, isFinal, wordCount: transcript.split(/\s+/).length });
    lastRecognizedTime = Date.now();
    const words = transcript.trim().split(/\s+/);
    
    let prevSpoken = null;

    for (const word of words) {
      if (!word) continue;
      
      const baseIndex = isFinal ? lastMatchedIndex : Math.max(lastMatchedIndex, tempMatchedIndex);
      const matched = matchWordFromBase(word, baseIndex, prevSpoken);
      prevSpoken = word;
      
      if (!matched) {
        log("onRecognitionResult: word not matched", word);
        continue;
      }
      
      if (isFinal) {
        if (matched.idx >= lastMatchedIndex) {
          lastMatchedIndex = matched.idx;
          tempMatchedIndex = matched.idx;
          log("onRecognitionResult: COMMITTED", { word: matched.text, idx: matched.idx });
        }
      } else {
        if (matched.idx > tempMatchedIndex) {
          tempMatchedIndex = matched.idx;
          log("onRecognitionResult: INTERIM", { word: matched.text, idx: matched.idx });
        }
      }
      
      updateHighlight(matched);
      centerWordInView(matched);
    }
  }

  // === RECOGNITION SETUP ===
  function setupRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("SpeechRecognition not supported");
      return null;
    }
    
    log("setupRecognition: creating recognition object");
    
    recognition = new SpeechRecognition();
    recognition.lang = opts.lang || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    
    recognition.onstart = () => {
      log("recognition.onstart: recording started");
      isRecording = true;
      hl.classList.add("recording");
      tempMatchedIndex = lastMatchedIndex;
    };
    
    recognition.onresult = (event) => {
      log("recognition.onresult:", { resultIndex: event.resultIndex, resultsLength: event.results.length });
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0] && res[0].transcript ? res[0].transcript.trim() : "";
        log("result item", { i, isFinal: res.isFinal, transcript });
        
        if (!transcript) continue;
        onRecognitionResult(transcript, !!res.isFinal);
      }
    };
    
    recognition.onend = async () => {
      log("recognition.onend: recognition ended");
      const wasRecording = isRecording;
      isRecording = false;
      hl.classList.remove("recording");
      if (wasRecording) {
        try {
          await new Promise(r => setTimeout(r, 250));
          if (recognition && typeof recognition.start === "function") {
            log("recognition.onend: auto-restarting");
            recognition.start();
          }
        } catch (e) {
          console.warn("Voice recognition auto-restart failed", e);
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.warn("Recognition error:", event.error);
      log("recognition.onerror:", event.error);
    };
    
    return recognition;
  }

  // === PUBLIC API ===
  return {
    buildWordMap,
    
    start() {
      log("start() called");
      if (!recognition) setupRecognition();
      if (!recognition) return false;
      try {
        if (isRecording) {
          log("start: already recording");
          return false;
        }
        tempMatchedIndex = lastMatchedIndex;
        log("start: calling recognition.start()");
        recognition.start();
        return true;
      } catch (e) {
        console.error("Failed to start recognition:", e);
        log("start: ERROR", e.message);
        return false;
      }
    },
    
    stop() {
      log("stop() called");
      if (!recognition || !isRecording) return;
      try {
        isRecording = false;
        recognition.onend = () => { hl.classList.remove("recording"); };
        recognition.stop();
      } catch (e) {
        console.error("Failed to stop recognition:", e);
      }
    },
    
    isVoiceActive() {
      return isRecording;
    },
    
    setScrollY(y) {
      voiceScrollY = Number(y) || 0;
      // optional: keep tempMatchedIndex in sync if undefined
      // console.log("[Voice] setScrollY:", voiceScrollY);
    },
    
    setMirrored(v) {
      mirrored = !!v;
      applyVoiceTransform();
    },
    
    reset() {
      log("reset() called");
      lastMatchedIndex = -1;
      tempMatchedIndex = -1;
      voiceScrollY = 0;
      hl.style.display = "none";
    },
    
    getState() {
      return {
        isRecording,
        lastMatchedIndex,
        totalWords: wordSpans.length,
        progress: wordSpans.length > 0 ? ((lastMatchedIndex + 1) / wordSpans.length * 100).toFixed(1) : "0"
      };
    }
  };
}
