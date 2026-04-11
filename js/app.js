// AR Language Learning Assistant — Main App Logic

class ARApp {
  constructor() {
    this.cocoModel    = null;   // COCO-SSD: bounding-box detection (80 classes)
    this.mnetModel    = null;   // MobileNet: scene classification (1000 classes)
    this.stream       = null;
    this.isDetecting  = false;
    this.rafId        = null;
    this.frameCount   = 0;
    this.lastDetections  = [];
    this.lastMnetPreds   = [];
    this.labelEls = {};
    this.targetLang = 'en';
    this.currentVocabKey = null;
    this.currentVocabRaw = null;  // raw MobileNet label for auto-gen entries
    this.quizQueue = [];
    this.quizIdx = 0;
    this.quizCorrect = 0;
    this.quizTotal = 0;
    this.progress = this.loadProgress();
    this.mnetPanelCollapsed = false;

    this.$ = (id) => document.getElementById(id);
    this.initUI();
    this.bindEvents();
    this.updateSplashStats();
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  initUI() {
    this.video   = this.$('camera-feed');
    this.canvas  = this.$('ar-canvas');
    this.ctx     = this.canvas.getContext('2d');
    this.labelsEl = this.$('ar-labels');
    this.modelLoadingEl = this.$('model-loading');
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.$(id).classList.add('active');
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  bindEvents() {
    this.$('btn-start-ar').addEventListener('click', () => this.startAR());
    this.$('btn-back').addEventListener('click', () => this.stopAR());
    this.$('btn-progress').addEventListener('click', () => this.showProgress());
    this.$('btn-view-progress').addEventListener('click', () => this.showProgress());
    this.$('btn-back-progress').addEventListener('click', () => this.showSplash());
    this.$('btn-quiz').addEventListener('click', () => this.startQuiz());

    this.$('mnet-toggle').addEventListener('click', () => this.toggleMnetPanel());
    this.$('vc-audio-btn').addEventListener('click', () => this.speakWord());
    this.$('vc-close-btn').addEventListener('click', () => this.closeVocabCard());
    this.$('vc-quiz-btn').addEventListener('click', () => {
      this.closeVocabCard();
      if (this.currentVocabKey) this.startQuizWithWord(this.currentVocabKey);
    });

    this.$('quiz-next-btn').addEventListener('click', () => this.nextQuizQuestion());
    this.$('quiz-close-btn').addEventListener('click', () => this.closeQuiz());

    this.$('target-language').addEventListener('change', (e) => {
      this.targetLang = e.target.value;
      this.$('language-badge').textContent = e.target.value.toUpperCase();
    });

    // Close vocab card by tapping backdrop
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.closeVocabCard(); this.closeQuiz(); }
    });
  }

  // ─── Progress persistence ──────────────────────────────────────────────────

  loadProgress() {
    try {
      return JSON.parse(localStorage.getItem('arlla_progress') || '{}');
    } catch { return {}; }
  }

  saveProgress() {
    localStorage.setItem('arlla_progress', JSON.stringify(this.progress));
  }

  markSeen(key) {
    if (!this.progress[key]) this.progress[key] = { seen: 0, correct: 0, total: 0 };
    this.progress[key].seen++;
    this.saveProgress();
  }

  markQuizResult(key, correct) {
    if (!this.progress[key]) this.progress[key] = { seen: 0, correct: 0, total: 0 };
    this.progress[key].total++;
    if (correct) this.progress[key].correct++;
    this.saveProgress();
  }

  isLearned(key) {
    const p = this.progress[key];
    return p && p.total >= 2 && p.correct / p.total >= 0.6;
  }

  updateSplashStats() {
    const keys = Object.keys(this.progress);
    const seen = keys.filter(k => this.progress[k].seen > 0).length;
    const learned = keys.filter(k => this.isLearned(k)).length;
    let totalCorrect = 0, totalTotal = 0;
    keys.forEach(k => { totalCorrect += this.progress[k].correct; totalTotal += this.progress[k].total; });
    const pct = totalTotal > 0 ? Math.round((totalCorrect / totalTotal) * 100) : 0;

    this.$('stat-words-seen').textContent = seen;
    this.$('stat-words-learned').textContent = learned;
    this.$('stat-quiz-score').textContent = pct + '%';
  }

  // ─── AR & Camera ───────────────────────────────────────────────────────────

  async startAR() {
    this.showScreen('ar-screen');
    this.modelLoadingEl.innerHTML = '<div class="loading-spinner"></div><p id="loading-text">Starting camera…</p>';
    this.modelLoadingEl.style.display = 'flex';

    try {
      // Camera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await new Promise(res => (this.video.onloadedmetadata = res));
      this.video.play();

      // Load COCO-SSD (object detection with bounding boxes)
      if (!this.cocoModel) {
        this.$('loading-text').textContent = 'Loading Object Detection…';
        this.cocoModel = await cocoSsd.load();
      }

      // Load MobileNet (1000-class scene recognition) — optional
      if (!this.mnetModel) {
        this.$('loading-text').textContent = 'Loading Scene Recognition…';
        try {
          this.mnetModel = await mobilenet.load({ version: 1, alpha: 0.25 });
        } catch (mnetErr) {
          console.warn('MobileNet unavailable, scene recognition disabled:', mnetErr.message);
          this.mnetModel = null;
        }
      }

      this.modelLoadingEl.style.display = 'none';

      // Show scene panel
      const panel = this.$('mnet-panel');
      panel.classList.remove('hidden');

      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.frameCount = 0;
      this.detectionLoop();
    } catch (err) {
      this.modelLoadingEl.innerHTML = `
        <div class="loading-error">
          <span>⚠️</span>
          <p>${err.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access.' : 'Could not start camera: ' + err.message}</p>
          <button onclick="app.stopAR()" class="btn-primary" style="margin-top:1rem">Go Back</button>
        </div>`;
    }
  }

  stopAR() {
    cancelAnimationFrame(this.rafId);
    this.isDetecting = false;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.clearLabels();
    this.$('mnet-panel').classList.add('hidden');
    window.removeEventListener('resize', () => this.resizeCanvas());
    this.showSplash();
  }

  showSplash() {
    this.updateSplashStats();
    this.showScreen('splash-screen');
  }

  resizeCanvas() {
    const rect = this.video.getBoundingClientRect();
    this.canvas.width  = rect.width;
    this.canvas.height = rect.height;
    this.canvas.style.left = rect.left + 'px';
    this.canvas.style.top  = rect.top  + 'px';
  }

  // ─── Detection Loop ────────────────────────────────────────────────────────

  async detectionLoop() {
    if (this.isDetecting || this.video.paused || this.video.ended) {
      this.rafId = requestAnimationFrame(() => this.detectionLoop());
      return;
    }
    this.isDetecting = true;
    this.frameCount++;

    try {
      // ── COCO-SSD every frame (fast, bounding boxes) ──────────────────────
      const preds = await this.cocoModel.detect(this.video, 6, 0.25);
      this.lastDetections = preds;
      this.renderDetections(preds);

      // ── MobileNet every 5 frames (broader 1000-class recognition) ────────
      if (this.frameCount % 5 === 0 && this.mnetModel) {
        const mnet = await this.mnetModel.classify(this.video, 7);
        // Keep predictions with reasonable confidence
        this.lastMnetPreds = mnet.filter(p => p.probability > 0.08);
        this.renderMnetPanel();
      }
    } catch (e) { console.error('Detection error:', e); }

    this.isDetecting = false;
    this.rafId = requestAnimationFrame(() => this.detectionLoop());
  }

  // ─── MobileNet scene panel ─────────────────────────────────────────────────

  renderMnetPanel() {
    if (this.mnetPanelCollapsed) return;
    const el = this.$('mnet-results');
    el.innerHTML = '';

    // Deduplicate against COCO-SSD detections so we don't show duplicates
    const cocoLabels = new Set(this.lastDetections.map(p => p.class.toLowerCase()));

    const shown = new Set();
    for (const pred of this.lastMnetPreds) {
      const vocab = getVocabForMnet(pred.className);
      if (!vocab) continue;
      const key = vocab.word.toLowerCase();
      if (shown.has(key)) continue;
      // Skip if COCO-SSD already has a bounding-box label for this
      if ([...cocoLabels].some(c => c.includes(key) || key.includes(c))) continue;
      shown.add(key);

      const pct = Math.round(pred.probability * 100);
      const trans = vocab.translations[this.targetLang] || vocab.word;
      const item = document.createElement('div');
      item.className = 'mnet-item';
      item.innerHTML = `
        <span class="mnet-word">${vocab.word}</span>
        <span class="mnet-arrow">→</span>
        <span class="mnet-trans">${trans}</span>
        <span class="mnet-pct">${pct}%</span>`;
      item.addEventListener('click', () => this.openVocabCardFromMnet(pred.className));
      el.appendChild(item);

      if (shown.size >= 4) break;   // cap at 4 scene predictions
    }

    // Hide panel when nothing useful to show
    this.$('mnet-panel').style.opacity = shown.size > 0 ? '1' : '0.4';
  }

  openVocabCardFromMnet(rawLabel) {
    const vocab = getVocabForMnet(rawLabel);
    if (!vocab) return;
    // Store raw label so quiz can use it
    this.currentVocabRaw = rawLabel;
    // Find a key in our dicts, or use the raw label
    const key = rawLabel.toLowerCase().split(',')[0].trim();
    this.currentVocabKey = key;
    this.markSeen(key);

    this.$('vc-word').textContent = vocab.word;
    this.$('vc-phonetic').textContent = vocab.phonetic || '';
    this.$('vc-pos').textContent = vocab.pos;

    const langName = { en: 'English', fr: 'French', es: 'Spanish', ja: 'Japanese', hi: 'Hindi', mr: 'Marathi', ar: 'Arabic' }[this.targetLang] || '';
    const trans = vocab.translations[this.targetLang] || '—';
    this.$('vc-translation').innerHTML =
      `<span class="trans-lang">${langName}</span> <span class="trans-word">${trans}</span>`;
    this.$('vc-definition').textContent = vocab.definition;
    this.$('vc-example').innerHTML = `<em>"${vocab.example}"</em>`;

    if (vocab.autoGenerated) {
      this.$('vc-example').innerHTML += ' <span style="color:#9090b0;font-size:.75rem">(auto-detected)</span>';
    }

    const card = this.$('vocab-card');
    card.style.borderTopColor = vocab.color || '#9c27b0';
    card.classList.remove('hidden');
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  toggleMnetPanel() {
    this.mnetPanelCollapsed = !this.mnetPanelCollapsed;
    this.$('mnet-results').style.display = this.mnetPanelCollapsed ? 'none' : '';
    this.$('mnet-toggle').textContent = this.mnetPanelCollapsed ? '+' : '−';
  }

  renderDetections(preds) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Scale factors: map video native coords → canvas display coords
    const scaleX = this.canvas.width  / this.video.videoWidth;
    const scaleY = this.canvas.height / this.video.videoHeight;

    // Track which labels are still active
    const activeKeys = new Set();

    const vocabPreds = preds.filter(p => getVocab(p.class));
    const count = vocabPreds.length;

    this.$('detection-count').textContent =
      count === 0 ? 'Scanning…' : `${count} object${count !== 1 ? 's' : ''} detected`;
    this.$('status-dot').className = 'status-dot ' + (count > 0 ? 'active' : '');

    vocabPreds.forEach(pred => {
      const vocab = getVocab(pred.class);
      if (!vocab) return;

      const key = pred.class.toLowerCase();
      activeKeys.add(key);

      const [bx, by, bw, bh] = pred.bbox;
      const sx = bx * scaleX;
      const sy = by * scaleY;
      const sw = bw * scaleX;
      const sh = bh * scaleY;

      // Draw bounding box on canvas
      const color = vocab.color || '#e91e8c';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.shadowBlur = 0;

      // Corner accents
      const cl = 14;
      ctx.fillStyle = color;
      [[sx, sy], [sx + sw - cl, sy], [sx, sy + sh - cl], [sx + sw - cl, sy + sh - cl]].forEach(([cx, cy]) => {
        ctx.fillRect(cx, cy, cl, 3);
        ctx.fillRect(cx, cy, 3, cl);
      });

      // HTML label pill
      this.upsertLabel(key, vocab, sx + sw / 2, sy - 4, color, pred.score);
    });

    // Remove stale labels
    Object.keys(this.labelEls).forEach(key => {
      if (!activeKeys.has(key)) { this.labelEls[key].remove(); delete this.labelEls[key]; }
    });
  }

  upsertLabel(key, vocab, cx, topY, color, score) {
    let el = this.labelEls[key];
    if (!el) {
      el = document.createElement('div');
      el.className = 'ar-label';
      el.addEventListener('click', () => this.openVocabCard(key));
      this.labelsEl.appendChild(el);
      this.labelEls[key] = el;
    }

    const translation = vocab.translations[this.targetLang] || '';
    const langNames = { fr: 'FR', es: 'ES', ja: 'JA' };
    const badge = langNames[this.targetLang] || '';
    const pct = Math.round(score * 100);

    el.style.cssText = `left:${cx}px; top:${topY}px;`;
    el.style.borderColor = color;
    el.innerHTML = `
      <span class="label-word">${vocab.word}</span>
      <span class="label-sep">→</span>
      <span class="label-trans">${translation}</span>
      <span class="label-pct">${pct}%</span>
    `;
  }

  clearLabels() {
    Object.values(this.labelEls).forEach(el => el.remove());
    this.labelEls = {};
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ─── Vocabulary Card ───────────────────────────────────────────────────────

  openVocabCard(key) {
    const vocab = getVocab(key);
    if (!vocab) return;
    this.currentVocabKey = key;
    this.markSeen(key);

    this.$('vc-word').textContent = vocab.word;
    this.$('vc-phonetic').textContent = vocab.phonetic;
    this.$('vc-pos').textContent = vocab.pos;

    const langName = { en: 'English', fr: 'French', es: 'Spanish', ja: 'Japanese', hi: 'Hindi', mr: 'Marathi', ar: 'Arabic' }[this.targetLang] || '';
    const trans = vocab.translations[this.targetLang] || '—';
    this.$('vc-translation').innerHTML =
      `<span class="trans-lang">${langName}</span> <span class="trans-word">${trans}</span>`;

    this.$('vc-definition').textContent = vocab.definition;
    this.$('vc-example').innerHTML = `<em>"${vocab.example}"</em>`;

    const card = this.$('vocab-card');
    card.style.borderTopColor = vocab.color || '#e91e8c';
    card.classList.remove('hidden');
    requestAnimationFrame(() => card.classList.add('visible'));
  }

  closeVocabCard() {
    const card = this.$('vocab-card');
    card.classList.remove('visible');
    setTimeout(() => card.classList.add('hidden'), 300);
  }

  speakWord() {
    if (!this.currentVocabKey) return;
    const vocab = getVocab(this.currentVocabKey);
    if (!vocab) return;
    const utter = new SpeechSynthesisUtterance(vocab.word);
    utter.lang = 'en-US';
    utter.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);

    // Also speak translation
    setTimeout(() => {
      const trans = vocab.translations[this.targetLang];
      if (trans && this.targetLang !== 'en') {
        const tLang = TTS_LANG[this.targetLang] || 'en-US';
        const tu = new SpeechSynthesisUtterance(trans.split(' ')[0]);
        tu.lang = tLang;
        tu.rate = 0.8;
        speechSynthesis.speak(tu);
      }
    }, 900);
  }

  // ─── Quiz ──────────────────────────────────────────────────────────────────

  startQuiz() {
    // Build quiz from currently detected objects
    // Gather detected keys from COCO-SSD + recent MobileNet scene preds
    const mnetKeys = this.lastMnetPreds
      .map(p => p.className.toLowerCase().split(',')[0].trim())
      .filter(k => getVocabForMnet(k) && !getVocabForMnet(k).autoGenerated);

    const detectedKeys = [
      ...this.lastDetections.map(p => p.class.toLowerCase()).filter(k => getVocab(k)),
      ...mnetKeys,
    ].filter((k, i, arr) => arr.indexOf(k) === i); // deduplicate

    if (detectedKeys.length === 0) {
      // Use progress words as fallback
      const keys = Object.keys(this.progress).filter(k => getVocab(k));
      if (keys.length === 0) {
        alert('Point your camera at some objects first!');
        return;
      }
      this.quizQueue = this.shuffleArray([...keys]).slice(0, 5);
    } else {
      this.quizQueue = this.shuffleArray([...new Set(detectedKeys)]).slice(0, 5);
    }

    this.quizIdx = 0;
    this.quizCorrect = 0;
    this.quizTotal = 0;
    const modal = this.$('quiz-modal');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
    this.showQuizQuestion();
  }

  startQuizWithWord(key) {
    this.quizQueue = [key];
    this.quizIdx = 0;
    this.quizCorrect = 0;
    this.quizTotal = 0;
    const modal = this.$('quiz-modal');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
    this.showQuizQuestion();
  }

  showQuizQuestion() {
    if (this.quizIdx >= this.quizQueue.length) { this.showQuizResults(); return; }

    const key = this.quizQueue[this.quizIdx];
    const vocab = getVocab(key);
    const langName = { en: 'English', fr: 'French', es: 'Spanish', ja: 'Japanese', hi: 'Hindi', mr: 'Marathi', ar: 'Arabic' }[this.targetLang] || 'target language';
    const trans = vocab.translations[this.targetLang] || vocab.word;

    // Randomly pick quiz type: 0 = "what is the translation?", 1 = "which object?"
    const quizType = Math.random() < 0.5 ? 0 : 1;

    let question, correctAnswer, optionKey;
    if (quizType === 0) {
      // English → translation
      question = `How do you say "<strong>${vocab.word}</strong>" in ${langName}?`;
      correctAnswer = trans;
      optionKey = 'translations';
    } else {
      // Translation → English
      question = `"<strong>${trans}</strong>" in ${langName} means:`;
      correctAnswer = vocab.word;
      optionKey = 'word';
    }

    // Generate distractors
    const allKeys = getAllVocabKeys().filter(k => k !== key);
    const distractorKeys = this.shuffleArray(allKeys).slice(0, 3);
    const distractors = distractorKeys.map(k => {
      const v = getVocab(k);
      return quizType === 0 ? (v.translations[this.targetLang] || v.word) : v.word;
    });

    const options = this.shuffleArray([correctAnswer, ...distractors]);

    this.$('quiz-question').innerHTML = question;
    this.$('quiz-score-display').textContent = `${this.quizCorrect}/${this.quizTotal}`;

    const optionsEl = this.$('quiz-options');
    optionsEl.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => this.checkQuizAnswer(opt, correctAnswer, key));
      optionsEl.appendChild(btn);
    });

    this.$('quiz-question-area').classList.remove('hidden');
    this.$('quiz-feedback').classList.add('hidden');
  }

  checkQuizAnswer(chosen, correct, key) {
    const isCorrect = chosen === correct;
    this.quizTotal++;
    this.quizCorrect += isCorrect ? 1 : 0;
    this.markQuizResult(key, isCorrect);

    // Highlight buttons
    this.$('quiz-options').querySelectorAll('.quiz-option').forEach(btn => {
      btn.disabled = true;
      if (btn.textContent === correct) btn.classList.add('correct');
      else if (btn.textContent === chosen && !isCorrect) btn.classList.add('wrong');
    });

    this.$('feedback-icon').textContent = isCorrect ? '✓' : '✗';
    this.$('feedback-icon').className = isCorrect ? 'feedback-correct' : 'feedback-wrong';
    this.$('feedback-text').textContent = isCorrect
      ? 'Great job! Keep it up!'
      : `The correct answer was: "${correct}"`;

    this.$('quiz-score-display').textContent = `${this.quizCorrect}/${this.quizTotal}`;
    this.$('quiz-feedback').classList.remove('hidden');
    this.$('quiz-question-area').classList.add('faded');
  }

  nextQuizQuestion() {
    this.quizIdx++;
    this.$('quiz-question-area').classList.remove('faded');
    this.showQuizQuestion();
  }

  showQuizResults() {
    const pct = this.quizTotal > 0 ? Math.round((this.quizCorrect / this.quizTotal) * 100) : 0;
    const msg = pct >= 80 ? 'Excellent! 🌟' : pct >= 60 ? 'Good work! 👍' : 'Keep practicing! 💪';
    this.$('quiz-question').innerHTML =
      `<div class="quiz-results">
        <div class="results-score">${pct}%</div>
        <div class="results-label">${this.quizCorrect} of ${this.quizTotal} correct</div>
        <div class="results-msg">${msg}</div>
      </div>`;
    this.$('quiz-options').innerHTML = '';
    this.$('quiz-feedback').classList.add('hidden');
    this.$('quiz-question-area').classList.remove('faded', 'hidden');
    this.$('quiz-next-btn').textContent = 'Done';
    this.$('quiz-next-btn').onclick = () => this.closeQuiz();
    this.$('quiz-feedback').classList.remove('hidden');
    this.$('quiz-feedback').querySelector('p').textContent = '';
    this.$('feedback-icon').textContent = '';
    this.updateSplashStats();
  }

  closeQuiz() {
    const modal = this.$('quiz-modal');
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
    this.$('quiz-next-btn').textContent = 'Next';
    this.$('quiz-next-btn').onclick = () => this.nextQuizQuestion();
  }

  // ─── Progress Screen ───────────────────────────────────────────────────────

  showProgress() {
    const allKeys = getAllVocabKeys();
    const seenKeys = allKeys.filter(k => this.progress[k] && this.progress[k].seen > 0);
    const learnedKeys = allKeys.filter(k => this.isLearned(k));
    const pct = allKeys.length > 0 ? Math.round((learnedKeys.length / allKeys.length) * 100) : 0;

    this.$('progress-bar').style.width = pct + '%';
    this.$('progress-text').textContent =
      `${learnedKeys.length} learned · ${seenKeys.length} seen · ${allKeys.length} total`;

    const listEl = this.$('word-list');
    listEl.innerHTML = '';

    // Sort: learned first, then seen, then unseen
    const sorted = [...allKeys].sort((a, b) => {
      const la = this.isLearned(a) ? 2 : (this.progress[a]?.seen > 0 ? 1 : 0);
      const lb = this.isLearned(b) ? 2 : (this.progress[b]?.seen > 0 ? 1 : 0);
      return lb - la;
    });

    sorted.forEach(key => {
      const vocab = getVocab(key);
      if (!vocab) return;
      const p = this.progress[key];
      const learned = this.isLearned(key);
      const seen = p && p.seen > 0;
      const trans = vocab.translations[this.targetLang] || '—';

      const item = document.createElement('div');
      item.className = `word-item ${learned ? 'learned' : seen ? 'seen' : 'unseen'}`;
      item.innerHTML = `
        <div class="word-item-left">
          <span class="word-status-icon">${learned ? '✓' : seen ? '○' : '·'}</span>
          <div>
            <span class="word-item-word">${vocab.word}</span>
            <span class="word-item-phonetic">${vocab.phonetic}</span>
          </div>
        </div>
        <div class="word-item-right">
          <span class="word-item-trans">${trans}</span>
          ${p ? `<span class="word-item-score">${p.total > 0 ? Math.round(p.correct / p.total * 100) + '%' : '—'}</span>` : ''}
        </div>`;
      listEl.appendChild(item);
    });

    this.showScreen('progress-screen');
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.app = new ARApp();
});
