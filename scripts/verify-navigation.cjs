const fs=require('fs'),vm=require('vm'),assert=require('assert');
const js=fs.readFileSync('./app.js','utf8');
const elements={};
function el(id){return elements[id] ||= {clientWidth:390,style:{setProperty(){}},classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture(){return true},releasePointerCapture(){},listeners:{},addEventListener(type,fn){this.listeners[type]=fn},showModal(){this.open=true},close(){this.open=false}}}
const c={document:{getElementById:el},appState:{face:'vocx',vocxProgress:{},dojoProgress:{}},dojoUnitsData:{'02':{part1:{},part2:{}}},playSound:()=>{},escapeHtml:s=>s,startVocxQuiz:(unit,mode)=>c.started={unit,mode,face:'vocx'},startDojoQuiz:(unit,mode)=>c.started={unit,mode,face:'dojo'},resumePausedSession:s=>c.resumed=s};
vm.createContext(c);
const start=js.indexOf('  const JP_FLAG');
vm.runInContext(js.slice(start,js.indexOf('  /* ===',start)),c);
c.openUnitModes('02');assert(el('unit-mode-dialog').open);assert.equal((el('unit-mode-options').innerHTML.match(/data-mode=/g)||[]).length,3);
el('unit-mode-options').listeners.click({target:{closest:()=>({dataset:{mode:'eng-type'}})}});assert.equal(c.started.mode,'eng-type');assert(!el('unit-mode-dialog').open);
c.appState.face='dojo';c.openUnitModes('02');assert.equal((el('unit-mode-options').innerHTML.match(/data-mode=/g)||[]).length,2);
const paused={mode:'part2',currentIndex:2,questions:[1,2,3,4]};c.appState.dojoProgress['02']={pausedSession:paused};c.openUnitModes('02');assert(el('unit-mode-options').innerHTML.includes('3 / 4'));
el('unit-mode-options').listeners.click({target:{closest:()=>({dataset:{mode:'resume'}})}});assert.equal(c.resumed,paused);
delete c.dojoUnitsData['02'].part2;c.openUnitModes('02');assert(!el('unit-mode-options').innerHTML.includes('data-mode="part2"'));
console.log('OK: Vocx/Dojo mode choices, start routing, resume routing, unavailable parts hidden');
const dialog=el('unit-mode-dialog');
const grip={closest:selector=>selector==='button'?null:{}};
dialog.listeners.pointerdown({button:0,isPrimary:true,pointerId:1,clientY:100,target:grip});
dialog.listeners.pointermove({pointerId:1,clientY:130});
dialog.listeners.pointerup({pointerId:1});assert(dialog.open,'short swipe stays open');
dialog.listeners.pointerdown({button:0,isPrimary:true,pointerId:1,clientY:100,target:grip});
dialog.listeners.pointermove({pointerId:1,clientY:180});
dialog.listeners.pointerup({pointerId:1});assert(!dialog.open,'long swipe dismisses');
dialog.showModal();dialog.listeners.pointerdown({button:0,isPrimary:true,pointerId:1,clientY:100,target:grip});dialog.listeners.pointermove({pointerId:1,clientY:180});dialog.listeners.pointercancel();assert(dialog.open,'cancelled swipe stays open');assert.equal(dialog.style.transform,'');
console.log('OK: short swipe, dismiss swipe, and pointer cancellation');

