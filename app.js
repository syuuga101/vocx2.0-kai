(() => {
  'use strict';

  /* =========================================================================
   * 1. STATE & STORAGE MANAGEMENT
   * ========================================================================= */
  const STORAGE_KEY = 'vocx_dojo_app_state_v2';
  const LEGACY_STORAGE_KEY = 'vocx_dojo_app_state_v1';

  const defaultState = {
    face: 'vocx',          // 'vocx' | 'dojo'
    activeTab: 'home',     // 'home' | 'mypage'
    profileName: '@Name',
    settings: {
      initialHint: true,
      soundEffects: true   // Enabled by default for ./se/ audio files
    },
    // Unit progress per face:
    // vocxProgress[unitId] = { clearedModes: { 'jpn-eng': bool, 'eng-select': bool, 'eng-type': bool }, bestScorePct: number, perfectClearCount: number, pausedSession: null | {...} }
    vocxProgress: {},
    dojoProgress: {}
  };

  let appState = loadState();
  let vocxUnitsData = Object.assign({}, window.VOCX_FALLBACK_DATA || {});
  let dojoUnitsData = Object.assign({}, window.DOJO_FALLBACK_DATA || {});
  let currentSession = null;
  let debugProgress = null;
  let debugSandbox = null;
  let cancelChoicePress = null;
  let studyClock = null;
  let studyTick = 0;
  let countdownTick = 0;

  function formatStudyTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function animateCountdownNumber(element) {
    if (!element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate([
      {opacity: 0, transform: 'scale(.78) translateY(10px)'},
      {opacity: 1, transform: 'scale(1.06) translateY(0)', offset: .65},
      {opacity: 1, transform: 'scale(1) translateY(0)'}
    ], {duration: 360, easing: 'cubic-bezier(.22,1,.36,1)'});
  }

  function recordStudyTime() {
    if (!studyClock || !currentSession) return;
    const now = performance.now();
    const delta = now - studyClock.startedAt;
    currentSession.elapsedTimeMs ??= (currentSession.totalTimeMs || 0) + (currentSession.answeredCurrent ? 0 : currentSession.questionTimeMs || 0);
    currentSession.elapsedTimeMs += delta;
    currentSession.totalTimeMs = currentSession.elapsedTimeMs;
    if (!currentSession.answeredCurrent) currentSession.questionTimeMs = (currentSession.questionTimeMs || 0) + delta;
    studyClock.startedAt = now;
    const timer = document.getElementById('quiz-study-time');
    const label = formatStudyTime(currentSession.elapsedTimeMs);
    if (timer.textContent !== label) timer.textContent = label;
  }

  function startQuestionClock() {
    stopStudyClock();
    studyClock = { startedAt: performance.now() };
    recordStudyTime();
    studyTick = setInterval(recordStudyTime, 1000);
  }

  function stopStudyClock() {
    recordStudyTime();
    clearInterval(studyTick);
    studyClock = null;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...structuredClone(defaultState),
          ...parsed,
          settings: { ...defaultState.settings, ...(parsed.settings || {}) },
          vocxProgress: parsed.vocxProgress || {},
          dojoProgress: parsed.dojoProgress || {}
        };
      }
      // Migrate progress from v1 while preserving progress and enabling sound effects.
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const migrated = {
          ...structuredClone(defaultState),
          face: legacy.face || 'vocx',
          activeTab: legacy.activeTab || 'home',
          profileName: legacy.profileName || '@Name',
          settings: {
            initialHint: legacy.settings && typeof legacy.settings.initialHint === 'boolean'
              ? legacy.settings.initialHint
              : true,
            soundEffects: true
          },
          vocxProgress: legacy.vocxProgress || {},
          dojoProgress: legacy.dojoProgress || {}
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return structuredClone(defaultState);
    } catch (e) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    if (debugSandbox) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      // Ignore quota errors
    }
  }

  /* =========================================================================
   * 2. SOUND EFFECTS FROM ./se/ FOLDER
   * ========================================================================= */
  const SE_FILES = {
    tap: './se/button.wav',
    slide: './se/Slide.wav',
    correct: './se/correct.wav',
    wrong: './se/incorrect.wav',
    complete: './se/correct.wav',
    countdown: './se/countdown.wav',
    countdownStart: './se/countdown-start.wav'
  };

  const preloadedAudio = {};
  Object.entries(SE_FILES).forEach(([key, src]) => {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      preloadedAudio[key] = a;
    } catch (e) {
      // Ignore preload errors
    }
  });

  function playSound(type) {
    if (!appState.settings.soundEffects) return;
    try {
      const src = SE_FILES[type] || SE_FILES.tap;
      const baseAudio = preloadedAudio[type];
      if (baseAudio) {
        const sound = baseAudio.cloneNode();
        sound.volume = 0.85;
        sound.play().catch(() => {});
      } else {
        const sound = new Audio(src);
        sound.volume = 0.85;
        sound.play().catch(() => {});
      }
    } catch (e) {
      // Ignore audio errors
    }
  }

  /* =========================================================================
   * 3. CSV & JSON DYNAMIC LOADER (with fallback to data.js)
   * ========================================================================= */
  function parseCSVText(text) {
    const rows = [];
    let cur = '';
    let inQuotes = false;
    let row = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cur);
        cur = '';
        if (row.length >= 4 && row[0].trim()) {
          rows.push({
            word: row[0].trim(),
            jpn: row[1].trim(),
            def: row[2].trim(),
            sentence: row[3].trim(),
            inflected: row[4] ? row[4].trim() : ''
          });
        }
        row = [];
      } else {
        cur += ch;
      }
    }
    if (cur || row.length > 0) {
      row.push(cur);
      if (row.length >= 4 && row[0].trim()) {
        rows.push({
          word: row[0].trim(),
          jpn: row[1].trim(),
          def: row[2].trim(),
          sentence: row[3].trim(),
          inflected: row[4] ? row[4].trim() : ''
        });
      }
    }
    return rows;
  }

  async function tryFetchLiveFiles() {
    if (window.location.protocol === 'file:') return;
    const unitPromises = [];
    for (let i = 2; i <= 27; i++) {
      const id = String(i).padStart(2, '0');
      unitPromises.push(
        fetch(`./vocx/${id}.csv`)
          .then(r => (r.ok ? r.text() : null))
          .then(txt => {
            if (txt) {
              const parsed = parseCSVText(txt);
              if (parsed.length > 0) vocxUnitsData[id] = parsed;
            }
          })
          .catch(() => {})
      );
    }
    const dojoPaths = [
      { unit: '01', part: 'part1', url: './dojo/unit1/part1.json' },
      { unit: '01', part: 'part2', url: './dojo/unit1/part2.json' },
      { unit: '02', part: 'part1', url: './dojo/Unit2/part1.json' },
      { unit: '02', part: 'part2', url: './dojo/Unit2/part2.json' }
    ];
    dojoPaths.forEach(({ unit, part, url }) => {
      unitPromises.push(
        fetch(url)
          .then(r => (r.ok ? r.json() : null))
          .then(json => {
            if (json) {
              if (!dojoUnitsData[unit]) dojoUnitsData[unit] = {};
              dojoUnitsData[unit][part] = json;
            }
          })
          .catch(() => {})
      );
    });
    await Promise.all(unitPromises);
    renderHomeUnits();
  }

  /* =========================================================================
   * 4. UI HELPERS & BADGE SVGS
   * ========================================================================= */
  const CHECK_BADGE_SVG = `
    <svg class="unit-badge" width="26" height="26" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16.5" cy="16.5" r="15" fill="var(--green-ring)" stroke="#2C2C2C" stroke-width="3"/>
      <path d="M23 13L14.75 21.25L11 17.5" stroke="#2C2C2C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const PAUSE_BADGE_SVG = `
    <svg class="unit-badge" width="26" height="26" viewBox="0 0 33 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16.5" cy="16.5" r="15" fill="var(--pink-accent)" stroke="#2C2C2C" stroke-width="3"/>
      <path d="M14 22V11M18.7143 22V11" stroke="#2C2C2C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('mode-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /* =========================================================================
   * 5. HOME SCREEN & UNIT STATUS COMPUTATION
   * ========================================================================= */
  function getPerfectClearCount(entry) {
    // Older saves recorded only the best score, so preserve one known perfect clear.
    return entry?.perfectClearCount ?? (entry?.bestScorePct === 100 ? 1 : 0);
  }

  function getProgressEntry(face, unitId) {
    if (debugProgress?.face === face && debugProgress.unitId === unitId) return debugProgress.entry;
    return (face === 'vocx' ? appState.vocxProgress : appState.dojoProgress)[unitId];
  }

  function getUnitEvaluation(face, unitId) {
    const entry = getProgressEntry(face, unitId);
    if (!entry) {
      return { status: 'untried', label: 'Untried', badge: '' };
    }
    if (entry.pausedSession) {
      return { status: 'paused', label: '続きから', badge: PAUSE_BADGE_SVG };
    }
    const cleared = entry.clearedModes || {};
    const standardModes = face === 'vocx' ? ['jpn-eng', 'eng-select', 'eng-type'] : ['part1', 'part2'];
    const clearedCount = standardModes.filter(mode => cleared[mode]).length;
    const requiredModes = face === 'vocx' ? 3 : 2;
    const perfectCount = getPerfectClearCount(entry);

    if (perfectCount >= 2) {
      return { status: 'marvelous', label: `Marvelous! ×${perfectCount}`, badge: CHECK_BADGE_SVG };
    }
    if (perfectCount >= 1) {
      return {
        status: 'perfect',
        label: 'Perfect!',
        badge: clearedCount >= requiredModes ? CHECK_BADGE_SVG : ''
      };
    }
    if (Object.values(cleared).some(Boolean)) {
      return { status: 'nice', label: 'Nice!', badge: '' };
    }
    return { status: 'untried', label: 'Untried', badge: '' };
  }

  function renderHomeUnits() {
    document.documentElement.dataset.face = appState.face;
    const listEl = document.getElementById('units-list');
    document.getElementById('face-vocx-btn').setAttribute('aria-pressed', String(appState.face === 'vocx'));
    document.getElementById('face-dojo-btn').setAttribute('aria-pressed', String(appState.face === 'dojo'));

    const unitIds = appState.face === 'vocx'
      ? Object.keys(vocxUnitsData).sort((a, b) => Number(a) - Number(b))
      : Object.keys(dojoUnitsData).sort((a, b) => Number(a) - Number(b));

    const rowsHtml = unitIds.map(unitId => {
      const evalInfo = getUnitEvaluation(appState.face, unitId);
      const perfectLevel = Math.min(2, getPerfectClearCount(getProgressEntry(appState.face, unitId)));
      return `
        <div class="unit-row" role="button" tabindex="0" aria-label="Unit ${unitId}、${evalInfo.label}、モードを選択" data-unit="${unitId}" data-status="${evalInfo.status}" data-perfect-level="${perfectLevel}">
          <div class="unit-circle-wrap" data-role="circle" data-unit="${unitId}">
            <div class="unit-circle-shadow"></div>
            <div class="unit-circle-main">
              <span class="unit-circle-num">${unitId}</span>
            </div>
            ${evalInfo.badge}
          </div>
          <div class="unit-info-wrap" data-role="unit-text" data-unit="${unitId}">
            <div class="unit-title-text">Unit ${unitId}</div>
            <div class="unit-status-text">${evalInfo.label}</div>
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = `<div class="timeline-line"></div>${rowsHtml}`;

    scheduleUnitScrollHints();
  }

  const MODE_OPTIONS = {
    vocx: [
      { id: 'jpn-eng', label: '日本語→英単語', icon: '<img class="mode-image" src="./sys/mode-jp-en.png" alt="" />', accessibleLabel: '日本語から英単語を選ぶ' },
      { id: 'eng-select', label: '英語(文)→英単語', icon: '<img class="mode-image" src="./sys/mode-en-en.png" alt="" />', accessibleLabel: '英文から英単語を選ぶ' },
      { id: 'eng-type', label: '英単語を入力', hint: '英文の空欄を埋める', icon: '<i class="fa-regular fa-keyboard"></i>', accessibleLabel: '英文の空欄に英単語を入力する' },
      { id: 'oni', label: '鬼モード', hint: '3つの出題形式をシャッフル', icon: '鬼', accessibleLabel: '鬼モード、3つの出題形式を混ぜて出題する' }
    ],
    dojo: [
      { id: 'part1', label: 'Part 1', icon: '01', accessibleLabel: '単語の組み合わせと選択問題' },
      { id: 'part2', label: 'Part 2', icon: '02', accessibleLabel: '会話とフレーズの問題' }
    ]
  };
  const modeDialog = document.getElementById('unit-mode-dialog');
  const modeOptions = document.getElementById('unit-mode-options');
  let selectedUnit = null;

  function openUnitModes(unitId) {
    selectedUnit = unitId;
    const progress = appState.face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;
    const paused = progress[unitId]?.pausedSession;
    document.getElementById('unit-mode-title').textContent = 'UNIT ' + unitId;
    document.getElementById('unit-mode-description').textContent = 'モードを選択';
    const available = MODE_OPTIONS[appState.face].filter(mode => appState.face === 'vocx' || dojoUnitsData[unitId]?.[mode.id]);
    const resumeLabel = MODE_OPTIONS[appState.face].find(mode => mode.id === paused?.mode)?.label || 'Practice';
    const chevron = '<i class="fa-solid fa-chevron-right mode-chevron" aria-hidden="true"></i>';
    modeOptions.innerHTML = (paused ? '<button type="button" class="mode-option mode-resume" data-mode="resume"><span class="mode-icon" aria-hidden="true"><i class="fa-solid fa-play"></i></span><span class="mode-copy"><strong>途中から再開</strong><span class="mode-progress">' + resumeLabel + ' · ' + Math.min(paused.currentIndex + 1, paused.questions.length) + ' / ' + paused.questions.length + '</span></span>' + chevron + '</button>' : '')
      + available.map(mode => '<button type="button" class="mode-option" data-mode="' + mode.id + '" aria-label="' + mode.accessibleLabel + (paused ? '、最初から' : '') + '"><span class="mode-icon" aria-hidden="true">' + mode.icon + '</span><span class="mode-copy"><strong class="mode-name">' + mode.label + '</strong>' + (mode.hint ? '<span class="mode-progress">' + mode.hint + '</span>' : '') + '</span>' + chevron + '</button>').join('');
    modeDialog.style.setProperty('--mode-sheet-width', document.getElementById('phone-viewport').clientWidth + 'px');
    playSound('tap');
    modeDialog.showModal();
  }
  document.getElementById('units-list').addEventListener('click', event => {
    const row = event.target.closest('.unit-row');
    if (row) openUnitModes(row.dataset.unit);
  });
  document.getElementById('units-list').addEventListener('keydown', event => {
    const row = event.target.closest('.unit-row');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openUnitModes(row.dataset.unit);
    }
  });
  document.getElementById('unit-mode-close').addEventListener('click', () => modeDialog.close());
  modeDialog.addEventListener('click', event => {
    if (event.target !== modeDialog) return;
    const rect = modeDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modeDialog.close();
  });
  let sheetPointer = null;
  let sheetOriginY = 0;
  let sheetOffsetY = 0;
  function resetModeSheetDrag() {
    sheetPointer = null;
    sheetOffsetY = 0;
    modeDialog.classList.remove('is-dragging');
    modeDialog.style.transform = '';
  }
  modeDialog.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || event.target.closest('button') || !event.target.closest('.mode-sheet-grip, .mode-dialog-header')) return;
    sheetPointer = event.pointerId;
    sheetOriginY = event.clientY;
    sheetOffsetY = 0;
    modeDialog.classList.add('is-dragging');
    modeDialog.setPointerCapture(event.pointerId);
  });
  modeDialog.addEventListener('pointermove', event => {
    if (event.pointerId !== sheetPointer) return;
    sheetOffsetY = Math.max(0, event.clientY - sheetOriginY);
    modeDialog.style.transform = 'translateY(' + sheetOffsetY + 'px)';
  });
  modeDialog.addEventListener('pointerup', event => {
    if (event.pointerId !== sheetPointer) return;
    const dismiss = sheetOffsetY >= 72;
    if (modeDialog.hasPointerCapture(event.pointerId)) modeDialog.releasePointerCapture(event.pointerId);
    resetModeSheetDrag();
    if (dismiss) modeDialog.close();
  });
  modeDialog.addEventListener('pointercancel', resetModeSheetDrag);
  modeDialog.addEventListener('close', resetModeSheetDrag);
  modeOptions.addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (!button || selectedUnit === null) return;
    const unitId = selectedUnit;
    const mode = button.dataset.mode;
    const progress = appState.face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;
    modeDialog.close();
    if (mode === 'resume') {
      const saved = progress[unitId]?.pausedSession;
      if (saved) resumePausedSession(saved);
    } else if (appState.face === 'vocx') {
      startVocxQuiz(unitId, mode);
    } else {
      startDojoQuiz(unitId, mode);
    }
  });

  /* =========================================================================
   * 6. QUESTION BUILDERS FOR VOCX & DOJO
   * ========================================================================= */
  function buildBlankedSentence(sentence, word, inflected, showInitialHint) {
    const candidates = [];
    if (inflected && inflected.trim()) candidates.push(inflected.trim());
    if (word && word.trim()) candidates.push(word.trim());

    for (const target of candidates) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      const match = sentence.match(regex) || sentence.match(new RegExp(escaped, 'i'));
      if (match) {
        const matchedStr = match[0];
        const replacement = showInitialHint
          ? `${matchedStr.charAt(0)}_____`
          : '______';
        return sentence.replace(matchedStr, replacement);
      }
    }
    return sentence;
  }

  function sanitizeDefinitionForType(defText, word, inflected) {
    if (!defText) return '';
    let result = defText;
    const candidates = [];
    if (inflected && inflected.trim()) candidates.push(inflected.trim());
    if (word && word.trim()) candidates.push(word.trim());
    for (const target of candidates) {
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(regex, '_____');
    }
    return result;
  }

  function startVocxQuiz(unitId, mode) {
    const rows = vocxUnitsData[unitId];
    if (!rows || rows.length === 0) return;

    const shuffledRows = shuffleArray(rows);
    const mixedModes = shuffleArray(['jpn-eng', 'eng-select', 'eng-type']);
    const questionModes = mode === 'oni'
      ? shuffleArray(shuffledRows.map((_, index) => mixedModes[index % mixedModes.length]))
      : shuffledRows.map(() => mode);
    const questions = shuffledRows.map((item, index) => {
      const questionMode = questionModes[index];
      const distractors = questionMode === 'eng-type' ? [] : shuffleArray(
        rows.filter(r => r.word.toLowerCase() !== item.word.toLowerCase())
      ).slice(0, 3);

      if (questionMode === 'jpn-eng') {
        const choices = shuffleArray([
          capitalizeFirst(item.word),
          ...distractors.map(d => capitalizeFirst(d.word))
        ]);
        const answerIndex = choices.findIndex(
          c => c.toLowerCase() === item.word.toLowerCase()
        );
        return {
          kind: 'vocx-jpn-eng',
          prompt: item.jpn,
          choices,
          answerIndex,
          wordDisplay: capitalizeFirst(item.word),
          subDisplay: item.jpn,
          rawItem: item
        };
      } else if (questionMode === 'eng-select') {
        const distractorWords = distractors.map(d => capitalizeFirst(d.word));
        const correctLabel = capitalizeFirst(item.inflected ? item.inflected : item.word);
        const choices = shuffleArray([correctLabel, ...distractorWords]);
        const answerIndex = choices.indexOf(correctLabel);
        return {
          kind: 'vocx-eng-select',
          prompt: buildBlankedSentence(item.sentence, item.word, item.inflected, false),
          choices,
          answerIndex,
          wordDisplay: capitalizeFirst(item.word),
          subDisplay: item.jpn,
          rawItem: item
        };
      } else {
        // eng-type
        return {
          kind: 'vocx-eng-type',
          defText: sanitizeDefinitionForType(item.def, item.word, item.inflected),
          acceptedAnswers: [
            item.word.toLowerCase(),
            ...(item.inflected ? [item.inflected.toLowerCase()] : [])
          ],
          wordDisplay: capitalizeFirst(item.word),
          subDisplay: item.jpn,
          rawItem: item
        };
      }
    });

    const modeLabel = mode === 'oni' ? '鬼モード' : mode === 'jpn-eng'
      ? 'JPN-ENG'
      : mode === 'eng-select'
        ? 'ENG-ENG Select'
        : 'ENG-ENG Type';
    showToast(modeLabel);

    currentSession = {
      face: 'vocx',
      unitId,
      mode,
      questions,
      currentIndex: 0,
      correctCount: 0,
      selectedChoice: null,
      typedText: '',
      answeredCurrent: false
    };
    openQuizScreen();
  }

  function stripLeadingQuestionNumber(text) {
    return text
      .replace(/^\d+\.\s*/, '')
      .replace(/^A:\s*/i, '')
      .replace(/\s*\/\s*B:\s*_+\s*$/i, '')
      .trim();
  }

  function startDojoQuiz(unitId, part) {
    const unitObj = dojoUnitsData[unitId];
    if (!unitObj || !unitObj[part]) return;
    const quizData = unitObj[part];
    const questions = [];

    if (part === 'part1') {
      const sec1 = (quizData.sections || []).find(s => s.type === 'matching');
      const sec2 = (quizData.sections || []).find(s => s.type === 'choice');

      if (sec1 && sec1.questions) {
        const allWords = Array.from(
          new Set(
            (sec1.options || [])
              .filter(w => w && w !== '未解答')
              .concat(sec1.questions.map(q => q.answer))
          )
        );
        const pickedVocab = shuffleArray(sec1.questions).slice(0, 5);
        pickedVocab.forEach(q => {
          const distractors = shuffleArray(
            allWords.filter(w => w.toLowerCase() !== q.answer.toLowerCase())
          ).slice(0, 3);
          const choices = shuffleArray([q.answer, ...distractors]);
          questions.push({
            kind: 'dojo-voc',
            prompt: stripLeadingQuestionNumber(q.text),
            choices,
            answerIndex: choices.indexOf(q.answer),
            wordDisplay: q.answer,
            subDisplay: q.explanation || '',
            rawItem: q
          });
        });
      }

      if (sec2 && sec2.questions) {
        const pickedChoice = shuffleArray(sec2.questions).slice(0, 5);
        pickedChoice.forEach(q => {
          const pairs = q.choices.map((c, idx) => ({ text: c, isCorrect: idx === q.answer }));
          const shuffledPairs = shuffleArray(pairs);
          const answerIndex = shuffledPairs.findIndex(p => p.isCorrect);
          questions.push({
            kind: 'dojo-answer',
            prompt: stripLeadingQuestionNumber(q.text).replace(/_{3,}/g, '_____'),
            choices: shuffledPairs.map(p => p.text),
            answerIndex,
            wordDisplay: shuffledPairs[answerIndex].text,
            subDisplay: q.explanation || '',
            rawItem: q
          });
        });
      }
    } else {
      // part2 (PDF phrasal verbs)
      const sec1 = (quizData.sections || [])[0];
      if (sec1 && sec1.questions) {
        const picked = shuffleArray(sec1.questions).slice(0, 10);
        picked.forEach(q => {
          const pairs = q.choices.map((c, idx) => ({
            text: capitalizeFirst(c),
            isCorrect: idx === q.answer
          }));
          const shuffledPairs = shuffleArray(pairs);
          const answerIndex = shuffledPairs.findIndex(p => p.isCorrect);
          questions.push({
            kind: 'dojo-phrasal',
            prompt: stripLeadingQuestionNumber(q.text).replace(/_{3,}/g, '_____'),
            choices: shuffledPairs.map(p => p.text),
            answerIndex,
            wordDisplay: shuffledPairs[answerIndex].text,
            subDisplay: q.explanation || '',
            rawItem: q
          });
        });
      }
    }

    showToast(part === 'part1' ? 'Dojo Part 1' : 'Dojo Part 2');
    currentSession = {
      face: 'dojo',
      unitId,
      mode: part,
      questions,
      currentIndex: 0,
      correctCount: 0,
      selectedChoice: null,
      typedText: '',
      answeredCurrent: false
    };
    openQuizScreen();
  }

  function resumePausedSession(savedSession) {
    currentSession = structuredClone(savedSession);
    if (currentSession.answeredCurrent) {
      currentSession.currentIndex++;
      currentSession.secondLetterHint = false;
      currentSession.meaningHint = false;
      currentSession.questionTimeMs = 0;
      if (currentSession.currentIndex >= currentSession.questions.length) {
        finishQuizSession();
        return;
      }
    }
    const selectedChoice = currentSession.answeredCurrent ? null : currentSession.selectedChoice;
    const typedText = currentSession.answeredCurrent ? '' : currentSession.typedText;
    currentSession.answeredCurrent = false;
    showToast('Resumed');
    openQuizScreen(false);
    currentSession.selectedChoice = selectedChoice;
    currentSession.typedText = typedText || '';
    const input = document.getElementById('type-native-input');
    if (input) input.value = currentSession.typedText;
    document.querySelectorAll('.choice-btn').forEach(button => {
      button.classList.toggle('selected', Number(button.dataset.choiceIndex) === selectedChoice);
    });
    saveQuizCheckpoint();
  }

  /* =========================================================================
   * 7. QUIZ SCREEN RENDERING & INTERACTION
   * ========================================================================= */
  function cancelQuizCountdown() {
    clearTimeout(countdownTick);
    document.getElementById('quiz-countdown').hidden = true;
    document.getElementById('screen-quiz').classList.remove('quiz-preparing');
  }

  function openQuizScreen(withCountdown = true) {
    if (debugSandbox?.skipCountdown) { withCountdown = false; debugSandbox.skipCountdown = false; }
    cancelQuizCountdown();
    stopStudyClock();
    document.getElementById('screen-main').classList.remove('active');
    document.getElementById('screen-quiz').classList.add('active');
    const sheet = document.getElementById('quiz-sheet');
    sheet.style.transform = 'translateY(0px)';
    document.getElementById('screen-quiz').scrollTop = 0;
    closeCheckSheet();
    const session = currentSession;
    const begin = () => {
      if (currentSession !== session) return;
      cancelQuizCountdown();
      renderCurrentQuestion();
      if (withCountdown) saveQuizCheckpoint();
      if (!appState.pauseHintSeen) {
        showToast('上のバーを下にスワイプすると一時停止');
        appState.pauseHintSeen = true;
        saveState();
      }
    };
    if (!withCountdown) {
      begin();
      return;
    }
    document.getElementById('quiz-content').replaceChildren();
    document.getElementById('quiz-study-time').textContent = '00:00';
    document.getElementById('screen-quiz').classList.add('quiz-preparing');
    const countdown = document.getElementById('quiz-countdown');
    const number = document.getElementById('quiz-countdown-number');
    countdown.hidden = false;
    let remaining = 3;
    number.textContent = String(remaining);
    animateCountdownNumber(number);
    const tick = () => {
      if (currentSession !== session) return;
      remaining--;
      if (remaining === 0) {
        playSound('countdownStart');
        begin();
      } else {
        number.textContent = String(remaining);
        animateCountdownNumber(number);
        playSound('countdown');
        countdownTick = setTimeout(tick, 1000);
      }
    };
    playSound('countdown');
    countdownTick = setTimeout(tick, 1000);
  }

  function closeQuizScreen() {
    cancelQuizCountdown();
    stopStudyClock();
    closeCheckSheet();
    document.getElementById('screen-quiz').classList.remove('active');
    document.getElementById('screen-main').classList.add('active');
    currentSession = null;
    renderHomeUnits();
  }

  function updateProgressBar() {
    if (!currentSession) return;
    const total = Math.max(1, currentSession.questions.length);
    const ratio = Math.min(1, Math.max(0, (currentSession.currentIndex + 1) / total));
    const trackEl = document.getElementById('quiz-progress-track');
    const trackWidth = (trackEl && trackEl.clientWidth) ? trackEl.clientWidth : 210;
    const thumbSize = 18;
    const fillWidth = Math.max(thumbSize, Math.round(thumbSize + (trackWidth - thumbSize) * ratio));
    const thumbLeft = fillWidth - thumbSize;

    document.getElementById('quiz-progress-fill').style.width = `${fillWidth}px`;
    document.getElementById('quiz-progress-thumb').style.left = `${thumbLeft}px`;
    document.getElementById('quiz-unit-num').textContent = currentSession.unitId;
    document.getElementById('quiz-question-count').textContent = `${Math.min(currentSession.currentIndex + 1, total)} / ${total} 問目`;
  }

  /* Sync --app-height to eliminate iOS standalone black-translucent bottom gap */
  function syncViewportHeight() {
    const innerH = window.innerHeight || document.documentElement.clientHeight || 800;
    const screenH = window.screen && window.screen.height ? window.screen.height : innerH;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches;

    // On iPhone PWA with apple-mobile-web-app-status-bar-style="black-translucent",
    // WebKit shifts origin to y=0 but reports innerHeight = screen.height - statusBarHeight.
    // Using screenH in portrait standalone fills the entire physical screen down to the bottom edge.
    let targetH = innerH;
    if (isPortrait && screenH > innerH && (screenH - innerH) <= 120 && (isStandalone || (screenH - innerH) <= 70)) {
      targetH = screenH;
    }
    document.documentElement.style.setProperty('--app-height', `${targetH}px`);
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }

  /* Prevent root window scrolling/bouncing when touching the navigation bar, header, Mypage, or overscrolling */
  let lastTouchY = 0;
  document.addEventListener('touchstart', e => {
    if (e.touches && e.touches.length === 1) {
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (e.touches && e.touches.length > 1) {
      return;
    }
    const scrollEl = e.target.closest('.units-scroll, .quiz-content, .unit-mode-dialog, .check-sheet, .results-screen, .mypage-body, .debug-panel');
    if (!scrollEl) {
      // Touched navigation bar (.bottom-footer), header (.app-header), Mypage, modals, etc. -> block page scroll
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    const curY = e.touches && e.touches.length ? e.touches[0].clientY : lastTouchY;
    const dy = curY - lastTouchY;
    lastTouchY = curY;

    // Prevent scroll-chaining to the root window at top and bottom boundaries
    if (dy > 0 && scrollEl.scrollTop <= 0) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (dy < 0 && scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1) {
      if (e.cancelable) e.preventDefault();
      return;
    }
  }, { passive: false });

  window.addEventListener('scroll', () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    syncViewportHeight();
    if (currentSession) {
      updateProgressBar();
    }
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(syncViewportHeight, 60);
  });
  window.addEventListener('pageshow', syncViewportHeight);

  function renderCurrentQuestion() {
    if (!currentSession) return;
    cancelChoicePress?.();
    startQuestionClock();
    updateProgressBar();
    closeCheckSheet();

    const q = currentSession.questions[currentSession.currentIndex];
    currentSession.selectedChoice = null;
    currentSession.typedText = '';
    currentSession.answeredCurrent = false;

    const contentEl = document.getElementById('quiz-content');
    contentEl.scrollTop = 0;

    if (q.kind === 'vocx-eng-type') {
      const raw = q.rawItem;
      const sentenceText = buildBlankedSentence(
        raw.sentence,
        raw.word,
        raw.inflected,
        appState.settings.initialHint
      );
      const safeDef = sanitizeDefinitionForType(q.defText || raw.def, raw.word, raw.inflected);
      contentEl.innerHTML = `
        <div class="quiz-prompt-type-wrap">
          <div id="type-hint-sentence" class="quiz-prompt-type-sentence">${escapeHtml(sentenceText)}</div>
          <div class="quiz-prompt-type-def">${escapeHtml(safeDef)}</div>
        </div>
        <form id="type-input-form" class="type-input-box" autocomplete="off">
          <input
            id="type-native-input"
            class="type-native-input"
            type="text"
            inputmode="text"
            autocapitalize="none"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="send"
            maxlength="28"
            aria-label="Type English word"
          />
          <button id="type-submit-btn" class="type-submit-btn" type="submit" aria-label="Submit Answer">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 11V1M9 4.75L5 1L1 4.75" stroke="#2C2C2C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
        <div class="hint-button-wrap">
          <button id="second-letter-hint" class="btn-54" type="button">
            <span class="shadow" aria-hidden="true"></span><span class="depth" aria-hidden="true"></span><span id="second-letter-hint-label" class="content">2文字目のヒント</span>
          </button>
        </div>
        <div class="meaning-hint-wrap">
          <button id="meaning-hint-btn" class="btn-54" type="button" aria-controls="meaning-hint-text" aria-expanded="false">
            <span class="shadow" aria-hidden="true"></span><span class="depth" aria-hidden="true"></span><span class="content">日本語の意味を見る</span>
          </button>
          <p id="meaning-hint-text" class="meaning-hint-text" role="status" hidden></p>
        </div>
      `;
      const meaningButton = document.getElementById('meaning-hint-btn');
      const showMeaning = () => {
        const text = document.getElementById('meaning-hint-text');
        text.textContent = raw.jpn || '';
        text.hidden = false;
        currentSession.meaningHint = true;
        meaningButton.setAttribute('aria-expanded', 'true');
        meaningButton.disabled = true;
      };
      meaningButton.addEventListener('click', () => {
        if (!currentSession || currentSession.answeredCurrent) return;
        showMeaning();
        playSound('tap');
        saveQuizCheckpoint();
      });
      if (currentSession.meaningHint) showMeaning();
      const hintButton = document.getElementById('second-letter-hint');
      const showSecondLetter = () => {
        const answer = raw.inflected || raw.word;
        const blanked = buildBlankedSentence(raw.sentence, raw.word, raw.inflected, false);
        document.getElementById('type-hint-sentence').textContent = blanked.replace('______', answer.slice(0, 2) + '____');
        currentSession.secondLetterHint = true;
        hintButton.disabled = true;
        document.getElementById('second-letter-hint-label').textContent = 'ヒント表示中';
      };
      hintButton.addEventListener('click', () => {
        if (!currentSession || currentSession.answeredCurrent) return;
        showSecondLetter();
        playSound('tap');
        saveQuizCheckpoint();
      });
      if (currentSession.secondLetterHint) showSecondLetter();
      const formEl = document.getElementById('type-input-form');
      const inputEl = document.getElementById('type-native-input');
      inputEl.addEventListener('input', () => {
        if (!currentSession) return;
        inputEl.setCustomValidity('');
        currentSession.typedText = inputEl.value;
      });
      formEl.addEventListener('click', e => {
        if (e.target !== inputEl && !e.target.closest('#type-submit-btn')) {
          inputEl.focus();
        }
      });
      formEl.addEventListener('submit', e => {
        e.preventDefault();
        submitTypeAnswer();
      });
      setTimeout(() => {
        if (currentSession && !currentSession.answeredCurrent) {
          inputEl.focus();
        }
      }, 60);
    } else {

      let promptClass = 'quiz-prompt-jpn';
      let choicesClass = 'choices-stack-4';

      if (q.kind === 'vocx-jpn-eng') {
        promptClass = 'quiz-prompt-jpn';
        choicesClass = 'choices-stack-4';
      } else if (q.kind === 'vocx-eng-select') {
        promptClass = 'quiz-prompt-jpn quiz-prompt-eng-select';
        choicesClass = 'choices-stack-4';
      } else if (q.kind === 'dojo-voc') {
        promptClass = 'quiz-prompt-eng-select';
        choicesClass = 'choices-grid-4';
      } else if (q.kind === 'dojo-answer') {
        promptClass = 'quiz-prompt-dojo-stack';
        choicesClass = 'choices-stack-3';
      } else if (q.kind === 'dojo-phrasal') {
        promptClass = 'quiz-prompt-dojo-stack';
        choicesClass = 'choices-stack-2';
      }

      const promptFontSize =
        q.prompt.length > 85 ? 'font-size: 17px;' :
        q.prompt.length > 60 ? 'font-size: 19px;' : '';

      const buttonsHtml = q.choices.map((choiceText, idx) => `
        <button type="button" class="choice-btn" data-choice-index="${idx}">
          ${escapeHtml(choiceText)}
        </button>
      `).join('');

      contentEl.innerHTML = `
        <div class="${promptClass}" style="${promptFontSize}">${escapeHtml(q.prompt)}</div>
        <div class="${choicesClass}">
          ${buttonsHtml}
        </div>
      `;

      contentEl.querySelectorAll('.choice-btn').forEach((button, index) => bindChoiceButton(button, index));
      contentEl.focus({ preventScroll: true });
    }
  }

  function bindChoiceButton(button, index) {
    let press = null;
    const inside = event => {
      const r = button.getBoundingClientRect();
      return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
    };
    const cancel = () => {
      const id = press?.id;
      press = null;
      if (cancelChoicePress === cancel) cancelChoicePress = null;
      button.classList.remove('is-pressed');
      if (id != null && button.hasPointerCapture(id)) button.releasePointerCapture(id);
    };
    const submit = () => {
      if (!currentSession || currentSession.answeredCurrent) return;
      currentSession.selectedChoice = index;
      button.classList.add('selected');
      confirmChoiceAnswer();
    };
    button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || currentSession?.answeredCurrent) return;
      cancelChoicePress?.();
      cancelChoicePress = cancel;
      press = { id: event.pointerId, cancelled: false };
      button.setPointerCapture(event.pointerId);
      button.classList.add('is-pressed');
    });
    button.addEventListener('pointermove', event => {
      if (press?.id !== event.pointerId) return;
      if (!inside(event)) press.cancelled = true;
      button.classList.toggle('is-pressed', inside(event));
    });
    button.addEventListener('pointerup', event => {
      if (press?.id !== event.pointerId) return;
      const valid = !press.cancelled && inside(event);
      cancel();
      if (valid) submit();
    });
    button.addEventListener('pointercancel', cancel);
    button.addEventListener('lostpointercapture', cancel);
    button.addEventListener('click', event => { if (event.detail === 0) submit(); });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function confirmChoiceAnswer() {
    if (!currentSession || currentSession.answeredCurrent) return;
    if (currentSession.selectedChoice === null) return;

    recordAnswerTime();
    currentSession.answeredCurrent = true;
    const q = currentSession.questions[currentSession.currentIndex];
    const isCorrect = currentSession.selectedChoice === q.answerIndex;
    document.querySelectorAll('.choice-btn').forEach(button => {
      const index = Number(button.dataset.choiceIndex);
      button.classList.toggle('selected', index === currentSession.selectedChoice);
      if (index === currentSession.selectedChoice) button.dataset.result = isCorrect ? 'correct' : 'wrong';
      button.disabled = true;
    });
    if (q.rawItem?.jpn) {
      const meaning = document.createElement('div');
      meaning.className = 'answer-meaning';
      meaning.textContent = q.wordDisplay + '：' + q.rawItem.jpn;
      document.getElementById('quiz-content').appendChild(meaning);
    }
    if (isCorrect) {
      currentSession.correctCount++;
      playSound('correct');
    } else {
      playSound('wrong');
    }
    if (!isCorrect) (currentSession.mistakes ||= []).push({ word: q.wordDisplay, meaning: q.subDisplay });
    saveQuizCheckpoint();
    openCheckSheet(isCorrect, q.wordDisplay, q.subDisplay);
  }

  function submitTypeAnswer() {
    if (!currentSession || currentSession.answeredCurrent) return;
    const q = currentSession.questions[currentSession.currentIndex];
    if (q.kind !== 'vocx-eng-type') return;
    const inputEl = document.getElementById('type-native-input');
    if (inputEl) {
      currentSession.typedText = inputEl.value;
    }
    const typed = (currentSession.typedText || '').trim().toLowerCase();
    if (!typed) {
      if (inputEl) { inputEl.setCustomValidity('英単語を入力してください'); inputEl.reportValidity(); }
      return;
    }
    if (inputEl) {
      inputEl.blur();
    }

    recordAnswerTime();
    currentSession.answeredCurrent = true;
    const isCorrect = q.acceptedAnswers.includes(typed);
    document.getElementById('type-input-form').dataset.result = isCorrect ? 'correct' : 'wrong';
    document.getElementById('second-letter-hint').disabled = true;
    document.getElementById('meaning-hint-btn').disabled = true;
    if (isCorrect) {
      currentSession.correctCount++;
      playSound('correct');
    } else {
      playSound('wrong');
    }
    if (!isCorrect) (currentSession.mistakes ||= []).push({ word: q.wordDisplay, meaning: q.subDisplay });
    saveQuizCheckpoint();
    openCheckSheet(isCorrect, q.wordDisplay, q.subDisplay);
  }

  function openCheckSheet(isCorrect, wordText, subText) {
    const titleEl = document.getElementById('check-status-title');
    const wordEl = document.getElementById('check-answer-word');
    const subEl = document.getElementById('check-answer-sub');

    titleEl.textContent = isCorrect ? 'Correct!' : 'Incorrect';
    const sheet = document.getElementById('check-sheet');
    sheet.dataset.result = isCorrect ? 'correct' : 'wrong';
    titleEl.classList.toggle('wrong', !isCorrect);
    wordEl.textContent = wordText;
    subEl.textContent = subText;

    document.getElementById('check-backdrop').classList.add('open');
    document.getElementById('quiz-content').inert = true;
    sheet.inert = false;
    sheet.setAttribute('aria-hidden', 'false');
    document.getElementById('check-next-btn').disabled = false;
    sheet.classList.add('open');
    document.getElementById('check-next-btn').focus({ preventScroll: true });
  }

  function closeCheckSheet() {
    document.getElementById('check-backdrop').classList.remove('open');
    const sheet = document.getElementById('check-sheet');
    sheet.classList.remove('open');
    sheet.inert = true;
    sheet.setAttribute('aria-hidden', 'true');
    document.getElementById('check-next-btn').disabled = true;
    document.getElementById('quiz-content').inert = false;
  }

  function advanceToNextQuestion() {
    if (!currentSession || !currentSession.answeredCurrent || currentSession.finished) return;
    playSound('tap');
    closeCheckSheet();

    if (currentSession.currentIndex + 1 < currentSession.questions.length) {
      currentSession.currentIndex++;
      currentSession.secondLetterHint = false;
      currentSession.meaningHint = false;
      currentSession.questionTimeMs = 0;
      renderCurrentQuestion();
      saveQuizCheckpoint();
    } else {
      finishQuizSession();
    }
  }

  function recordAnswerTime() {
    recordStudyTime();
    currentSession.elapsedTimeMs ??= (currentSession.totalTimeMs || 0) + (currentSession.questionTimeMs || 0);
    currentSession.totalTimeMs = currentSession.elapsedTimeMs;
  }

  function getResultFeedback(percent, perfect = percent === 100) {
    const levels = [
      {level: 'danger', color: '#ff4040', messages: ['今回はかなり苦戦！復習で立て直そう', 'ここから巻き返そう！まずは意味の確認から', '覚え直しのチャンス！一語ずつ攻略しよう', 'まだ伸びしろたっぷり！焦らず復習しよう', '今回は難しかったね。次は一問ずつ増やそう']},
      {level: 'warning', color: '#ff9650', messages: ['まだ要復習！覚えた単語を増やしていこう', '少しずつつかめてきた！もう一度挑戦', 'ここが踏ん張りどころ！間違いを見直そう', '土台づくりはこれから！繰り返せば伸びる', '正解できた単語もある！次は半分を目指そう']},
      {level: 'steady', color: '#ffd34d', messages: ['いい勝負！復習でもう一段上へ', '半分以上つかめた！苦手を減らそう', 'あとひと押し！間違えた問題が次の得点源', '着実に前進中！もう一度で伸ばせそう', '理解が育ってきた！次は高得点を狙おう']},
      {level: 'good', color: '#b5e36a', messages: ['かなり好調！全問正解まであと少し', 'よくできた！残りの苦手を仕上げよう', '実力がついてきた！次は満点を狙おう', 'いい仕上がり！最後の取りこぼしをなくそう', 'ここまで来た！間違いを確認して完成へ']},
      {level: 'perfect', color: '#58e3a1', messages: ['全問正解！おめでとう！', '全問正解！完璧な仕上がり！', '全問正解！しっかり身についているね', '全問正解！見事な集中力！', '全問正解！この調子で次のユニットへ！']}
    ];
    const index = perfect ? 4 : percent < 25 ? 0 : percent < 50 ? 1 : percent < 75 ? 2 : 3;
    const feedback = levels[index];
    return {level: feedback.level, color: feedback.color, message: feedback.messages[Math.floor(Math.random() * feedback.messages.length)]};
  }

  function showQuizResults() {
    stopStudyClock();
    closeCheckSheet();
    const { correctCount, questions, mistakes = [], totalTimeMs = 0 } = currentSession;
    document.getElementById('screen-quiz').classList.remove('active');
    document.getElementById('screen-results').classList.add('active');
    const perfect = questions.length > 0 && correctCount === questions.length;
    const percent = Math.round(correctCount / Math.max(1, questions.length) * 100);
    const feedback = getResultFeedback(percent, perfect);
    document.getElementById('screen-results').dataset.perfect = String(perfect);
    document.getElementById('screen-results').dataset.scoreLevel = feedback.level;
    document.getElementById('results-title').textContent = feedback.message;
    document.getElementById('results-score').textContent = correctCount + ' / ' + questions.length + ' 問正解';
    document.getElementById('results-percent').textContent = percent + '%';
    document.getElementById('results-percent').style.color = feedback.color;
    document.getElementById('results-time').textContent = '解答時間 ' + formatStudyTime(totalTimeMs);
    document.getElementById('results-mistakes').innerHTML = mistakes.length
      ? '<h2>間違えた問題</h2><ul>' + mistakes.map(item => '<li><strong>' + escapeHtml(item.word) + '</strong><span>' + escapeHtml(item.meaning) + '</span></li>').join('') + '</ul>'
      : perfect ? '<p>すべての問題に正解しました！</p>' : '<p>未回答または記録のない問題があります。</p>';
    const resultScreen = document.getElementById('screen-results');
    resultScreen.scrollTop = 0;
    document.getElementById('results-title').focus({ preventScroll: true });
    updateResultsScrollHint();
  }

  function updateResultsScrollHint() {
    const screen = document.getElementById('screen-results');
    document.getElementById('results-hint-down').hidden = !screen.classList.contains('active')
      || screen.scrollHeight - screen.clientHeight - screen.scrollTop <= 2;
  }

  function finishQuizSession() {
    if (!currentSession) return;
    if (currentSession.finished) return;
    currentSession.finished = true;
    playSound('complete');
    const { face, unitId, mode, correctCount, questions } = currentSession;
    const scorePct = Math.round((correctCount / Math.max(1, questions.length)) * 100);
    const progMap = face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;

    const existing = progMap[unitId] || { clearedModes: {}, bestScorePct: 0, pausedSession: null };
    existing.clearedModes = existing.clearedModes || {};
    existing.clearedModes[mode] = true;
    existing.perfectClearCount = getPerfectClearCount(existing);
    if (questions.length > 0 && correctCount === questions.length) {
      existing.perfectClearCount++;
    }
    existing.bestScorePct = Math.max(existing.bestScorePct || 0, scorePct);
    existing.pausedSession = null;
    progMap[unitId] = existing;

    saveState();
    showQuizResults();
  }

  /* =========================================================================
   * 8. SLIDE DOWN TO PAUSE GESTURE
   * ========================================================================= */
  /* Slide Down Quiz Sheet to Pause & Save Progress */
  document.getElementById('quiz-content').addEventListener('scroll', () => cancelChoicePress?.(), { passive: true });
  const quizSheet = document.getElementById('quiz-sheet');
  let sheetDragging = false;
  let sheetStartY = 0;
  let sheetDeltaY = 0;

  quizSheet.addEventListener('pointerdown', e => {
    if (!currentSession) return;
    if (e.target.closest('button, input, .type-input-box')) return;
    sheetDragging = true;
    sheetStartY = e.clientY;
    sheetDeltaY = 0;
    quizSheet.classList.add('dragging');
  });

  window.addEventListener('pointermove', e => {
    if (!sheetDragging) return;
    const dy = e.clientY - sheetStartY;
    sheetDeltaY = Math.max(0, dy);
    quizSheet.style.transform = `translateY(${sheetDeltaY}px)`;
  });

  function saveQuizCheckpoint() {
    if (!currentSession || currentSession.finished) return;
    const { face, unitId } = currentSession;
    const map = face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;
    const entry = map[unitId] ||= { clearedModes: {}, bestScorePct: 0, pausedSession: null };
    entry.pausedSession = structuredClone(currentSession);
    saveState();
  }

  function pauseQuizSession() {
    if (!currentSession || currentSession.finished) return;
    cancelChoicePress?.();
    cancelQuizCountdown();
    stopStudyClock();
    const input = document.getElementById('type-native-input');
    if (input) { currentSession.typedText = input.value; input.blur(); }
    saveQuizCheckpoint();
    playSound('slide');
    closeQuizScreen();
  }

  function endSheetDrag() {
    if (!sheetDragging) return;
    sheetDragging = false;
    quizSheet.classList.remove('dragging');
    if (sheetDeltaY > 95 && currentSession) {
      pauseQuizSession();
    } else {
      quizSheet.style.transform = 'translateY(0px)';
    }
  }

  window.addEventListener('pointerup', endSheetDrag);
  window.addEventListener('pointercancel', () => { sheetDragging = false; quizSheet.classList.remove('dragging'); quizSheet.style.transform = 'translateY(0px)'; });

  /* =========================================================================
   * 9. KEYBOARD SHORTCUTS (Check Sheet / Profile Name Modal)
   * ========================================================================= */
  window.addEventListener('keydown', e => {
    if (document.querySelector('.debug-panel[open]')) return;
    if (e.repeat) return;
    if (document.getElementById('name-modal').classList.contains('open')) {
      if (e.key === 'Enter') saveProfileName();
      return;
    }
    if (!currentSession) return;
    if (document.getElementById('check-sheet').classList.contains('open')) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advanceToNextQuestion();
      }
    }
  });

  /* =========================================================================
   * 10. TOP TITLE FACE SWITCHING, NAVIGATION, SETTINGS & MODALS
   * ========================================================================= */
  function switchFace(face) {
    if (appState.face === face) return;
    playSound('tap');
    appState.face = face;
    saveState();
    renderHomeUnits();
    document.getElementById('tab-home').scrollTop = 0;
  }
  document.getElementById('face-vocx-btn').addEventListener('click', () => switchFace('vocx'));
  document.getElementById('face-dojo-btn').addEventListener('click', () => switchFace('dojo'));

  const unitsScroller = document.getElementById('tab-home');
  const unitsList = document.getElementById('units-list');
  const mainScreen = document.getElementById('screen-main');
  const bottomFooter = document.querySelector('.bottom-footer');
  let unitHintsFrame = null;
  function scheduleUnitScrollHints() {
    if (unitHintsFrame !== null) return;
    unitHintsFrame = requestAnimationFrame(() => {
      unitHintsFrame = null;
      updateUnitScrollHints();
    });
  }
  const unitHintUp = document.getElementById('units-hint-up');
  const unitHintDown = document.getElementById('units-hint-down');
  function updateUnitScrollHints() {
    const visible = unitsScroller.clientHeight > 0;
    const viewport = mainScreen.getBoundingClientRect();
    const area = unitsScroller.getBoundingClientRect();
    const footer = bottomFooter.getBoundingClientRect();
    const lastUnit = unitsList.lastElementChild;
    const lastBottom = lastUnit?.classList.contains('unit-row') ? lastUnit.getBoundingClientRect().bottom : null;
    unitHintUp.style.top = (area.top - viewport.top + 8) + 'px';
    unitHintDown.style.top = (Math.min(area.bottom, footer.top) - viewport.top - 46) + 'px';
    unitHintUp.hidden = !visible || unitsScroller.scrollTop <= 2;
    // Only indicate actual unit content hidden beneath the footer, not bottom padding.
    unitHintDown.hidden = !visible || lastBottom === null || lastBottom <= Math.min(area.bottom, footer.top) + 2;
  }
  unitsScroller.addEventListener('scroll', scheduleUnitScrollHints, { passive: true });
  const unitResizeObserver = new ResizeObserver(scheduleUnitScrollHints);
  [unitsScroller, unitsList, bottomFooter].forEach(el => unitResizeObserver.observe(el));
  window.addEventListener('resize', scheduleUnitScrollHints);
  document.fonts.ready.then(scheduleUnitScrollHints);

  function switchTab(tab, withSound = true) {
    if (withSound) playSound('tap');
    appState.activeTab = tab;
    saveState();
    const isHome = tab === 'home';
    document.getElementById('nav-home-btn').setAttribute('aria-current', isHome ? 'page' : 'false');
    document.getElementById('nav-mypage-btn').setAttribute('aria-current', isHome ? 'false' : 'page');
    scheduleUnitScrollHints();
    document.getElementById('tab-home').style.display = isHome ? 'block' : 'none';
    document.getElementById('tab-mypage').style.display = isHome ? 'none' : 'flex';
    document.getElementById('icon-home-active').style.display = isHome ? 'block' : 'none';
    document.getElementById('icon-home-inactive').style.display = isHome ? 'none' : 'block';
    document.getElementById('icon-mypage-active').style.display = isHome ? 'none' : 'block';
    document.getElementById('icon-mypage-inactive').style.display = isHome ? 'block' : 'none';
  }

  document.getElementById('nav-home-btn').addEventListener('click', () => switchTab('home', true));
  document.getElementById('nav-mypage-btn').addEventListener('click', () => switchTab('mypage', true));

  /* Mypage Settings Toggles */
  function syncSettingsUI() {
    document.getElementById('profile-name').textContent = appState.profileName || '@Name';
    const hintBtn = document.getElementById('toggle-hint');
    const soundBtn = document.getElementById('toggle-sound');

    hintBtn.classList.toggle('on', !!appState.settings.initialHint);
    hintBtn.setAttribute('aria-checked', String(!!appState.settings.initialHint));


    soundBtn.classList.toggle('on', !!appState.settings.soundEffects);
    soundBtn.setAttribute('aria-checked', String(!!appState.settings.soundEffects));
  }

  document.getElementById('toggle-hint').addEventListener('click', () => {
    appState.settings.initialHint = !appState.settings.initialHint;
    saveState();
    syncSettingsUI();
    playSound('tap');
  });


  document.getElementById('toggle-sound').addEventListener('click', () => {
    appState.settings.soundEffects = !appState.settings.soundEffects;
    saveState();
    syncSettingsUI();
    playSound('tap');
  });

  /* Profile Name Editing */
  const nameModal = document.getElementById('name-modal');
  const nameInput = document.getElementById('name-input-field');

  function openNameModal() {
    playSound('tap');
    nameInput.value = appState.profileName || '@Name';
    nameInput.setCustomValidity('');
    nameModal.classList.add('open');
    setTimeout(() => nameInput.focus(), 50);
  }

  function saveProfileName() {
    const val = nameInput.value.trim();
    if (!val) { nameInput.setCustomValidity('名前を入力してください'); nameInput.reportValidity(); return; }
    if (val) {
      appState.profileName = Array.from(val.startsWith('@') ? val : `@${val}`).slice(0, 20).join('');
      saveState();
      syncSettingsUI();
    }
    nameModal.classList.remove('open');
    playSound('tap');
  }

  document.getElementById('profile-edit-btn').addEventListener('click', openNameModal);
  nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
  document.getElementById('profile-name').addEventListener('click', openNameModal);
  document.getElementById('name-save-btn').addEventListener('click', saveProfileName);
  document.getElementById('name-cancel-btn').addEventListener('click', () => {
    nameModal.classList.remove('open');
    playSound('tap');
  });

  /* Quit Confirmation Modal (X Button discards progress) */
  const quitModal = document.getElementById('quit-modal');
  document.getElementById('quiz-close-btn').addEventListener('click', () => {
    playSound('tap');
    quitModal.classList.add('open');
  });

  document.getElementById('quit-confirm-pause').addEventListener('click', () => {
    quitModal.classList.remove('open');
    pauseQuizSession();
  });

  document.getElementById('quit-confirm-no').addEventListener('click', () => {
    playSound('tap');
    quitModal.classList.remove('open');
  });

  document.getElementById('quit-confirm-yes').addEventListener('click', () => {
    playSound('tap');
    quitModal.classList.remove('open');
    if (currentSession) {
      const { face, unitId } = currentSession;
      const progMap = face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;
      if (progMap[unitId] && progMap[unitId].pausedSession) {
        progMap[unitId].pausedSession = null;
        saveState();
      }
    }
    closeQuizScreen();
  });

  document.getElementById('results-home').addEventListener('click', () => {
    document.getElementById('screen-results').classList.remove('active');
    updateResultsScrollHint();
    closeQuizScreen();
  });

  const resultsScroller = document.getElementById('screen-results');
  resultsScroller.addEventListener('scroll', updateResultsScrollHint, { passive: true });
  const resultsResizeObserver = new ResizeObserver(updateResultsScrollHint);
  [resultsScroller, document.getElementById('results-mistakes'), document.getElementById('results-home')]
    .forEach(element => resultsResizeObserver.observe(element));
  window.addEventListener('resize', updateResultsScrollHint);
  document.fonts.ready.then(updateResultsScrollHint);

  document.getElementById('check-next-btn').addEventListener('click', advanceToNextQuestion);

  function createDebugTools() {
    const home = () => {
      cancelChoicePress?.();
      document.getElementById('screen-results').classList.remove('active');
      quitModal.classList.remove('open');
      nameModal.classList.remove('open');
      if (modeDialog.open) modeDialog.close();
      closeQuizScreen();
      updateResultsScrollHint();
    };
    const requireSession = () => {
      if (!currentSession || currentSession.finished) throw new Error('先にテスト用クイズを開始してください');
      return currentSession;
    };
    const entryFor = (face, unitId, count, cleared) => ({
      perfectClearCount: Math.max(0, Math.floor(Number(count) || 0)),
      bestScorePct: count > 0 ? 100 : cleared ? 80 : 0,
      clearedModes: cleared ? Object.fromEntries(MODE_OPTIONS[face].map(mode => [mode.id, true])) : {},
      pausedSession: null
    });
    return {
      inspect() {
        const q = currentSession?.questions[currentSession.currentIndex];
        return {state: structuredClone(appState), session: currentSession ? {
          face: currentSession.face, unitId: currentSession.unitId, mode: currentSession.mode,
          question: currentSession.currentIndex + 1, total: currentSession.questions.length,
          correct: currentSession.correctCount, questionTimeMs: currentSession.questionTimeMs || 0,
          totalTimeMs: currentSession.totalTimeMs || 0, finished: !!currentSession.finished,
          answer: q?.acceptedAnswers?.join(' / ') || q?.choices?.[q.answerIndex] || ''
        } : null};
      },
      units(face) { return Object.keys(face === 'vocx' ? vocxUnitsData : dojoUnitsData).sort((a, b) => Number(a) - Number(b)); },
      modes(face, unitId) { return MODE_OPTIONS[face].filter(mode => face === 'vocx' || dojoUnitsData[unitId]?.[mode.id]).map(mode => ({id: mode.id, label: mode.accessibleLabel})); },
      progress({face, unitId, count, cleared, all}) {
        debugProgress = null;
        const map = face === 'vocx' ? appState.vocxProgress : appState.dojoProgress;
        for (const id of all ? this.units(face) : [unitId]) map[id] = entryFor(face, id, count, cleared);
        home(); switchFace(face);
      },
      start({face, unitId, mode, questions, skipCountdown}) {
        home(); switchFace(face);
        debugSandbox.skipCountdown = skipCountdown;
        if (face === 'vocx') startVocxQuiz(unitId, mode); else startDojoQuiz(unitId, mode);
        const session = requireSession();
        const limit = Math.max(1, Math.min(session.questions.length, Math.floor(Number(questions) || session.questions.length)));
        session.questions = session.questions.slice(0, limit);
        if (skipCountdown) renderCurrentQuestion();
      },
      answer(correct) {
        const session = requireSession();
        if (session.answeredCurrent) throw new Error('回答済みです。「次の問題」へ進んでください');
        if (!document.getElementById('quiz-countdown').hidden) { cancelQuizCountdown(); renderCurrentQuestion(); }
        const q = session.questions[session.currentIndex];
        if (q.kind === 'vocx-eng-type') {
          document.getElementById('type-native-input').value = correct ? q.acceptedAnswers[0] : '__debug_wrong__';
          submitTypeAnswer();
        } else {
          session.selectedChoice = correct ? q.answerIndex : (q.answerIndex + 1) % q.choices.length;
          confirmChoiceAnswer();
        }
      },
      next() { const session = requireSession(); if (!session.answeredCurrent) throw new Error('先に正解または不正解を確定してください'); advanceToNextQuestion(); },
      jump(number) {
        const session = requireSession(); stopStudyClock(); cancelQuizCountdown();
        session.currentIndex = Math.max(0, Math.min(session.questions.length - 1, Math.floor(Number(number) || 1) - 1));
        session.correctCount = 0; session.mistakes = []; session.totalTimeMs = 0; session.elapsedTimeMs = 0;
        session.questionTimeMs = 0; session.secondLetterHint = false; session.meaningHint = false;
        renderCurrentQuestion();
      },
      time(seconds) {
        const session = requireSession();
        session.questionTimeMs = Math.max(0, Number(seconds) || 0) * 1000;
        session.elapsedTimeMs = session.questionTimeMs;
        session.totalTimeMs = session.elapsedTimeMs;
        if (studyClock) studyClock.startedAt = performance.now();
        document.getElementById('quiz-study-time').textContent = formatStudyTime(session.questionTimeMs);
      },
      results(ratio, seconds) {
        const session = requireSession(); stopStudyClock(); cancelQuizCountdown();
        session.correctCount = Math.round(session.questions.length * Math.max(0, Math.min(1, ratio)));
        session.mistakes = session.questions.slice(session.correctCount).map(q => ({word: q.wordDisplay, meaning: q.subDisplay}));
        session.totalTimeMs = Math.max(0, Number(seconds) || 0) * 1000;
        session.elapsedTimeMs = session.totalTimeMs;
        session.answeredCurrent = true;
        finishQuizSession();
      },
      pause() { requireSession(); pauseQuizSession(); },
      resume(face, unitId) {
        const saved = (face === 'vocx' ? appState.vocxProgress : appState.dojoProgress)[unitId]?.pausedSession;
        if (!saved) throw new Error('このユニットに途中保存はありません');
        home(); switchFace(face); resumePausedSession(saved);
      },
      prompt(text) {
        requireSession(); stopStudyClock(); cancelQuizCountdown();
        currentSession = structuredClone(currentSession);
        const q = currentSession.questions[currentSession.currentIndex];
        if (q.kind === 'vocx-eng-type') q.rawItem.sentence = text; else q.prompt = text;
        renderCurrentQuestion();
      },
      settings({hint, sound, name}) {
        appState.settings.initialHint = hint; appState.settings.soundEffects = sound;
        if (name.trim()) appState.profileName = name.trim().slice(0, 20);
        syncSettingsUI();
      },
      sound(type) { playSound(type); },
      view(tab) { home(); switchTab(tab); },
      home,
      reset(empty = false) {
        home(); debugProgress = null;
        appState = structuredClone(empty ? defaultState : debugSandbox.original);
        switchTab(appState.activeTab || 'home', false); syncSettingsUI(); renderHomeUnits();
      }
    };
  }

  /* Initialize */
  window.addEventListener('vocx-debug-connect', event => {
    if (location.hash !== '#debug' && new URLSearchParams(location.search).get('debug') !== '1') return;
    if (!debugSandbox) debugSandbox = { original: structuredClone(appState), skipCountdown: false };
    event.detail.connect(createDebugTools());
  });
  window.addEventListener('vocx-debug-preview', event => {
    debugProgress = event.detail;
    renderHomeUnits();
  });
  syncViewportHeight();
  syncSettingsUI();
  switchTab(appState.activeTab || 'home', false);
  renderHomeUnits();
  tryFetchLiveFiles();

  /* Register PWA Service Worker */
  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }
})();
