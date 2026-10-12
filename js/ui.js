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

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  // modal({ title, body: Node }) -> { el, close, setBody, setTitle }
  function modal(opts) {
    var prev = document.activeElement;
    var titleId = 'modal-title-' + Math.random().toString(36).slice(2, 7);
    var title = el('h2', { id: titleId, class: 'modal-title', text: opts.title || '' });
    var closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Закрыть окно', text: '×' });
    var bodyHost = el('div', { class: 'modal-body' });
    var dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
      el('div', { class: 'modal-head' }, [title, closeBtn]), bodyHost
    ]);
    var backdrop = el('div', { class: 'modal-backdrop' }, [dialog]);
    var closed = false;

    function setBody(node) { bodyHost.replaceChildren(node); }
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (!document.querySelector('.modal-backdrop')) document.body.classList.remove('modal-open');
      if (prev && prev.focus) prev.focus();
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = dialog.querySelectorAll(FOCUSABLE);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    setBody(opts.body || el('div'));
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    var firstField = dialog.querySelector('input,select,textarea') || closeBtn;
    firstField.focus();
    return { el: dialog, close: close, setBody: setBody, setTitle: function (t) { title.textContent = t; } };
  }

  // Копирование в буфер: Clipboard API, запасной путь через временный textarea.
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = el('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px;top:0' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var okay = false;
    try { okay = document.execCommand('copy'); } catch (e) { okay = false; }
    ta.remove();
    return okay;
  }

  // Файл-картинка -> data URL, уменьшенный до maxW по ширине (чтобы не раздувать localStorage).
  function fileToDataUrl(file, maxW) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Выберите файл-изображение')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Не удалось открыть изображение')); };
        img.onload = function () {
          var w = Math.min(maxW || 1000, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  T.ui = { el: el, toast: toast, reveal: reveal, image: image, modal: modal, copyText: copyText,
           fileToDataUrl: fileToDataUrl };
})();
