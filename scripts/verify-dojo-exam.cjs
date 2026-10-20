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
    for(const pair of [['outcome','result'],['magnificent','terrific'],['pile','stack']])assert(!pair.every(word=>exam.bank.includes(word)),'confusable synonyms must not share a bank');
    assert(exam.questions.slice(0,8).every(q=>exam.bank.includes(q.answer)));
    assert(exam.questions.slice(8).every(q=>!exam.bank.includes(q.answer)),'typed answers should not be exposed by the bank');
    for(const q of exam.questions){
      assert(q.unit===range.start||q.unit===range.end);assert.equal((q.sentence.match(/_____/g)||[]).length,1);
      const row=data[String(q.unit)].find(row=>row.word===q.word);assert(row);
      const base=api.questionPool(range.start,data).find(item=>item.word===q.word);
      assert(api.questionVariants(base).some(v=>v.sentence===q.sentence && v.answer===q.answer));
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

let time=10000,writes=0,open=false,storageWorks=true;const progress={},nodes={},handlers={};
const node=selector=>nodes[selector] ||= {textContent:'',classList:{toggle(){}},focus(){},showModal(){this.open=true;},close(){this.open=false;},scrollTop:0};
const root={innerHTML:'',insertAdjacentHTML(_where,html){this.innerHTML+=html;},classList:{add(){open=true;},remove(){open=false;}},querySelector:node,addEventListener:(name,fn)=>handlers[name]=fn};
const launcher={innerHTML:'',querySelector:node};
const options={root,getData:()=>data,getProgress:()=>progress,saveProgress:()=>{writes++;return storageWorks;},onOpen(){},onClose(){},now:()=>time};
const click=attribute=>handlers.click({target:{closest:()=>({hasAttribute:name=>name===attribute})}});
function flush(){const jobs=[...scheduled.entries()];scheduled.clear();jobs.forEach(([,fn])=>fn());}
function ready(){for(let i=0;i<3;i++)flush();assert.equal(nodes['.exam-countdown-number'].textContent,3);assert.equal(clocks.size,0);for(let i=0;i<3;i++){time+=1000;flush();}assert.equal(clocks.size,1);}
function field(index,value,select=false){return {dataset:{examIndex:String(index)},value,matches:selector=>select?selector.startsWith('select'):selector.startsWith('input')};}
let view=api.create(options);view.renderLauncher(launcher);assert(launcher.innerHTML.includes('教材未追加: Unit 28'));
view.launch(20);assert(open);assert(!progress['20-21']);ready();assert.equal(progress['20-21'].exam.remainingMs,api.DURATION,'preparation/countdown must not consume exam time');
handlers.change({target:field(0,'draft-select',true)});handlers.input({target:field(8,'draft-text')});time+=5000;
node('.exam-scroll').scrollTop=345;view.close();assert(open);assert(nodes['.exam-exit-dialog'].open);assert.equal(clocks.size,0);
time+=10000;click('data-exam-keep');assert.equal(clocks.size,1);time+=1000;view.close();click('data-exam-pause');assert(!open);
assert.equal(progress['20-21'].exam.answers[0],'draft-select');assert.equal(progress['20-21'].exam.answers[8],'draft-text');assert.equal(progress['20-21'].exam.remainingMs,api.DURATION-6000);
const oldOrder=progress['20-21'].exam.questions.map(q=>q.word).join(',');
view.launch(20);assert(nodes['.exam-start-dialog'].open);assert.equal(clocks.size,0);click('data-exam-resume');ready();assert.equal(progress['20-21'].exam.questions.map(q=>q.word).join(','),oldOrder);assert.equal(node('.exam-scroll').scrollTop,345);
progress['20-21'].exam.questions.forEach((q,i)=>handlers[i<8?'change':'input']({target:field(i,q.answer,i<8)}));
click('data-exam-submit');assert(nodes['.exam-confirm'].open);click('data-exam-grade');assert.equal(progress['20-21'].exam.status,'completed');assert.equal(progress['20-21'].perfectClearCount,1);assert.equal(api.grade(progress['20-21'].exam).score,15);
click('data-exam-grade');assert.equal(progress['20-21'].perfectClearCount,1,'grading is idempotent');
view.close();view.launch(20,true);assert.equal(progress['20-21'].perfectClearCount,1);assert.equal(clocks.size,0);view.close();
view.launch(21);ready();time+=api.DURATION+1;[...clocks.values()].forEach(fn=>fn());assert(progress['21-22'].exam.timedOut);assert.equal(progress['21-22'].exam.status,'completed');assert.equal(clocks.size,0);
view.close();view.launch(22);ready();time+=api.DURATION;handlers.input({target:field(8,'late-answer')});assert(progress['22-23'].exam.timedOut);assert.equal(progress['22-23'].exam.answers[8],'');view.close();
view.launch(23);ready();handlers.input({target:field(8,'discard-me')});flush();view.close();storageWorks=false;click('data-exam-discard');assert(open);assert(progress['23-24'].exam);storageWorks=true;click('data-exam-discard');assert(!open);assert(!progress['23-24'].exam);assert.equal(scheduled.size,0);
view.launch(24);ready();handlers.input({target:field(8,'keep-me')});view.close();storageWorks=false;click('data-exam-pause');assert(open);assert(nodes['.exam-exit-error'].textContent);storageWorks=true;click('data-exam-pause');
const prior=JSON.stringify(progress['24-25'].exam);view.launch(24);click('data-exam-new');flush();click('data-exam-back');assert.equal(JSON.stringify(progress['24-25'].exam),prior,'cancelling preparation must preserve earlier attempt');assert.equal(scheduled.size,0);
view.launch(24);click('data-exam-new');ready();assert(progress['24-25'].exam.answers.every(a=>!a));assert.equal(progress['24-25'].exam.remainingMs,api.DURATION);assert.notEqual(progress['24-25'].exam.questions.map(q=>q.word).join(','),JSON.parse(prior).questions.map(q=>q.word).join(','));
view.close();handlers.cancel({target:{matches:s=>s==='.exam-exit-dialog'},preventDefault(){}});assert.equal(clocks.size,1);view.close();click('data-exam-discard');assert.equal(clocks.size,0);assert.equal(scheduled.size,0);assert(writes>0);
console.log('OK: Dojo paper generation, grading, prepare/countdown timing, resume/new, paused exit/cancel, autosave, discard, storage failure, timeout and review');
