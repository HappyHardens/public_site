/* Shared avatar IDs and colors are also the server's allowlist. No user-provided asset URLs. */
(function (root) {
  'use strict';
  var list = [
    { id: 'lightning', label: 'Lightning' }, { id: 'skateboard', label: 'Skateboard' },
    { id: 'sneaker', label: 'Sneaker' }, { id: 'flame', label: 'Flame' },
    { id: 'planet', label: 'Planet' }, { id: 'vinyl', label: 'Vinyl' },
    { id: 'eightball', label: 'Eight ball' }, { id: 'moon', label: 'Moon' }, { id: 'diamond', label: 'Diamond' }
  ];
  var colors = ['#eb7945', '#e8bb4b', '#54b7ad', '#a88ac4', '#79a6d5', '#df8298', '#b9cc72', '#f2e5c9'];
  function find(id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  var api = { list: list, colors: colors, find: find };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  var images = {}, callbacks = [];
  list.forEach(function (avatar) {
    var img = new Image(); img.onload = function () { callbacks.forEach(function (fn) { fn(); }); };
    img.src = window.TrailRoutes.asset('assets/avatar-' + avatar.id + '.svg'); images[avatar.id] = img;
  });
  api.onLoad = function (fn) { callbacks.push(fn); };
  api.badge = function (element, id, color) {
    var avatar = find(id) || list[0];
    element.style.backgroundColor = color; element.setAttribute('data-avatar', avatar.id);
    if (element.getAttribute('data-rendered-avatar') === avatar.id) return;
    element.textContent = ''; var img = document.createElement('img'); img.src = window.TrailRoutes.asset('assets/avatar-' + avatar.id + '.svg');
    img.alt = avatar.label; img.draggable = false; element.appendChild(img); element.setAttribute('data-rendered-avatar', avatar.id);
  };
  api.draw = function (ctx, id, color, x, y, size) {
    var avatar = find(id) || list[0], img = images[avatar.id];
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = '#f8efdf'; ctx.lineWidth = Math.max(1, size * 0.045);
    ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (img.complete && img.naturalWidth) ctx.drawImage(img, x - size * 0.34, y - size * 0.34, size * 0.68, size * 0.68);
    ctx.restore();
  };
  /* Solid underpainting is always continuous; stripes decorate rather than split the trail. */
  api.trail = function (ctx, points, color, width) {
    if (!points.length) return;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); points.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
    var pattern = colors.indexOf(color) % 4;
    ctx.strokeStyle = pattern === 1 ? '#594c2c' : '#fbefdf'; ctx.globalAlpha = 0.65; ctx.lineWidth = Math.max(1, width * 0.14);
    if (ctx.setLineDash) ctx.setLineDash(pattern === 1 ? [width * 0.55, width * 0.65] : pattern === 2 ? [1, width * 0.8] : pattern === 3 ? [width, width * 0.7] : []);
    ctx.stroke(); ctx.restore();
  };
  root.TrailAvatars = api;
}(typeof window !== 'undefined' ? window : this));
