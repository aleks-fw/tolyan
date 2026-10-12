(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Tolyan = root.Tolyan || {}; root.Tolyan.seed = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Цены и остатки демонстрационные: владелец меняет их в админке.
  function materials() {
    return [
      { id: 'm-sand', name: 'Песок карьерный', description: 'Для подсыпки, выравнивания, раствора', unit: 'т', price: 450, stock: 120, active: true, sort: 1, image: 'assets/img/mat-sand.jpg' },
      { id: 'm-sand-washed', name: 'Песок мытый', description: 'Чистый, для бетона и кладки', unit: 'т', price: 700, stock: 80, active: true, sort: 2, image: 'assets/img/mat-sand-washed.jpg' },
      { id: 'm-gravel-520', name: 'Щебень гранитный 5-20', description: 'Фундаменты, бетон, дорожки', unit: 'т', price: 1450, stock: 200, active: true, sort: 3, image: 'assets/img/mat-gravel-520.jpg' },
      { id: 'm-gravel-2040', name: 'Щебень 20-40', description: 'Основание дорог и площадок', unit: 'т', price: 1350, stock: 150, active: true, sort: 4, image: 'assets/img/mat-gravel-2040.jpg' },
      { id: 'm-screening', name: 'Отсев', description: 'Дорожки, подсыпка, подушка под плитку', unit: 'т', price: 600, stock: 90, active: true, sort: 5, image: 'assets/img/mat-screening.jpg' },
      { id: 'm-soil', name: 'Грунт плодородный', description: 'Газон, клумбы, огород', unit: 'м³', price: 900, stock: 60, active: true, sort: 6, image: 'assets/img/mat-soil.jpg' },
      { id: 'm-pgs', name: 'ПГС', description: 'Песчано-гравийная смесь для насыпей', unit: 'т', price: 500, stock: 0, active: true, sort: 7, image: 'assets/img/mat-pgs.jpg' }
    ];
  }

  function trucks() {
    return [
      { id: 't-gazelle', name: 'ГАЗель Next', body: 'Борт', capacity_t: 1.5, price_per_hour: 900, status: 'available', description: 'Небольшие грузы, мебель, мешки и поддоны', active: true, sort: 1, image: 'assets/img/truck-gazelle.jpg' },
      { id: 't-gazon', name: 'ГАЗон Next', body: 'Борт', capacity_t: 5, price_per_hour: 1200, status: 'available', description: 'Стройматериалы на поддонах, перевозки по городу', active: true, sort: 2, image: 'assets/img/truck-gazon.jpg' },
      { id: 't-kamaz-15', name: 'КамАЗ 65115', body: 'Самосвал', capacity_t: 15, price_per_hour: 1800, status: 'busy', description: 'Песок, щебень, грунт, вывоз строительного мусора', active: true, sort: 3, image: 'assets/img/truck-kamaz-15.jpg' },
      { id: 't-kamaz-20', name: 'КамАЗ 6520', body: 'Самосвал', capacity_t: 20, price_per_hour: 2200, status: 'available', description: 'Большие объёмы сыпучих материалов', active: true, sort: 4, image: 'assets/img/truck-kamaz-20.jpg' },
      { id: 't-manip', name: 'Манипулятор', body: 'Манипулятор', capacity_t: 7, price_per_hour: 2000, status: 'service', description: 'Перевозка и разгрузка плит, блоков, бруса', active: true, sort: 5, image: 'assets/img/truck-manipulator.jpg' }
    ];
  }

  function settings() {
    return {
      company_name: 'Толян',
      tagline: 'Аренда грузовиков и доставка стройматериалов',
      phone: '+7 900 000-00-00',
      email: 'info@example.com',
      address: 'Укажите адрес в админ-панели',
      work_hours: 'Ежедневно, 08:00-20:00',
      telegram_username: 'tolyan_demo',
      hero_image: 'assets/img/hero.jpg',
      hero_title: 'Грузовики и стройматериалы с доставкой на объект',
      hero_subtitle: 'Арендуйте машину на нужные часы или закажите песок, щебень и грунт. Привезём вовремя, цена видна сразу.',
      advantages: [
        { title: 'Своя техника', text: 'Борта и самосвалы разной грузоподъёмности под вашу задачу.' },
        { title: 'Честная цена', text: 'Стоимость видна до заказа: цена за час и цена за тонну.' },
        { title: 'Быстрая подача', text: 'Подтверждаем заказ в день обращения и приезжаем в назначенное время.' },
        { title: 'Всё в одном месте', text: 'Материалы и транспорт у одного исполнителя, без посредников.' }
      ],
      footer_text: 'Аренда грузовиков и доставка стройматериалов.',
      delivery_note: 'Стоимость доставки рассчитывается отдельно по расстоянию, менеджер уточнит её при подтверждении заказа.'
    };
  }

  return { materials: materials, trucks: trucks, settings: settings };
});
