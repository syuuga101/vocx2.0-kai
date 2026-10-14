const fs = require('fs'), vm = require('vm'), assert = require('assert');
const root = './';
const html = fs.readFileSync(root+'index.html','utf8');
const css = fs.readFileSync(root+'ui.css','utf8');
const js = fs.readFileSync(root+'app.js','utf8');
new vm.Script(js);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'duplicate element IDs');
for(const m of html.matchAll(/(?:src|href)="(\.\/[^"?]+)"/g)) assert(fs.existsSync(root+m[1]),m[1]);
for(const m of js.matchAll(/getElementById\('([^']+)'\)/g)) {
  assert(ids.includes(m[1]) || js.includes('id="'+m[1]+'"'), 'missing ID: '+m[1]);
}
assert(css.includes('width: max-content;'));
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length);
const context = {debugProgress: null,appState:{vocxProgress:{},dojoProgress:{}},CHECK_BADGE_SVG:'check',PAUSE_BADGE_SVG:'pause',playSound:()=>{},saveState:()=>{},closeQuizScreen:()=>{},showQuizResults:()=>{}};
vm.createContext(context);
vm.runInContext(js.slice(js.indexOf('  function getPerfectClearCount'), js.indexOf('  function renderHomeUnits')),context);
const finishStart = js.indexOf('  function finishQuizSession');
vm.runInContext(js.slice(finishStart,js.indexOf('  /* ===',finishStart)),context);
for(const face of ['vocx','dojo']) {
  for(const [correct, count] of [[1,0],[2,1],[1,1],[2,2]]) {
    context.currentSession={face,unitId:'02',mode:'test',correctCount:correct,questions:[1,2]};
    context.finishQuizSession();
    assert.equal(context.appState[face+'Progress']['02'].perfectClearCount,count);
    assert.equal(context.getUnitEvaluation(face,'02').status,count===2?'marvelous':count===1?'perfect':'nice');
  }
}
context.unitsScroller={clientHeight:600,scrollTop:0,getBoundingClientRect:()=>({top:100,bottom:700})};
context.mainScreen={getBoundingClientRect:()=>({top:0})};
context.bottomFooter={getBoundingClientRect:()=>({top:640})};
context.unitsList={lastElementChild:{classList:{contains:()=>true},getBoundingClientRect:()=>({bottom:context.lastBottom})}};
context.unitHintUp={style:{}}; context.unitHintDown={style:{}};
const hintStart=js.indexOf('  function updateUnitScrollHints');
vm.runInContext(js.slice(hintStart,js.indexOf('  unitsScroller.addEventListener',hintStart)),context);
for(const [height,top,bottom,up,down] of [[600,0,1800,true,false],[600,300,1500,false,false],[600,1200,600,false,true],[600,0,400,true,true],[0,300,1500,true,true]]) {
  Object.assign(context.unitsScroller,{clientHeight:height,scrollTop:top});context.lastBottom=bottom;
  context.updateUnitScrollHints();assert.equal(context.unitHintUp.hidden,up);assert.equal(context.unitHintDown.hidden,down);
}
console.log('OK: local assets, element IDs, CSS structure, perfect-clear progression, scroll indicators');

context.appState.vocxProgress['03'] = {clearedModes: {'jpn-eng': true, 'eng-select': true, oni: true}, perfectClearCount: 1};
assert.equal(context.getUnitEvaluation('vocx', '03').badge, '', 'Oni does not replace the third standard mode');
context.appState.vocxProgress['03'].clearedModes['eng-type'] = true;
assert.equal(context.getUnitEvaluation('vocx', '03').badge, 'check');
context.appState.vocxProgress['04'] = {clearedModes: {oni: true}, perfectClearCount: 0};
assert.equal(context.getUnitEvaluation('vocx', '04').status, 'nice');

const savedProgress = JSON.stringify(context.appState);
context.debugProgress = {face: 'vocx', unitId: '05', entry: {perfectClearCount: 1, clearedModes: {}}};
assert.equal(context.getUnitEvaluation('vocx', '05').status, 'perfect');
context.debugProgress.entry.perfectClearCount = 2;
assert.equal(context.getUnitEvaluation('vocx', '05').status, 'marvelous');
assert.equal(context.getUnitEvaluation('vocx', '05').label, 'Marvelous! ×2');
context.debugProgress.entry.perfectClearCount = 5;
assert.equal(context.getUnitEvaluation('vocx', '05').label, 'Marvelous! ×5');
assert.equal(JSON.stringify(context.appState), savedProgress, 'debug previews do not mutate saved progress');
context.debugProgress = null;
assert.equal(context.getUnitEvaluation('vocx', '05').status, 'untried');
const counterElements = {};
context.document = {getElementById: id => counterElements[id] ||= {style: {}, clientWidth: 200}};
vm.runInContext(js.slice(js.indexOf('  function updateProgressBar'), js.indexOf('  function syncViewportHeight')), context);
context.currentSession = {unitId: '02', questions: Array(20), currentIndex: 0};
context.updateProgressBar(); assert.equal(counterElements['quiz-question-count'].textContent, '1 / 20 問目');
context.currentSession.currentIndex = 19;
context.updateProgressBar(); assert.equal(counterElements['quiz-question-count'].textContent, '20 / 20 問目');
new vm.Script(fs.readFileSync('./debug.js', 'utf8'));
