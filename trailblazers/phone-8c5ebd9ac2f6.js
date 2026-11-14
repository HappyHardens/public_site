(function () {
  'use strict';
  var A = window.TrailAvatars, T = window.Trail, conn, identity, room, me, seq = -1, lastSent = 0, lastX = 0, lastY = 0, x = 0, y = 0, online = false;
  var joystick = new window.TrailJoystick.Joystick(T.byId('joystick'), T.byId('knob'), function (nx, ny) { x = nx; y = ny; flush(); });
  var rememberedAvatar = T.storageGet('trailblazers:last-avatar');
  var selectedAvatar = rememberedAvatar || 'lightning';
  if (!A.find(selectedAvatar)) selectedAvatar = 'lightning';
  function createPicker(id, choose) {
    var container = T.byId(id);
    A.list.forEach(function (avatar) {
      var button = document.createElement('button'), badge = document.createElement('span'), label = document.createElement('span');
      button.type = 'button'; button.className = 'avatar-option'; button.setAttribute('data-avatar-choice', avatar.id);
      button.setAttribute('aria-label', avatar.label); button.setAttribute('aria-pressed', 'false');
      badge.className = 'avatar-chip'; A.badge(badge, avatar.id, '#e8dfce');
      // The button's accessible name describes the icon; don't announce it twice.
      badge.firstChild.alt = ''; label.className = 'avatar-label'; label.textContent = avatar.label;
      button.appendChild(badge); button.appendChild(label); button.onclick = function () { choose(avatar.id); }; container.appendChild(button);
    });
  }
  function paintPicker(id, avatar, color) {
    var buttons = T.byId(id).querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var selected = buttons[i].getAttribute('data-avatar-choice') === avatar;
      buttons[i].classList.toggle('selected', selected); buttons[i].setAttribute('aria-pressed', String(selected));
      buttons[i].firstChild.style.backgroundColor = selected ? color : '#e8dfce';
      buttons[i].disabled = id === 'room-avatars' && !online;
    }
  }
  createPicker('join-avatars', function (avatar) { selectedAvatar = avatar; paintPicker('join-avatars', avatar, A.colors[0]); });
  createPicker('room-avatars', function (avatar) { if (conn && online) { T.show('error', false); conn.send({ type: 'avatar', avatar: avatar }); } });
  paintPicker('join-avatars', selectedAvatar, A.colors[0]);
  function error(message) { T.text('error', message); T.show('error', true); }
  function flush() {
    var now = Date.now();
    if (!conn || !online || !me || !me.alive || !room || room.phase !== 'running') return;
    if (now - lastSent < 45 && (x !== 0 || y !== 0)) return;
    if (x === lastX && y === lastY && now - lastSent < 150) return;
    conn.send({ type: 'input', seq: ++seq, x: x, y: y }); lastSent = now; lastX = x; lastY = y;
  }
  setInterval(function () { if (x || y) flush(); }, 55);
  function begin(hello) {
    if (conn) conn.stop(); T.show('error', false); T.byId('join-button').disabled = true;
    conn = new T.Connection(hello, { status: function (label, connected) {
      online = connected; T.text('connection', label); T.byId('connection').classList.toggle('offline', !connected);
      if (!connected) { var choices = T.byId('room-avatars').querySelectorAll('button'); for (var i = 0; i < choices.length; i++) choices[i].disabled = true; T.byId('start').disabled = true; joystick.enable(false); x = 0; y = 0; if (me) { T.text('phone-title', 'Connection lost'); T.text('phone-detail', 'Your rider keeps moving. Reconnecting to the same rider…'); } }
    }, message: function (m) {
      if (m.type === 'welcome') {
        identity = { code: m.code, playerId: m.playerId, token: m.token }; seq = m.inputSeq; lastSent = 0; lastX = 0; lastY = 0;
        T.show('storage-warning', !T.storageSet('trailblazers:' + m.code, identity)); T.storageSet('trailblazers:last-name', T.byId('name-input').value);
        T.show('join-screen', false); T.show('controller', true); T.show('error', false); history.replaceState(null, '', window.TrailRoutes.join(m.code));
      } else if (m.type === 'state') render(m.room);
      else if (m.type === 'replaced') { joystick.enable(false); error(m.message + ' Close this tab, or reload to take control here.'); }
      else if (m.type === 'left') {
        T.storageSet('trailblazers:' + identity.code, null); conn.stop(); online = false; identity = null; me = null; room = null;
        T.show('controller', false); T.show('join-screen', true); T.byId('join-button').disabled = false; T.text('connection', 'Ready to join');
      } else if (m.type === 'error') {
        error(m.message); T.byId('join-button').disabled = false;
        if (m.code === 'BAD_TOKEN' || m.code === 'ROOM_GONE') { T.storageSet('trailblazers:' + hello.code, null); identity = null; me = null; room = null; T.show('controller', false); T.show('join-screen', true); }
      }
    } });
  }
  function render(state) {
    room = state; if (!identity) return;
    me = null; var captain, winner, index = 0;
    room.players.forEach(function (p, i) { if (p.id === identity.playerId) { me = p; index = i; } if (p.id === room.captainId) captain = p; if (room.result && p.id === room.result.winnerId) winner = p; });
    if (!me) return;
    var isCaptain = me.id === room.captainId, between = room.phase === 'lobby' || room.phase === 'results', connected = room.players.filter(function (p) { return p.connected; }).length;
    T.text('rider-name', me.name); T.text('rider-meta', 'ROOM ' + room.code + (isCaptain ? ' · CAPTAIN' : ' · RIDER ' + (index + 1)));
    A.badge(T.byId('rider-badge'), me.avatar, me.color); A.badge(T.byId('knob'), me.avatar, me.color);
    T.show('avatar-panel', between); paintPicker('room-avatars', me.avatar, me.color);
    A.badge(T.byId('sample-badge'), me.avatar, me.color); T.byId('sample-line').style.backgroundColor = me.color;
    if (selectedAvatar !== me.avatar) { selectedAvatar = me.avatar; paintPicker('join-avatars', selectedAvatar, me.color); }
    if (rememberedAvatar !== me.avatar) { T.storageSet('trailblazers:last-avatar', me.avatar); rememberedAvatar = me.avatar; }
    var wins = T.byId('wins'); wins.firstChild.nodeValue = me.wins;
    T.show('captain-controls', isCaptain && between); T.byId('mode').value = room.mode;
    T.byId('start').disabled = !online || connected < 2 || (room.mode === 'duel' && connected !== 2);
    T.text('start', (room.phase === 'results' ? 'Rematch' : 'Start round') + ' · ' + connected + ' riders');
    T.show('leave', between); T.show('stick-section', !between); T.show('phone-scoreboard', between);
    joystick.enable(online && room.phase === 'running' && me.alive);
    T.text('direction-label', room.phase === 'running' && me.alive ? 'MOVING ' + me.dir.toUpperCase() : 'HOLD TO STEER');
    if (room.phase === 'lobby') {
      T.text('phone-kicker', connected + ' RIDERS CONNECTED'); T.text('phone-title', 'You’re in!');
      T.text('phone-detail', isCaptain ? (connected < 2 ? 'Invite another rider, then start your round.' : room.mode === 'duel' && connected !== 2 ? 'Duel needs exactly two riders. Choose free-for-all for this crew.' : 'Your crew is ready. Start when everyone is looking up.') : (captain ? captain.name + ' will start the round. Keep this screen open.' : 'Waiting for a captain to reconnect.'));
    } else if (room.phase === 'countdown') {
      T.text('phone-kicker', 'ROUND ' + room.round + ' · GET READY'); T.text('phone-title', Math.max(1, Math.ceil(room.countdownMs / 1000))); T.text('phone-detail', 'Eyes on the arena. Steering unlocks at go!');
    } else if (room.phase === 'running') {
      T.text('phone-kicker', me.alive ? 'ROUND ' + room.round + ' · KEEP MOVING' : me.inRound ? 'YOUR TRAIL HAS CLEARED' : 'WATCH THIS ROUND'); T.text('phone-title', me.alive ? 'Stay in the game.' : me.inRound ? 'You’re out. Cheer them on!' : 'Next round is yours.');
      T.text('phone-detail', me.alive ? 'Drag toward a direction. Avoid walls and active trails.' : !me.inRound ? 'This round started while you were away. You’re back for the next one.' : 'That ' + (me.eliminated === 'head-on' ? 'head-on collision' : me.eliminated) + ' got you. You’re back next round.');
    } else {
      T.text('phone-kicker', 'ROUND ' + room.round + ' COMPLETE'); T.text('phone-title', winner ? (winner.id === me.id ? 'You blazed it!' : winner.name + ' wins!') : 'It’s a draw!');
      T.text('phone-detail', (winner ? '+1 win for the last rider standing. ' : 'No points this round. ') + (isCaptain ? 'Ready for a rematch?' : 'Your captain can start a rematch.'));
    }
    if (between) {
      var scoreboard = T.byId('phone-scoreboard'); scoreboard.textContent = '';
      room.players.forEach(function (p, i) {
        var row = document.createElement('div'), badge = document.createElement('span'), name = document.createElement('span'), score = document.createElement('strong');
        badge.className = 'rider-swatch'; A.badge(badge, p.avatar, p.color);
        name.textContent = p.name + (p.connected ? '' : ' · offline'); score.textContent = p.wins + ' wins'; row.appendChild(badge); row.appendChild(name); row.appendChild(score); scoreboard.appendChild(row);
      });
      var slots = T.byId('offline-slots'); slots.textContent = '';
      room.players.filter(function (p) { return !p.connected; }).forEach(function (p) {
        var row = document.createElement('div'), label = document.createElement('span'), button = document.createElement('button'); row.className = 'offline-slot'; label.textContent = p.name + ' · offline'; button.className = 'quiet'; button.textContent = 'Clear spot';
        button.onclick = function () { conn.send({ type: 'remove', playerId: p.id }); }; row.appendChild(label); row.appendChild(button); slots.appendChild(row);
      });
    }
  }
  T.byId('join-form').onsubmit = function (e) { e.preventDefault(); var code = T.byId('room-input').value.trim().toUpperCase(); var saved = T.storageGet('trailblazers:' + code);
    begin(saved && saved.token ? { v: 1, type: 'resume', code: code, playerId: saved.playerId, token: saved.token } : { v: 1, type: 'join', code: code, name: T.byId('name-input').value, avatar: selectedAvatar });
  };
  T.byId('start').onclick = function () { T.show('error', false); conn.send({ type: 'start' }); };
  T.byId('mode').onchange = function () { T.show('error', false); conn.send({ type: 'mode', mode: this.value }); };
  T.byId('leave').onclick = function () { conn.send({ type: 'leave' }); };
  var keys = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
  window.addEventListener('keydown', function (e) {
    if (!online || !me || !me.alive || !room || room.phase !== 'running' || !keys[e.key] || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault(); x = keys[e.key][0]; y = keys[e.key][1]; flush();
  });
  window.addEventListener('keyup', function (e) { if (keys[e.key]) { x = 0; y = 0; flush(); } });
  var code = T.query('room'), name = T.storageGet('trailblazers:last-name'); T.byId('room-input').value = code; T.byId('name-input').value = typeof name === 'string' ? name : '';
  var saved = code && T.storageGet('trailblazers:' + code);
  if (saved && saved.token) begin({ v: 1, type: 'resume', code: code, playerId: saved.playerId, token: saved.token });
}());
