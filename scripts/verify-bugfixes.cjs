const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
const extract = (name, next) => js.slice(js.indexOf('  function ' + name), js.indexOf('  function ' + next));
const elements = {}, storage = new Map();
const el = id => elements[id] ||= {dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', setAttribute(k, v) {this[k] = v;}, focus() {}, blur() {}, setCustomValidity(text) {this.error = text;}, reportValidity() {}, classList: {add() {}, remove() {}, toggle() {}, contains() {return false;}}};
let rendered = 0, finished = 0;
const c = { desktopUI: null,structuredClone, STORAGE_KEY: 'state', LEGACY_STORAGE_KEY: 'legacy', debugSandbox: null, lastSavedRaw:null, savedStateSnapshot:'{}',
  defaultState: {profileName: '@Name', settings: {}, vocxProgress: {}, dojoProgress: {}},
  appState: {settings: {}, vocxProgress: {'06': {clearedModes: {'eng-type': true}, bestScorePct: 90, perfectClearCount: 1}}, dojoProgress: {}},
  localStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
  document: {getElementById: el, querySelectorAll: () => []}, nameInput: el('name'), nameModal: el('modal'),
  syncSettingsUI() {}, playSound() {}, showToast() {}, openQuizScreen() {}, stopStudyClock() {},
  renderCurrentQuestion() {rendered++;}, finishQuizSession() {finished++;}, formatStudyTime: ms => String(ms), updateResultsScrollHint() {}
};
vm.createContext(c);
vm.runInContext(extract('loadState', 'playSound').split('  const SE_FILES')[0], c);
vm.runInContext(extract('saveQuizCheckpoint', 'pauseQuizSession'), c);
c.currentSession = {face: 'vocx', unitId: '06', questions: [1, 2], currentIndex: 0, correctCount: 1, answeredCurrent: true};
c.saveQuizCheckpoint();
assert.equal(c.loadState().vocxProgress['06'].pausedSession.correctCount, 1);
assert.equal(c.loadState().vocxProgress['06'].bestScorePct, 90, 'autosave preserves existing best score');
vm.runInContext(extract('resumePausedSession', 'cancelQuizCountdown'), c);
c.resumePausedSession(c.loadState().vocxProgress['06'].pausedSession);
assert.equal(c.currentSession.currentIndex, 1);
assert.equal(c.loadState().vocxProgress['06'].pausedSession.currentIndex, 1);
c.currentSession = {face: 'vocx', unitId: '06', questions: [1], currentIndex: 0, correctCount: 0, answeredCurrent: false, typedText: 'draft'};
c.saveQuizCheckpoint(); c.resumePausedSession(c.loadState().vocxProgress['06'].pausedSession);
assert.equal(c.loadState().vocxProgress['06'].pausedSession.typedText, 'draft', 'resume retains saved drafts');
vm.runInContext(extract('openCheckSheet', 'recordAnswerTime'), c);
c.currentSession = {face: 'dojo', unitId: '01', questions: [1, 2], currentIndex: 0, answeredCurrent: false};
c.closeCheckSheet(); assert(el('check-sheet').inert); assert(el('check-next-btn').disabled);
c.advanceToNextQuestion(); assert.equal(c.currentSession.currentIndex, 0); assert.equal(rendered, 0);
c.currentSession.answeredCurrent = true; c.openCheckSheet(false, 'Word', '意味');
assert(!el('check-sheet').inert); assert(!el('check-next-btn').disabled); assert(el('quiz-content').inert);
c.advanceToNextQuestion(); assert.equal(c.currentSession.currentIndex, 1); assert.equal(rendered, 1);
c.currentSession.answeredCurrent = false; c.advanceToNextQuestion(); assert.equal(finished, 0);
vm.runInContext(extract('getResultFeedback', 'updateResultsScrollHint'), c);
c.currentSession = {correctCount: 0, questions: [1, 2], mistakes: []}; c.showQuizResults();
assert(!el('results-mistakes').innerHTML.includes('すべての問題に正解'));
c.currentSession.correctCount = 2; c.showQuizResults(); assert(el('results-mistakes').innerHTML.includes('すべての問題に正解'));
const start = js.indexOf('  function saveProfileName');
vm.runInContext(js.slice(start, js.indexOf("  document.getElementById('profile-edit-btn')", start)), c);
c.nameInput.value = 'A'.repeat(100); c.saveProfileName(); assert.equal(c.appState.profileName.length, 20);
c.nameInput.value = ''; c.saveProfileName(); assert.equal(c.nameInput.error, '名前を入力してください');
console.log('OK: answer autosave/resume and drafts, hidden feedback and unanswered skip guards, result consistency, robust name limits');
