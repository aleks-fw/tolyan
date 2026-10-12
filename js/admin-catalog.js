// Вкладки «Материалы» и «Грузовики»: таблица с быстрой правкой, добавление, редактирование, удаление.
(function () {
  'use strict';
  var A = window.Tolyan.admin, el = A.el, ui = A.ui, store = A.store, calc = A.calc;

  var TRUCK_STATUS = [['available', 'Свободна'], ['busy', 'Занята'], ['service', 'На обслуживании']];

  function thumb(src, kind) { return ui.image(src, '', kind, { class: 'thumb', loading: 'lazy' }); }

  function numInput(value, label, step) {
    return A.input('number', { class: 'input input-sm num-input', value: String(value), min: '0', step: step || 'any', 'aria-label': label });
  }

  // Быстрая правка числового поля прямо в строке. save(value) -> Promise.
  function inlineNumber(value, label, save) {
    var inp = numInput(value, label);
    var last = String(value);
    inp.addEventListener('change', function () {
      var v = inp.value;
      save(v).then(function () { last = v; ui.toast('Сохранено'); },
        function (e) { inp.value = last; ui.toast(A.errorText(e), { error: true }); });
    });
    return inp;
  }

  function activeToggle(item, saveFn) {
    var cb = el('input', { type: 'checkbox', checked: item.active !== false, 'aria-label': 'Показывать на сайте: ' + item.name });
    cb.addEventListener('change', function () {
      saveFn(Object.assign({}, item, { active: cb.checked })).then(function (saved) {
        item.active = saved.active; ui.toast(cb.checked ? 'Показывается на сайте' : 'Скрыто с сайта');
      }, function (e) { cb.checked = !cb.checked; ui.toast(A.errorText(e), { error: true }); });
    });
    return el('label', { class: 'check' }, [cb, el('span', { class: 'sr-only', text: 'Показывать' })]);
  }

  /* ---------- общий каркас вкладки ---------- */

  // cfg: { title, addLabel, empty, list(), headers[], row(item, rerender), openEdit(item|null, rerender) }
  function catalogTab(cfg) {
    return function render(panel) {
      return cfg.list().then(function (items) {
        var add = el('button', { class: 'btn btn-primary', type: 'button', text: cfg.addLabel });
        function rerender() { render(panel); }
        add.addEventListener('click', function () { cfg.openEdit(null, rerender); });
        var tbody = el('tbody', null, items.length ? items.map(function (it) { return cfg.row(it, rerender); })
          : [el('tr', null, [el('td', { colspan: String(cfg.headers.length), class: 'empty-cell', text: cfg.empty })])]);
        var table = el('table', { class: 'table' }, [
          el('thead', null, [el('tr', null, cfg.headers.map(function (h) { return el('th', { scope: 'col', text: h }); }))]), tbody]);
        panel.replaceChildren(el('div', { class: 'toolbar' }, [add]), el('div', { class: 'table-wrap' }, [table]));
      });
    };
  }

  function removeButton(label, onYes) {
    var b = el('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Удалить' });
    b.addEventListener('click', function () {
      A.confirm('Удалить?', label, 'Удалить').then(function (yes) { if (yes) onYes(); });
    });
    return b;
  }

  /* ---------- материалы ---------- */

  function openMaterialEdit(m, rerender) {
    var isNew = !m; m = m || { unit: 'т', price: 0, stock: 0, active: true };
    var name = A.field('Название', A.input('text', { value: m.name || '', maxlength: '80' }), { span: true });
    var desc = A.field('Описание', A.input('text', { value: m.description || '', maxlength: '160' }), { span: true });
    var unitInput = A.input('text', { value: m.unit, list: 'unit-list', maxlength: '12' });
    var unit = A.field('Единица измерения', unitInput);
    var datalist = el('datalist', { id: 'unit-list' }, ['т', 'м³', 'кг', 'шт', 'мешок'].map(function (u) { return el('option', { value: u }); }));
    var price = A.field('Цена за единицу, ₽', A.input('number', { value: String(m.price), min: '0', step: 'any' }));
    var stock = A.field('Остаток в наличии', A.input('number', { value: String(m.stock), min: '0', step: 'any' }));
    var img = A.imageField('Фото (ссылка)', m.image);
    var active = el('input', { type: 'checkbox', checked: m.active !== false });
    var activeLabel = el('label', { class: 'check span-2' }, [active, el('span', { text: 'Показывать на сайте' })]);
    var save = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Сохранить' });
    var form = el('form', { novalidate: true }, [
      el('div', { class: 'form-grid cols-2' }, [name.root, desc.root, unit.root, price.root, stock.root, img.root, activeLabel]),
      datalist, el('div', { class: 'modal-actions' }, [save])]);
    var modal = ui.modal({ title: isNew ? 'Новый материал' : 'Изменить материал', body: form });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); save.disabled = true;
      store.saveMaterial(Object.assign({}, m, { name: name.input.value, description: desc.input.value, unit: unitInput.value,
        price: price.input.value, stock: stock.input.value, image: img.getValue(), active: active.checked }))
        .then(function () { modal.close(); ui.toast('Материал сохранён'); rerender(); },
          function (err) { save.disabled = false; ui.toast(A.errorText(err), { error: true }); });
    });
  }

  A.tabs.push({ id: 'materials', title: 'Материалы', render: catalogTab({
    addLabel: 'Добавить материал', empty: 'Материалов пока нет. Добавьте первый.',
    headers: ['', 'Название', 'Цена, ₽', 'Ед.', 'Остаток', 'На сайте', ''],
    list: function () { return store.listMaterials(); },
    openEdit: openMaterialEdit,
    row: function (m, rerender) {
      var edit = el('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Изменить' });
      edit.addEventListener('click', function () { openMaterialEdit(m, rerender); });
      return el('tr', { class: m.active === false ? 'is-hidden' : '' }, [
        el('td', { class: 'cell-thumb' }, [thumb(m.image, 'material')]),
        el('td', { 'data-label': 'Название', class: 'cell-wide' }, [el('strong', { text: m.name }), el('div', { class: 'muted small', text: m.description || '' })]),
        el('td', { 'data-label': 'Цена, ₽' }, [inlineNumber(m.price, 'Цена: ' + m.name, function (v) { return store.saveMaterial(Object.assign({}, m, { price: v })).then(function (s) { m.price = s.price; }); })]),
        el('td', { 'data-label': 'Ед.', text: m.unit }),
        el('td', { 'data-label': 'Остаток' }, [inlineNumber(m.stock, 'Остаток: ' + m.name, function (v) { return store.saveMaterial(Object.assign({}, m, { stock: v })).then(function (s) { m.stock = s.stock; }); })]),
        el('td', { 'data-label': 'На сайте' }, [activeToggle(m, function (x) { return store.saveMaterial(x); })]),
        el('td', { class: 'cell-actions' }, [edit, removeButton('Материал «' + m.name + '» будет удалён из каталога.', function () {
          store.deleteMaterial(m.id).then(function () { ui.toast('Материал удалён'); rerender(); },
            function (e) { ui.toast(A.errorText(e), { error: true }); });
        })])
      ]);
    }
  }) });

  /* ---------- грузовики ---------- */

  function statusSelect(truck) {
    var s = el('select', { class: 'select select-sm', 'aria-label': 'Статус: ' + truck.name },
      TRUCK_STATUS.map(function (x) { return el('option', { value: x[0], selected: x[0] === truck.status, text: x[1] }); }));
    s.addEventListener('change', function () {
      var prev = truck.status;
      store.saveTruck(Object.assign({}, truck, { status: s.value })).then(function (saved) {
        truck.status = saved.status; ui.toast('Статус обновлён');
      }, function (e) { s.value = prev; ui.toast(A.errorText(e), { error: true }); });
    });
    return s;
  }

  function openTruckEdit(t, rerender) {
    var isNew = !t; t = t || { status: 'available', price_per_hour: 0, active: true, capacity_t: 0 };
    var name = A.field('Название', A.input('text', { value: t.name || '', maxlength: '60' }), { span: true });
    var body = A.field('Тип кузова', A.input('text', { value: t.body || '', list: 'body-list', maxlength: '30' }));
    var bodyList = el('datalist', { id: 'body-list' }, ['Борт', 'Самосвал', 'Манипулятор', 'Тент', 'Фургон'].map(function (u) { return el('option', { value: u }); }));
    var cap = A.field('Грузоподъёмность, т', A.input('number', { value: String(t.capacity_t || ''), min: '0', step: 'any' }));
    var price = A.field('Цена за час, ₽', A.input('number', { value: String(t.price_per_hour), min: '0', step: 'any' }));
    var status = A.field('Доступность', el('select', { class: 'select' },
      TRUCK_STATUS.map(function (x) { return el('option', { value: x[0], selected: x[0] === t.status, text: x[1] }); })));
    var desc = A.field('Описание', el('textarea', { class: 'textarea', rows: '3', maxlength: '200' }), { span: true });
    desc.input.value = t.description || '';
    var img = A.imageField('Фото (ссылка)', t.image);
    var active = el('input', { type: 'checkbox', checked: t.active !== false });
    var activeLabel = el('label', { class: 'check span-2' }, [active, el('span', { text: 'Показывать на сайте' })]);
    var save = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Сохранить' });
    var form = el('form', { novalidate: true }, [
      el('div', { class: 'form-grid cols-2' }, [name.root, body.root, cap.root, price.root, status.root, desc.root, img.root, activeLabel]),
      bodyList, el('div', { class: 'modal-actions' }, [save])]);
    var modal = ui.modal({ title: isNew ? 'Новый грузовик' : 'Изменить грузовик', body: form });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); save.disabled = true;
      store.saveTruck(Object.assign({}, t, { name: name.input.value, body: body.input.value, capacity_t: cap.input.value,
        price_per_hour: price.input.value, status: status.input.value, description: desc.input.value,
        image: img.getValue(), active: active.checked }))
        .then(function () { modal.close(); ui.toast('Грузовик сохранён'); rerender(); },
          function (err) { save.disabled = false; ui.toast(A.errorText(err), { error: true }); });
    });
  }

  A.tabs.push({ id: 'trucks', title: 'Грузовики', render: catalogTab({
    addLabel: 'Добавить грузовик', empty: 'Грузовиков пока нет. Добавьте первый.',
    headers: ['', 'Название', 'Цена за час, ₽', 'Статус', 'На сайте', ''],
    list: function () { return store.listTrucks(); },
    openEdit: openTruckEdit,
    row: function (t, rerender) {
      var edit = el('button', { class: 'btn btn-outline btn-sm', type: 'button', text: 'Изменить' });
      edit.addEventListener('click', function () { openTruckEdit(t, rerender); });
      var meta = [t.body, t.capacity_t ? calc.formatNumber(t.capacity_t) + ' т' : ''].filter(Boolean).join(', ');
      return el('tr', { class: t.active === false ? 'is-hidden' : '' }, [
        el('td', { class: 'cell-thumb' }, [thumb(t.image, 'truck')]),
        el('td', { 'data-label': 'Название', class: 'cell-wide' }, [el('strong', { text: t.name }), el('div', { class: 'muted small', text: meta })]),
        el('td', { 'data-label': 'Цена за час, ₽' }, [inlineNumber(t.price_per_hour, 'Цена за час: ' + t.name, function (v) { return store.saveTruck(Object.assign({}, t, { price_per_hour: v })).then(function (s) { t.price_per_hour = s.price_per_hour; }); })]),
        el('td', { 'data-label': 'Статус' }, [statusSelect(t)]),
        el('td', { 'data-label': 'На сайте' }, [activeToggle(t, function (x) { return store.saveTruck(x); })]),
        el('td', { class: 'cell-actions' }, [edit, removeButton('Грузовик «' + t.name + '» будет удалён из каталога.', function () {
          store.deleteTruck(t.id).then(function () { ui.toast('Грузовик удалён'); rerender(); },
            function (e) { ui.toast(A.errorText(e), { error: true }); });
        })])
      ]);
    }
  }) });
})();
