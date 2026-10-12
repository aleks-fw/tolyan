// Подсказки адреса под полем ввода (OpenStreetMap через Photon). Если сервис недоступен, поле работает как обычное.
(function () {
  'use strict';
  var T = window.Tolyan, el = T.ui.el, S = T.suggest;
  var seq = 0;

  // enabled(): вернуть false, чтобы отключить (настройка в админке)
  function attach(input, enabled) {
    var wrap = el('div', { class: 'suggest-wrap' });
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var listId = 'suggest-' + (++seq);
    var list = el('ul', { class: 'suggest-list', id: listId, role: 'listbox', hidden: true });
    wrap.appendChild(list);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    var items = [], active = -1, timer = null, ctrl = null, lastQuery = '', cache = {};

    function close() {
      list.hidden = true; input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant'); active = -1;
    }
    function setActive(i) {
      var nodes = list.children;
      for (var k = 0; k < nodes.length; k++) nodes[k].setAttribute('aria-selected', k === i ? 'true' : 'false');
      active = i;
      if (i >= 0) { input.setAttribute('aria-activedescendant', nodes[i].id); nodes[i].scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function choose(i) {
      if (i < 0 || i >= items.length) return;
      input.value = items[i].label;
      input.dispatchEvent(new Event('input', { bubbles: true }));   // сбросить ошибку поля
      lastQuery = input.value;
      close();
    }
    function show(found) {
      items = found;
      if (!items.length) { close(); return; }
      list.replaceChildren.apply(list, items.map(function (it, i) {
        var li = el('li', { class: 'suggest-item', role: 'option', id: listId + '-' + i, 'aria-selected': 'false', text: it.label });
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });   // до blur поля
        return li;
      }));
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
    }

    // Строка состояния («Ищем...», «Не удалось...») вместо вариантов.
    function status(text) {
      items = [];
      list.replaceChildren(el('li', { class: 'suggest-status', role: 'status', text: text }));
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); active = -1;
    }

    // Публичный Photon иногда отвечает 5-8 секунд, поэтому ждём до 15 и показываем, что идёт поиск.
    function search(q) {
      if (cache[q]) { show(cache[q]); return; }
      if (ctrl) ctrl.abort();
      var mine = ctrl = new AbortController();
      var abortTimer = setTimeout(function () { mine.abort(); }, 15000);
      status('Ищем адреса...');
      fetch(S.buildUrl(q, 6), { signal: mine.signal, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (json) {
          clearTimeout(abortTimer);
          var found = S.parse(json);
          cache[q] = found;
          if (input.value.trim() !== q || document.activeElement !== input) return;
          if (found.length) show(found); else status('Ничего не найдено. Введите адрес вручную.');
        })
        .catch(function (err) {
          clearTimeout(abortTimer);
          if (mine !== ctrl) return;            // запрос заменён более новым
          if (input.value.trim() === q && document.activeElement === input) status('Подсказки недоступны. Введите адрес вручную.');
        });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (!enabled() || q.length < S.MIN_CHARS || q === lastQuery) { if (q.length < S.MIN_CHARS) close(); return; }
      timer = setTimeout(function () { lastQuery = q; search(q); }, 350);
    });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (!items.length) { if (e.key === 'Escape') { e.stopPropagation(); close(); } return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
  }

  T.addressSuggest = { attach: attach };
})();
