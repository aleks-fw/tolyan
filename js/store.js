// Слой данных (демо-режим): localStorage. Интерфейс общий с будущим store-supabase.js, все методы асинхронные.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./lib/calc'), require('./lib/validate'),
      require('./lib/order-message'), require('./seed'));
  } else {
    root.Tolyan = root.Tolyan || {};
    var T = root.Tolyan;
    var api = factory(T.calc, T.validate, T.orderMessage, T.seed);
    T.createLocalStore = api.createLocalStore;
    var cfg = T.config || {};
    T.store = api.createLocalStore(api.safeStorage(root), {
      demoPassword: cfg.demoPassword,
      sessionStorage: api.safeStorage({ localStorage: root.sessionStorage })
    });
  }
})(typeof self !== 'undefined' ? self : this, function (calc, validate, orderMessage, seed) {
  'use strict';

  var KEYS = { materials: 'tolyan.materials', trucks: 'tolyan.trucks', orders: 'tolyan.orders',
               settings: 'tolyan.settings', counter: 'tolyan.counter' };
  var SESSION_KEY = 'tolyan.admin';
  var SEED_VERSION_KEY = 'tolyan.seedv';
  var SEED_VERSION = 2;
  var OLD_SEED_IMAGES = ['assets/img/gravel-pile.jpg', 'assets/img/stone.jpg',
                         'assets/img/truck-flatbed.jpg', 'assets/img/tipper-dump.jpg'];
  var TRUCK_STATUSES = ['available', 'busy', 'service'];
  var ORDER_STATUSES = ['new', 'confirmed', 'in_progress', 'done', 'cancelled'];

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  }

  // localStorage может бросать (приватный режим, запрет cookies): тогда работаем в памяти.
  function safeStorage(root) {
    try {
      var s = root.localStorage; var t = '__tolyan_test__';
      s.setItem(t, '1'); s.removeItem(t);
      return s;
    } catch (e) { return memoryStorage(); }
  }

  function fail(message, code) {
    var e = new Error(message); e.code = code || 'VALIDATION'; return e;
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function todayStr(now) {
    var d = now ? now() : new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function byName(a, b) { return (a.sort - b.sort) || String(a.name).localeCompare(String(b.name), 'ru'); }

  // opts: { demoPassword, sessionStorage, now }
  function createLocalStore(storage, opts) {
    opts = opts || {};
    var session = opts.sessionStorage || memoryStorage();
    var now = opts.now;
    var hooks = { onOrderCreated: null };

    function read(key, fallback) {
      try {
        var raw = storage.getItem(key);
        if (raw == null) return fallback();
        return JSON.parse(raw);
      } catch (e) { return fallback(); }
    }
    function write(key, value) { storage.setItem(key, JSON.stringify(value)); }

    // Миграция сохранённых демо-данных: у товаров из стартового набора заменяем старые общие фото на новые.
    // Фото, которые владелец поставил сам, не трогаем.
    function migrate() {
      var v = Number(read(SEED_VERSION_KEY, function () { return 0; }));
      if (v >= SEED_VERSION) return;
      ['materials', 'trucks'].forEach(function (name) {
        var raw = storage.getItem(KEYS[name]);
        if (raw == null) return;
        var list;
        try { list = JSON.parse(raw); } catch (e) { return; }
        var fresh = seed[name]();
        list.forEach(function (it) {
          var s = fresh.find(function (x) { return x.id === it.id; });
          if (s && (!it.image || OLD_SEED_IMAGES.indexOf(it.image) >= 0)) it.image = s.image;
        });
        write(KEYS[name], list);
      });
      write(SEED_VERSION_KEY, SEED_VERSION);
    }
    migrate();

    function load(name) {
      var v = read(KEYS[name], function () { return null; });
      if (v == null) {
        v = name === 'settings' ? seed.settings() : name === 'orders' ? [] : seed[name]();
        write(KEYS[name], v);
      }
      return v;
    }

    function upsert(name, item, prepare) {
      var list = load(name);
      var clean = prepare(item);
      if (!clean.id) clean.id = uid(name === 'materials' ? 'm' : 't');
      var i = list.findIndex(function (x) { return x.id === clean.id; });
      if (i >= 0) list[i] = clean; else { clean.sort = clean.sort || list.length + 1; list.push(clean); }
      write(KEYS[name], list);
      return clean;
    }

    function removeFrom(name, id) {
      write(KEYS[name], load(name).filter(function (x) { return x.id !== id; }));
    }

    function prepareMaterial(m) {
      var nameV = String(m.name || '').trim();
      if (!nameV) throw fail('Укажите название материала');
      var p = validate.price(m.price); if (!p.ok) throw fail(p.error);
      var s = validate.stock(m.stock); if (!s.ok) throw fail(s.error);
      return { id: m.id, name: nameV, description: String(m.description || '').trim(),
               unit: String(m.unit || 'т').trim() || 'т', price: p.value, stock: s.value,
               active: m.active !== false, sort: Number(m.sort) || 0, image: String(m.image || '') };
    }

    function prepareTruck(t) {
      var nameV = String(t.name || '').trim();
      if (!nameV) throw fail('Укажите название машины');
      var p = validate.price(t.price_per_hour); if (!p.ok) throw fail(p.error);
      var status = TRUCK_STATUSES.indexOf(t.status) >= 0 ? t.status : 'available';
      return { id: t.id, name: nameV, body: String(t.body || '').trim(),
               capacity_t: Number(t.capacity_t) || 0, price_per_hour: p.value, status: status,
               description: String(t.description || '').trim(), active: t.active !== false,
               sort: Number(t.sort) || 0, image: String(t.image || '') };
    }

    function nextNumber() {
      var n = Number(read(KEYS.counter, function () { return 0; })) + 1;
      write(KEYS.counter, n);
      return n;
    }

    // payload (доставка): { type:'delivery', lines:[{material_id, qty}], ...контакты }
    // payload (аренда):   { type:'rental', truck_id, hours, ...контакты }
    // Итог считается по ценам из хранилища, а не по присланным клиентом (как будет в RPC Supabase).
    function buildOrder(payload) {
      var errors = {};
      var settings = load('settings');
      var nameR = validate.name(payload.customer_name); if (!nameR.ok) errors.customer_name = nameR.error;
      var phoneR = validate.phone(payload.phone); if (!phoneR.ok) errors.phone = phoneR.error;
      var addrR = validate.address(payload.address); if (!addrR.ok) errors.address = addrR.error;
      var dateR = validate.date(payload.date, todayStr(now)); if (!dateR.ok) errors.date = dateR.error;
      var rental = payload.type === 'rental';
      var timeR = validate.time(payload.time, rental); if (!timeR.ok) errors.time = timeR.error;
      var comR = validate.comment(payload.comment); if (!comR.ok) errors.comment = comR.error;

      var items = [];
      if (rental) {
        var truck = load('trucks').find(function (t) { return t.id === payload.truck_id; });
        var hoursR = validate.hours(payload.hours);
        if (!hoursR.ok) errors.hours = hoursR.error;
        if (!truck || !truck.active) errors.truck_id = 'Машина не найдена';
        else if (truck.status !== 'available') errors.truck_id = 'Эта машина сейчас недоступна';
        else if (hoursR.ok) {
          items.push({ kind: 'truck', id: truck.id, name: truck.name + (truck.body ? ' (' + truck.body.toLowerCase() + ')' : ''),
                       hours: hoursR.value, price_per_hour: truck.price_per_hour,
                       line_total: calc.rentalTotal(truck.price_per_hour, hoursR.value) });
        }
      } else {
        var merged = {};
        (payload.lines || []).forEach(function (l) {
          if (!l || !l.material_id) return;
          merged[l.material_id] = (merged[l.material_id] || 0) + (Number(String(l.qty).replace(',', '.')) || 0);
        });
        var ids = Object.keys(merged);
        if (!ids.length) errors.lines = 'Добавьте хотя бы один материал';
        var materials = load('materials');
        ids.forEach(function (id) {
          var m = materials.find(function (x) { return x.id === id; });
          if (!m || !m.active) { errors.lines = 'Материал не найден: обновите страницу'; return; }
          var q = validate.quantity(merged[id], m.stock);
          if (!q.ok) { errors.lines = m.name + ': ' + q.error; return; }
          items.push({ kind: 'material', id: m.id, name: m.name, unit: m.unit, qty: q.value,
                       price: m.price, line_total: calc.lineTotal(m.price, q.value) });
        });
      }

      if (Object.keys(errors).length) {
        var e = fail('Проверьте поля формы', 'VALIDATION'); e.fields = errors; throw e;
      }
      var total = calc.round2(items.reduce(function (s, it) { return s + it.line_total; }, 0));
      return {
        order: { type: rental ? 'rental' : 'delivery', items: items, total: total,
                 customer_name: nameR.value, phone: phoneR.value, address: addrR.value,
                 date: dateR.value, time: timeR.value, comment: comR.value },
        company: settings.company_name
      };
    }

    var store = {
      mode: 'demo',
      hooks: hooks,

      listMaterials: function (o) {
        var l = load('materials').slice().sort(byName);
        if (o && o.onlyActive) l = l.filter(function (m) { return m.active; });
        return Promise.resolve(l);
      },
      saveMaterial: function (m) {
        try { return Promise.resolve(upsert('materials', m, prepareMaterial)); }
        catch (e) { return Promise.reject(e); }
      },
      deleteMaterial: function (id) { removeFrom('materials', id); return Promise.resolve(); },

      listTrucks: function (o) {
        var l = load('trucks').slice().sort(byName);
        if (o && o.onlyActive) l = l.filter(function (t) { return t.active; });
        return Promise.resolve(l);
      },
      saveTruck: function (t) {
        try { return Promise.resolve(upsert('trucks', t, prepareTruck)); }
        catch (e) { return Promise.reject(e); }
      },
      deleteTruck: function (id) { removeFrom('trucks', id); return Promise.resolve(); },

      createOrder: function (payload) {
        var built;
        try { built = buildOrder(payload || {}); } catch (e) { return Promise.reject(e); }
        var order = built.order;
        order.id = uid('o');
        order.number = nextNumber();
        order.status = 'new';
        order.created_at = (now ? now() : new Date()).toISOString();
        order.message_text = orderMessage.buildOrderMessage(order, built.company);
        var orders = load('orders');
        orders.push(order);
        write(KEYS.orders, orders);
        // Точка расширения под бота/вебхук. Ошибка здесь не должна отменять сохранённый заказ.
        try { if (typeof hooks.onOrderCreated === 'function') hooks.onOrderCreated(order); } catch (e) { /* ignore */ }
        return Promise.resolve(order);
      },
      listOrders: function () {
        var l = load('orders').slice().sort(function (a, b) { return b.number - a.number; });
        return Promise.resolve(l);
      },
      setOrderStatus: function (id, status) {
        if (ORDER_STATUSES.indexOf(status) < 0) return Promise.reject(fail('Неизвестный статус'));
        var orders = load('orders');
        var o = orders.find(function (x) { return x.id === id; });
        if (!o) return Promise.reject(fail('Заказ не найден', 'NOT_FOUND'));
        o.status = status;
        write(KEYS.orders, orders);
        return Promise.resolve(o);
      },
      deleteOrder: function (id) { removeFrom('orders', id); return Promise.resolve(); },

      getSettings: function () {
        var def = seed.settings(), cur = load('settings');
        return Promise.resolve(Object.assign(def, cur));
      },
      saveSettings: function (patch) {
        var cur = Object.assign(seed.settings(), load('settings'), patch || {});
        if (patch && 'telegram_username' in patch) {
          var tg = validate.telegram(patch.telegram_username);
          if (!tg.ok) return Promise.reject(fail(tg.error));
          cur.telegram_username = tg.value;
        }
        if (!String(cur.company_name || '').trim()) return Promise.reject(fail('Укажите название компании'));
        write(KEYS.settings, cur);
        return Promise.resolve(cur);
      },

      exportAll: function () {
        return Promise.resolve({ version: 1, exported_at: (now ? now() : new Date()).toISOString(),
          materials: load('materials'), trucks: load('trucks'), orders: load('orders'),
          settings: load('settings'), counter: Number(read(KEYS.counter, function () { return 0; })) });
      },
      importAll: function (data) {
        if (!data || data.version !== 1 || !Array.isArray(data.materials) || !Array.isArray(data.trucks) ||
            !Array.isArray(data.orders) || typeof data.settings !== 'object') {
          return Promise.reject(fail('Файл не похож на резервную копию «Толяна»'));
        }
        write(KEYS.materials, data.materials); write(KEYS.trucks, data.trucks);
        write(KEYS.orders, data.orders); write(KEYS.settings, data.settings);
        write(KEYS.counter, Number(data.counter) || data.orders.reduce(function (m, o) { return Math.max(m, o.number || 0); }, 0));
        return Promise.resolve();
      },
      resetDemo: function () {
        Object.keys(KEYS).forEach(function (k) { storage.removeItem(KEYS[k]); });
        return Promise.resolve();
      },

      login: function (password) {
        if (!opts.demoPassword || String(password) !== opts.demoPassword) {
          return Promise.reject(fail('Неверный пароль', 'AUTH'));
        }
        session.setItem(SESSION_KEY, '1');
        return Promise.resolve();
      },
      logout: function () { session.removeItem(SESSION_KEY); return Promise.resolve(); },
      isAdmin: function () { return Promise.resolve(session.getItem(SESSION_KEY) === '1'); }
    };
    return store;
  }

  return { createLocalStore: createLocalStore, safeStorage: safeStorage, memoryStorage: memoryStorage,
           ORDER_STATUSES: ORDER_STATUSES, TRUCK_STATUSES: TRUCK_STATUSES };
});
