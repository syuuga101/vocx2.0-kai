const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app.js','utf8');
const code=source.slice(source.indexOf('  function saveState()'),source.indexOf('  /* ===',source.indexOf('  function saveState()')));
let stored=JSON.stringify({face:'vocx',vocxProgress:{'02':{perfectClearCount:0}},dojoProgress:{},dojoExamProgress:{}}),fail=false;
function tab(){const state=JSON.parse(stored),c={appState:state,debugSandbox:null,STORAGE_KEY:'state',lastSavedRaw:null,savedStateSnapshot:JSON.stringify(state),localStorage:{getItem:()=>stored,setItem:(_,value)=>{if(fail)throw Error('quota');stored=value;}}};vm.createContext(c);vm.runInContext(code,c);return c;}
const a=tab(),b=tab();
a.appState.vocxProgress['02'].perfectClearCount=1;assert(a.saveState());
b.appState.dojoExamProgress['20-21']={bestScore:15};assert(b.saveState());
assert.equal(JSON.parse(stored).vocxProgress['02'].perfectClearCount,1,'stale Dojo tab preserves another tab’s Vocx progress');
a.appState.vocxProgress['03']={bestScorePct:90};assert(a.saveState());assert.equal(JSON.parse(stored).dojoExamProgress['20-21'].bestScore,15);
const c=tab(),d=tab();delete c.appState.vocxProgress['03'];d.appState.dojoExamProgress['21-22']={bestScore:14};assert(d.saveState());assert(c.saveState());assert(!JSON.parse(stored).vocxProgress['03']);assert.equal(JSON.parse(stored).dojoExamProgress['21-22'].bestScore,14);
fail=true;c.appState.vocxProgress['04']={bestScorePct:80};assert.equal(c.saveState(),false);fail=false;assert(c.saveState());assert.equal(JSON.parse(stored).vocxProgress['04'].bestScorePct,80);
console.log('OK: unrelated Unit progress survives stale tab saves, intentional deletion and quota retry');
