const fs=require('fs'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync('./app.js','utf8').replace(/\r\n/g,'\n'),els={};
const c={document:{getElementById:id=>els[id]||(els[id]={dataset:{},setAttribute(){},focus(){},classList:{add(){},toggle(){}}})}};
vm.createContext(c);
const start=s.indexOf('  function openCheckSheet');
vm.runInContext(s.slice(start,s.indexOf('  function closeCheckSheet',start)),c);
for(const correct of [true,false]){
  c.openCheckSheet(correct,'Chore','雑用・日課');
  assert.equal(els['check-sheet'].dataset.result,correct?'correct':'wrong');
  assert.equal(els['check-status-title'].textContent,correct?'Correct!':'Incorrect');
  assert.equal(els['check-answer-word'].textContent,'Chore');
}
assert(s.includes("promptClass = 'quiz-prompt-jpn quiz-prompt-eng-select';\n        choicesClass = 'choices-stack-4';"));
console.log('OK: matching four-choice layout, correct/wrong feedback and answer text');

