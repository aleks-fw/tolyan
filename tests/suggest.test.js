const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/lib/suggest');

test('suggest: адрес дома собирается в порядке «улица, дом, город, область, страна»', () => {
  assert.equal(S.formatFeature({ street: 'улица Ленина', housenumber: '15', city: 'Вологда', state: 'Вологодская область', country: 'Россия', osm_value: 'house' }),
    'улица Ленина, 15, Вологда, Вологодская область, Россия');
});

test('suggest: объект без улицы и повторы названий', () => {
  assert.equal(S.formatFeature({ name: 'Вологда', city: 'Вологда', state: 'Вологодская область', country: 'Россия' }),
    'Вологда, Вологодская область, Россия');
  assert.equal(S.formatFeature({ name: 'ТЦ Мега', street: 'Мира', housenumber: '2', city: 'Москва', osm_value: 'mall' }),
    'ТЦ Мега, Мира, 2, Москва');
  assert.equal(S.formatFeature({}), '');
});

test('suggest: parse убирает дубли и пустые', () => {
  const json = { features: [
    { properties: { name: 'Вологда', country: 'Россия' } },
    { properties: { name: 'Вологда', country: 'Россия' } },
    { properties: {} }
  ] };
  assert.deepEqual(S.parse(json).map((x) => x.label), ['Вологда, Россия']);
  assert.deepEqual(S.parse(null), []);
});

test('suggest: url кодирует запрос', () => {
  assert.equal(S.buildUrl(' ул. Мира 5 ', 4), 'https://photon.komoot.io/api/?q=' + encodeURIComponent('ул. Мира 5') + '&limit=4');
});
