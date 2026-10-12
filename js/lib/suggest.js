(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Tolyan = root.Tolyan || {}; root.Tolyan.suggest = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENDPOINT = 'https://photon.komoot.io/api/';
  var MIN_CHARS = 3;

  function buildUrl(query, limit) {
    return ENDPOINT + '?q=' + encodeURIComponent(String(query).trim()) + '&limit=' + (limit || 6);
  }

  function uniqueParts(parts) {
    var out = [];
    parts.forEach(function (p) {
      p = String(p || '').trim();
      if (p && out.indexOf(p) < 0) out.push(p);
    });
    return out;
  }

  // properties объекта Photon -> строка адреса: "улица, дом, город, область, страна"
  function formatFeature(p) {
    p = p || {};
    var first;
    if (p.street) {
      first = p.street + (p.housenumber ? ', ' + p.housenumber : '');
      if (p.name && p.name !== p.street && p.osm_value !== 'house') first = p.name + ', ' + first;
    } else {
      first = (p.name || '') + (p.housenumber ? ', ' + p.housenumber : '');
    }
    var place = p.city || p.locality || p.district || p.county;
    return uniqueParts([first, place, p.state, p.country]).join(', ');
  }

  // Ответ Photon (GeoJSON) -> [{ label }], без дублей
  function parse(json) {
    var feats = (json && json.features) || [];
    var seen = {}, out = [];
    feats.forEach(function (f) {
      var label = formatFeature(f && f.properties);
      if (label && !seen[label]) { seen[label] = true; out.push({ label: label }); }
    });
    return out;
  }

  return { ENDPOINT: ENDPOINT, MIN_CHARS: MIN_CHARS, buildUrl: buildUrl, formatFeature: formatFeature, parse: parse };
});
