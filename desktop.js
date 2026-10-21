/* Desktop enhancements are gated by viewport and pointing capabilities, not user-agent strings. */
(() => {
  'use strict';
  const QUERY = '(min-width: 960px) and (hover: hover) and (pointer: fine)';
  function move(index, key, count, columns = 2) {
    if (index < 0) return 0;
    if (key === 'ArrowLeft') return index % columns ? index - 1 : index;
    if (key === 'ArrowRight') return index % columns < columns - 1 && index + 1 < count ? index + 1 : index;
    if (key === 'ArrowUp') return Math.max(0, index - columns);
    if (key === 'ArrowDown') return index + columns < count ? index + columns : index;
    return index;
  }
  function create({session,checkpoint,confirm,next}) {
    const media = window.matchMedia(QUERY);
    const answer = document.getElementById('desktop-answer');
    const content = document.getElementById('quiz-content');
    const buttons = () => [...content.querySelectorAll('.choice-btn')];
    const quizActive = () => document.getElementById('screen-quiz').classList.contains('active');
    const blocked = () => document.querySelector('.modal-overlay.open, dialog[open], .debug-panel[open]') ||
      !document.getElementById('quiz-countdown').hidden;
    function refresh() {
      const s = session();
      const choices = buttons();
      answer.disabled = !s || s.answeredCurrent || !Number.isInteger(s.selectedChoice) || !choices.length;
      answer.parentElement.hidden = !!content.querySelector('input');
      choices.forEach((button, i) => {
        button.classList.toggle('selected', s?.selectedChoice === i);
        button.setAttribute('aria-pressed', String(s?.selectedChoice === i));
        button.dataset.shortcut = String(i + 1);
      });
    }
    function select(index, focus = false) {
      const s = session(), choices = buttons();
      if (!s || s.answeredCurrent || blocked() || !choices[index]) return;
      s.selectedChoice = index;
      refresh(); checkpoint();
      if (focus) choices[index].focus({preventScroll:true});
      choices[index].scrollIntoView({block:'nearest',inline:'nearest'});
    }
    answer.addEventListener('click', () => {
      if (media.matches && !blocked() && !answer.disabled) { confirm(); refresh(); }
    });
    document.addEventListener('keydown', event => {
      if (!media.matches || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (blocked()) {
        const dialog = target.closest('dialog[open], .modal-overlay.open');
        if (dialog && !target.closest('input,textarea,select') && event.key.startsWith('Arrow')) {
          const items = [...dialog.querySelectorAll('button:not(:disabled)')].filter(item=>item.getClientRects().length);
          const index = items.indexOf(target);
          if (index >= 0) {
            event.preventDefault(); event.stopPropagation();
            const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
            items[Math.max(0,Math.min(items.length-1,index+delta))]?.focus();
          }
        }
        // Native dialogs and the existing modal focus trap retain ownership.
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        return;
      }
      const s = session();
      const inQuiz = quizActive() && s && !s.finished;
      if (inQuiz && event.key === 'Escape') {
        event.preventDefault();
        if (!event.repeat) document.getElementById('quiz-close-btn').click();
        return;
      }
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
      const inAnswers = target === content || !!target.closest('.choice-btn, .desktop-quiz-actions');
      if (inQuiz && document.getElementById('check-sheet').classList.contains('open')) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) next();
        }
        return;
      }
      if (inQuiz && inAnswers && buttons().length) {
        const keyIndex = /^[1-4]$/.test(event.key) ? Number(event.key) - 1 : null;
        if (keyIndex !== null || event.key.startsWith('Arrow')) {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) select(keyIndex ?? move(s.selectedChoice ?? -1,event.key,buttons().length),true);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat && !answer.disabled) { confirm(); refresh(); }
          return;
        }
      }
      // Keep arrows local to the focused list; never consume ordinary page scrolling.
      const group = target.closest('.face-tabs, .tango-sources, .units-list, .tango-units, .desktop-book-nav, .dojo-ranges, .mode-options');
      if (!group || !event.key.startsWith('Arrow')) return;
      const selector = group.matches('.dojo-ranges') ? '[data-exam-start]:not(:disabled)' : 'button:not(:disabled), .unit-row';
      const items = [...group.querySelectorAll(selector)].filter(item => item.getClientRects().length);
      const current = items.findIndex(item => item === target || item.contains(target));
      if (current < 0) return;
      event.preventDefault();
      const columns = group.matches('.face-tabs, .tango-sources, .desktop-book-nav, .mode-options') ? 1 : 2;
      const horizontal = group.matches('.tango-sources');
      const key = horizontal ? ({ArrowLeft:'ArrowUp',ArrowRight:'ArrowDown'}[event.key] || event.key) :
        group.matches('.face-tabs') ? ({ArrowLeft:'ArrowUp',ArrowRight:'ArrowDown'}[event.key] || event.key) : event.key;
      const item = items[move(current,key,items.length,columns)];
      item?.focus({preventScroll:true}); item?.scrollIntoView({block:'nearest',inline:'nearest'});
    }, true);
    media.addEventListener('change', refresh);
    refresh();
    return {enabled:()=>media.matches,select,refresh};
  }
  window.DesktopUI = {create,move,QUERY};
})();
