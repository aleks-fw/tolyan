(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Tolyan = root.Tolyan || {}; root.Tolyan.calc = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function round2(n) { return Math.round(n * 100) / 100; }

  // 1234567.5 -> "1 234 567,50" (неразрывные пробелы, без зависимости от Intl)
  function formatNumber(n) {
    var v = round2(Number(n) || 0);
    var neg = v < 0; v = Math.abs(v);
    var parts = v.toFixed(Number.isInteger(v) ? 0 : 2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '-' : '') + parts.join(',');
  }

  function formatMoney(n) { return formatNumber(n) + ' ₽'; }

  function lineTotal(price, qty) { return round2((Number(price) || 0) * (Number(qty) || 0)); }

  function rentalTotal(pricePerHour, hours) { return lineTotal(pricePerHour, hours); }

  function sumLines(lines) {
    var s = 0;
    for (var i = 0; i < lines.length; i++) s += lineTotal(lines[i].price, lines[i].qty);
    return round2(s);
  }

  return { round2: round2, formatNumber: formatNumber, formatMoney: formatMoney,
           lineTotal: lineTotal, rentalTotal: rentalTotal, sumLines: sumLines };
});
