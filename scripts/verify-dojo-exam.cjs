const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={window:{addEventListener(){}},document:{documentElement:{dataset:{}}}};
let nextTimer=0;const scheduled=new Map(),clocks=new Map();
Object.assign(c,{setTimeout(fn){scheduled.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){scheduled.delete(id);},setInterval(fn){clocks.set(++nextTimer,fn);return nextTimer;},clearInterval(id){clocks.delete(id);}});
vm.createContext(c);
vm.runInContext(fs.readFileSync('data.js','utf8'),c);
vm.runInContext(fs.readFileSync('dojo-exam.js','utf8'),c);
const api=c.window.DojoExam,data=c.window.VOCX_FALLBACK_DATA;
const ranges=api.listRanges(data);
assert.equal(ranges.length,11);assert.equal(ranges.filter(r=>r.ready).length,8);
for(const range of ranges){
  if(!range.ready){assert.throws(()=>api.buildExam(range.start,data));continue;}
  for(let run=0;run<30;run++){
    const exam=api.buildExam(range.start,data);
    assert.equal(exam.questions.length,15);assert.equal(exam.questions.filter(q=>q.type==='select').length,8);assert.equal(exam.questions.filter(q=>q.type==='type').length,7);
    assert.equal(new Set(exam.questions.map(q=>q.word.toLowerCase())).size,15);
    assert.equal(new Set(exam.bank).size,12);assert.equal(exam.bank.length,12);
    assert(exam.questions.slice(0,8).every(q=>exam.bank.includes(q.answer)));
    assert(exam.questions.slice(8).every(q=>!exam.bank.includes(q.answer)),'typed answers should not be exposed by the bank');
    for(const q of exam.questions){
      assert(q.unit===range.start||q.unit===range.end);assert.equal((q.sentence.match(/_____/g)||[]).length,1);
      const row=data[String(q.unit)].find(row=>row.word===q.word);assert(row);
      assert.equal(q.sentence.replace('_____',q.answer).toLowerCase(),row.sentence.toLowerCase());
    }
    assert.equal(new Set(exam.questions.slice(0,8).map(q=>q.unit)).size,2);
    assert.equal(new Set(exam.questions.slice(8).map(q=>q.unit)).size,2);
    assert(api.validSaved(exam,range.id));
    exam.answers=exam.questions.map(q=>'  '+q.answer.toUpperCase()+'  ');assert.equal(api.grade(exam).score,15);
    exam.answers[14]='';assert.equal(api.grade(exam).score,14);
  }
}
const invalid=api.buildExam(20,data);invalid.answers[0]={bad:true};assert(!api.validSaved(invalid,'20-21'));
const malformed=api.buildExam(20,data);malformed.bank[1]=malformed.bank[0];assert(!api.validSaved(malformed,'20-21'));
const empty=api.listRanges({'20':[{}],'21':[{}]});assert(!empty.find(r=>r.start===20).ready);
const books=api.bookData(data);assert.equal(Object.keys(books).length,8);assert.equal(books['20-21'].entries.length,40);

let time=10000,writes=0,open=false;const progress={},nodes={},handlers={};
const node=selector=>nodes[selector] ||= {textContent:'',classList:{toggle(){}},focus(){},showModal(){this.open=true;},close(){this.open=false;},scrollTop:0};
const root={innerHTML:'',classList:{add(){open=true;},remove(){open=false;}},querySelector:node,addEventListener:(name,fn)=>handlers[name]=fn};
const launcher={innerHTML:'',querySelector:node};
const options={root,getData:()=>data,getProgress:()=>progress,saveProgress:()=>{writes++;return true;},onOpen(){},onClose(){},now:()=>time};
let view=api.create(options);view.renderLauncher(launcher);assert(launcher.innerHTML.includes('教材未追加: Unit 28'));
view.launch(20);assert(open);assert.equal(progress['20-21'].exam.questions.length,15);
function field(index,value,select=false){return {dataset:{examIndex:String(index)},value,matches:selector=>select?selector.startsWith('select'):selector.startsWith('input')};}
handlers.change({target:field(0,'draft-select',true)});
handlers.input({target:field(8,'draft-text')});time+=5000;view.close();assert(!open);
assert.equal(progress['20-21'].exam.answers[0],'draft-select');assert.equal(progress['20-21'].exam.answers[8],'draft-text');assert.equal(progress['20-21'].exam.remainingMs,api.DURATION-5000);
const oldOrder=progress['20-21'].exam.questions.map(q=>q.word).join(',');
view=api.create(options);view.launch(20);assert.equal(progress['20-21'].exam.questions.map(q=>q.word).join(','),oldOrder);
progress['20-21'].exam.questions.forEach((q,i)=>handlers[i<8?'change':'input']({target:field(i,q.answer,i<8)}));
const click=attribute=>handlers.click({target:{closest:()=>({hasAttribute:name=>name===attribute})}});
click('data-exam-submit');assert(nodes['.exam-confirm'].open);click('data-exam-grade');assert.equal(progress['20-21'].exam.status,'completed');assert.equal(progress['20-21'].perfectClearCount,1);assert.equal(api.grade(progress['20-21'].exam).score,15);
click('data-exam-grade');assert.equal(progress['20-21'].perfectClearCount,1,'grading is idempotent');
view.close();view.launch(20,true);assert.equal(progress['20-21'].perfectClearCount,1);assert.equal(clocks.size,0);view.close();
view.launch(21);time+=api.DURATION+1;[...clocks.values()].forEach(fn=>fn());assert(progress['21-22'].exam.timedOut);assert.equal(progress['21-22'].exam.status,'completed');assert.equal(progress['21-22'].perfectClearCount,0);assert.equal(clocks.size,0);
view.close();view.launch(22);time+=api.DURATION;
handlers.input({target:field(8,'late-answer')});
assert(progress['22-23'].exam.timedOut);assert.equal(progress['22-23'].exam.answers[8],'','expired input must not be accepted between timer ticks');
assert(writes>0);
console.log('OK: 8 dropdown + 7 spelling questions, both-unit coverage, unique 12-word bank, no typed-answer leak, exact grading, missing data, drafts/resume, elapsed time, timeout, idempotence and Tango books');
