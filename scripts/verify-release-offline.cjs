const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {buildPages}=require('./build-pages.cjs');
const output=buildPages(),origin='https://offline.invalid/',handlers={},stored=new Map();
const key=input=>new URL(typeof input==='string'?input:input.url,origin).href;
const cache={
  async addAll(assets){for(const asset of assets){const relative=asset==='./'?'index.html':asset.slice(2);stored.set(key(asset),new Response(fs.readFileSync(path.join(output,relative))));}},
  async match(input){return stored.get(key(input))?.clone();},
  async put(input,response){stored.set(key(input),response);}
};
vm.runInNewContext(fs.readFileSync(path.join(output,'sw.js'),'utf8'),{
  URL,self:{location:{origin:origin.slice(0,-1)},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting(){}},
  caches:{open:async()=>cache},fetch:async()=>{throw Error('offline');}
});
(async()=>{
  let installed;handlers.install({waitUntil:p=>installed=p});await installed;
  async function read(file){let response;handlers.fetch({request:new Request(new URL(file,origin)),respondWith:p=>response=p,waitUntil(){}});return (await response).text();}
  for(const file of ['','index.html','app.js','ui.css','data.js','tango.js','dojo-exam.js','study-plan.js','sound-effects.js'])assert.equal(await read(file),fs.readFileSync(path.join(output,file || 'index.html'),'utf8'));
  const c={window:{}};vm.createContext(c);vm.runInContext(await read('data.js'),c);vm.runInContext(await read('dojo-exam.js'),c);
  assert.equal(Object.values(c.window.VOCX_FALLBACK_DATA).flat().length,520);
  assert.equal(Object.values(c.window.DOJO_EXAMPLE_DATA).flatMap(unit=>Object.values(unit).flat()).length,720);
  const paper=c.window.DojoExam.buildExam(20,c.window.VOCX_FALLBACK_DATA);assert.equal(paper.questions.length,15);
  paper.answers=paper.questions.map(q=>q.answer);assert.equal(c.window.DojoExam.grade(paper).score,15);
  assert.equal([...stored.keys()].filter(url=>/\/(?:vocx|dojo)\//.test(url)).length,0);
  console.log('OK: release code, all 520 words and 720 added contexts work from precache offline without duplicate raw lessons');
})().catch(error=>{console.error(error);process.exitCode=1;});
