// Вкладка «Заказы и брони».
(function () {
  'use strict';
  var A = window.Tolyan.admin, el = A.el, ui = A.ui, store = A.store, calc = A.calc, V = A.V;
  var OM = window.Tolyan.orderMessage;

  var STATUSES = [
    ['new', 'Новый', 'badge-accent'], ['confirmed', 'Подтверждён', 'badge-ok'],
    ['in_progress', 'В работе', 'badge-warn'], ['done', 'Выполнен', 'badge-ok'], ['cancelled', 'Отменён', 'badge-danger']
  ];
  var TYPES = { delivery: 'Доставка', rental: 'Аренда' };
  var filters = { status: '', type: '', q: '' };

  function statusLabel(s) { var r = STATUSES.find(function (x) { return x[0] === s; }); return r ? r[1] : s; }

  function composition(o) {
    return (o.items || []).map(function (it) {
      return it.kind === 'truck' ? it.name + ', ' + it.hours + ' ч'
                                 : it.name + ', ' + calc.formatNumber(it.qty) + ' ' + it.unit;
    }).join('; ');
  }

  function statusSelect(order, onChange) {
    var s = el('select', { class: 'select select-sm', 'aria-label': 'Статус заказа ' + OM.orderNumber(order.number) },
      STATUSES.map(function (x) { return el('option', { value: x[0], selected: x[0] === order.status, text: x[1] }); }));
    s.addEventListener('change', function () {
      var prev = order.status;
      store.setOrderStatus(order.id, s.value).then(function () {
        order.status = s.value; ui.toast('Статус: ' + statusLabel(s.value)); onChange();
      }, function (e) { s.value = prev; ui.toast(A.errorText(e), { error: true }); });
    });
    return s;
  }

  function render(panel) {
    return store.listOrders().then(function (orders) {
      var tiles = el('div', { class: 'stat-grid' });
      var tbody = el('tbody');
      var countEl = el('p', { class: 'muted' });

      function drawTiles() {
        var n = orders.filter(function (o) { return o.status === 'new'; }).length;
        var work = orders.filter(function (o) { return o.status === 'confirmed' || o.status === 'in_progress'; }).length;
        var sum = orders.filter(function (o) { return o.status === 'done'; }).reduce(function (s, o) { return s + o.total; }, 0);
        tiles.replaceChildren(
          tile('Новые', String(n), n ? 'is-accent' : ''), tile('В работе', String(work)),
          tile('Сумма выполненных', calc.formatMoney(sum)));
      }
      function tile(label, value, cls) {
        return el('div', { class: 'stat-tile card ' + (cls || '') }, [el('span', { class: 'muted', text: label }), el('strong', { text: value })]);
      }

      function visible() {
        var q = filters.q.trim().toLowerCase();
        return orders.filter(function (o) {
          if (filters.status && o.status !== filters.status) return false;
          if (filters.type && o.type !== filters.type) return false;
          if (!q) return true;
          return [String(o.number), o.customer_name, o.phone, o.address, composition(o)].join(' ').toLowerCase().indexOf(q) >= 0;
        });
      }

      function refreshAll() { drawTiles(); drawRows(); A.refreshBadges(); }

      function openDetail(o) {
        var rows = [['Заказ', OM.orderNumber(o.number) + ', ' + (TYPES[o.type] || o.type)], ['Создан', A.fmtDateTime(o.created_at)],
          ['Клиент', o.customer_name + ', ' + V.formatPhone(o.phone)], ['Адрес', o.address],
          ['Когда', OM.formatDate(o.date) + (o.time ? ', ' + o.time : '')], ['Состав', composition(o)],
          ['Сумма', calc.formatMoney(o.total)]];
        if (o.comment) rows.push(['Комментарий', o.comment]);
        var dl = el('dl', { class: 'summary-list' }, rows.map(function (r) {
          return el('div', null, [el('dt', { text: r[0] }), el('dd', { text: r[1] })]);
        }));
        var ta = el('textarea', { class: 'textarea order-text', readonly: true, rows: '8', 'aria-label': 'Текст заказа' });
        ta.value = o.message_text || '';
        var copy = el('button', { class: 'btn btn-outline', type: 'button', text: 'Скопировать заказ' });
        copy.addEventListener('click', function () {
          ui.copyText(ta.value).then(function (ok) { ui.toast(ok ? 'Текст скопирован' : 'Не удалось скопировать', { error: !ok }); });
        });
        var del = el('button', { class: 'btn btn-danger', type: 'button', text: 'Удалить заказ' });
        var statusRow = el('div', { class: 'detail-status' }, [el('span', { class: 'label', text: 'Статус' }), statusSelect(o, refreshAll)]);
        var m = ui.modal({ title: 'Заказ ' + OM.orderNumber(o.number), body: el('div', null, [
          dl, statusRow, ta, el('div', { class: 'modal-actions' }, [copy, del])]) });
        del.addEventListener('click', function () { m.close(); removeOrder(o); });
      }

      function removeOrder(o) {
        A.confirm('Удалить заказ?', 'Заказ ' + OM.orderNumber(o.number) + ' от ' + o.customer_name + ' будет удалён без возможности восстановления.')
          .then(function (yes) {
            if (!yes) return;
            store.deleteOrder(o.id).then(function () {
              orders.splice(orders.indexOf(o), 1); refreshAll(); ui.toast('Заказ удалён');
            }, function (e) { ui.toast(A.errorText(e), { error: true }); });
          });
      }

      function drawRows() {
        var list = visible();
        countEl.textContent = 'Показано: ' + list.length + ' из ' + orders.length;
        if (!list.length) {
          tbody.replaceChildren(el('tr', null, [el('td', { colspan: '8', class: 'empty-cell',
            text: orders.length ? 'Ничего не найдено. Измените фильтры.' : 'Заказов пока нет. Новые заказы с сайта появятся здесь.' })]));
          return;
        }
        tbody.replaceChildren.apply(tbody, list.map(function (o) {
          var det = el('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Подробнее' });
          var del = el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Удалить' });
          det.addEventListener('click', function () { openDetail(o); });
          del.addEventListener('click', function () { removeOrder(o); });
          return el('tr', { class: o.status === 'new' ? 'is-new' : '' }, [
            el('td', { 'data-label': '№' }, [el('strong', { text: OM.orderNumber(o.number) })]),
            el('td', { 'data-label': 'Создан', text: A.fmtDateTime(o.created_at) }),
            el('td', { 'data-label': 'Тип' }, [el('span', { class: 'badge', text: TYPES[o.type] || o.type })]),
            el('td', { 'data-label': 'Клиент' }, [el('div', { text: o.customer_name }),
              el('a', { href: 'tel:' + o.phone, text: V.formatPhone(o.phone) })]),
            el('td', { 'data-label': 'Состав', class: 'cell-wide', text: composition(o) }),
            el('td', { 'data-label': 'Сумма', class: 'cell-num', text: calc.formatMoney(o.total) }),
            el('td', { 'data-label': 'Когда', text: OM.formatDate(o.date) + (o.time ? ', ' + o.time : '') }),
            el('td', { 'data-label': 'Статус' }, [statusSelect(o, refreshAll)]),
            el('td', { class: 'cell-actions' }, [det, del])
          ]);
        }));
      }

      var status = el('select', { class: 'select select-sm', 'aria-label': 'Фильтр по статусу' },
        [el('option', { value: '', text: 'Все статусы' })].concat(STATUSES.map(function (x) { return el('option', { value: x[0], text: x[1] }); })));
      var type = el('select', { class: 'select select-sm', 'aria-label': 'Фильтр по типу' }, [
        el('option', { value: '', text: 'Все типы' }), el('option', { value: 'delivery', text: 'Доставка' }), el('option', { value: 'rental', text: 'Аренда' })]);
      var q = A.input('search', { class: 'input input-sm', placeholder: 'Поиск: имя, телефон, адрес, №', 'aria-label': 'Поиск по заказам' });
      status.value = filters.status; type.value = filters.type; q.value = filters.q;
      status.addEventListener('change', function () { filters.status = status.value; drawRows(); });
      type.addEventListener('change', function () { filters.type = type.value; drawRows(); });
      q.addEventListener('input', function () { filters.q = q.value; drawRows(); });

      var table = el('table', { class: 'table' }, [
        el('thead', null, [el('tr', null, ['№', 'Создан', 'Тип', 'Клиент', 'Состав', 'Сумма', 'Когда', 'Статус', ''].map(function (h) {
          return el('th', { scope: 'col', text: h });
        }))]), tbody]);

      panel.replaceChildren(tiles, el('div', { class: 'toolbar' }, [status, type, q]), countEl,
        el('div', { class: 'table-wrap' }, [table]));
      drawTiles(); drawRows();
    });
  }

  A.tabs.push({ id: 'orders', title: 'Заказы', render: render });
})();
