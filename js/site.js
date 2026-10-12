// Логика публичной страницы: настройки, каталог, навигация.
(function () {
  'use strict';
  var T = window.Tolyan, ui = T.ui, el = ui.el, calc = T.calc, store = T.store;

  var STATUS = {
    available: { label: 'Свободна', cls: 'badge-ok' },
    busy: { label: 'Занята', cls: 'badge-warn' },
    service: { label: 'На обслуживании', cls: 'badge-danger' }
  };

  function setText(selector, value) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = value;
  }

  function applySettings(s) {
    var nodes = document.querySelectorAll('[data-setting]');
    for (var i = 0; i < nodes.length; i++) {
      var v = s[nodes[i].getAttribute('data-setting')];
      if (typeof v === 'string' && v) nodes[i].textContent = v;
    }
    document.title = s.company_name + ': ' + (s.tagline || '').toLowerCase();
    var hero = document.getElementById('hero-image');
    if (hero && s.hero_image) hero.src = s.hero_image;
    renderAdvantages(s.advantages || []);
    renderContacts(s);
  }

  function renderAdvantages(items) {
    var grid = document.getElementById('adv-grid');
    grid.replaceChildren.apply(grid, items.slice(0, 4).map(function (a) {
      return el('article', { class: 'adv-item reveal' }, [el('h3', { text: a.title }), el('p', { text: a.text })]);
    }));
    ui.reveal(grid);
  }

  function renderContacts(s) {
    var list = document.getElementById('contact-list');
    var rows = [];
    var phone = T.validate.normalizePhone(s.phone);
    if (s.phone) rows.push(['Телефон', phone ? el('a', { href: 'tel:' + phone, text: s.phone }) : s.phone]);
    var tg = T.validate.telegramUsername(s.telegram_username);
    if (tg) rows.push(['Telegram', el('a', { href: 'https://t.me/' + tg, target: '_blank', rel: 'noopener', text: '@' + tg })]);
    if (s.email) rows.push(['Почта', el('a', { href: 'mailto:' + s.email, text: s.email })]);
    if (s.address) rows.push(['Адрес', s.address]);
    if (s.work_hours) rows.push(['Режим работы', s.work_hours]);
    list.replaceChildren.apply(list, rows.map(function (r) {
      return el('div', { class: 'contact-item' }, [el('dt', { text: r[0] }), el('dd', null, [r[1]])]);
    }));
  }

  function emptyState(text) { return el('div', { class: 'empty-state', text: text }); }

  function truckCard(t) {
    var st = STATUS[t.status] || STATUS.service;
    var free = t.status === 'available';
    var meta = [t.body, t.capacity_t ? calc.formatNumber(t.capacity_t) + ' т' : ''].filter(Boolean).join(', ');
    var btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', 'data-book-truck': t.id,
                             disabled: !free, text: free ? 'Забронировать' : 'Недоступна' });
    return el('article', { class: 'card is-hoverable truck-card reveal' }, [
      ui.image(t.image, t.name, 'truck'),
      el('div', { class: 'truck-body' }, [
        el('div', { class: 'truck-title' }, [el('h3', { text: t.name }), el('span', { class: 'badge ' + st.cls, text: st.label })]),
        meta ? el('p', { class: 'truck-meta', text: meta }) : null,
        t.description ? el('p', { class: 'muted', text: t.description }) : null
      ]),
      el('div', { class: 'truck-foot' }, [
        el('span', { class: 'price' }, [calc.formatNumber(t.price_per_hour) + ' ₽', el('small', { text: ' / час' })]),
        btn
      ])
    ]);
  }

  function materialRow(m) {
    var out = !(m.stock > 0);
    return el('article', { class: 'card is-hoverable material-row reveal' }, [
      ui.image(m.image, m.name, 'material'),
      el('div', { class: 'material-main' }, [
        el('h3', { text: m.name }),
        m.description ? el('p', { class: 'muted', text: m.description }) : null,
        el('span', { class: 'material-stock' + (out ? ' is-out' : ''),
                     text: out ? 'Нет в наличии' : 'В наличии: ' + calc.formatNumber(m.stock) + ' ' + m.unit })
      ]),
      el('div', { class: 'material-buy' }, [
        el('span', { class: 'price' }, [calc.formatNumber(m.price) + ' ₽', el('small', { text: ' / ' + m.unit })]),
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', 'data-order-material': m.id,
                       disabled: out, text: out ? 'Нет в наличии' : 'Заказать' })
      ])
    ]);
  }

  function render(into, items, build, emptyText) {
    var node = document.getElementById(into);
    var kids = items.length ? items.map(build) : [emptyState(emptyText)];
    node.replaceChildren.apply(node, kids);
    ui.reveal(node);
  }

  function initNav() {
    var toggle = document.getElementById('nav-toggle'), nav = document.getElementById('main-nav');
    function close() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Открыть меню'); }
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a, button')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  // События для этапа 3 (бронирование и форма доставки подписываются на них).
  function initActions() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-book-truck]');
      var m = e.target.closest('[data-order-material]');
      if (b) document.dispatchEvent(new CustomEvent('tolyan:book-truck', { detail: { id: b.getAttribute('data-book-truck') } }));
      if (m) document.dispatchEvent(new CustomEvent('tolyan:order-material', { detail: { id: m.getAttribute('data-order-material') } }));
    });
  }

  function load() {
    return Promise.all([store.getSettings(), store.listTrucks({ onlyActive: true }), store.listMaterials({ onlyActive: true })])
      .then(function (r) {
        applySettings(r[0]);
        render('truck-grid', r[1], truckCard, 'Машины скоро появятся. Позвоните нам, подберём вручную.');
        render('material-grid', r[2], materialRow, 'Каталог пока пуст. Позвоните нам, подскажем наличие.');
      })
      .catch(function () {
        ui.toast('Не удалось загрузить данные. Обновите страницу.', { error: true });
        var msg = 'Не удалось загрузить данные. Обновите страницу.';
        document.getElementById('truck-grid').replaceChildren(emptyState(msg));
        document.getElementById('material-grid').replaceChildren(emptyState(msg));
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initActions();
    ui.reveal(document);
    ui.startAtTopOnReload(load(), { stripHash: true });
  });

  T.site = { reload: load };
})();
