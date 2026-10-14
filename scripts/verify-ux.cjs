const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
function extract(name, next) { return js.slice(js.indexOf('  function ' + name), js.indexOf('  function ' + next)); }
const classes = new Set(), handlers = {};
let capture = null, submissions = 0;
const button = {
  classList: { add: s => classes.add(s), remove: s => classes.delete(s), toggle: (s, on) => on ? classes.add(s) : classes.delete(s) },
  getBoundingClientRect: () => ({left: 10, right: 110, top: 10, bottom: 60}),
  setPointerCapture: id => capture = id, hasPointerCapture: id => capture === id,
  releasePointerCapture: () => capture = null, addEventListener: (type, fn) => handlers[type] = fn
};
const c = { cancelChoicePress: null, currentSession: {answeredCurrent: false}, confirmChoiceAnswer() { submissions++; c.currentSession.answeredCurrent = true; } };
vm.createContext(c); vm.runInContext(extract('bindChoiceButton', 'escapeHtml'), c); c.bindChoiceButton(button, 2);
const event = (x = 50, y = 30) => ({isPrimary: true, button: 0, pointerId: 1, clientX: x, clientY: y});
function reset() { c.currentSession = {answeredCurrent: false}; classes.clear(); }
handlers.pointerdown(event()); assert.equal(submissions, 0); assert(classes.has('is-pressed'));
handlers.pointerup(event()); assert.equal(submissions, 1); assert.equal(c.currentSession.selectedChoice, 2);
handlers.click({detail: 1}); assert.equal(submissions, 1, 'pointer click cannot submit twice');
reset(); handlers.pointerdown(event()); handlers.pointermove(event(120)); assert(!classes.has('is-pressed'));
handlers.pointermove(event()); assert(classes.has('is-pressed')); handlers.pointerup(event());
assert.equal(submissions, 1, 'leaving the bounds cancels even if finger returns');
reset(); handlers.pointerdown(event()); handlers.pointerup(event(120)); assert.equal(submissions, 1);
reset(); handlers.pointerdown(event()); handlers.pointercancel(); handlers.pointerup(event()); assert.equal(submissions, 1);
for (let i = 0; i < 2; i++) { reset(); handlers.pointerdown(event()); c.cancelChoicePress(); handlers.pointerup(event()); }
assert.equal(submissions, 1, 'scroll cancellation works on repeated presses');
reset(); handlers.click({detail: 0}); assert.equal(submissions, 2, 'keyboard click submits');

const els = {};
const el = id => els[id] ||= {dataset: {}, style: {}, textContent: '', innerHTML: '', scrollTop: 100, value: '', focus() {}, blur() {}, classList: {active: false, add() {this.active = true}, remove() {this.active = false}, contains() {return this.active}}};
let saves = 0, stopped = 0;
const r = {debugProgress: null,currentSession: {face: 'vocx', unitId: '02', mode: 'oni', correctCount: 1, questions: [1, 2], questionTimeMs: 3000, totalTimeMs: 4000, mistakes: [{word: '<word>', meaning: '意味'}]}, appState: {vocxProgress: {}, dojoProgress: {}}, document: {getElementById: el}, structuredClone, stopStudyClock: () => stopped++, closeCheckSheet() {}, saveState: () => saves++, playSound() {}, formatStudyTime: ms => String(ms), CHECK_BADGE_SVG: 'check', PAUSE_BADGE_SVG: 'pause', cancelChoicePress: null, closeQuizScreen() {} };
vm.createContext(r);
r.recordStudyTime = () => {};
vm.runInContext(extract('escapeHtml', 'confirmChoiceAnswer'), r);
vm.runInContext(js.slice(js.indexOf('  function getPerfectClearCount'), js.indexOf('  function renderHomeUnits')), r);
vm.runInContext(js.slice(js.indexOf('  function recordAnswerTime'), js.indexOf('  /* ===', js.indexOf('  function finishQuizSession'))), r);
r.recordAnswerTime(); assert.equal(r.currentSession.totalTimeMs, 7000);
r.finishQuizSession(); assert.equal(el('results-score').textContent, '1 / 2 問正解');
const result = el('screen-results');
result.clientHeight = 600; result.scrollHeight = 1200; r.updateResultsScrollHint();
assert.equal(el('results-hint-down').hidden, false);
result.scrollTop = 600; r.updateResultsScrollHint(); assert.equal(el('results-hint-down').hidden, true);
result.scrollTop = 0; result.scrollHeight = 600; r.updateResultsScrollHint(); assert.equal(el('results-hint-down').hidden, true);
assert.equal(el('results-percent').textContent, '50%'); assert.equal(el('results-time').textContent, '解答時間 7000');
assert(el('results-mistakes').innerHTML.includes('&lt;word&gt;')); assert.equal(el('screen-results').scrollTop, 0);
assert.equal(r.appState.vocxProgress['02'].bestScorePct, 50);
r.finishQuizSession(); assert.equal(saves, 1, 'finish cannot save or award twice');
r.currentSession = {face: 'vocx', unitId: '02', mode: 'oni', correctCount: 2, questions: [1, 2]};
r.finishQuizSession(); assert(el('results-title').textContent.includes('全問正解')); assert.equal(r.appState.vocxProgress['02'].perfectClearCount, 1);
vm.runInContext(extract('saveQuizCheckpoint', 'pauseQuizSession'), r);
r.openCheckSheet = () => {};
vm.runInContext(extract('submitTypeAnswer', 'openCheckSheet'), r);
r.currentSession = {face: 'vocx', unitId: '02', questions: [{kind: 'vocx-eng-type', acceptedAnswers: ['arose'], wordDisplay: 'Arise', subDisplay: '起こる'}], currentIndex: 0, correctCount: 0, questionTimeMs: 2500, totalTimeMs: 1000};
el('type-native-input').value = 'wrong';
r.submitTypeAnswer(); assert.equal(r.currentSession.totalTimeMs, 3500, 'typed answers contribute to total time');
assert.equal(r.currentSession.mistakes[0].meaning, '起こる');
r.submitTypeAnswer(); assert.equal(r.currentSession.totalTimeMs, 3500, 'typed answer cannot count time twice');
vm.runInContext(extract('pauseQuizSession', 'endSheetDrag'), r);
r.cancelQuizCountdown = () => {};
r.currentSession = {face: 'dojo', unitId: '01', mode: 'part1', questions: [1], currentIndex: 0, questionTimeMs: 1234};
r.pauseQuizSession(); const paused = r.appState.dojoProgress['01'].pausedSession;
assert.equal(paused.questionTimeMs, 1234); assert.notEqual(paused, r.currentSession);
assert(stopped > 0);
const html = fs.readFileSync('./index.html', 'utf8'), css = fs.readFileSync('./ui.css', 'utf8');
assert(!html.includes('user-scalable=no')); assert(!html.includes('slide-next-wrap')); assert(!js.includes('syncSlideAvailability'));
assert(html.includes('一時停止して終了')); assert(html.includes('破棄して終了'));
function luminance(hex) { return hex.match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0); }
const border = css.match(/--border-grey: #([0-9a-f]+)/)[1];
for (const background of ['192e38', '233c48']) assert((luminance(border) + .05) / (luminance(background) + .05) >= 3);
console.log('OK: pointer/keyboard cancellation, result totals and progress, pause compatibility, contrast and zoom');
