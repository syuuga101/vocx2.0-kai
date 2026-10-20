const fs = require('fs'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync('app.js', 'utf8');
const c = {window: {}, appState: {settings: {}}, showToast() {}, openQuizScreen() {}};
vm.createContext(c);
vm.runInContext(fs.readFileSync('data.js', 'utf8'), c);
c.vocxUnitsData = c.window.VOCX_FALLBACK_DATA;
c.dojoUnitsData = c.window.DOJO_FALLBACK_DATA;
vm.runInContext(source.slice(source.indexOf('  function capitalizeFirst'), source.indexOf('  /* ===', source.indexOf('  function capitalizeFirst'))), c);
vm.runInContext(source.slice(source.indexOf('  function buildBlankedSentence'), source.indexOf('  function resumePausedSession')), c);
function check(questions) {
  const counts = new Map(), previous = new Map();
  for (const question of questions) {
    if (!question.choices) continue;
    const n = question.choices.length;
    if (!counts.has(n)) counts.set(n, Array(n).fill(0));
    const tally = counts.get(n);
    tally[question.answerIndex]++;
    assert(Math.max(...tally) - Math.min(...tally) <= 1, 'balanced at every prefix');
    assert.notEqual(question.answerIndex, previous.get(n), 'no same-position run, including bag boundaries');
    previous.set(n, question.answerIndex);
  }
}
for (let run = 0; run < 150; run++) {
  const questions = Array.from({length: 67}, (_, i) => {
    const count = [2,3,4][i % 3];
    return {choices: Array.from({length: count}, (_, j) => 'q' + i + ':' + j), answerIndex: i % count};
  });
  const expected = questions.map(q => q.choices[q.answerIndex]);
  c.balanceChoicePositions(questions); check(questions);
  questions.forEach((q,i) => assert.equal(q.choices[q.answerIndex], expected[i], 'correct answer preserved'));
}
for (const id of Object.keys(c.vocxUnitsData)) {
  for (const mode of ['jpn-eng','eng-select','oni']) {
    c.startVocxQuiz(id, mode); check(c.currentSession.questions);
    for (const q of c.currentSession.questions.filter(q => q.choices)) {
      const expected = q.kind === 'vocx-eng-select' ? q.rawItem.inflected || q.rawItem.word : q.rawItem.word;
      assert.equal(q.choices[q.answerIndex].toLowerCase(), expected.toLowerCase());
    }
  }
}
for (const [id, parts] of Object.entries(c.dojoUnitsData)) for (const part of Object.keys(parts)) {
  c.startDojoQuiz(id, part); check(c.currentSession.questions);
}
console.log('OK: balanced answer positions, randomized bags, no adjacent repeats, correct answers preserved across Vocx/Oni/Dojo');
