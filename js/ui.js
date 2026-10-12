// Общие помощники интерфейса: DOM-хелпер, toast, появление блоков при скролле, запасные картинки.
(function () {
  'use strict';
  var T = (window.Tolyan = window.Tolyan || {});

  // el('div', {class: 'x', 'data-id': 1}, [child | 'text']). Текст всегда через textContent (защита от XSS).
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function toast(message, opts) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var t = el('div', { class: 'toast' + (opts && opts.error ? ' is-error' : ''), text: message });
    host.appendChild(t);
    setTimeout(function () { t.remove(); }, (opts && opts.ms) || 4000);
  }

  var observer = null;
  function reveal(root) {
    var nodes = (root || document).querySelectorAll('.reveal:not(.is-visible)');
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.add('is-visible');
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
    }
    for (var j = 0; j < nodes.length; j++) observer.observe(nodes[j]);
  }

  // Картинка с запасным вариантом: пустой src или ошибка загрузки => SVG-заглушка.
  function image(src, alt, kind, attrs) {
    var fallback = 'assets/img/' + (kind === 'truck' ? 'truck' : 'material') + '-placeholder.svg';
    var img = el('img', Object.assign({ alt: alt || '', loading: 'lazy', decoding: 'async' }, attrs || {}));
    img.addEventListener('error', function onErr() {
      img.removeEventListener('error', onErr);
      img.src = fallback;
    });
    img.src = src || fallback;
    return img;
  }

  T.ui = { el: el, toast: toast, reveal: reveal, image: image };
})();
