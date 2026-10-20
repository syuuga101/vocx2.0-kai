const fs=require('fs'),vm=require('vm'),assert=require('assert');
const c={window:{}};vm.createContext(c);
for(const file of ['data.js','dojo-exam.js','study-plan.js','tango.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const {DojoExam:api,VOCX_FALLBACK_DATA:data,DOJO_EXAMPLE_DATA:extras,StudyPlan:plan}=c.window;
let words=0,total=0;
for(let unit=19;unit<=27;unit++){
  assert.equal(Object.keys(extras[unit]).length,20);
  const pool=api.questionPool(unit===27?26:unit,data).filter(q=>q.unit===unit);
  assert.equal(pool.length,20);
  for(const q of pool){
    const variants=api.questionVariants(q);words++;total+=variants.length;
    assert.equal(variants.length,5,q.word+' must have five questions');
    assert.equal(new Set(variants.map(v=>v.sentence.toLowerCase())).size,5,'duplicate contexts: '+q.word);
    assert.equal(variants[0].sentence,q.sentence,'keep the textbook sentence');
    for(const v of variants){
      assert.equal((v.sentence.match(/_____/g)||[]).length,1,q.word);
      assert(/^[a-z]+(?:['-][a-z]+)*$/i.test(v.answer));
      assert(/[.!?]$/.test(v.sentence),q.word+' must be a complete sentence');
      assert(!new RegExp('\\b'+q.word+'\\b','i').test(v.sentence),'answer leaked: '+q.word);
    }
  }
}
assert.equal(words,180);assert.equal(total,900);
const first=api.buildExam(20,data,()=>0),last=api.buildExam(20,data,()=>0.999999);
assert(first.questions.every(q=>!q.source));assert(last.questions.every(q=>q.source==='practice'));
assert.equal(api.bookData(data)['20-21'].entries[0].examples.length,5);
assert.equal(plan.schedule.length,11);
for(let i=0;i<plan.schedule.length;i++){
  const exam=plan.schedule[i],deadline=Date.parse(exam.deadline);
  assert.equal(plan.upcoming(deadline).id,exam.id);
  assert.equal(plan.upcoming(deadline+1)?.id,plan.schedule[i+1]?.id);
}
assert.equal(plan.upcoming(Date.parse('2026-10-20T00:00:00+09:00')).id,'19-20');
assert.equal(plan.upcoming(Date.parse('2026-10-20T15:00:00+09:00')).id,'20-21');
assert.equal(plan.upcoming(Date.parse('2026-11-03T11:00:00+09:00')).id,'21-22');
assert.equal(plan.upcoming(Date.parse('2026-12-23T00:00:00+09:00')),null);
assert.equal(plan.upcoming(NaN),null);
const handlers={},list={innerHTML:''},counter={};
const panel={innerHTML:'',contains:()=>true,insertAdjacentHTML(_where,html){this.innerHTML+=html;},querySelector:s=>s==='.tango-entries'?list:s==='.tango-count'?counter:{focus(){}},querySelectorAll:()=>[],closest:()=>({scrollTop:0}),addEventListener:(type,fn)=>handlers[type]=fn};
let upcoming=plan.upcoming(Date.parse('2026-10-20T15:00:00+09:00'));
const book=c.window.TangoBook.create(panel,{getVocxData:()=>data,getDojoData:()=>api.bookData(data),getUpcoming:()=>upcoming});
book.render();assert(panel.innerHTML.includes('次のテスト · 10/27'));assert(panel.innerHTML.includes('<h2>Unit 20-21</h2>'));assert(list.innerHTML.includes('例文 5問'));
const click=(dataset,attribute)=>handlers.click({target:{closest:()=>({dataset,hasAttribute:name=>name===attribute,setAttribute(){}})}});
click({},'data-tango-back');assert(panel.innerHTML.indexOf('data-tango-unit="20-21"')<panel.innerHTML.indexOf('data-tango-unit="19-20"'));
click({tangoSource:'vocx'});assert(panel.innerHTML.indexOf('data-tango-unit="20"')<panel.innerHTML.indexOf('data-tango-unit="02"'));
click({},'data-tango-upcoming');assert(panel.innerHTML.includes('<h2>Unit 20-21</h2>'));
upcoming=plan.schedule.find(e=>e.id==='27-28');
const missing=c.window.TangoBook.create(panel,{getVocxData:()=>data,getDojoData:()=>api.bookData(data),getUpcoming:()=>upcoming});missing.render();assert(panel.innerHTML.includes('教材準備中'));assert(!panel.innerHTML.includes('data-tango-upcoming'));
console.log('OK: 180 words / 900 contexts, variant sampling, five-example books, JST deadlines, automatic priority, manual navigation and unavailable ranges');
