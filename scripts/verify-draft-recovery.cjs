const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('app.js','utf8'),timers=new Map();let id=0,writes=0;
const c={quizDraftTimer:null,currentSession:{currentIndex:0,typedText:''},saveQuizCheckpoint(){writes++;},setTimeout(fn,ms){assert.equal(ms,250);timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function queueQuizCheckpoint()'),source.indexOf('  function pauseQuizSession()')),c);
function flush(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());}
c.queueQuizCheckpoint();c.queueQuizCheckpoint();assert.equal(timers.size,1,'typing coalesces writes');flush();assert.equal(writes,1);
c.queueQuizCheckpoint();c.currentSession.currentIndex++;flush();assert.equal(writes,1,'pending draft cannot affect next question');
c.queueQuizCheckpoint();c.currentSession={currentIndex:1};flush();assert.equal(writes,1,'pending draft cannot affect another session');
c.queueQuizCheckpoint();c.currentSession=null;flush();assert.equal(writes,1,'leaving cannot resurrect a draft');
console.log('OK: debounced Vocx drafts, stale-question/session rejection and leave safety');
