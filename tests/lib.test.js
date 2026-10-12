const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/lib/calc');
const v = require('../js/lib/validate');
const om = require('../js/lib/order-message');

const NB = ' ';

test('calc: деньги форматируются с неразрывными пробелами', () => {
  assert.equal(calc.formatNumber(1234567), `1${NB}234${NB}567`);
  assert.equal(calc.formatNumber(1234.5), `1${NB}234,50`);
  assert.equal(calc.formatMoney(450), `450${NB}₽`);
  assert.equal(calc.formatNumber(0), '0');
});

test('calc: стоимость аренды = часы × цена, без дробного мусора', () => {
  assert.equal(calc.rentalTotal(1200, 4), 4800);
  assert.equal(calc.lineTotal(0.1, 3), 0.3);
  assert.equal(calc.sumLines([{ price: 450, qty: 10 }, { price: 600, qty: 2.5 }]), 6000);
  assert.equal(calc.rentalTotal(1200, ''), 0);
});

test('validate.phone: нормализация и отказы', () => {
  assert.equal(v.phone('+7 900 123-45-67').value, '+79001234567');
  assert.equal(v.phone('8 (900) 123-45-67').value, '+79001234567');
  assert.equal(v.phone('9001234567').value, '+79001234567');
  assert.equal(v.phone('12345').ok, false);
  assert.equal(v.phone('').error, 'Введите телефон');
  assert.equal(v.formatPhone('+79001234567'), '+7 900 123-45-67');
});

test('validate.quantity: остаток и формат', () => {
  assert.equal(v.quantity('10', 120).value, 10);
  assert.equal(v.quantity('2,5', 120).value, 2.5);
  assert.equal(v.quantity('0', 120).ok, false);
  assert.equal(v.quantity('-1', 120).ok, false);
  assert.equal(v.quantity('', 120).ok, false);
  assert.equal(v.quantity('abc', 120).ok, false);
  assert.match(v.quantity('121', 120).error, /120/);
  assert.equal(v.quantity('1.234').ok, false);
});

test('validate.hours: целое от 1 до 24', () => {
  assert.equal(v.hours('4').value, 4);
  assert.equal(v.hours('0').ok, false);
  assert.equal(v.hours('25').ok, false);
  assert.equal(v.hours('1.5').ok, false);
  assert.equal(v.hours('').ok, false);
});

test('validate.date/time', () => {
  assert.equal(v.date('2026-10-15', '2026-10-12').ok, true);
  assert.equal(v.date('2026-10-12', '2026-10-12').ok, true);
  assert.equal(v.date('2026-10-11', '2026-10-12').ok, false);
  assert.equal(v.date('', '2026-10-12').ok, false);
  assert.equal(v.date('15.10.2026', '2026-10-12').ok, false);
  assert.equal(v.time('', true).ok, false);
  assert.equal(v.time('', false).ok, true);
  assert.equal(v.time('25:00', false).ok, false);
  assert.equal(v.time('09:30', true).value, '09:30');
});

test('validate.telegram: нормализация ника', () => {
  assert.equal(v.telegramUsername('@tolyan_dostavka'), 'tolyan_dostavka');
  assert.equal(v.telegramUsername('https://t.me/tolyan_dostavka'), 'tolyan_dostavka');
  assert.equal(v.telegramUsername('t.me/x'), null);
  assert.equal(v.telegramUsername('abc'), null);
  assert.equal(v.telegramUsername('1tolyan'), null);
  assert.equal(v.telegramUsername('ник_кириллица'), null);
  assert.equal(v.telegram('').ok, false);
});

const delivery = {
  number: 12, type: 'delivery', total: 6000, customer_name: 'Иван', phone: '+79001234567',
  address: 'Вологда, ул. Ленина, 1', date: '2026-10-15', time: '10:00', comment: 'Позвонить за час',
  items: [
    { kind: 'material', name: 'Песок карьерный', unit: 'т', qty: 10, price: 450, line_total: 4500 },
    { kind: 'material', name: 'Отсев', unit: 'т', qty: 2.5, price: 600, line_total: 1500 }
  ]
};

test('order-message: доставка', () => {
  const t = om.buildOrderMessage(delivery, 'Толян');
  assert.match(t, /^Заказ №12 — «Толян»/);
  assert.match(t, /Тип: Доставка материалов/);
  assert.match(t, /- Песок карьерный: 10 т × 450.₽ = 4.500.₽/);
  assert.match(t, /- Отсев: 2,50 т|- Отсев: 2\.5 т|- Отсев: 2,5 т/);
  assert.match(t, /Итого: 6.000.₽/);
  assert.match(t, /Дата: 15\.10\.2026, 10:00/);
  assert.match(t, /Клиент: Иван, \+7 900 123-45-67/);
  assert.match(t, /Комментарий: Позвонить за час/);
});

test('order-message: аренда, без комментария', () => {
  const t = om.buildOrderMessage({
    number: 3, type: 'rental', total: 4800, customer_name: 'Пётр', phone: '+79001234567',
    address: 'Склад', date: '2026-10-15', time: '08:00', comment: '',
    items: [{ kind: 'truck', name: 'ГАЗон Next (борт)', hours: 4, price_per_hour: 1200, line_total: 4800 }]
  }, 'Толян');
  assert.match(t, /Тип: Аренда грузовика/);
  assert.match(t, /4 ч × 1.200.₽\/ч = 4.800.₽/);
  assert.match(t, /Адрес подачи: Склад/);
  assert.doesNotMatch(t, /Комментарий/);
});

test('order-message: ссылки Telegram', () => {
  const l = om.telegramLinks('@tolyan_dostavka', 'Заказ №1\nПесок');
  assert.equal(l.open, 'https://t.me/tolyan_dostavka');
  assert.equal(l.send, 'https://t.me/tolyan_dostavka?text=' + encodeURIComponent('Заказ №1\nПесок'));
  assert.equal(om.telegramLinks('', 'x'), null);
});
