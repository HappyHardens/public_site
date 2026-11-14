(function () {
  'use strict';
  function byId(id) { return document.getElementById(id); }
  function text(id, value) { byId(id).textContent = value; }
  function show(id, visible) { byId(id).classList.toggle('hidden', !visible); }
  function storageGet(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function storageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } }
  function query(name) { var match = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search); try { return match ? decodeURIComponent(match[1]).toUpperCase() : ''; } catch (e) { return ''; } }
  function Connection(hello, callbacks) {
    this.hello = hello; this.callbacks = callbacks; this.socket = null; this.stopped = false; this.ready = false; this.delay = 500; this.timer = null; this.request = null; this.wakeStarted = 0;
    this.connect();
  }
  Connection.prototype.connect = function () {
    var self = this;
    if (self.stopped) return;
    if (window.TrailRoutes.remote) { self.wake(); return; }
    self.openSocket();
  };
  Connection.prototype.wake = function () {
    var self = this;
    if (self.stopped) return;
    if (!self.wakeStarted) self.wakeStarted = Date.now();
    self.callbacks.status('Waking game server…', false);
    var request = new XMLHttpRequest(); self.request = request;
    request.open('GET', window.TrailRoutes.health, true); request.timeout = 10000;
    function done(ok) {
      if (self.stopped || self.request !== request) return;
      self.request = null;
      if (ok) { self.wakeStarted = 0; self.openSocket(); return; }
      if (Date.now() - self.wakeStarted > 120000) {
        self.stop(); self.callbacks.status('Couldn’t connect', false);
        self.callbacks.message({ v: 1, type: 'error', code: 'UNAVAILABLE', message: 'The game server is taking a little longer. Please try again.' }); return;
      }
      self.timer = setTimeout(function () { self.wake(); }, 2000);
    }
    request.onload = function () { var health; try { health = JSON.parse(request.responseText); } catch (e) {} done(request.status === 200 && health && health.game === 'trailblazers'); };
    request.onerror = request.ontimeout = function () { done(false); };
    request.send();
  };
  Connection.prototype.openSocket = function () {
    var self = this;
    if (self.stopped) return;
    self.callbacks.status('Connecting…', false);
    var socket = new WebSocket(window.TrailRoutes.socket);
    self.socket = socket;
    socket.onopen = function () { socket.send(JSON.stringify(self.hello)); };
    socket.onmessage = function (event) {
      var m; try { m = JSON.parse(event.data); } catch (e) { return; }
      if (m.v !== 1) return;
      if (m.type === 'welcome') {
        self.ready = true; self.delay = 500;
        self.hello = m.role === 'player' ? { v: 1, type: 'resume', code: m.code, playerId: m.playerId, token: m.token } : { v: 1, type: 'watch', code: m.code };
        self.callbacks.status('Connected', true);
      }
      if (m.type === 'replaced') { self.stop(); self.callbacks.status('Open in another tab', false); }
      if (m.type === 'error' && !self.ready) { self.stop(); self.callbacks.status('Not connected', false); }
      self.callbacks.message(m);
    };
    socket.onerror = function () { /* onclose owns recovery */ };
    socket.onclose = function () {
      self.ready = false;
      if (self.stopped) return;
      self.callbacks.status('Reconnecting…', false);
      self.timer = setTimeout(function () { self.connect(); }, self.delay);
      self.delay = Math.min(5000, self.delay * 1.6);
    };
  };
  Connection.prototype.send = function (message) {
    if (!this.ready || !this.socket || this.socket.readyState !== 1) return false;
    message.v = 1; this.socket.send(JSON.stringify(message)); return true;
  };
  Connection.prototype.stop = function () { this.stopped = true; this.ready = false; clearTimeout(this.timer); if (this.request) this.request.abort(); this.request = null; if (this.socket) this.socket.close(); };
  window.Trail = { byId: byId, text: text, show: show, storageGet: storageGet, storageSet: storageSet, query: query, Connection: Connection };
}());
