// Оформление заказов на публичной странице: форма доставки, бронь грузовика, окно «Заказ оформлен».
(function () {
  'use strict';
  var T = window.Tolyan, ui = T.ui, el = ui.el, calc = T.calc, V = T.validate, store = T.store, OM = T.orderMessage;

  var cache = { materials: [], trucks: [], settings: {} };
  var uidCounter = 0;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function refresh() {
    return Promise.all([store.listMaterials({ onlyActive: true }), store.listTrucks({ onlyActive: true }), store.getSettings()])
      .then(function (r) { cache.materials = r[0]; cache.trucks = r[1]; cache.settings = r[2]; });
  }

  /* ---------- поля ---------- */

  function field(label, control, opts) {
    opts = opts || {};
    var id = 'f' + (++uidCounter);
    var err = el('p', { class: 'field-error', id: id + '-err', 'aria-live': 'polite' });
    control.id = id;
    control.setAttribute('aria-describedby', id + '-err');
    // Ошибка снимается, как только человек начал править поле.
    control.addEventListener('input', function () { if (root.classList.contains('has-error')) api.setError(''); });
    var root = el('div', { class: 'field' + (opts.span ? ' span-2' : '') }, [
      el('label', { for: id, text: label }), control,
      opts.hint ? el('p', { class: 'field-hint', text: opts.hint }) : null, err
    ]);
    var api = {
      root: root, input: control,
      setError: function (msg) {
        root.classList.toggle('has-error', !!msg);
        err.textContent = msg || '';
        control.setAttribute('aria-invalid', msg ? 'true' : 'false');
      }
    };
    return api;
  }

  function input(type, attrs) { return el('input', Object.assign({ class: 'input', type: type }, attrs || {})); }

  // Общие поля: адрес, дата, время, имя, телефон, комментарий.
  function contactFields(opts) {
    var f = {
      address: field(opts.addressLabel, input('text', { autocomplete: 'street-address', placeholder: 'Город, улица, дом' }), { span: true }),
      date: field('Дата', input('date', { min: today() })),
      time: field(opts.timeRequired ? 'Время' : 'Время (если важно)', input('time')),
      name: field('Ваше имя', input('text', { autocomplete: 'name', maxlength: '60' })),
      phone: field('Телефон', input('tel', { autocomplete: 'tel', inputmode: 'tel', placeholder: '+7 900 123-45-67' })),
      comment: field('Комментарий', el('textarea', { class: 'textarea', maxlength: '500', rows: '3' }), { span: true })
    };
    f.phone.input.addEventListener('blur', function () {
      var r = V.phone(f.phone.input.value);
      if (r.ok) f.phone.input.value = V.formatPhone(r.value);
    });
    return f;
  }

  function contactValues(f) {
    return { address: f.address.input.value, date: f.date.input.value, time: f.time.input.value,
             customer_name: f.name.input.value, phone: f.phone.input.value, comment: f.comment.input.value };
  }

  var FIELD_KEYS = { customer_name: 'name', phone: 'phone', address: 'address', date: 'date', time: 'time', comment: 'comment' };

  function clearErrors(f) { Object.keys(f).forEach(function (k) { f[k].setError(''); }); }

  // Возвращает { fieldKey: message } по тем же правилам, что и хранилище.
  function checkContacts(v, timeRequired) {
    var e = {};
    var r;
    r = V.name(v.customer_name); if (!r.ok) e.name = r.error;
    r = V.phone(v.phone); if (!r.ok) e.phone = r.error;
    r = V.address(v.address); if (!r.ok) e.address = r.error;
    r = V.date(v.date, today()); if (!r.ok) e.date = r.error;
    r = V.time(v.time, timeRequired); if (!r.ok) e.time = r.error;
    r = V.comment(v.comment); if (!r.ok) e.comment = r.error;
    return e;
  }

  function showErrors(f, errors) {
    var first = null;
    Object.keys(errors).forEach(function (k) {
      if (f[k]) { f[k].setError(errors[k]); if (!first) first = f[k].input; }
    });
    if (first) first.focus();
  }

  // Ошибки хранилища (поля customer_name и т.д.) -> ключи формы.
  function mapStoreErrors(fields, extra) {
    var out = {};
    Object.keys(fields || {}).forEach(function (k) { out[FIELD_KEYS[k] || k] = fields[k]; });
    return Object.assign(out, extra || {});
  }

  /* ---------- текст заказа без сохранения (запасной вариант при сбое) ---------- */

  function previewMessage(payload) {
    var items = [], total = 0;
    if (payload.type === 'rental') {
      var t = cache.trucks.find(function (x) { return x.id === payload.truck_id; });
      if (t) {
        var line = calc.rentalTotal(t.price_per_hour, payload.hours);
        items.push({ kind: 'truck', name: t.name, hours: payload.hours, price_per_hour: t.price_per_hour, line_total: line });
        total = line;
      }
    } else {
      (payload.lines || []).forEach(function (l) {
        var m = cache.materials.find(function (x) { return x.id === l.material_id; });
        var q = Number(String(l.qty).replace(',', '.')) || 0;
        if (!m || !q) return;
        var lt = calc.lineTotal(m.price, q);
        items.push({ kind: 'material', name: m.name, unit: m.unit, qty: q, price: m.price, line_total: lt });
        total += lt;
      });
    }
    var phone = V.normalizePhone(payload.phone) || payload.phone;
    return OM.buildOrderMessage({
      number: '(не сохранён)', type: payload.type, items: items, total: calc.round2(total),
      customer_name: payload.customer_name, phone: phone, address: payload.address,
      date: payload.date, time: payload.time, comment: payload.comment
    }, cache.settings.company_name);
  }

  /* ---------- отправка ---------- */

  // ui: { setBusy(bool), showAlert(text|null), showFieldErrors(map), fallbackText(), onDone(order) }
  function send(payload, ctx) {
    ctx.setBusy(true); ctx.showAlert(null);
    return store.createOrder(payload).then(function (order) {
      ctx.setBusy(false);
      ctx.onDone(order);
    }, function (e) {
      ctx.setBusy(false);
      if (e && e.code === 'VALIDATION') {
        var extra = {};
        if (e.fields && e.fields.lines) extra.lines = e.fields.lines;
        if (e.fields && e.fields.truck_id) extra.truck_id = e.fields.truck_id;
        ctx.showFieldErrors(mapStoreErrors(e.fields, extra));
      } else {
        ctx.showAlert('Не удалось сохранить заказ. Проверьте соединение и попробуйте ещё раз.', ctx.fallbackText());
      }
    });
  }

  function alertBox() {
    var box = el('div', { class: 'form-alert', role: 'alert', hidden: true });
    var text = el('p'); var copy = el('button', { class: 'btn btn-outline btn-sm', type: 'button', hidden: true, text: 'Скопировать заказ без сохранения' });
    box.appendChild(text); box.appendChild(copy);
    var fallback = '';
    copy.addEventListener('click', function () {
      ui.copyText(fallback).then(function (ok) { ui.toast(ok ? 'Текст заказа скопирован' : 'Не удалось скопировать', { error: !ok }); });
    });
    return {
      root: box,
      show: function (msg, fallbackText) {
        if (!msg) { box.hidden = true; return; }
        text.textContent = msg; box.hidden = false;
        fallback = fallbackText || ''; copy.hidden = !fallback;
      }
    };
  }

  /* ---------- окно «Заказ оформлен» ---------- */

  function showDone(order) {
    var s = cache.settings;
    var links = OM.telegramLinks(s.telegram_username, order.message_text);
    var tooLong = links && links.send.length > 1900;
    var body = el('div');

    var textarea = el('textarea', { class: 'textarea order-text', readonly: true, rows: '10', 'aria-label': 'Текст заказа' });
    textarea.value = order.message_text;

    var copyBtn = el('button', { class: 'btn btn-outline', type: 'button', text: 'Скопировать заказ' });
    copyBtn.addEventListener('click', function () {
      ui.copyText(order.message_text).then(function (ok) {
        ui.toast(ok ? 'Текст заказа скопирован' : 'Не удалось скопировать, выделите текст вручную', { error: !ok });
      });
    });

    var actions = el('div', { class: 'modal-actions' });
    var hint;
    if (links) {
      var sendLink = el('a', { class: 'btn btn-primary', href: tooLong ? links.open : links.send, target: '_blank', rel: 'noopener', text: 'Отправить заказ в Telegram' });
      // Префилл текста поддерживают не все клиенты Telegram: копируем в буфер заранее.
      sendLink.addEventListener('click', function () { ui.copyText(order.message_text); });
      var openLink = el('a', { class: 'btn btn-outline', href: links.open, target: '_blank', rel: 'noopener', text: 'Открыть Telegram владельца' });
      actions.appendChild(sendLink); actions.appendChild(copyBtn); actions.appendChild(openLink);
      hint = 'Текст уже скопирован при нажатии «Отправить». Если в Telegram он не подставился сам, вставьте его в чат.';
    } else {
      actions.appendChild(copyBtn);
      hint = 'Ник Telegram владельца не задан. Скопируйте заказ и отправьте любым удобным способом.';
    }

    var summary = el('p', null, ['Номер заказа: ', el('strong', { text: OM.orderNumber(order.number) }),
      '. Сумма: ', el('strong', { text: calc.formatMoney(order.total) }) , '.']);

    body.appendChild(summary);
    body.appendChild(el('p', { class: 'muted done-note', text: 'Заказ сохранён, владелец увидит его в админ-панели. Чтобы ответили быстрее, отправьте текст в Telegram.' }));
    body.appendChild(textarea);
    body.appendChild(actions);
    body.appendChild(el('p', { class: 'field-hint', text: hint }));

    var closeBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Закрыть' });
    var m = ui.modal({ title: 'Заказ оформлен', body: body });
    closeBtn.addEventListener('click', m.close);
    actions.appendChild(closeBtn);
  }

  /* ---------- форма доставки ---------- */

  function buildDeliveryForm(host) {
    var f = contactFields({ addressLabel: 'Адрес доставки', timeRequired: false });
    var linesHost = el('div', { class: 'lines' });
    var linesError = el('p', { class: 'field-error', 'aria-live': 'polite' });
    var totalEl = el('strong', { text: calc.formatMoney(0) });
    var alert = alertBox();
    var submit = el('button', { class: 'btn btn-primary btn-lg', type: 'submit', text: 'Оформить заказ' });
    var addBtn = el('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Добавить материал' });
    var rows = [];

    function findMaterial(id) { return cache.materials.find(function (m) { return m.id === id; }); }

    function addRow(materialId) {
      var select = el('select', { class: 'select', 'aria-label': 'Материал' }, [el('option', { value: '', text: 'Выберите материал' })]);
      cache.materials.forEach(function (m) {
        var out = !(m.stock > 0);
        select.appendChild(el('option', { value: m.id, disabled: out,
          text: m.name + ', ' + calc.formatNumber(m.price) + ' ₽/' + m.unit + (out ? ' (нет в наличии)' : '') }));
      });
      var qty = input('text', { inputmode: 'decimal', placeholder: 'Количество', 'aria-label': 'Количество', autocomplete: 'off' });
      var unit = el('span', { class: 'line-unit muted' });
      var sum = el('span', { class: 'line-sum' });
      var rm = el('button', { class: 'icon-btn line-remove', type: 'button', 'aria-label': 'Убрать строку', text: '×' });
      var row = el('div', { class: 'line-row' }, [select, el('div', { class: 'line-qty' }, [qty, unit]), sum, rm]);
      var rec = { select: select, qty: qty, row: row };
      rows.push(rec);
      linesHost.appendChild(row);
      if (materialId) select.value = materialId;

      function update() {
        var m = findMaterial(select.value);
        unit.textContent = m ? m.unit : '';
        var q = V.quantity(qty.value, m ? m.stock : undefined);
        sum.textContent = m && q.ok ? calc.formatMoney(calc.lineTotal(m.price, q.value)) : '';
        linesError.textContent = '';
        recalc();
      }
      select.addEventListener('change', update);
      qty.addEventListener('input', update);
      rm.addEventListener('click', function () {
        rows.splice(rows.indexOf(rec), 1); row.remove();
        if (!rows.length) addRow();
        recalc();
      });
      update();
      return rec;
    }

    function recalc() {
      var t = 0;
      rows.forEach(function (r) {
        var m = findMaterial(r.select.value), q = V.quantity(r.qty.value);
        if (m && q.ok) t += calc.lineTotal(m.price, q.value);
      });
      totalEl.textContent = calc.formatMoney(t);
      addBtn.disabled = rows.length >= 8;
    }

    function reset() {
      rows.length = 0; linesHost.replaceChildren(); addRow();
      ['address', 'date', 'time', 'name', 'phone', 'comment'].forEach(function (k) { f[k].input.value = ''; });
      clearErrors(f); linesError.textContent = '';
    }

    function payload() {
      var v = contactValues(f);
      return Object.assign(v, { type: 'delivery',
        lines: rows.map(function (r) { return { material_id: r.select.value, qty: r.qty.value }; })
                   .filter(function (l) { return l.material_id || String(l.qty).trim(); }) });
    }

    function lineErrors(p) {
      if (!p.lines.length) return 'Добавьте хотя бы один материал';
      for (var i = 0; i < p.lines.length; i++) {
        var l = p.lines[i], m = findMaterial(l.material_id);
        if (!m) return 'В строке ' + (i + 1) + ' выберите материал';
        var q = V.quantity(l.qty, m.stock);
        if (!q.ok) {
          var over = Number(String(l.qty).replace(',', '.')) > m.stock;
          return m.name + ': ' + (over ? 'в наличии только ' + calc.formatNumber(m.stock) + ' ' + m.unit : q.error);
        }
      }
      return '';
    }

    addBtn.addEventListener('click', function () { addRow(); });

    var form = el('form', { class: 'order-card', novalidate: true }, [
      el('div', { class: 'order-block' }, [
        el('h3', { text: 'Что везти' }),
        linesHost, linesError, addBtn
      ]),
      el('div', { class: 'order-block' }, [
        el('h3', { text: 'Куда и когда' }),
        el('div', { class: 'form-grid cols-2' }, [f.address.root, f.date.root, f.time.root])
      ]),
      el('div', { class: 'order-block' }, [
        el('h3', { text: 'Контакты' }),
        el('div', { class: 'form-grid cols-2' }, [f.name.root, f.phone.root, f.comment.root])
      ]),
      el('div', { class: 'order-total' }, [
        el('div', null, [el('span', { class: 'muted', text: 'Итого за материалы: ' }), totalEl]),
        el('p', { class: 'field-hint' })
      ]),
      alert.root,
      el('div', { class: 'order-submit' }, [submit])
    ]);
    // Пояснение про доставку из настроек
    var noteHost = form.querySelector('.order-total .field-hint');
    function applyNote() { noteHost.textContent = cache.settings.delivery_note || ''; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(f); linesError.textContent = ''; alert.show(null);
      var p = payload();
      var errs = checkContacts(p, false);
      var le = lineErrors(p);
      if (le) linesError.textContent = le;
      if (Object.keys(errs).length || le) {
        showErrors(f, errs);
        if (!Object.keys(errs).length && le) linesHost.querySelector('select,input').focus();
        return;
      }
      send(p, {
        setBusy: function (b) { submit.disabled = b; submit.textContent = b ? 'Отправляем...' : 'Оформить заказ'; },
        showAlert: function (m, fb) { alert.show(m, fb); },
        showFieldErrors: function (map) {
          if (map.lines) linesError.textContent = map.lines;
          delete map.lines; delete map.truck_id;
          showErrors(f, map);
        },
        fallbackText: function () { return previewMessage(p); },
        onDone: function (order) { reset(); showDone(order); }
      });
    });

    host.replaceChildren(form);
    reset();
    applyNote();

    return {
      selectMaterial: function (id) {
        var empty = rows.find(function (r) { return !r.select.value; });
        var same = rows.find(function (r) { return r.select.value === id; });
        var rec = same || empty || (rows.length < 8 ? addRow(id) : null);
        if (!rec) return;
        rec.select.value = id; rec.select.dispatchEvent(new Event('change'));
        rec.qty.focus();
      },
      rebuild: function () {
        // Каталог мог измениться: пересобрать строки с сохранением выбора.
        var keep = rows.map(function (r) { return { id: r.select.value, qty: r.qty.value }; });
        rows.length = 0; linesHost.replaceChildren();
        if (!keep.length) keep = [{ id: '', qty: '' }];
        keep.forEach(function (k) { var r = addRow(k.id && findMaterial(k.id) ? k.id : ''); r.qty.value = k.qty; r.select.dispatchEvent(new Event('change')); });
        applyNote();
      }
    };
  }

  /* ---------- бронирование грузовика ---------- */

  function openBooking(truckId) {
    var truck = cache.trucks.find(function (t) { return t.id === truckId; });
    if (!truck) { ui.toast('Машина не найдена. Обновите страницу.', { error: true }); return; }
    if (truck.status !== 'available') { ui.toast('Эта машина сейчас недоступна.', { error: true }); return; }

    var f = contactFields({ addressLabel: 'Адрес подачи', timeRequired: true });
    var hours = field('Количество часов', input('number', { min: '1', max: '24', step: '1', value: '2', inputmode: 'numeric' }),
      { hint: 'От 1 до 24 часов' });
    var totalEl = el('strong');
    var alert = alertBox();
    var modalRef;

    function hoursValue() { return V.hours(hours.input.value); }
    function recalc() {
      var h = hoursValue();
      totalEl.textContent = h.ok ? calc.formatMoney(calc.rentalTotal(truck.price_per_hour, h.value)) : '...';
    }
    hours.input.addEventListener('input', recalc);

    function payload() {
      return Object.assign(contactValues(f), { type: 'rental', truck_id: truck.id, hours: hours.input.value });
    }

    var next = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Проверить заказ' });
    var form = el('form', { novalidate: true }, [
      el('p', { class: 'muted' }, [truck.name + (truck.body ? ', ' + truck.body.toLowerCase() : '') + '. Цена: ',
        calc.formatMoney(truck.price_per_hour) + ' в час.']),
      el('div', { class: 'form-grid cols-2 modal-form' }, [hours.root, f.date.root, f.time.root, f.address.root, f.name.root, f.phone.root, f.comment.root]),
      el('p', { class: 'order-total' }, [el('span', { class: 'muted', text: 'Стоимость: ' }), totalEl]),
      alert.root,
      el('div', { class: 'modal-actions' }, [next])
    ]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(f); hours.setError(''); alert.show(null);
      var p = payload();
      var errs = checkContacts(p, true);
      var h = hoursValue();
      if (!h.ok) errs.hours = h.error;
      var map = Object.assign({}, f, { hours: hours });
      if (Object.keys(errs).length) { showErrors(map, errs); return; }
      showSummary(p, h.value);
    });

    function showSummary(p, h) {
      var total = calc.rentalTotal(truck.price_per_hour, h);
      var rowsList = [
        ['Машина', truck.name], ['Время аренды', h + ' ч × ' + calc.formatMoney(truck.price_per_hour)],
        ['Стоимость', calc.formatMoney(total)], ['Адрес подачи', V.address(p.address).value],
        ['Когда', OM.formatDate(p.date) + ', ' + p.time],
        ['Клиент', V.name(p.customer_name).value + ', ' + V.formatPhone(V.phone(p.phone).value)]
      ];
      if (p.comment.trim()) rowsList.push(['Комментарий', p.comment.trim()]);
      var dl = el('dl', { class: 'summary-list' }, rowsList.map(function (r) {
        return el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]);
      }));
      var back = el('button', { class: 'btn btn-outline', type: 'button', text: 'Изменить' });
      var confirm = el('button', { class: 'btn btn-primary', type: 'button', text: 'Подтвердить бронь' });
      var summaryAlert = alertBox();
      back.addEventListener('click', function () { modalRef.setTitle('Бронь: ' + truck.name); modalRef.setBody(form); });
      confirm.addEventListener('click', function () {
        send(p, {
          setBusy: function (b) { confirm.disabled = b; back.disabled = b; confirm.textContent = b ? 'Отправляем...' : 'Подтвердить бронь'; },
          showAlert: function (m, fb) { summaryAlert.show(m, fb); },
          showFieldErrors: function (map) {
            // Ошибка пришла уже после проверки: вернуть пользователя на форму с подсвеченным полем.
            modalRef.setTitle('Бронь: ' + truck.name); modalRef.setBody(form);
            if (map.truck_id) alert.show(map.truck_id); delete map.truck_id;
            showErrors(Object.assign({}, f, { hours: hours }), map);
          },
          fallbackText: function () { return previewMessage(p); },
          onDone: function (order) { modalRef.close(); showDone(order); }
        });
      });
      modalRef.setTitle('Проверьте бронь');
      modalRef.setBody(el('div', null, [dl, summaryAlert.root, el('div', { class: 'modal-actions' }, [confirm, back])]));
    }

    modalRef = ui.modal({ title: 'Бронь: ' + truck.name, body: form });
    recalc();
  }

  /* ---------- запуск ---------- */

  var delivery = null;

  function init() {
    var host = document.getElementById('delivery-host');
    refresh().then(function () {
      if (host) delivery = buildDeliveryForm(host);
    });
    document.addEventListener('tolyan:book-truck', function (e) {
      refresh().then(function () { openBooking(e.detail.id); });
    });
    document.addEventListener('tolyan:order-material', function (e) {
      refresh().then(function () {
        if (delivery) delivery.rebuild();
        var section = document.getElementById('order');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (delivery) delivery.selectMaterial(e.detail.id);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  T.orders = { previewMessage: previewMessage };
})();
