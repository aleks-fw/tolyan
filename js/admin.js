// Админ-панель: ядро (вход, вкладки, общие помощники). Вкладки регистрируются в admin-*.js через A.tabs.push.
(function () {
  'use strict';
  var T = window.Tolyan, ui = T.ui, el = ui.el, store = T.store;
  var A = T.admin = { tabs: [], el: el, ui: ui, store: store, calc: T.calc, V: T.validate };

  var uid = 0;

  A.fmtDateTime = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  A.errorText = function (e) { return (e && e.message) || 'Что-то пошло не так'; };

  // Поле с подписью и местом под ошибку.
  A.field = function (label, control, opts) {
    opts = opts || {};
    var id = 'a' + (++uid);
    var err = el('p', { class: 'field-error', id: id + '-err', 'aria-live': 'polite' });
    control.id = id; control.setAttribute('aria-describedby', id + '-err');
    var root = el('div', { class: 'field' + (opts.span ? ' span-2' : '') }, [
      el('label', { for: id, text: label }), control,
      opts.hint ? el('p', { class: 'field-hint', text: opts.hint }) : null, err]);
    control.addEventListener('input', function () { root.classList.remove('has-error'); err.textContent = ''; });
    return { root: root, input: control, setError: function (m) { root.classList.toggle('has-error', !!m); err.textContent = m || ''; } };
  };

  A.input = function (type, attrs) { return el('input', Object.assign({ class: 'input', type: type }, attrs || {})); };

  // Подтверждение действия в модальном окне -> Promise<boolean>.
  A.confirm = function (title, text, okLabel) {
    return new Promise(function (resolve) {
      var done = false;
      var ok = el('button', { class: 'btn btn-danger', type: 'button', text: okLabel || 'Удалить' });
      var cancel = el('button', { class: 'btn btn-outline', type: 'button', text: 'Отмена' });
      var body = el('div', null, [el('p', { text: text }), el('div', { class: 'modal-actions' }, [ok, cancel])]);
      var m = ui.modal({ title: title, body: body, onClose: function () { if (!done) resolve(false); } });
      ok.addEventListener('click', function () { done = true; resolve(true); m.close(); });
      cancel.addEventListener('click', function () { m.close(); });
      cancel.focus();
    });
  };

  // Картинка: URL или файл с компьютера. getValue() -> строка (URL или data URL).
  A.imageField = function (label, current) {
    var value = current || '';
    var url = A.input('text', { placeholder: 'https://... или выберите файл', value: value.indexOf('data:') === 0 ? '' : value });
    var file = el('input', { type: 'file', accept: 'image/*', class: 'file-input', 'aria-label': 'Файл изображения' });
    var preview = el('img', { class: 'image-preview', alt: 'Предпросмотр', hidden: !value });
    if (value) preview.src = value;
    var status = el('p', { class: 'field-hint', text: value.indexOf('data:') === 0 ? 'Загружен файл. Чтобы заменить, выберите другой.' : '' });
    var f = A.field(label, url, { span: true });
    function show() { preview.hidden = !value; if (value) preview.src = value; }
    url.addEventListener('input', function () { value = url.value.trim(); status.textContent = ''; show(); });
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      ui.fileToDataUrl(fl, 1000).then(function (d) {
        value = d; url.value = ''; status.textContent = 'Файл загружен (' + Math.round(d.length / 1024) + ' КБ).'; show();
      }, function (e) { f.setError(A.errorText(e)); });
    });
    var wrap = el('div', { class: 'image-field span-2' }, [f.root, el('div', { class: 'image-row' }, [file, preview]), status]);
    return { root: wrap, getValue: function () { return value; } };
  };

  A.badgeCounts = function () {
    return store.listOrders().then(function (list) {
      return list.filter(function (o) { return o.status === 'new'; }).length;
    });
  };

  /* ---------- оболочка ---------- */

  var root, logoutBtn, activeTab = null;

  function showLogin() {
    logoutBtn.hidden = true;
    var needsEmail = store.mode === 'supabase';
    var email = A.field('Почта', A.input('email', { autocomplete: 'username' }));
    var pass = A.field('Пароль', A.input('password', { autocomplete: 'current-password' }));
    var submit = el('button', { class: 'btn btn-primary btn-lg', type: 'submit', text: 'Войти' });
    var form = el('form', { class: 'login-card card', novalidate: true }, [
      el('h1', { class: 'login-title', text: 'Вход для владельца' }),
      needsEmail ? email.root : null, pass.root, submit,
      store.mode === 'demo' ? el('p', { class: 'field-hint', text: 'Демо-режим: пароль задан в файле js/config.js. Это не защита, а заглушка до подключения Supabase.' }) : null
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); pass.setError(''); email.setError('');
      if (!pass.input.value) { pass.setError('Введите пароль'); pass.input.focus(); return; }
      submit.disabled = true;
      store.login(pass.input.value, email.input.value).then(showApp, function (err) {
        submit.disabled = false; pass.setError(A.errorText(err)); pass.input.focus();
      });
    });
    root.replaceChildren(form);
    (needsEmail ? email.input : pass.input).focus();
  }

  function showApp() {
    logoutBtn.hidden = false;
    var banner = store.mode === 'demo'
      ? el('p', { class: 'demo-banner', role: 'note', text: 'Демо-режим: данные хранятся только в этом браузере. Заказы клиентов с других устройств сюда не попадут, пока не подключён Supabase.' })
      : null;
    var nav = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Разделы админ-панели' });
    var panel = el('section', { class: 'tab-panel', role: 'tabpanel' });
    var buttons = {};

    A.tabs.forEach(function (t) {
      var badge = el('span', { class: 'tab-badge', hidden: true });
      var b = el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': 'false', id: 'tab-' + t.id }, [t.title, badge]);
      b.addEventListener('click', function () { select(t.id); });
      b.addEventListener('keydown', function (e) {
        var i = A.tabs.indexOf(t), n = A.tabs.length;
        if (e.key === 'ArrowRight') { e.preventDefault(); select(A.tabs[(i + 1) % n].id, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select(A.tabs[(i - 1 + n) % n].id, true); }
      });
      buttons[t.id] = { btn: b, badge: badge };
      nav.appendChild(b);
    });

    function select(id, focus) {
      var tab = A.tabs.find(function (t) { return t.id === id; }) || A.tabs[0];
      activeTab = tab.id;
      Object.keys(buttons).forEach(function (k) {
        buttons[k].btn.setAttribute('aria-selected', k === tab.id ? 'true' : 'false');
        buttons[k].btn.tabIndex = k === tab.id ? 0 : -1;
      });
      if (focus) buttons[tab.id].btn.focus();
      panel.setAttribute('aria-labelledby', 'tab-' + tab.id);
      history.replaceState(null, '', '#' + tab.id);
      panel.replaceChildren(el('p', { class: 'muted', text: 'Загрузка...' }));
      var rendering = Promise.resolve(tab.render(panel)).catch(function (e) {
        panel.replaceChildren(el('p', { class: 'form-alert', text: 'Не удалось загрузить раздел: ' + A.errorText(e) }));
      });
      if (!A.firstRender) A.firstRender = rendering;
      A.refreshBadges();
    }

    A.refreshBadges = function () {
      A.badgeCounts().then(function (n) {
        var b = buttons.orders; if (!b) return;
        b.badge.hidden = n === 0; b.badge.textContent = String(n);
        b.btn.setAttribute('aria-label', 'Заказы' + (n ? ', новых: ' + n : ''));
      });
    };

    root.replaceChildren(banner, nav, panel);
    var fromHash = location.hash.replace('#', '');
    select(A.tabs.some(function (t) { return t.id === fromHash; }) ? fromHash : A.tabs[0].id);
  }

  A.start = function () {
    root = document.getElementById('admin-root');
    logoutBtn = document.getElementById('logout');
    logoutBtn.addEventListener('click', function () { store.logout().then(showLogin); });
    store.isAdmin().then(function (ok) { if (ok) showApp(); else showLogin(); });
    ui.startAtTopOnReload(store.isAdmin().then(function () { return A.firstRender; }));
  };
})();
