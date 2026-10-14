(() => {
  'use strict';
  if (location.hash !== '#debug' && new URLSearchParams(location.search).get('debug') !== '1') return;
  let tools;
  window.dispatchEvent(new CustomEvent('vocx-debug-connect', {detail: {connect: api => tools = api}}));
  if (!tools) return;
  const style = document.createElement('style');
  style.textContent = `
    .debug-toggle { position: fixed; top: 8px; right: 12px; z-index: 80; min-height: 44px; padding: 6px 12px; border: 1px dashed var(--text-muted); border-radius: 12px; background: var(--bg-dark); color: var(--text-light); cursor: pointer; }
    body:has(#screen-quiz.active, #screen-results.active) .debug-toggle { top: 50%; right: 0; transform: translateY(-50%); writing-mode: vertical-rl; width: 32px; padding: 10px 4px; }
    .debug-panel { width: min(440px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto; padding: 20px; border: 1px solid var(--border-grey); border-radius: 20px; background: var(--bg-dark); color: var(--text-light); touch-action: pan-y pinch-zoom; }
    .debug-panel::backdrop { background: #0009; }
    .debug-panel h2 { font-size: 20px; margin: 0 0 12px; }
    .debug-panel p, .debug-panel label { font-size: 14px; line-height: 1.5; }
    .debug-panel select, .debug-panel button, .debug-panel input:not([type=checkbox]), .debug-panel textarea { width: 100%; min-height: 44px; margin: 8px 0; padding: 8px 12px; border: 1px solid var(--border-grey); border-radius: 12px; background: var(--surface-btn); color: var(--text-light); font-size: 15px; }
    .debug-panel input[type=checkbox] { width: 20px; height: 20px; vertical-align: middle; margin: 12px 8px 12px 0; accent-color: var(--pink-accent); }
    .debug-panel details { border-top: 1px solid var(--border-grey); margin-top: 12px; padding-top: 12px; }
    .debug-panel summary { min-height: 44px; cursor: pointer; font-size: 16px; font-weight: 700; }
    .debug-panel textarea { min-height: 100px; resize: vertical; user-select: text; }
    .debug-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    #debug-status { overflow-wrap: anywhere; color: var(--text-muted); }
  `;
  document.head.appendChild(style);
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'debug-toggle'; toggle.textContent = 'デバッグ';
  const panel = document.createElement('dialog');
  panel.className = 'debug-panel';
  panel.innerHTML = `<h2>開発テスト</h2><p>テスト中はすべてメモリ内で動作します。実際の学習履歴・設定には保存しません。再読み込みで元に戻ります。</p>
    <p id="debug-status" role="status"></p>
    <label>コンテンツ<select id="debug-face"><option value="vocx">Vocx</option><option value="dojo">Dojo</option></select></label>
    <label>対象ユニット<select id="debug-unit"></select></label>
    <details open><summary>進捗・色・回数</summary>
      <select id="debug-state"><option value="0">未挑戦</option><option value="nice">通常クリア</option><option value="1">全問正解1回・緑</option><option value="2">全問正解2回・黄色</option><option value="custom">任意の全問正解回数</option></select>
      <label>全問正解回数<input id="debug-count" type="number" min="0" max="9999" value="0"></label>
      <label><input id="debug-all" type="checkbox">全ユニットに適用</label>
      <button id="debug-apply" data-action="progress" type="button">進捗を適用</button>
    </details>
    <details open><summary>クイズ・回答・途中保存</summary>
      <label>出題形式<select id="debug-mode"></select></label>
      <label>問題数（0で通常の問題数）<input id="debug-questions" type="number" min="0" max="100" value="0"></label>
      <label><input id="debug-skip-countdown" type="checkbox">カウントダウンを省略</label>
      <button data-action="start" type="button">テスト用クイズを開始</button>
      <div class="debug-actions"><button data-action="correct" type="button">正解にする</button><button data-action="wrong" type="button">不正解にする</button><button data-action="next" type="button">次の問題</button><button data-action="pause" type="button">一時停止する</button><button data-action="resume" type="button">途中から再開</button><button data-action="home" type="button">ホームへ</button></div>
      <label>移動する問題番号<input id="debug-question" type="number" min="1" value="1"></label><button data-action="jump" type="button">問題へ移動（回答記録リセット）</button>
      <label>クイズの経過秒数<input id="debug-time" type="number" min="0" value="60"></label><button data-action="time" type="button">経過時間を変更</button>
    </details>
    <details><summary>結果画面</summary><p>現在のクイズからテスト結果を作ります。クイズがない場合は上の設定で開始します。</p>
      <label>合計解答時間（秒）<input id="debug-total-time" type="number" min="0" value="120"></label>
      <button data-action="perfect" type="button">全問正解の結果</button><button data-action="half" type="button">半分正解の結果</button><button data-action="all-wrong" type="button">全問不正解・長い誤答一覧</button>
    </details>
    <details><summary>効果音・設定・プロフィール</summary>
      <select id="debug-sound"><option value="tap">ボタン</option><option value="slide">一時停止</option><option value="correct">正解</option><option value="wrong">不正解</option><option value="countdown">カウントダウン・低いド</option><option value="countdownStart">スタート・高いド</option></select><button data-action="sound" type="button">効果音を再生</button>
      <label><input id="debug-hint" type="checkbox">頭文字ヒント</label><br><label><input id="debug-sound-on" type="checkbox">効果音オン</label>
      <label>名前<input id="debug-name" maxlength="20"></label><button data-action="settings" type="button">テスト用設定を適用</button><button data-action="mypage" type="button">マイページを見る</button>
    </details>
    <details><summary>長文・データ確認</summary><label>現在の問題文<textarea id="debug-prompt" placeholder="長い文章を入れてレイアウトを確認"></textarea></label><button data-action="prompt" type="button">問題文を差し替える</button><button data-action="inspect" type="button">状態を確認（正解も表示）</button><textarea id="debug-inspect" readonly aria-label="テスト状態"></textarea></details>
    <button data-action="empty" type="button">テストデータを初期化</button><button id="debug-reset" data-action="reset" type="button">実データに戻す（テストをリセット）</button><button id="debug-close" data-action="close" type="button">閉じる</button>`;
  document.body.append(toggle, panel);
  const el = id => panel.querySelector('#debug-' + id);
  function modes() { el('mode').replaceChildren(...tools.modes(el('face').value, el('unit').value).map(mode => new Option(mode.label, mode.id))); }
  function units() { el('unit').replaceChildren(...tools.units(el('face').value).map(id => new Option('Unit ' + id, id))); modes(); }
  function refresh() {
    const info = tools.inspect();
    el('status').textContent = info.session ? `${info.session.finished ? '結果表示中' : 'クイズ中'}：${info.session.question} / ${info.session.total} 問目、正解 ${info.session.correct} 問` : 'ホーム／マイページ（保存先：メモリ）';
    el('hint').checked = info.state.settings.initialHint; el('sound-on').checked = info.state.settings.soundEffects; el('name').value = info.state.profileName;
    el('inspect').value = JSON.stringify(info, null, 2);
  }
  el('face').value = document.documentElement.dataset.face || 'vocx'; units();
  el('face').addEventListener('change', units); el('unit').addEventListener('change', modes);
  el('state').addEventListener('change', () => {if (/^\d+$/.test(el('state').value)) el('count').value = el('state').value;});
  el('count').addEventListener('input', () => el('state').value = 'custom');
  const config = () => ({face: el('face').value, unitId: el('unit').value, mode: el('mode').value, questions: el('questions').value, skipCountdown: el('skip-countdown').checked});
  toggle.addEventListener('click', () => {refresh(); panel.showModal();});
  panel.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    try {
      const cfg = config();
      switch (action) {
        case 'progress': tools.progress({...cfg, count: el('state').value === 'nice' || el('state').value === '0' ? 0 : el('count').value, cleared: el('state').value !== '0', all: el('all').checked}); break;
        case 'start': tools.start(cfg); break;
        case 'correct': tools.answer(true); break;
        case 'wrong': tools.answer(false); break;
        case 'next': tools.next(); break;
        case 'jump': tools.jump(el('question').value); break;
        case 'time': tools.time(el('time').value); break;
        case 'pause': tools.pause(); break;
        case 'resume': tools.resume(cfg.face, cfg.unitId); break;
        case 'home': tools.home(); break;
        case 'perfect': case 'half': case 'all-wrong':
          if (!tools.inspect().session || tools.inspect().session.finished) tools.start(cfg);
          tools.results(action === 'perfect' ? 1 : action === 'half' ? .5 : 0, el('total-time').value); break;
        case 'sound': tools.sound(el('sound').value); refresh(); return;
        case 'settings': tools.settings({hint: el('hint').checked, sound: el('sound-on').checked, name: el('name').value}); break;
        case 'mypage': tools.view('mypage'); break;
        case 'prompt': if (!el('prompt').value.trim()) throw new Error('問題文を入力してください'); tools.prompt(el('prompt').value); break;
        case 'inspect': refresh(); return;
        case 'reset': tools.reset(); break;
        case 'empty': tools.reset(true); break;
        case 'close': break;
      }
      panel.close();
    } catch (error) {el('status').textContent = error.message;}
  });
})();
