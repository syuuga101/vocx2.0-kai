const fs = require('fs'), vm = require('vm'), assert = require('assert');
const c = {window: {}};
vm.createContext(c);
vm.runInContext(fs.readFileSync('data.js','utf8'),c);
vm.runInContext(fs.readFileSync('tango.js','utf8'),c);
const {getEntries, create} = c.window.TangoBook;
const vocx = c.window.VOCX_FALLBACK_DATA, dojo = c.window.DOJO_FALLBACK_DATA;
for (const [id, rows] of Object.entries(vocx)) {
  const entries = getEntries('vocx',id,vocx,dojo);
  assert.equal(entries.length,rows.length);
  entries.forEach((entry,i) => {assert.equal(entry.word,rows[i].word);assert.equal(entry.meaning,rows[i].jpn);assert.equal(entry.sentence,rows[i].sentence);});
}
for (const id of Object.keys(dojo)) {
  const entries = getEntries('dojo',id,vocx,dojo);
  assert(entries.length > 0);
  assert(entries.every(entry=>typeof entry.word === 'string' && typeof entry.meaning === 'string'));
  assert.equal(new Set(entries.map(e=>e.word.toLowerCase()+'\n'+e.meaning)).size,entries.length);
}
assert.equal(getEntries('vocx','missing',vocx,dojo).length,0);
const handlers = {}, list = {innerHTML:''}, count = {}, scroller = {scrollTop:10};
const panel = {
  innerHTML: '', contains:()=>true,
  addEventListener: (type,fn)=>handlers[type]=fn,
  insertAdjacentHTML(_,html){this.innerHTML += html;},
  closest:()=>scroller,
  querySelector: selector => selector === '.tango-entries' ? (panel.innerHTML.includes('tango-entries') ? list : null) : selector === '.tango-count' ? count : {focus(){}},
  querySelectorAll: ()=>[]
};
const book = create(panel,{getVocxData:()=>vocx,getDojoData:()=>dojo}); book.render();
assert(panel.innerHTML.includes('data-tango-unit="02"'));
function click(dataset, attributes=[]) {handlers.click({target:{closest:()=>({dataset,hasAttribute:name=>attributes.includes(name),setAttribute(){}})}});}
click({tangoUnit:'02'}); assert(list.innerHTML.includes(vocx['02'][0].word)); assert.equal(scroller.scrollTop,0);
assert(list.innerHTML.includes('意味を見る'),'meanings start hidden');
const word = vocx['02'][0].word;
handlers.input({target:{matches:()=>true,value:word}}); assert(list.innerHTML.includes(word));
click({},['data-tango-hide']); assert(!list.innerHTML.includes('meaning-show'),'global toggle reveals meanings');
handlers.input({target:{matches:()=>true,value:'<script>unlikely-term</script>'}}); assert(list.innerHTML.includes('該当する単語がありません'));
click({},['data-tango-back']); assert(panel.innerHTML.includes('data-tango-unit="02"'));
click({tangoSource:'dojo'});click({tangoUnit:'01'});assert(list.innerHTML.includes(getEntries('dojo','01',vocx,dojo)[0].word));
const unsafe={'01':[{word:'<img onerror="alert(1)">',jpn:'<script>bad</script>'}]};
const safeBook=create(panel,{getVocxData:()=>unsafe,getDojoData:()=>({})});safeBook.render();click({tangoUnit:'01'});assert(!list.innerHTML.includes('<img'));assert(list.innerHTML.includes('&lt;img'));
const exampleData={'01':[{word:'bench',jpn:'ベンチ',sentence:'Sit on the bench.'},{word:'howl',inflected:'howled',jpn:'ほえる',sentence:'The wolf howled at the moon.'}]};
const cards=create(panel,{getVocxData:()=>exampleData,getDojoData:()=>({})});cards.render();click({tangoUnit:'01'});
handlers.input({target:{matches:()=>true,value:'howl'}});assert(list.innerHTML.includes('>02</span>'));assert(list.innerHTML.includes('<mark>howled</mark>'));
handlers.toggle({target:{matches:()=>true,open:true,closest:()=>({dataset:{tangoWord:'howl'}})}});
click({},['data-tango-hide']);assert(list.innerHTML.includes('class="tango-example" open'));assert(!list.innerHTML.includes('meaning-hide'));
console.log('OK: all Unit data, Dojo answers/explanations, deduplication, source/unit navigation, search, meaning reveal, escaped content');
