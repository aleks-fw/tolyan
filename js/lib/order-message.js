(function (root, factory) {
  var api;
  if (typeof module === 'object' && module.exports) {
    api = factory(require('./calc'), require('./validate'));
    module.exports = api;
  } else {
    root.Tolyan = root.Tolyan || {};
    api = factory(root.Tolyan.calc, root.Tolyan.validate);
    root.Tolyan.orderMessage = api;
  }
})(typeof self !== 'undefined' ? self : this, function (calc, validate) {
  'use strict';

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(iso || '');
  }

  function orderNumber(n) { return '№' + n; }

  function itemLine(it) {
    if (it.kind === 'truck') {
      return '- ' + it.name + ': ' + it.hours + ' ч × ' + calc.formatMoney(it.price_per_hour) +
        '/ч = ' + calc.formatMoney(it.line_total);
    }
    return '- ' + it.name + ': ' + calc.formatNumber(it.qty) + ' ' + it.unit + ' × ' +
      calc.formatMoney(it.price) + ' = ' + calc.formatMoney(it.line_total);
  }

  // order: { number, type, items, total, customer_name, phone, address, date, time, comment }
  function buildOrderMessage(order, companyName) {
    var rental = order.type === 'rental';
    var lines = [];
    lines.push('Заказ ' + orderNumber(order.number) + ' — «' + (companyName || 'Толян') + '»');
    lines.push('Тип: ' + (rental ? 'Аренда грузовика' : 'Доставка материалов'));
    lines.push(rental ? 'Машина:' : 'Состав:');
    for (var i = 0; i < order.items.length; i++) lines.push(itemLine(order.items[i]));
    lines.push('Итого: ' + calc.formatMoney(order.total));
    lines.push((rental ? 'Адрес подачи: ' : 'Адрес доставки: ') + order.address);
    var when = formatDate(order.date) + (order.time ? ', ' + order.time : '');
    lines.push('Дата: ' + when);
    lines.push('Клиент: ' + order.customer_name + ', ' + validate.formatPhone(order.phone));
    if (order.comment) lines.push('Комментарий: ' + order.comment);
    return lines.join('\n');
  }

  // Ссылки Telegram. text префиллится не во всех клиентах, поэтому UI ещё и копирует его в буфер.
  function telegramLinks(username, text) {
    var u = validate.telegramUsername(username);
    if (!u) return null;
    return {
      open: 'https://t.me/' + u,
      send: 'https://t.me/' + u + '?text=' + encodeURIComponent(text || '')
    };
  }

  return { formatDate: formatDate, orderNumber: orderNumber, buildOrderMessage: buildOrderMessage,
           telegramLinks: telegramLinks };
});
