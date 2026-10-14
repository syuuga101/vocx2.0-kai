const fs = require('fs'), vm = require('vm'), assert = require('assert');
const js = fs.readFileSync('./app.js', 'utf8');
const math = Object.create(Math);
const c = {Math: math}; vm.createContext(c);
vm.runInContext(js.slice(js.indexOf('  function getResultFeedback'), js.indexOf('  function showQuizResults')), c);
const bands = [[0,24,'danger','#ff4040'],[25,49,'warning','#ff9650'],[50,74,'steady','#ffd34d'],[75,99,'good','#b5e36a'],[100,100,'perfect','#58e3a1']];
for (const [low, high, level, color] of bands) {
  const messages = new Set();
  for (let i = 0; i < 5; i++) {
    math.random = () => (i + .1) / 5;
    const result = c.getResultFeedback(low);
    assert.equal(result.level, level); assert.equal(result.color, color);
    assert.equal(c.getResultFeedback(high).level, level);
    messages.add(result.message);
    if (level === 'perfect') assert(result.message.includes('全問正解'));
  }
  assert.equal(messages.size, 5, 'each band has five distinct messages');
}
assert.equal(c.getResultFeedback(100, false).level, 'good', 'rounded scores do not falsely celebrate perfection');
console.log('OK: five score bands, red/green endpoints, boundary scores and 25 prewritten random messages');
