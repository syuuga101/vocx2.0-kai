const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
const c = { window: {}, appState: { settings: { initialHint: true } }, showToast() {}, openQuizScreen() {} };
vm.createContext(c);
vm.runInContext(fs.readFileSync('./data.js', 'utf8'), c);
c.vocxUnitsData = c.window.VOCX_FALLBACK_DATA;
vm.runInContext(js.slice(js.indexOf('  function capitalizeFirst'), js.indexOf('  /* ===', js.indexOf('  function capitalizeFirst'))), c);
vm.runInContext(js.slice(js.indexOf('  function buildBlankedSentence'), js.indexOf('  function stripLeadingQuestionNumber')), c);
for (const unitId of Object.keys(c.vocxUnitsData)) {
  c.startVocxQuiz(unitId, 'oni');
  const session = c.currentSession;
  assert.equal(session.mode, 'oni');
  assert.equal(session.questions.length, 20);
  assert.equal(new Set(session.questions.map(q => q.rawItem.word)).size, 20);
  const counts = {};
  for (const q of session.questions) {
    counts[q.kind] = (counts[q.kind] || 0) + 1;
    if (q.kind === 'vocx-eng-type') {
      assert(q.acceptedAnswers.includes(q.rawItem.word.toLowerCase()));
    } else {
      assert.equal(q.choices.length, 4);
      const expected = q.kind === 'vocx-eng-select' ? q.rawItem.inflected || q.rawItem.word : q.rawItem.word;
      assert.equal(q.choices[q.answerIndex].toLowerCase(), expected.toLowerCase());
    }
  }
  assert.equal(Object.keys(counts).length, 3);
  assert.deepEqual(Object.values(counts).sort(), [6, 7, 7]);
  for (const mode of ['jpn-eng', 'eng-select', 'eng-type']) {
    c.startVocxQuiz(unitId, mode);
    assert(c.currentSession.questions.every(q => q.kind === 'vocx-' + mode));
  }
}
console.log('OK: Oni mixes all three formats across 20 unique words in every unit; standard modes and answers remain valid');
