const test = require('node:test');
const assert = require('node:assert/strict');
const { createLocalStore, memoryStorage } = require('../js/store');

const FIXED = () => new Date(2026, 9, 12, 12, 0, 0); // 12.10.2026

function mk() {
  return createLocalStore(memoryStorage(), { demoPassword: 'pw', now: FIXED });
}

const contact = { customer_name: 'Иван', phone: '8 900 123 45 67', address: 'Вологда, Ленина 1',
                  date: '2026-10-15', time: '10:00', comment: '' };

test('seed: каталог и настройки появляются при первом чтении', async () => {
  const s = mk();
  assert.ok((await s.listMaterials()).length >= 5);
  assert.ok((await s.listTrucks()).length >= 4);
  assert.equal((await s.getSettings()).company_name, 'Толян');
});

test('createOrder (доставка): итог считается по ценам хранилища, не клиента', async () => {
  const s = mk();
  const o = await s.createOrder({ ...contact, type: 'delivery', total: 1,
    lines: [{ material_id: 'm-sand', qty: 10 }, { material_id: 'm-sand', qty: 5 }, { material_id: 'm-screening', qty: '2,5' }] });
  assert.equal(o.number, 1);
  assert.equal(o.status, 'new');
  assert.equal(o.total, 450 * 15 + 600 * 2.5);
  assert.equal(o.items.length, 2);
  assert.equal(o.phone, '+79001234567');
  assert.match(o.message_text, /Заказ №1/);
  assert.equal((await s.listOrders()).length, 1);
  assert.equal((await s.createOrder({ ...contact, type: 'delivery', lines: [{ material_id: 'm-sand', qty: 1 }] })).number, 2);
});

test('createOrder: остаток, нулевой остаток, пустой заказ', async () => {
  const s = mk();
  await assert.rejects(s.createOrder({ ...contact, type: 'delivery', lines: [{ material_id: 'm-sand', qty: 121 }] }),
    (e) => e.code === 'VALIDATION' && /120/.test(e.fields.lines));
  await assert.rejects(s.createOrder({ ...contact, type: 'delivery', lines: [{ material_id: 'm-pgs', qty: 1 }] }),
    (e) => e.code === 'VALIDATION');
  await assert.rejects(s.createOrder({ ...contact, type: 'delivery', lines: [] }),
    (e) => !!e.fields.lines);
  assert.equal((await s.listOrders()).length, 0);
});

test('createOrder (аренда): часы × цена, недоступная машина, прошедшая дата', async () => {
  const s = mk();
  const o = await s.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 4 });
  assert.equal(o.total, 4800);
  assert.match(o.message_text, /Аренда грузовика/);
  await assert.rejects(s.createOrder({ ...contact, type: 'rental', truck_id: 't-kamaz-15', hours: 2 }),
    (e) => !!e.fields.truck_id);
  await assert.rejects(s.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 30 }),
    (e) => !!e.fields.hours);
  await assert.rejects(s.createOrder({ ...contact, date: '2026-10-01', type: 'rental', truck_id: 't-gazon', hours: 2 }),
    (e) => !!e.fields.date);
});

test('createOrder: ошибка поля контактов отдаётся по имени поля', async () => {
  const s = mk();
  await assert.rejects(s.createOrder({ ...contact, phone: '123', customer_name: '', type: 'rental', truck_id: 't-gazon', hours: 1 }),
    (e) => !!(e.fields.phone && e.fields.customer_name));
});

test('падение хука уведомления не отменяет заказ', async () => {
  const s = mk();
  s.hooks.onOrderCreated = () => { throw new Error('bot down'); };
  const o = await s.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 1 });
  assert.equal(o.number, 1);
});

test('админка: статусы, материалы, грузовики, настройки', async () => {
  const s = mk();
  const o = await s.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 1 });
  assert.equal((await s.setOrderStatus(o.id, 'confirmed')).status, 'confirmed');
  await assert.rejects(s.setOrderStatus(o.id, 'bogus'));

  const m = await s.saveMaterial({ name: 'Глина', price: '300', stock: '10', unit: 'м³' });
  assert.ok(m.id);
  assert.equal((await s.saveMaterial({ ...m, price: 350 })).price, 350);
  await assert.rejects(s.saveMaterial({ name: '', price: 1, stock: 1 }));
  await assert.rejects(s.saveMaterial({ name: 'X', price: -1, stock: 1 }));
  await s.deleteMaterial(m.id);
  assert.ok(!(await s.listMaterials()).some((x) => x.id === m.id));

  const t = await s.saveTruck({ name: 'Новый', price_per_hour: 1000, status: 'weird' });
  assert.equal(t.status, 'available');

  assert.equal((await s.saveSettings({ telegram_username: '@my_nick1' })).telegram_username, 'my_nick1');
  await assert.rejects(s.saveSettings({ telegram_username: 'x' }));

  await s.deleteOrder(o.id);
  assert.equal((await s.listOrders()).length, 0);
});

test('экспорт и импорт сохраняют заказы и счётчик', async () => {
  const a = mk();
  await a.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 1 });
  const dump = JSON.parse(JSON.stringify(await a.exportAll()));
  const b = mk();
  await b.importAll(dump);
  assert.equal((await b.listOrders()).length, 1);
  const o = await b.createOrder({ ...contact, type: 'rental', truck_id: 't-gazon', hours: 1 });
  assert.equal(o.number, 2);
  await assert.rejects(b.importAll({ nope: 1 }));
  await b.resetDemo();
  assert.equal((await b.listOrders()).length, 0);
});

test('вход: неверный и верный пароль, выход', async () => {
  const s = mk();
  assert.equal(await s.isAdmin(), false);
  await assert.rejects(s.login('bad'), (e) => e.code === 'AUTH');
  await s.login('pw');
  assert.equal(await s.isAdmin(), true);
  await s.logout();
  assert.equal(await s.isAdmin(), false);
});
