(function () {
  'use strict';
  var A = window.TrailAvatars, T = window.Trail, conn, currentRoom, preview = T.byId('preview'), arena = T.byId('arena');
  var colors = A.colors;
  function grid(ctx, width, height, cell) {
    ctx.fillStyle = '#28332e'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#35423b'; ctx.lineWidth = 1;
    ctx.beginPath(); var x, y;
    for (x = cell; x < width; x += cell) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, height); }
    for (y = cell; y < height; y += cell) { ctx.moveTo(0, y + 0.5); ctx.lineTo(width, y + 0.5); } ctx.stroke();
  }
  function demo(canvas) {
    var ctx = canvas.getContext('2d'), scale = Math.min(canvas.width / 720, canvas.height / 440);
    ctx.save(); ctx.fillStyle = '#28332e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate((canvas.width - 720 * scale) / 2, (canvas.height - 440 * scale) / 2); ctx.scale(scale, scale); grid(ctx, 720, 440, 22);
    var paths = [[[30, 100], [180, 100], [180, 190], [520, 190], [520, 110], [620, 110]], [[30, 280], [360, 280], [360, 350], [600, 350]], [[30, 400], [170, 400], [170, 460], [430, 460]], [[30, 550], [540, 550], [540, 460], [650, 460]]];
    var ids = ['lightning', 'skateboard', 'planet', 'vinyl'];
    paths.forEach(function (points, i) {
      points = points.map(function (p) { return [p[0], p[1] * 0.72]; });
      A.trail(ctx, points, colors[i], 18); var end = points[points.length - 1];
      A.draw(ctx, ids[i], colors[i], end[0], end[1], 48);
    }); ctx.restore();
  }
  function draw(room) {
    if (room.phase === 'lobby') { demo(arena); return; }
    var ctx = arena.getContext('2d'), cell = arena.width / room.width;
    grid(ctx, arena.width, arena.height, cell);
    room.players.forEach(function (p) {
      if (!p.alive) return;
      var points = p.trail.map(function (pos) { return [(pos[0] + 0.5) * cell, (pos[1] + 0.5) * cell]; });
      A.trail(ctx, points, p.color, cell - 3);
    });
    // Heads are drawn last so nearby trails never obscure an avatar. All hitboxes stay one grid cell.
    room.players.forEach(function (p) {
      if (p.alive) A.draw(ctx, p.avatar, p.color, (p.x + 0.5) * cell, (p.y + 0.5) * cell, cell * 1.8);
    });
  }

  function render(room, displays) {
    currentRoom = room; var alive = room.players.filter(function (p) { return p.alive; }), captain, winner;
    room.players.forEach(function (p) { if (p.id === room.captainId) captain = p; if (room.result && p.id === room.result.winnerId) winner = p; });
    T.text('phase-title', room.phase === 'running' ? 'Find your line.' : room.phase === 'countdown' ? 'Eyes on the arena.' : room.phase === 'results' ? 'One more round?' : 'The starting line');
    T.text('mode-label', room.mode === 'duel' ? 'DUEL' : 'FREE-FOR-ALL');
    T.text('round-label', 'ROUND ' + Math.max(1, room.round));
    T.text('alive-label', room.phase === 'running' ? alive.length + ' STILL RIDING · ' + Math.ceil(room.remainingMs / 1000) + 's' : room.players.length + ' / 8 RIDERS');
    T.show('arena-overlay', room.phase !== 'running'); T.byId('arena-overlay').classList.toggle('countdown', room.phase === 'countdown');
    if (room.phase === 'lobby') {
      T.text('overlay-kicker', room.players.length ? 'THE CREW IS COMING TOGETHER' : 'GET YOUR CREW TOGETHER'); T.text('overlay-title', 'Ready to blaze?');
      T.text('overlay-detail', captain ? captain.name + ' starts the round from their phone. At least two riders needed.' : 'Scan the code. Pick your mark. Make your move.');
    } else if (room.phase === 'countdown') { T.text('overlay-kicker', 'THUMBS READY · EYES UP'); T.text('overlay-title', Math.max(1, Math.ceil(room.countdownMs / 1000))); T.text('overlay-detail', 'Drag the joystick when the countdown ends.'); }
    else if (room.phase === 'results') {
      T.text('overlay-kicker', winner ? 'LAST RIDER STANDING' : 'A ROUND TO REMEMBER'); T.text('overlay-title', winner ? winner.name + ' wins!' : 'It’s a draw!');
      T.text('overlay-detail', (winner ? '+1 win. ' : room.result.reason === 'timeout' ? 'Time’s up. No points awarded. ' : 'Everyone went out. No points awarded. ') + (captain ? 'Rematch on ' + captain.name + '’s phone.' : 'Reconnect a phone to play again.'));
    }
    var roster = T.byId('roster'); roster.textContent = '';
    room.players.forEach(function (p, i) {
      var li = document.createElement('li'), swatch = document.createElement('span'), label = document.createElement('span'), sub = document.createElement('small'), score = document.createElement('strong');
      li.className = p.inRound && !p.alive ? 'out' : ''; swatch.className = 'rider-swatch'; A.badge(swatch, p.avatar, p.color);
      label.className = 'rider-label'; label.textContent = p.name;
      sub.textContent = (!p.connected ? 'RECONNECTING' : room.phase === 'running' ? (p.alive ? 'RIDING' : 'WATCHING') : 'READY') + (p.id === room.captainId ? ' · CAPTAIN' : '');
      label.appendChild(sub); score.textContent = p.wins; li.appendChild(swatch); li.appendChild(label); li.appendChild(score); roster.appendChild(li);
    });
    T.text('captain-note', captain ? captain.name + ' is captain. Start & rematch on their phone.' : 'The first phone to join becomes captain.');
    T.text('display-note', displays + (displays === 1 ? ' display' : ' displays') + ' watching · Room ' + room.code + ' · Read-only'); draw(room);
  }
  function begin(hello) {
    if (conn) conn.stop(); T.show('error', false); T.byId('create').disabled = true;
    conn = new T.Connection(hello, { status: function (label, online) {
      T.text('connection', label); T.byId('connection').classList.toggle('offline', !online);
      if (!online && currentRoom) { T.text('phase-title', 'Reconnecting display…'); }
    }, message: function (m) {
      if (m.type === 'welcome') {
        document.body.classList.add('room-open'); T.show('setup', false); T.show('room', true); T.text('room-code', m.code); T.byId('qr').src = window.TrailRoutes.qr(m.code);
        var url = m.joinUrl.replace(/\?room=.*$/, ''); T.byId('join-url').href = m.joinUrl; T.text('join-url', url.replace(/^https?:\/\//, ''));
        T.show('lan-warning', /^(localhost|127\.|\[::1\])/.test(location.hostname));
        history.replaceState(null, '', window.TrailRoutes.display(m.code));
      }
      if (m.type === 'state') render(m.room, m.displays);
      if (m.type === 'error') { T.text('error', m.message); T.show('error', true); T.byId('create').disabled = false;
        if (m.code === 'ROOM_GONE') { document.body.classList.remove('room-open'); T.show('setup', true); T.show('room', false); currentRoom = null; history.replaceState(null, '', window.TrailRoutes.display('')); }
      }
    } });
  }
  T.byId('create').onclick = function () { begin({ v: 1, type: 'create' }); };
  T.byId('watch-form').onsubmit = function (e) { e.preventDefault(); begin({ v: 1, type: 'watch', code: T.byId('watch-code').value.trim().toUpperCase() }); };
  T.byId('fullscreen').onclick = function () {
    var root = document.documentElement, enter = root.requestFullscreen || root.webkitRequestFullscreen;
    if (enter) { var result = enter.call(root); if (result && result.catch) result.catch(function () { T.text('error', 'Use your browser’s full-screen option.'); T.show('error', true); }); }
  };
  A.onLoad(function () { demo(preview); if (currentRoom) draw(currentRoom); });
  demo(preview); var code = T.query('room'); if (code) begin({ v: 1, type: 'watch', code: code });
}());
