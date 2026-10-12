// Вкладка «Настройки»: компания, тексты главной, контакты, Telegram, резервная копия.
(function () {
  'use strict';
  var A = window.Tolyan.admin, el = A.el, ui = A.ui, store = A.store, V = A.V;

  function text(label, value, opts) { return A.field(label, A.input('text', { value: value || '', maxlength: (opts && opts.max) || '120' }), opts); }
  function area(label, value, rows) {
    var f = A.field(label, el('textarea', { class: 'textarea', rows: String(rows || 3), maxlength: '400' }), { span: true });
    f.input.value = value || '';
    return f;
  }

  function section(title, hint, fields) {
    return el('fieldset', { class: 'settings-block card' }, [
      el('legend', { text: title }), hint ? el('p', { class: 'muted', text: hint }) : null,
      el('div', { class: 'form-grid cols-2' }, fields)]);
  }

  function download(name, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function render(panel) {
    return store.getSettings().then(function (s) {
      var f = {
        company_name: text('Название компании', s.company_name, { max: '40' }),
        tagline: text('Короткое описание', s.tagline, { span: true }),
        hero_title: text('Заголовок главной', s.hero_title, { span: true, max: '100' }),
        hero_subtitle: area('Подзаголовок главной', s.hero_subtitle, 3),
        phone: text('Телефон', s.phone, { max: '30' }),
        email: text('Почта', s.email, { max: '60' }),
        address: text('Адрес', s.address, { span: true }),
        work_hours: text('Режим работы', s.work_hours, { span: true }),
        telegram_username: text('Ник Telegram владельца', s.telegram_username, { max: '60',
          hint: 'Например @tolyan_dostavka. Сюда клиенты отправляют текст заказа.' }),
        footer_text: text('Текст в подвале', s.footer_text, { span: true, max: '160' }),
        delivery_note: area('Пояснение про стоимость доставки', s.delivery_note, 2)
      };
      var hero = A.imageField('Главное фото (ссылка)', s.hero_image);
      var adv = (s.advantages || []).slice(0, 4);
      while (adv.length < 4) adv.push({ title: '', text: '' });
      var advFields = adv.map(function (a, i) {
        return { title: text('Преимущество ' + (i + 1) + ': заголовок', a.title, { max: '40' }),
                 text: text('Преимущество ' + (i + 1) + ': текст', a.text, { max: '160' }) };
      });

      var tgPreview = el('p', { class: 'field-hint' });
      function updatePreview() {
        var u = V.telegramUsername(f.telegram_username.input.value);
        tgPreview.textContent = u ? 'Ссылка для клиентов: https://t.me/' + u : 'Ник не распознан';
      }
      f.telegram_username.input.addEventListener('input', updatePreview);
      updatePreview();

      var suggest = el('input', { type: 'checkbox', checked: s.address_suggest !== false });
      var suggestRow = el('label', { class: 'check span-2' }, [suggest,
        el('span', { text: 'Подсказывать адреса при вводе (поиск по OpenStreetMap, сервис Photon)' })]);
      var save = el('button', { class: 'btn btn-primary btn-lg', type: 'submit', text: 'Сохранить настройки' });
      var form = el('form', { class: 'settings-form', novalidate: true }, [
        section('Компания', null, [f.company_name.root, f.tagline.root]),
        section('Контакты', null, [f.phone.root, f.email.root, f.address.root, f.work_hours.root]),
        section('Подсказки адреса', 'Пока клиент вводит адрес, введённый текст отправляется во внешний сервис подсказок. Отключите, если это нежелательно.',
          [suggestRow]),
        section('Telegram', 'Заказы сохраняются в базу в любом случае. Ник нужен для кнопок «Открыть Telegram» и «Отправить заказ».',
          [f.telegram_username.root, el('div', { class: 'span-2' }, [tgPreview])]),
        section('Тексты главной страницы', null, [f.hero_title.root, f.hero_subtitle.root, hero.root,
          f.footer_text.root, f.delivery_note.root]),
        section('Преимущества', 'Четыре блока на главной. Первый показывается крупным.',
          advFields.reduce(function (acc, p) { return acc.concat([p.title.root, p.text.root]); }, [])),
        el('div', { class: 'settings-save' }, [save])
      ]);

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var tg = V.telegram(f.telegram_username.input.value);
        if (!tg.ok) { f.telegram_username.setError(tg.error); f.telegram_username.input.focus(); return; }
        if (!f.company_name.input.value.trim()) { f.company_name.setError('Укажите название компании'); f.company_name.input.focus(); return; }
        save.disabled = true;
        var patch = { hero_image: hero.getValue() || '', telegram_username: tg.value, address_suggest: suggest.checked,
          advantages: advFields.map(function (p) { return { title: p.title.input.value.trim(), text: p.text.input.value.trim() }; })
                              .filter(function (a) { return a.title || a.text; }) };
        Object.keys(f).forEach(function (k) { if (k !== 'telegram_username') patch[k] = f[k].input.value.trim(); });
        store.saveSettings(patch).then(function (saved) {
          save.disabled = false; f.telegram_username.input.value = saved.telegram_username; updatePreview();
          ui.toast('Настройки сохранены');
        }, function (err) { save.disabled = false; ui.toast(A.errorText(err), { error: true }); });
      });

      /* резервная копия */
      var exportBtn = el('button', { class: 'btn btn-outline', type: 'button', text: 'Скачать резервную копию' });
      exportBtn.addEventListener('click', function () {
        store.exportAll().then(function (d) {
          download('tolyan-backup-' + new Date().toISOString().slice(0, 10) + '.json', d); ui.toast('Файл скачан');
        });
      });
      var importInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'file-input', 'aria-label': 'Файл резервной копии' });
      importInput.addEventListener('change', function () {
        var file = importInput.files[0]; if (!file) return;
        A.confirm('Загрузить копию?', 'Текущие материалы, грузовики, заказы и настройки будут заменены данными из файла.', 'Загрузить')
          .then(function (yes) {
            if (!yes) { importInput.value = ''; return; }
            file.text().then(function (t) { return store.importAll(JSON.parse(t)); }).then(function () {
              ui.toast('Данные загружены'); render(panel);
            }, function (err) {
              importInput.value = '';
              ui.toast(err instanceof SyntaxError ? 'Файл повреждён: это не JSON' : A.errorText(err), { error: true });
            });
          });
      });
      var blocks = [el('p', { class: 'muted', text: 'Копия содержит каталог, заказы и настройки. Храните файл в надёжном месте.' }),
        el('div', { class: 'backup-row' }, [exportBtn, el('label', { class: 'btn btn-outline' }, ['Загрузить копию', importInput])])];
      if (store.mode === 'demo') {
        var reset = el('button', { class: 'btn btn-danger', type: 'button', text: 'Сбросить демо-данные' });
        reset.addEventListener('click', function () {
          A.confirm('Сбросить все данные?', 'Каталог, заказы и настройки вернутся к стартовым. Сделайте резервную копию, если нужно что-то сохранить.', 'Сбросить')
            .then(function (yes) { if (yes) store.resetDemo().then(function () { ui.toast('Данные сброшены'); render(panel); }); });
        });
        blocks.push(el('div', { class: 'backup-row' }, [reset]));
      }
      panel.replaceChildren(form, el('section', { class: 'settings-block card' }, [el('h2', { class: 'block-title', text: 'Резервная копия' })].concat(blocks)));
    });
  }

  A.tabs.push({ id: 'settings', title: 'Настройки', render: render });
})();
