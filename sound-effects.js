/* Short effects share one predecoded Web Audio context, never a media player. */
(() => {
  'use strict';
  function create({files,enabled,now=()=>performance.now()}) {
    let context=null,master=null,loading=null,resuming=null,generation=0;
    const buffers=new Map(),active=new Set();
    function mixWithMusic(){
      try{if(navigator.audioSession && navigator.audioSession.type!=='ambient')navigator.audioSession.type='ambient';}catch{}
    }
    function ensure(){
      if(context)return context;
      const Constructor=window.AudioContext || window.webkitAudioContext;
      if(!Constructor)return null;
      try{
        mixWithMusic();context=new Constructor({latencyHint:'interactive'});
        master=context.createGain();master.gain.value=0.85;master.connect(context.destination);
      }catch{context=null;}
      return context;
    }
    function preload(){
      if(loading)return loading;
      if(!enabled() || !ensure())return Promise.resolve();
      loading=Promise.allSettled([...new Set(Object.values(files))].filter(url=>!buffers.has(url)).map(async url=>{
        const response=await fetch(url);if(!response.ok)throw Error('Sound unavailable');
        const bytes=await response.arrayBuffer();
        const decoded=await context.decodeAudioData(bytes);buffers.set(url,decoded);
      })).finally(()=>{loading=null;});
      return loading;
    }
    function unlock(){
      if(!enabled() || !ensure())return null;
      mixWithMusic();preload();
      if(context.state==='running')return null;
      if(!resuming){
        try{resuming=Promise.resolve(context.resume()).catch(()=>{}).finally(()=>{resuming=null;});}catch{return null;}
      }
      return resuming;
    }
    function track(node,extra){
      active.add(node);node.onended=()=>{active.delete(node);node.disconnect();extra?.disconnect();};
    }
    function fallback(type){
      // If the first interaction beats decoding, give immediate feedback rather
      // than replaying a late event after the screen has moved on.
      const tones=type==='correct'||type==='complete'?[660,880]:type==='wrong'?[180]:type==='countdownStart'?[880]:type==='countdown'?[660]:[440];
      tones.forEach((frequency,index)=>{
        const at=context.currentTime+index*0.075,duration=tones.length>1?0.09:type==='wrong'?0.18:0.045;
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);
        gain.gain.linearRampToValueAtTime(0.16,at+0.004);gain.gain.exponentialRampToValueAtTime(0.001,at+duration);
        oscillator.connect(gain);gain.connect(master);track(oscillator,gain);
        oscillator.start(at);oscillator.stop(at+duration);
      });
    }
    function start(type){
      if(!enabled() || document.hidden || context.state!=='running')return false;
      const buffer=buffers.get(files[type] || files.tap);
      if(!buffer){fallback(type);return true;}
      const node=context.createBufferSource();node.buffer=buffer;node.connect(master);track(node);
      node.start(context.currentTime);return true;
    }
    function stop(){
      generation++;
      for(const node of active){try{node.stop();}catch{}}
      active.clear();
    }
    function play(type){
      if(!enabled()){stop();return false;}
      if(document.hidden || !ensure())return false;
      const at=now(),ticket=generation,pending=unlock();
      if(context.state==='running')return start(type);
      pending?.then(()=>{if(ticket===generation && now()-at<=100)start(type);});
      return false;
    }
    function onVisibility(){if(document.hidden){stop();if(context?.state==='running')context.suspend().catch(()=>{});}}
    document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
    document.addEventListener('touchstart',unlock,{capture:true,passive:true});
    document.addEventListener('keydown',unlock,true);
    document.addEventListener('visibilitychange',onVisibility);
    preload();
    return {play,preload,stop};
  }
  window.SoundEffects={create};
})();
