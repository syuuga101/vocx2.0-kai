const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
const initial = {face: 'vocx', activeTab: 'home', profileName: '@Name', settings: {initialHint: true, soundEffects: true}, vocxProgress: {}, dojoProgress: {}};
const elements = {}, dataItem = {sentence: 'original'};
const el = id => elements[id] ||= {hidden: true, style: {}, value: '', classList: {add() {}, remove() {} }};
let writes = 0;
const c = {
  appState: structuredClone(initial), defaultState: initial, structuredClone,
  debugProgress: null, debugSandbox: {original: structuredClone(initial), skipCountdown: true}, currentSession: null,
  STORAGE_KEY: 'test', lastSavedRaw:null, savedStateSnapshot:'{}', localStorage: {getItem(){return null;},setItem() {writes++;}},
  document: {getElementById: el}, quitModal: el('quit'), nameModal: el('name'), modeDialog: {open: false},
  MODE_OPTIONS: {vocx: [{id: 'jpn-eng', accessibleLabel: '日本語'}, {id: 'eng-type', accessibleLabel: '入力'}], dojo: [{id: 'part1', accessibleLabel: 'Part 1'}]},
  vocxUnitsData: {'02': [dataItem], '03': [dataItem]}, dojoUnitsData: {'01': {part1: {}}},
  closeQuizScreen() {c.currentSession = null;}, updateResultsScrollHint() {}, renderHomeUnits() {}, syncSettingsUI() {},
  switchFace(face) {c.appState.face = face;}, switchTab(tab) {c.appState.activeTab = tab;},
  cancelChoicePress: null, stopStudyClock() {}, cancelQuizCountdown() {}, renderCurrentQuestion() {},
  studyClock: null, performance: {now: () => 100}, formatStudyTime: ms => String(ms),
  startVocxQuiz(unitId, mode) { c.currentSession = {face: 'vocx', unitId, mode, currentIndex: 0, correctCount: 0, questions: Array.from({length: 5}, () => ({kind: 'vocx-jpn-eng', answerIndex: 1, choices: ['wrong', 'correct'], wordDisplay: 'correct', subDisplay: '意味', rawItem: dataItem}))}; },
  confirmChoiceAnswer() {c.currentSession.answeredCurrent = true;},
  finishQuizSession() {c.currentSession.finished = true; c.saveState();}, playSound() {}
};
vm.createContext(c);
vm.runInContext(js.slice(js.indexOf('  function saveState'), js.indexOf('  /* ===', js.indexOf('  function saveState'))), c);
vm.runInContext(js.slice(js.indexOf('  function createDebugTools'), js.indexOf('  /* Initialize */')), c);
const tools = c.createDebugTools();
tools.progress({face: 'vocx', unitId: '02', count: 7, cleared: true, all: true});
assert.equal(c.appState.vocxProgress['03'].perfectClearCount, 7); c.saveState(); assert.equal(writes, 0);
tools.start({face: 'vocx', unitId: '02', mode: 'jpn-eng', questions: 3, skipCountdown: true});
assert.equal(c.currentSession.questions.length, 3);
tools.answer(true); assert.equal(c.currentSession.selectedChoice, 1);
tools.jump(3); assert.equal(c.currentSession.currentIndex, 2); assert.equal(c.currentSession.correctCount, 0);
tools.time(95); assert.equal(c.currentSession.questionTimeMs, 95000);
tools.prompt('long text'); assert.equal(c.currentSession.questions[2].prompt, 'long text'); assert.equal(dataItem.sentence, 'original');
tools.results(0, 120); assert.equal(c.currentSession.mistakes.length, 3); assert.equal(c.currentSession.totalTimeMs, 120000); assert.equal(writes, 0);
tools.settings({hint: false, sound: false, name: '@Debug'}); assert.equal(c.appState.profileName, '@Debug');
const inspected = tools.inspect(); inspected.state.profileName = 'changed'; assert.equal(c.appState.profileName, '@Debug');
tools.reset(); assert.deepEqual(c.appState, initial); assert.equal(writes, 0, 'all debug actions remain in memory');
c.debugSandbox = null; c.saveState(); assert.equal(writes, 1, 'normal saving remains enabled');
console.log('OK: debug progress, sessions, answers, time, results and settings stay isolated; reset restores state and normal saving works');
