/* EEW3 practice papers: eight dropdown questions and seven spelling questions. */
(() => {
  'use strict';
  const DURATION = 11 * 60 * 1000;
  const VERSION = 1;
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
    const selected = shuffle(groups.flatMap(group=>group.splice(0,4)),random);
    const typed = shuffle([...groups[0].splice(0,4),...groups[1].splice(0,3)],random);
    const used = new Set([...selected,...typed].map(q=>normalize(q.word)));
    const distractors = shuffle(questionPool(start,data).filter(q=>!used.has(normalize(q.word))),random).slice(0,4);
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
    return Object.fromEntries(listRanges(data).filter(range=>range.ready).map(range=>[range.id,{entries:questionPool(range.start,data).map(q=>({word:q.word,meaning:q.meaning,definition:q.definition,sentence:(data[String(q.unit)] || []).find(item=>item.word===q.word)?.sentence || ''}))}]));
  }

  function create({root,getData,getProgress,saveProgress,onOpen,onClose,now=Date.now}) {
    let exam=null,clock=null,startedAt=null,saveTimer=null,launcher=null;
    const timeLeft=()=>exam ? Math.max(0,exam.remainingMs-(startedAt===null?0:now()-startedAt)) : 0;
    function persist() {
      if (!exam) return;
      clearTimeout(saveTimer); saveTimer=null;
      exam.remainingMs=timeLeft(); startedAt=exam.status==='in-progress'?now():null;
      exam.updatedAt=now();
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
      if(exam?.status==='in-progress' && ms===0) finish(true);
    }
    function renderLauncher(panel) {
      launcher=panel;
      panel.innerHTML='<div class="dojo-range-heading"><span class="dojo-eyebrow">4000 EEW3</span><h2>Test practice</h2><p>選択 8問 · 入力 7問 · 11分</p></div><div class="dojo-ranges">'+listRanges(getData()).map(range=>{
        const progress=getProgress()[range.id] || {},saved=progress.exam;
        const resume=validSaved(saved,range.id) && saved.status==='in-progress';
        const review=validSaved(saved,range.id) && saved.status==='completed';
        const level=Math.min(2,progress.perfectClearCount||0);
        return '<article class="dojo-range" data-level="'+level+'"><div><h3>Unit '+range.start+'–'+range.end+'</h3><p>'+(range.ready?(review?'前回 '+grade(saved).score+' / 15':resume?'途中から再開':'15 questions'):'教材未追加: Unit '+range.missing.join('・'))+'</p></div><div class="dojo-range-actions"><button type="button" data-exam-start="'+range.start+'" '+(!range.ready?'disabled':'')+' aria-label="Unit '+range.start+'–'+range.end+(resume?'を再開':'を開始')+'">'+(!range.ready?'準備中':resume?'再開':'開始')+'</button>'+(review?'<button type="button" class="exam-review-link" data-exam-review="'+range.start+'">復習</button>':'')+'</div></article>';
      }).join('')+'</div><p class="dojo-source-note">登録済みの単語・例文から作成した練習問題です。Unit 28〜30は教材追加後に利用できます。</p>';
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
      root.innerHTML='<header class="exam-header"><button type="button" data-exam-exit aria-label="Dojoに戻る">‹ Dojo</button><div><span>4000 EEW3</span><h1 id="dojo-exam-title">Unit '+exam.start+'–'+exam.end+'</h1></div><div class="exam-timing">'+(completed?'<strong>'+result.score+' / 15</strong><span>RESULT</span>':'<strong class="exam-timer" role="timer"></strong><span>残り時間</span>')+'</div></header>'+
        '<div class="exam-scroll" tabindex="-1"><div class="exam-paper"><div class="exam-paper-title"><h2 tabindex="-1">4000 EEW3 UNITS '+exam.start+'–'+exam.end+' QUIZ = 15 POINTS</h2><p>'+(completed?(exam.timedOut?'時間切れで採点しました':'採点結果'):'空欄に当てはまる単語を解答してください')+'</p></div>'+
        '<section class="exam-section" id="exam-section-select"><header><span>SECTION 1</span><h3>Select the correct word</h3><small>8 points</small></header><p class="exam-instructions" lang="en">SELECT THE CORRECT WORD FROM THE DROPDOWN LIST TO COMPLETE EACH SENTENCE.</p>'+exam.questions.slice(0,8).map(questionHtml).join('')+'</section>'+
        '<section class="exam-section" id="exam-section-type"><header><span>SECTION 2</span><h3>Type the missing word</h3><small>7 points</small></header><p class="exam-instructions" lang="en">TYPE ONE MISSING WORD WITH CORRECT SPELLING TO COMPLETE EACH SENTENCE.</p>'+exam.questions.slice(8).map((q,i)=>questionHtml(q,i+8)).join('')+'</section></div></div>'+
        '<footer class="exam-footer"><div>'+(completed?'<span>'+result.score+' / 15 問正解</span>':'<span class="exam-answer-count" aria-live="polite"></span><small class="exam-save-status" role="status"></small>')+'</div><button type="button" class="exam-primary" '+(completed?'data-exam-exit':'data-exam-submit')+'>'+(completed?'Dojoへ戻る':'採点する')+'</button></footer>'+
        '<dialog class="exam-confirm" aria-labelledby="exam-confirm-title"><h2 id="exam-confirm-title">採点しますか？</h2><p class="exam-confirm-message"></p><div><button type="button" data-exam-cancel>戻る</button><button type="button" data-exam-grade>採点する</button></div></dialog>';
      refreshSummary();tick();
    }
    function refreshSummary() {
      if (!exam) return;
      const count=exam.answers.filter(answer=>normalize(answer)).length;
      const label=root.querySelector('.exam-answer-count');
      if(label) label.textContent=count+' / 15 解答済み';
    }
    function launch(start,review=false) {
      const range=listRanges(getData()).find(range=>range.start===Number(start));
      if(!range?.ready)return;
      stopClock();
      const saved=getProgress()[range.id]?.exam;
      exam=validSaved(saved,range.id) && (review || saved.status==='in-progress')?JSON.parse(JSON.stringify(saved)):buildExam(range.start,getData());
      startedAt=exam.status==='in-progress'?now():null;
      onOpen();root.classList.add('active');document.documentElement.dataset.dojoExam='true';
      render();
      if(exam.status==='in-progress'){persist();clock=setInterval(tick,1000);}
      root.querySelector('.exam-scroll').scrollTop=0;
      root.querySelector('.exam-paper-title h2').focus({preventScroll:true});
    }
    function close() {
      if(!exam)return;
      if(exam.status==='in-progress')persist();
      stopClock();clearTimeout(saveTimer);saveTimer=null;
      root.querySelector('.exam-confirm')?.close();
      root.classList.remove('active');delete document.documentElement.dataset.dojoExam;
      const id=exam.start;exam=null;startedAt=null;onClose();
      launcher?.querySelector('[data-exam-start="'+id+'"]')?.focus({preventScroll:true});
    }
    function finish(timedOut=false) {
      if(!exam || exam.status==='completed')return;
      timedOut=timedOut || timeLeft()===0;
      exam.remainingMs=timeLeft();startedAt=null;stopClock();clearTimeout(saveTimer);
      exam.status='completed';exam.timedOut=timedOut;
      const result=grade(exam),previous=getProgress()[exam.id] || {};
      getProgress()[exam.id]={...previous,perfectClearCount:(previous.perfectClearCount||0)+(result.score===15?1:0),bestScore:Math.max(previous.bestScore||0,result.score)};
      root.querySelector('.exam-confirm')?.close();persist();render();
      root.querySelector('.exam-scroll').scrollTop=0;
      root.querySelector('.exam-paper-title h2').focus({preventScroll:true});
    }
    function updateAnswer(field,immediate=false) {
      if(!exam || exam.status!=='in-progress')return;
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
      else if(button.hasAttribute('data-exam-save')){button.textContent=persist()?'保存済み':'再試行';}
      else if(button.hasAttribute('data-exam-submit')){
        persist();const left=exam.answers.filter(answer=>!normalize(answer)).length;
        root.querySelector('.exam-confirm-message').textContent=left?left+'問が未解答です。空欄は不正解になります。':'15問の解答を採点します。';
        root.querySelector('.exam-confirm').showModal();
      }else if(button.hasAttribute('data-exam-cancel'))root.querySelector('.exam-confirm').close();
      else if(button.hasAttribute('data-exam-grade'))finish();
    });
    window.addEventListener('pagehide',()=>{if(exam?.status==='in-progress')persist();});
    return {renderLauncher,launch,close};
  }
  window.DojoExam={DURATION,listRanges,questionPool,buildExam,grade,validSaved,bookData,create};
})();
