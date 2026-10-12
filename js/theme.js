// Подключается в <head> без defer: ставит тему до первой отрисовки, чтобы не было «мигания».
(function () {
  var KEY = 'tolyan-theme';
  var root = document.documentElement;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; }
    catch (e) { return null; }
  }
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btns[i].setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    }
  }
  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* без сохранения тоже работает */ }
    apply(theme);
  }

  apply(saved() || 'light');

  document.addEventListener('DOMContentLoaded', function () {
    apply(root.getAttribute('data-theme') || 'light');
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (t) set(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  });

  window.Tolyan = window.Tolyan || {};
  window.Tolyan.theme = { set: set, get: function () { return root.getAttribute('data-theme'); } };
})();
