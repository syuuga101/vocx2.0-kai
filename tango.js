/* Unit vocabulary browser; data comes from the same source as each quiz. */
(() => {
  'use strict';
  function getEntries(source, unitId, vocx, dojo) {
    if (source === 'vocx') {
      return (vocx[unitId] || []).map(item => ({
        word: item.word, meaning: item.jpn || item.def || '',
        definition: item.def || '', sentence: item.sentence || ''
      }));
    }
    if (Array.isArray(dojo[unitId]?.entries)) return dojo[unitId].entries;
    const entries = [];
    const seen = new Set();
    for (const part of Object.values(dojo[unitId] || {})) {
      for (const section of part.sections || []) {
        for (const question of section.questions || []) {
          const word = typeof question.answer === 'string' ? question.answer : question.choices?.[question.answer];
          if (!word) continue;
          const meaning = question.explanation || (section.type === 'matching' ? question.text : '') || '';
          const key = word.toLowerCase() + '\n' + meaning;
          if (seen.has(key)) continue;
          seen.add(key);
          entries.push({ word, meaning, definition: section.type === 'matching' ? question.text || '' : '', sentence: section.type === 'matching' ? '' : question.text || '' });
        }
      }
    }
    return entries;
  }

  function create(panel, { getVocxData, getDojoData }) {
    let source = 'vocx', unitId = null, query = '', hideMeaning = false;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const entries = () => getEntries(source, unitId, getVocxData(), getDojoData());

    function renderItems() {
      const list = panel.querySelector('.tango-entries');
      if (!list) return;
      const all = entries();
      const needle = query.trim().toLocaleLowerCase();
      const filtered = all.filter(item => [item.word, item.meaning, item.definition, item.sentence].some(value => value.toLocaleLowerCase().includes(needle)));
      panel.querySelector('.tango-count').textContent = filtered.length + ' / ' + all.length;
      list.innerHTML = filtered.length ? filtered.map((item, index) => `<article class="tango-entry">
        <span class="tango-entry-number" aria-hidden="true">${index + 1}</span>
        <div class="tango-entry-copy"><h3 lang="en">${escape(item.word)}</h3>
          ${hideMeaning ? `<details class="tango-meaning"><summary>意味を見る</summary><p>${escape(item.meaning)}</p></details>` : `<p class="tango-meaning">${escape(item.meaning)}</p>`}
          ${(item.definition && item.definition !== item.meaning) || item.sentence ? `<details class="tango-example"><summary>例文・解説</summary>${item.definition && item.definition !== item.meaning ? `<p lang="en">${escape(item.definition)}</p>` : ''}${item.sentence ? `<p lang="en">${escape(item.sentence)}</p>` : ''}</details>` : ''}
        </div></article>`).join('') : '<p class="tango-empty" role="status">該当する単語がありません</p>';
    }

    function render() {
      panel.innerHTML = `<div class="tango-sources" role="group" aria-label="単語帳の教材">
        <button type="button" data-tango-source="vocx" aria-pressed="${source === 'vocx'}">Vocx</button>
        <button type="button" data-tango-source="dojo" aria-pressed="${source === 'dojo'}">Dojo</button>
      </div>`;
      if (unitId === null) {
        const data = source === 'vocx' ? getVocxData() : getDojoData();
        const ids = Object.keys(data).sort((a,b) => parseInt(a,10) - parseInt(b,10));
        panel.insertAdjacentHTML('beforeend', `<h2 class="tango-heading">単語帳</h2><div class="tango-units">${ids.map(id => {
          const count = getEntries(source, id, getVocxData(), getDojoData()).length;
          return `<button type="button" class="tango-unit" data-tango-unit="${escape(id)}"><span>Unit ${escape(id)}</span><small>${count} ${source === 'vocx' ? 'words' : 'items'}</small><span aria-hidden="true">›</span></button>`;
        }).join('') || '<p class="tango-empty">単語帳はまだありません</p>'}</div>`);
      } else {
        panel.insertAdjacentHTML('beforeend', `<div class="tango-book-heading"><button type="button" class="tango-back" data-tango-back aria-label="Unit一覧に戻る">‹ Units</button><h2>Unit ${escape(unitId)}</h2><span class="tango-count" aria-live="polite"></span></div>
          <div class="tango-tools"><label class="tango-search-label"><span class="sr-only">単語・意味を検索</span><input class="tango-search" type="search" placeholder="単語・意味を検索" value="${escape(query)}" autocomplete="off" /></label>
          <button type="button" class="tango-hide" data-tango-hide aria-pressed="${hideMeaning}">意味を隠す</button></div>
          <div class="tango-entries"></div>`);
        renderItems();
      }
    }
    function scrollTop() { panel.closest('.units-scroll').scrollTop = 0; }
    panel.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target || !panel.contains(target)) return;
      if (target.dataset.tangoSource) {
        source = target.dataset.tangoSource; unitId = null; query = ''; render(); scrollTop();
        panel.querySelector('[data-tango-source="' + source + '"]').focus({preventScroll: true});
      } else if (target.dataset.tangoUnit) {
        unitId = target.dataset.tangoUnit; query = ''; render(); scrollTop();
        panel.querySelector('.tango-back').focus({preventScroll: true});
      } else if (target.hasAttribute('data-tango-back')) {
        const previousUnit = unitId; unitId = null; query = ''; render(); scrollTop();
        [...panel.querySelectorAll('[data-tango-unit]')].find(button => button.dataset.tangoUnit === previousUnit)?.focus({preventScroll: true});
      } else if (target.hasAttribute('data-tango-hide')) {
        hideMeaning = !hideMeaning; target.setAttribute('aria-pressed', String(hideMeaning)); renderItems();
      }
    });
    panel.addEventListener('input', event => {
      if (!event.target.matches('.tango-search')) return;
      query = event.target.value; renderItems();
    });
    return { render };
  }
  window.TangoBook = { getEntries, create };
})();
