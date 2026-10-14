const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
let nextId = 0, rendered = 0;
const timers = new Map(), elements = {};
const sounds = [];
const el = id => elements[id] ||= {hidden: true, textContent: '', style: {}, replaceChildren() {}, classList: {add() {}, remove() {}}};
const c = {debugSandbox: null, countdownTick: 0, currentSession: {questionTimeMs: 0}, appState: {pauseHintSeen: true}, document: {getElementById: el}, stopStudyClock() {}, closeCheckSheet() {}, renderHomeUnits() {}, renderCurrentQuestion() {rendered++;}, setTimeout(fn, ms) {assert.equal(ms, 1000); const id = ++nextId; timers.set(id, fn); return id;}, clearTimeout: id => timers.delete(id) };
vm.createContext(c);
c.saveQuizCheckpoint = () => {};
vm.runInContext(js.slice(js.indexOf('  function animateCountdownNumber'), js.indexOf('  function recordStudyTime')), c);
c.playSound = type => sounds.push(type);
vm.runInContext(js.slice(js.indexOf('  function cancelQuizCountdown'), js.indexOf('  function updateProgressBar')), c);
function second() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); }
c.openQuizScreen(); assert.equal(el('quiz-countdown-number').textContent, '3'); assert.equal(rendered, 0);
second(); assert.equal(el('quiz-countdown-number').textContent, '2'); assert.equal(rendered, 0);
second(); assert.equal(el('quiz-countdown-number').textContent, '1'); assert.equal(rendered, 0);
assert.equal(c.currentSession.questionTimeMs, 0, 'countdown time is excluded');
second(); assert.equal(rendered, 1); assert(el('quiz-countdown').hidden); assert.equal(timers.size, 0);
assert.deepEqual(sounds, ['countdown', 'countdown', 'countdown', 'countdownStart']);
c.openQuizScreen(false); assert.equal(rendered, 2, 'resume opens immediately'); assert.equal(timers.size, 0);
assert.equal(sounds.length, 4, 'resume does not play countdown sounds');
let animations = 0;
const animatedNumber = {animate() {animations++;}, getAnimations() {return []}};
c.window = {matchMedia: () => ({matches: true})};
c.animateCountdownNumber(animatedNumber); assert.equal(animations, 0, 'reduced motion disables countdown animation');
c.window.matchMedia = () => ({matches: false});
c.animateCountdownNumber(animatedNumber); assert.equal(animations, 1);
c.openQuizScreen(); c.closeQuizScreen(); assert.equal(timers.size, 0, 'close cancels pending countdown');
c.currentSession = {};
c.debugSandbox = {skipCountdown: true};
c.openQuizScreen(); assert.equal(timers.size, 0, 'explicit debug skip opens immediately');
assert.equal(c.debugSandbox.skipCountdown, false, 'debug skip applies only to that start');
c.openQuizScreen(); assert.equal(el('quiz-countdown-number').textContent, '3');
assert.equal(timers.size, 1, 'subsequent normal start keeps countdown in debug mode');
c.closeQuizScreen();
console.log('OK: three-second countdown precedes rendering, excludes answer time and skips resume');

const played = [];
class AudioStub {
  constructor(src) { this.src = src; this.playbackRate = 1; }
  cloneNode() { return new AudioStub(this.src); }
  play() { played.push({src: this.src, rate: this.playbackRate, preservesPitch: this.preservesPitch}); return Promise.resolve(); }
}
const audioContext = {Audio: AudioStub, appState: {settings: {soundEffects: true}}};
vm.createContext(audioContext);
vm.runInContext(js.slice(js.indexOf('  const SE_FILES'), js.indexOf('  function parseCSVText')), audioContext);
audioContext.playSound('countdown'); audioContext.playSound('countdownStart');
assert.equal(played[0].src, './se/countdown.wav'); assert.equal(played[0].rate, 1);
assert.equal(played[1].src, './se/countdown-start.wav'); assert.equal(played[1].rate, 1);
audioContext.appState.settings.soundEffects = false;
audioContext.playSound('countdown'); audioContext.playSound('countdownStart');
assert.equal(played.length, 2, 'countdown honors the sound setting');

for (const [file, expected] of [['countdown.wav', 261.6255653005986], ['countdown-start.wav', 523.2511306011972]]) {
  const wav = fs.readFileSync('./se/' + file), crossings = [];
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  const rate = wav.readUInt32LE(24);
  for (let i = 1; 44 + i * 2 < wav.length; i++) {
    const before = wav.readInt16LE(44 + (i - 1) * 2), after = wav.readInt16LE(44 + i * 2);
    if (before < 0 && after >= 0) crossings.push(i - 1 - before / (after - before));
  }
  const frequency = rate * (crossings.length - 1) / (crossings.at(-1) - crossings[0]);
  assert(Math.abs(frequency - expected) < .1, `${file}: ${frequency} Hz`);
}
