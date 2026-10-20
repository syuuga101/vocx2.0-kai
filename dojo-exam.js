/* EEW3 practice papers: eight dropdown questions and seven spelling questions. */
(() => {
  'use strict';
  const DURATION = 11 * 60 * 1000;
  const VERSION = 1;
  // These pairs can both fit the same blank; never put both in the shared answer bank.
  const similarWords=[['outcome','result'],['magnificent','terrific'],['pile','stack']];
  const conflicts=(a,b)=>similarWords.some(pair=>pair.includes(normalize(a)) && pair.includes(normalize(b)));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'");
  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i],result[j]] = [result[j],result[i]];
    }
    return result;
  }
  function wordQuestion(item, unit) {
    if (!item?.sentence || !item.word) return null;
    for (const answer of [item.inflected, item.word].filter(Boolean)) {
      if (!/^[a-z]+(?:['-][a-z]+)*$/i.test(answer)) continue;
      const literal = answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const expression = new RegExp('\\b' + literal + '\\b','i');
      const match = expression.exec(item.sentence);
      if (!match) continue;
      const sentence = item.sentence.slice(0,match.index) + '_____' + item.sentence.slice(match.index + match[0].length);
      // One gap means exactly one missing word, with no second answer leaked in the sentence.
      if (expression.test(sentence)) continue;
      return {unit,word:item.word,answer:match[0].toLowerCase(),sentence,meaning:item.jpn || item.def || '',definition:item.def || ''};
    }
    return null;
  }
  function questionPool(start, data) {
    const seen = new Set(), answers = new Set(), pool = [];
    for (const unit of [start,start + 1]) {
      for (const item of data[String(unit)] || data[String(unit).padStart(2,'0')] || []) {
        const question = wordQuestion(item,unit);
        if (!question || seen.has(normalize(question.word)) || answers.has(normalize(question.answer))) continue;
        seen.add(normalize(question.word)); answers.add(normalize(question.answer)); pool.push(question);
      }
    }
    return pool;
  }
  function questionVariants(question) {
    const additional=window.DOJO_EXAMPLE_DATA?.[String(question.unit)]?.[question.word] || [];
    return [question,...additional.map(sentence=>({...question,sentence,answer:question.word.toLowerCase(),source:'practice'}))];
  }
  function listRanges(data) {
    return Array.from({length:11}, (_,i) => {
      const start = 19 + i;
      const missing = [start,start+1].filter(unit => !(data[String(unit)] || []).length);
      const pool=questionPool(start,data);
      return {id:start+'-'+(start+1),start,end:start+1,missing,ready:missing.length===0 && pool.length>=19 && [start,start+1].every(unit=>pool.filter(q=>q.unit===unit).length>=8)};
    });
  }
  function buildExam(start, data, random = Math.random) {
    const range = listRanges(data).find(range=>range.start===start);
    if (!range?.ready) throw new Error('この範囲の教材が不足しています');
    // Use both units in both sections, never two unrelated or partially loaded units.
    const groups = [start,start+1].map(unit=>shuffle(questionPool(start,data).filter(q=>q.unit===unit),random));
    if (groups.some(group=>group.length<8)) throw new Error('各Unitに8語以上の出題可能な例文が必要です');
    const pickVariant=q=>{const variants=questionVariants(q);return variants[Math.floor(random()*variants.length)];};
    const selectedWords=[];
    for(const group of groups){
      let count=0;
      for(let index=0;index<group.length && count<4;){
        if(selectedWords.some(q=>conflicts(q.word,group[index].word))){index++;continue;}
        selectedWords.push(group.splice(index,1)[0]);count++;
      }
      if(count!==4)throw new Error('選択問題の候補が不足しています');
    }
    const selected = shuffle(selectedWords,random).map(pickVariant);
    const typed = shuffle([...groups[0].splice(0,4),...groups[1].splice(0,3)],random).map(pickVariant);
    const used = new Set([...selected,...typed].map(q=>normalize(q.word)));
    const distractors=[];
    for(const q of shuffle(questionPool(start,data).filter(q=>!used.has(normalize(q.word))),random)){
      if([...selected,...distractors].some(other=>conflicts(other.word,q.word)))continue;
      distractors.push(q);if(distractors.length===4)break;
    }
    if(distractors.length!==4)throw new Error('選択肢の候補が不足しています');
    const bank = shuffle([...selected,...distractors].map(q=>q.answer),random);
    return {version:VERSION,id:range.id,start,end:start+1,status:'in-progress',remainingMs:DURATION,
      questions:[...selected.map(q=>({...q,type:'select'})),...typed.map(q=>({...q,type:'type'}))],
      bank,answers:Array(15).fill(''),updatedAt:Date.now()};
  }
  function grade(exam) {
    const checks = exam.questions.map((question,index)=>normalize(exam.answers[index])===normalize(question.answer));
    return {checks,score:checks.filter(Boolean).length,total:exam.questions.length};
  }
  function validSaved(exam, id) {
    return exam?.version===VERSION && exam.id===id && Array.isArray(exam.questions) && exam.questions.length===15 &&
      Array.isArray(exam.answers) && exam.answers.length===15 && exam.answers.every(value=>typeof value==='string') &&
      Array.isArray(exam.bank) && exam.bank.length===12 && exam.bank.every(value=>typeof value==='string' && normalize(value)) && new Set(exam.bank.map(normalize)).size===12 &&
      exam.questions.every((q,i)=>typeof q.sentence==='string' && typeof q.answer==='string' && normalize(q.answer) && q.type===(i<8?'select':'type') && (i>=8 || exam.bank.includes(q.answer))) &&
      ['in-progress','completed'].includes(exam.status) && Number.isFinite(exam.remainingMs) && exam.remainingMs>=0 && exam.remainingMs<=DURATION;
  }
  function bookData(data) {
    const filled=v=>v.sentence.replace('_____',v.word==='DNA'?'DNA':v.sentence.startsWith('_____')?v.answer[0].toUpperCase()+v.answer.slice(1):v.answer);
    return Object.fromEntries(listRanges(data).filter(range=>range.ready).map(range=>[range.id,{entries:questionPool(range.start,data).map(q=>({word:q.word,meaning:q.meaning,definition:q.definition,forms:[q.word,q.answer],sentence:(data[String(q.unit)] || []).find(item=>item.word===q.word)?.sentence || '',examples:questionVariants(q).map(filled)}))}]));
  }

  function create({root,getData,getProgress,saveProgress,onOpen,onClose,onCountdown=()=>{},now=Date.now}) {
    let exam=null,clock=null,startedAt=null,saveTimer=null,launcher=null,phase='idle',prepareTimer=null,pendingStart=null;
    const timeLeft=()=>exam ? Math.max(0,exam.remainingMs-(startedAt===null?0:now()-startedAt)) : 0;
    function persist() {
      if (!exam) return;
      clearTimeout(saveTimer); saveTimer=null;
      const running=startedAt!==null;
      exam.remainingMs=timeLeft(); startedAt=running && exam.status==='in-progress'?now():null;
      exam.updatedAt=now();
      exam.scrollTop=root.querySelector('.exam-scroll')?.scrollTop || 0;
      const previous=getProgress()[exam.id];
      getProgress()[exam.id]={...previous,exam:JSON.parse(JSON.stringify(exam))};
      const saved=saveProgress();
      const status=root.querySelector('.exam-save-status');
      if (status) status.textContent=saved===false?'保存できませんでした':'この端末に保存済み';
      return saved!==false;
    }
    function stopClock() { if(clock!==null) clearInterval(clock);clock=null; }
    function tick() {
      const timer=root.querySelector('.exam-timer');
      const ms=timeLeft(),seconds=Math.ceil(ms/1000);
      if(timer) {timer.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');timer.classList.toggle('is-urgent',seconds<=60);}
      if(phase==='running' && exam?.status==='in-progress' && ms===0) finish(true);
    }
    function renderLauncher(panel) {
      launcher=panel;
      panel.innerHTML='<div class="dojo-range-heading"><span class="dojo-eyebrow">4000 EEW3</span><h2>Test practice</h2><p>選択 8問 · 入力 7問 · 11分<br>1語につき5問から抽選</p></div><div class="dojo-ranges">'+listRanges(getData()).map(range=>{
        const progress=getProgress()[range.id] || {},saved=progress.exam;
        const resume=validSaved(saved,range.id) && saved.status==='in-progress';
        const review=validSaved(saved,range.id) && saved.status==='completed';
        const level=Math.min(2,progress.perfectClearCount||0);
        return '<article class="dojo-range" data-level="'+level+'"><div><h3>Unit '+range.start+'–'+range.end+'</h3><p>'+(range.ready?(review?'前回 '+grade(saved).score+' / 15':resume?'途中保存あり · '+saved.answers.filter(a=>normalize(a)).length+' / 15':'15 questions'):'教材未追加: Unit '+range.missing.join('・'))+'</p></div><div class="dojo-range-actions"><button type="button" data-exam-start="'+range.start+'" '+(!range.ready?'disabled':'')+' aria-label="Unit '+range.start+'–'+range.end+'を開始">'+(!range.ready?'準備中':'開始')+'</button>'+(review?'<button type="button" class="exam-review-link" data-exam-review="'+range.start+'">復習</button>':'')+'</div></article>';
      }).join('')+'</div>';
    }
    function questionHtml(question,index) {
      const number=index<8?index+1:index-7;
      const value=exam.answers[index] || '';
      const completed=exam.status==='completed';
      const correct=normalize(value)===normalize(question.answer);
      const control=question.type==='select'
        ? '<select id="exam-answer-'+index+'" data-exam-index="'+index+'" '+(completed?'disabled':'')+'><option value="">未解答</option>'+exam.bank.map(word=>'<option value="'+escape(word)+'" '+(value===word?'selected':'')+'>'+escape(word)+'</option>').join('')+'</select>'
        : '<div class="exam-type-control"><input id="exam-answer-'+index+'" data-exam-index="'+index+'" type="text" value="'+escape(value)+'" '+(completed?'readonly':'')+' autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="'+(index<14?'next':'done')+'" maxlength="60" />'+(!completed?'<button type="button" data-exam-save="'+index+'">回答を保存</button>':'')+'</div>';
      return '<div class="exam-question '+(completed?(correct?'exam-correct':'exam-wrong'):'')+'" id="exam-q-'+index+'"><label for="exam-answer-'+index+'" class="exam-sentence"><span class="exam-question-number">'+number+'.</span><span lang="en">'+escape(question.sentence)+'</span></label><div class="exam-answer">'+control+'</div>'+(completed?'<div class="exam-answer-review"><strong>'+(correct?'○ Correct':'× '+(value.trim()?'Incorrect':'未解答'))+'</strong><span>正解: <b lang="en">'+escape(question.answer)+'</b></span><p>'+escape(question.meaning)+'</p></div>':'')+'</div>';
    }
    function render() {
      const completed=exam.status==='completed';
      const result=completed?grade(exam):null;
      root.innerHTML='<header class="exam-header"><div class="exam-toolbar"><span>教材</span><button type="button" data-exam-exit aria-label="Dojoに戻る">終了</button></div><h1 id="dojo-exam-title">Unit '+exam.start+'–'+exam.end+'</h1><div class="exam-timing">'+(completed?'<strong>'+result.score+' / 15</strong><span>RESULT</span>':'<strong class="exam-timer" role="timer"></strong><span>残り時間</span>')+'</div></header>'+
        '<div class="exam-workspace"><aside class="exam-sidebar" aria-label="教材情報"><div class="exam-course">4000 Essential English Words 3<div>4000 EEW3 Unit '+exam.start+'-'+exam.end+' Quiz</div></div><p>制限時間 11 分<br>15 問 / 15 POINTS</p></aside><div class="exam-scroll" tabindex="-1"><div class="exam-paper"><div class="exam-paper-title"><h2 tabindex="-1">4000 EEW3 UNITS '+exam.start+'-'+exam.end+' QUIZ = 15 POINTS</h2>'+(completed?'<p>'+(exam.timedOut?'時間切れで採点しました':'採点結果')+'</p>':'')+'</div>'+
        '<section class="exam-section" id="exam-section-select"><h3 lang="en">SECTION 1: SELECT THE CORRECT WORD FROM THE DROPDOWN LIST ON THE RIGHT TO COMPLETE EACH SENTENCE. (8 points)</h3>'+exam.questions.slice(0,8).map(questionHtml).join('')+'</section>'+
        '<section class="exam-section" id="exam-section-type"><h3 lang="en">SECTION 2: TYPE THE ONE MISSING WORD WITH CORRECT SPELLING TO COMPLETE EACH SENTENCE. (7 points)</h3>'+exam.questions.slice(8).map((q,i)=>questionHtml(q,i+8)).join('')+'</section></div></div></div>'+
        '<footer class="exam-footer"><div>'+(completed?'<span>'+result.score+' / 15 問正解</span>':'<span class="exam-answer-count" aria-live="polite"></span><small class="exam-save-status" role="status"></small>')+'</div><button type="button" class="exam-primary" '+(completed?'data-exam-exit':'data-exam-submit')+'>'+(completed?'Dojoへ戻る':'採点する')+'</button></footer>'+
        '<dialog class="exam-confirm" aria-labelledby="exam-confirm-title"><h2 id="exam-confirm-title">採点しますか？</h2><p class="exam-confirm-message"></p><div><button type="button" data-exam-cancel>戻る</button><button type="button" data-exam-grade>採点する</button></div></dialog>';
      root.insertAdjacentHTML('beforeend','<dialog class="exam-exit-dialog exam-confirm" aria-labelledby="exam-exit-title"><h2 id="exam-exit-title">終了しますか？</h2><p>解答と残り時間を保存して再開できます。保存せず終了すると、この挑戦の解答は破棄されます。</p><p class="exam-exit-error" role="status"></p><div class="exam-dialog-actions"><button type="button" data-exam-keep>問題に戻る</button><button type="button" data-exam-discard>保存せず終了</button><button type="button" data-exam-pause>保存して終了</button></div></dialog>');
      refreshSummary();tick();
    }
    function refreshSummary() {
      if (!exam) return;
      const count=exam.answers.filter(answer=>normalize(answer)).length;
      const label=root.querySelector('.exam-answer-count');
      if(label) label.textContent=count+' / 15 解答済み';
    }
    function launch(start,review=false) {
      if(phase!=='idle')return;
      const range=listRanges(getData()).find(range=>range.start===Number(start));
      if(!range?.ready)return;
      const saved=getProgress()[range.id]?.exam;
      onOpen();root.classList.add('active');document.documentElement.dataset.dojoExam='true';
      pendingStart=range.start;
      if(review && validSaved(saved,range.id) && saved.status==='completed'){
        exam=JSON.parse(JSON.stringify(saved));phase='completed';render();focusPaper();return;
      }
      if(validSaved(saved,range.id) && saved.status==='in-progress'){
        phase='choice';
        root.innerHTML='<div class="exam-stage"><h1 id="dojo-exam-title">Unit '+range.start+'–'+range.end+'</h1><dialog class="exam-start-dialog exam-confirm" aria-labelledby="exam-start-title"><h2 id="exam-start-title">途中保存があります</h2><p>'+saved.answers.filter(a=>normalize(a)).length+' / 15 解答済み。新しく挑戦すると、途中の解答を置き換えます。</p><div class="exam-dialog-actions"><button type="button" data-exam-resume>途中から再開</button><button type="button" data-exam-new>新しく挑戦</button><button type="button" data-exam-back>戻る</button></div></dialog></div>';
        root.querySelector('.exam-start-dialog').showModal();
      }else prepare(false);
    }
    function focusPaper(){
      root.querySelector('.exam-scroll').scrollTop=Math.max(0,Number(exam.scrollTop)||0);
      root.querySelector('.exam-paper-title h2').focus({preventScroll:true});
    }
    function prepare(resume) {
      if(!['idle','choice'].includes(phase))return;
      root.querySelector('.exam-start-dialog')?.close();phase='loading';
      const start=pendingStart;
      root.innerHTML='<div class="exam-stage"><h1 id="dojo-exam-title">Unit '+start+'–'+(start+1)+'</h1><p class="exam-stage-label" role="status">問題を準備しています</p><progress class="exam-load-progress" max="3" value="0" aria-label="問題の準備"></progress><strong class="exam-countdown-number" aria-live="assertive"></strong><button type="button" data-exam-back>キャンセル</button></div>';
      const progress=root.querySelector('.exam-load-progress');
      root.querySelector('[data-exam-back]').focus();
      // Yield between actual preparation steps so slow devices can paint progress.
      prepareTimer=setTimeout(()=>{
        try{
          const data=getData();progress.value=1;
          prepareTimer=setTimeout(()=>{
            try{
              const saved=getProgress()[start+'-'+(start+1)]?.exam;
              exam=resume && validSaved(saved,start+'-'+(start+1))?JSON.parse(JSON.stringify(saved)):buildExam(start,data);
              progress.value=2;
              prepareTimer=setTimeout(()=>{
                if(!validSaved(exam,exam.id)){preparationFailed();return;}
                progress.value=3;progress.hidden=true;phase='countdown';
                root.querySelector('.exam-stage-label').textContent=resume?'途中から再開':'Ready?';
                let count=3;
                const number=root.querySelector('.exam-countdown-number');number.textContent=count;onCountdown(count);
                const step=()=>{
                  if(phase!=='countdown')return;
                  count--;
                  if(count>0){number.textContent=count;onCountdown(count);prepareTimer=setTimeout(step,1000);}
                  else{prepareTimer=null;phase='running';startedAt=now();onCountdown(0);render();focusPaper();if(exam.status==='in-progress'){persist();clock=setInterval(tick,1000);}}
                };
                prepareTimer=setTimeout(step,1000);
              },0);
            }catch{preparationFailed();}
          },0);
        }catch{preparationFailed();}
      },0);
    }
    function preparationFailed(){
      phase='error';exam=null;startedAt=null;
      root.querySelector('.exam-stage-label').textContent='準備できませんでした。戻ってもう一度お試しください。';
      root.querySelector('.exam-load-progress').hidden=true;
    }
    function leave() {
      stopClock();clearTimeout(saveTimer);saveTimer=null;
      clearTimeout(prepareTimer);prepareTimer=null;
      root.querySelector('.exam-confirm')?.close();
      root.querySelector('.exam-exit-dialog')?.close();
      root.classList.remove('active');delete document.documentElement.dataset.dojoExam;
      const id=pendingStart;exam=null;startedAt=null;phase='idle';onClose();
      launcher?.querySelector('[data-exam-start="'+id+'"]')?.focus({preventScroll:true});
    }
    function close() {
      if(phase==='completed' || !exam || ['loading','countdown'].includes(phase)){leave();return;}
      if(phase!=='running')return;
      if(timeLeft()===0){finish(true);return;}
      exam.remainingMs=timeLeft();startedAt=null;phase='exit';stopClock();clearTimeout(saveTimer);saveTimer=null;
      root.querySelector('.exam-exit-dialog').showModal();
    }
    function continueExam(){
      if(phase!=='exit')return;
      root.querySelector('.exam-exit-dialog').close();phase='running';startedAt=now();clock=setInterval(tick,1000);
    }
    function discard(){
      if(phase!=='exit')return;
      const entry=getProgress()[exam.id];const saved=entry?.exam;
      if(entry)delete entry.exam;
      if(saveProgress()===false){
        if(entry)entry.exam=saved;
        root.querySelector('.exam-exit-error').textContent='保存データを削除できませんでした。もう一度お試しください。';return;
      }
      leave();
    }
    function finish(timedOut=false) {
      if(!exam || exam.status==='completed')return;
      timedOut=timedOut || timeLeft()===0;
      exam.remainingMs=timeLeft();startedAt=null;stopClock();clearTimeout(saveTimer);
      exam.status='completed';exam.timedOut=timedOut;
      phase='completed';
      const result=grade(exam),previous=getProgress()[exam.id] || {};
      getProgress()[exam.id]={...previous,perfectClearCount:(previous.perfectClearCount||0)+(result.score===15?1:0),bestScore:Math.max(previous.bestScore||0,result.score)};
      root.querySelector('.exam-confirm')?.close();persist();render();
      root.querySelector('.exam-scroll').scrollTop=0;
      root.querySelector('.exam-paper-title h2').focus({preventScroll:true});
    }
    function updateAnswer(field,immediate=false) {
      if(!exam || exam.status!=='in-progress' || phase!=='running')return;
      if(timeLeft()===0){finish(true);return;}
      const index=Number(field.dataset.examIndex);
      if(!Number.isInteger(index)||index<0||index>=15)return;
      exam.answers[index]=field.value;
      const save=root.querySelector('[data-exam-save="'+index+'"]');if(save)save.textContent='回答を保存';
      refreshSummary();clearTimeout(saveTimer);
      if(immediate)persist();else saveTimer=setTimeout(persist,250);
    }
    root.addEventListener('input',event=>{if(event.target.matches('input[data-exam-index]'))updateAnswer(event.target);});
    root.addEventListener('change',event=>{if(event.target.matches('select[data-exam-index]'))updateAnswer(event.target,true);});
    root.addEventListener('keydown',event=>{
      if(event.key==='Enter' && event.target.matches('input[data-exam-index]')){
        event.preventDefault();updateAnswer(event.target,true);
        const next=Number(event.target.dataset.examIndex)+1;
        root.querySelector('#exam-answer-'+next)?.focus();
      }
    });
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-exam-exit'))close();
      else if(button.hasAttribute('data-exam-back'))leave();
      else if(button.hasAttribute('data-exam-resume'))prepare(true);
      else if(button.hasAttribute('data-exam-new'))prepare(false);
      else if(button.hasAttribute('data-exam-keep'))continueExam();
      else if(button.hasAttribute('data-exam-discard'))discard();
      else if(button.hasAttribute('data-exam-pause')){if(phase==='exit'){if(persist())leave();else root.querySelector('.exam-exit-error').textContent='保存できませんでした。もう一度お試しください。';}}
      else if(button.hasAttribute('data-exam-save')){button.textContent=persist()?'保存済み':'再試行';}
      else if(button.hasAttribute('data-exam-submit')){
        persist();const left=exam.answers.filter(answer=>!normalize(answer)).length;
        root.querySelector('.exam-confirm-message').textContent=left?left+'問が未解答です。空欄は不正解になります。':'15問の解答を採点します。';
        root.querySelector('.exam-confirm').showModal();
      }else if(button.hasAttribute('data-exam-cancel'))root.querySelector('.exam-confirm').close();
      else if(button.hasAttribute('data-exam-grade'))finish();
    });
    root.addEventListener('cancel',event=>{
      if(event.target.matches('.exam-exit-dialog')){event.preventDefault();continueExam();}
      else if(event.target.matches('.exam-start-dialog')){event.preventDefault();leave();}
    },true);
    window.addEventListener('pagehide',()=>{if(exam?.status==='in-progress' && ['running','exit'].includes(phase))persist();});
    return {renderLauncher,launch,close};
  }
  window.DojoExam={DURATION,listRanges,questionPool,questionVariants,buildExam,grade,validSaved,bookData,create};
})();
