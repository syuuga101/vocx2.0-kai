const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app.js','utf8'),handlers={},body={};
vm.runInNewContext(source.slice(source.indexOf('  /* Allow any real scroll container'),source.indexOf("  window.addEventListener('scroll',")),{
  document:{body,addEventListener:(name,fn)=>handlers[name]=fn},getComputedStyle:el=>({overflowY:el.overflowY||'visible'})
});
function scroller(parent=body){return {parentElement:parent,overflowY:'auto',scrollHeight:2000,clientHeight:500,scrollTop:0};}
function gesture(target,from,to,multi=false){handlers.touchstart({touches:[{clientY:from}]});const e={target,cancelable:true,touches:multi?[{clientY:to},{clientY:to}]:[{clientY:to}],preventDefault(){this.prevented=true;}};handlers.touchmove(e);return !!e.prevented;}
// No class-name dependency: Dojo, native/custom dialogs, books and future scroll areas all work.
for(const name of ['Dojo paper','Dojo preparation','Dojo exit dialog','quit modal','Unit list','Tango','results']){
  const scroll=scroller(),target={parentElement:scroll};
  assert(!gesture(target,400,200),name+' must accept upward swipe at start');
  assert(gesture(target,200,400),name+' blocks root bounce at top');
  scroll.scrollTop=500;assert(!gesture(target,400,200));assert(!gesture(target,200,400));
  scroll.scrollTop=1500;assert(gesture(target,400,200));assert(!gesture(target,200,400),name+' can return from bottom');
}
assert(gesture({parentElement:body},400,200),'non-scrolling header still blocks bounce');
const parent=scroller(),small={parentElement:parent,overflowY:'auto',scrollHeight:40,clientHeight:40};assert(!gesture(small,400,200),'non-overflowing nested content finds scrolling ancestor');
assert(!gesture({parentElement:body},400,200,true),'pinch zoom remains native');
console.log('OK: Dojo/dialog/book/result touch scrolling, both directions and boundaries, nested containers, root bounce and pinch zoom');
