(function () {
  'use strict';
  var config = window.HH_TRAILBLAZERS_CONFIG || {};
  var origin = location.protocol + '//' + location.host;
  var backend = config.backendOrigin || origin;
  var base = config.publicUrl || origin + '/';
  window.TrailRoutes = {
    remote: backend !== origin,
    asset: function (path) { return base + path; },
    health: backend + '/health',
    socket: backend.replace(/^http/, 'ws') + '/ws',
    qr: function (code) { return backend + '/qr/' + code + '.png'; },
    display: function (code) { return config.publicUrl ? base + (code ? '?room=' + code : '') : (code ? '/tv?room=' + code : '/'); },
    join: function (code) { return config.publicUrl ? base + 'join/?room=' + code : '/join?room=' + code; }
  };
}());
