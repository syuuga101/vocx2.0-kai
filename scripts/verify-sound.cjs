const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('sound-effects.js','utf8');
function harness({slow=false,unsupported=false}={}){
  let enabled=true,time=0,resumeResolve,fetchResolve;const starts=[],stops=[],requests=[],listeners={},contexts=[];
  class Context {
    constructor(options){assert.equal(options.latencyHint,'interactive');this.state='suspended';this.currentTime=5;this.destination={};contexts.push(this);}
    createGain(){return {gain:{value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createBufferSource(){const node={connect(){},disconnect(){},buffer:null,start:at=>starts.push({kind:'buffer',at,buffer:node.buffer}),stop(){stops.push(1);node.onended?.();}};return node;}
    createOscillator(){const node={frequency:{value:0},connect(){},disconnect(){},start:at=>starts.push({kind:'tone',at}),stop(){stops.push(1);}};return node;}
    decodeAudioData(bytes){return Promise.resolve({bytes});}
    resume(){if(slow)return new Promise(resolve=>{resumeResolve=()=>{this.state='running';resolve();};});this.state='running';return Promise.resolve();}
    suspend(){this.state='suspended';return Promise.resolve();}
  }
  const document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn};
  const c={window:unsupported?{}:{AudioContext:Context},document,navigator:{audioSession:{type:'auto'}},performance:{now:()=>time},fetch:url=>{requests.push(url);return slow?new Promise(resolve=>{fetchResolve=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});}):Promise.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});}};
  vm.createContext(c);vm.runInContext(source,c);
  const engine=c.window.SoundEffects.create({files:{tap:'tap.wav',correct:'correct.wav',complete:'correct.wav',wrong:'wrong.wav'},enabled:()=>enabled,now:()=>time});
  return {engine,c,starts,stops,requests,listeners,contexts,setEnabled:v=>enabled=v,setTime:v=>time=v,resume:()=>resumeResolve(),fetchDone:()=>fetchResolve()};
}
(async()=>{
  const h=harness();await h.engine.preload();assert.equal(h.requests.length,3,'aliases decode only once');assert.equal(h.contexts.length,1);assert.equal(h.c.navigator.audioSession.type,'ambient');
  h.listeners.pointerdown();h.engine.play('correct');assert.equal(h.starts.length,1);assert.equal(h.starts[0].at,5,'ready effect starts at current audio time without waiting');assert.equal(h.starts[0].kind,'buffer');
  h.engine.play('complete');h.engine.play('wrong');assert.equal(h.starts.length,3);assert.strictEqual(h.starts[0].buffer,h.starts[1].buffer);await h.engine.preload();assert.equal(h.requests.length,3);
  h.setEnabled(false);h.engine.play('correct');assert.equal(h.starts.length,3);assert(h.stops.length>=3,'muting stops active effects');
  h.setEnabled(true);h.c.document.hidden=true;h.engine.play('correct');assert.equal(h.starts.length,3);h.listeners.visibilitychange();assert.equal(h.contexts[0].state,'suspended');
  const delayed=harness({slow:true});delayed.engine.play('tap');delayed.setTime(150);delayed.resume();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(delayed.starts.length,0,'stale resume must never play a delayed effect');
  const cold=harness({slow:true});cold.contexts[0].state='running';cold.engine.play('correct');assert.equal(cold.starts[0].kind,'tone','cold decode gets immediate fallback, not a queued old effect');
  const noApi=harness({unsupported:true});assert.equal(noApi.engine.play('correct'),false);assert.equal(noApi.contexts.length,0);
  assert(!/new Audio\(|cloneNode|mediaSession|transient-solo/.test(source),'effects must not claim exclusive media playback');
  console.log('OK: ambient mixing, one context, shared predecoded buffers, immediate starts, mute/background, stale-resume rejection and cold fallback');
})().catch(error=>{console.error(error);process.exitCode=1;});
