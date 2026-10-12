(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Tolyan = root.Tolyan || {}; root.Tolyan.validate = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function ok(value) { return { ok: true, value: value, error: '' }; }
  function fail(error) { return { ok: false, value: null, error: error }; }

  // Принимает +7 900 123-45-67, 8 (900) 123-45-67, 9001234567. Возвращает +79001234567.
  function normalizePhone(input) {
    var d = String(input || '').replace(/\D/g, '');
    if (d.length === 11 && (d[0] === '7' || d[0] === '8')) d = d.slice(1);
    if (d.length !== 10) return null;
    return '+7' + d;
  }

  function formatPhone(normalized) {
    var m = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(normalized || '');
    return m ? '+7 ' + m[1] + ' ' + m[2] + '-' + m[3] + '-' + m[4] : String(normalized || '');
  }

  function phone(input) {
    var s = String(input || '').trim();
    if (!s) return fail('Введите телефон');
    var n = normalizePhone(s);
    return n ? ok(n) : fail('Телефон в формате +7 900 123-45-67');
  }

  function name(input) {
    var s = String(input || '').trim().replace(/\s+/g, ' ');
    if (!s) return fail('Введите имя');
    if (s.length < 2) return fail('Имя слишком короткое');
    if (s.length > 60) return fail('Имя слишком длинное (до 60 символов)');
    return ok(s);
  }

  function address(input) {
    var s = String(input || '').trim().replace(/\s+/g, ' ');
    if (!s) return fail('Укажите адрес');
    if (s.length < 5) return fail('Укажите адрес подробнее: город, улица, дом');
    if (s.length > 200) return fail('Адрес слишком длинный (до 200 символов)');
    return ok(s);
  }

  function comment(input) {
    var s = String(input || '').trim();
    if (s.length > 500) return fail('Комментарий слишком длинный (до 500 символов)');
    return ok(s);
  }

  // stock === undefined — без проверки остатка
  function quantity(input, stock) {
    var n = Number(String(input).replace(',', '.'));
    if (input === '' || input == null || !isFinite(n)) return fail('Введите количество');
    if (n <= 0) return fail('Количество должно быть больше нуля');
    if (Math.round(n * 100) / 100 !== n) return fail('Не больше двух знаков после запятой');
    if (stock !== undefined && n > stock) return fail('В наличии только ' + stock);
    return ok(n);
  }

  function hours(input) {
    var n = Number(input);
    if (input === '' || input == null || !isFinite(n)) return fail('Укажите количество часов');
    if (!Number.isInteger(n)) return fail('Только целое число часов');
    if (n < 1 || n > 24) return fail('От 1 до 24 часов');
    return ok(n);
  }

  // dateStr и todayStr в формате YYYY-MM-DD
  function date(dateStr, todayStr) {
    var s = String(dateStr || '').trim();
    if (!s) return fail('Выберите дату');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s))) return fail('Неверная дата');
    if (todayStr && s < todayStr) return fail('Дата не может быть в прошлом');
    return ok(s);
  }

  function time(input, required) {
    var s = String(input || '').trim();
    if (!s) return required ? fail('Выберите время') : ok('');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return fail('Время в формате ЧЧ:ММ');
    return ok(s);
  }

  // @nick, nick, https://t.me/nick -> nick; null, если не похоже на ник Telegram
  function telegramUsername(input) {
    var s = String(input || '').trim()
      .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
      .replace(/^@/, '')
      .replace(/[/?#].*$/, '');
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s) ? s : null;
  }

  function telegram(input) {
    var s = String(input || '').trim();
    if (!s) return fail('Укажите ник Telegram');
    var n = telegramUsername(s);
    return n ? ok(n) : fail('Ник: 5-32 символа, латиница, цифры и _, начинается с буквы');
  }

  function price(input) {
    var n = Number(String(input).replace(',', '.'));
    if (input === '' || input == null || !isFinite(n)) return fail('Введите цену');
    if (n < 0) return fail('Цена не может быть отрицательной');
    return ok(Math.round(n * 100) / 100);
  }

  function stock(input) {
    var n = Number(String(input).replace(',', '.'));
    if (input === '' || input == null || !isFinite(n)) return fail('Введите количество');
    if (n < 0) return fail('Остаток не может быть отрицательным');
    return ok(Math.round(n * 100) / 100);
  }

  return { normalizePhone: normalizePhone, formatPhone: formatPhone, phone: phone, name: name,
           address: address, comment: comment, quantity: quantity, hours: hours, date: date,
           time: time, telegramUsername: telegramUsername, telegram: telegram, price: price,
           stock: stock };
});
