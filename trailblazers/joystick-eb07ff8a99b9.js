(function (root) {
  'use strict';
  function normalize(dx, dy, radius) {
    var length = Math.sqrt(dx * dx + dy * dy), scale = length > radius ? radius / length : 1;
    return { x: dx * scale / radius, y: dy * scale / radius, dx: dx * scale, dy: dy * scale };
  }
  function Joystick(element, knob, onChange) {
    var active = null, enabled = false, self = this;
    function move(x, y) {
      var rect = element.getBoundingClientRect(), radius = Math.min(rect.width, rect.height) / 2 - 44;
      var axes = normalize(x - rect.left - rect.width / 2, y - rect.top - rect.height / 2, Math.max(1, radius));
      knob.style.transform = 'translate(' + axes.dx + 'px,' + axes.dy + 'px)'; onChange(axes.x, axes.y);
    }
    function release() { active = null; element.classList.remove('active'); knob.style.transform = 'translate(0px,0px)'; onChange(0, 0); }
    self.reset = release;
    self.enable = function (value) { if (enabled && !value) release(); enabled = value; element.classList.toggle('disabled', !enabled); element.setAttribute('aria-disabled', String(!enabled)); };
    if (root.PointerEvent) {
      element.addEventListener('pointerdown', function (e) {
        if (!enabled || active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault(); active = e.pointerId; element.classList.add('active');
        if (element.setPointerCapture) element.setPointerCapture(e.pointerId); move(e.clientX, e.clientY);
      });
      element.addEventListener('pointermove', function (e) { if (active !== null && active === e.pointerId) { e.preventDefault(); move(e.clientX, e.clientY); } });
      function end(e) { if (active === e.pointerId) { e.preventDefault(); release(); } }
      element.addEventListener('pointerup', end); element.addEventListener('pointercancel', end); element.addEventListener('lostpointercapture', end);
    } else {
      element.addEventListener('touchstart', function (e) {
        if (!enabled || active !== null) return; e.preventDefault(); var touch = e.changedTouches[0]; active = touch.identifier;
        element.classList.add('active'); move(touch.clientX, touch.clientY);
      }, { passive: false });
      element.addEventListener('touchmove', function (e) {
        if (active === null) return; e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === active) move(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }, { passive: false });
      function touchEnd(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === active) { e.preventDefault(); release(); break; } }
      element.addEventListener('touchend', touchEnd, { passive: false }); element.addEventListener('touchcancel', touchEnd, { passive: false });
    }
    root.addEventListener('blur', release);
    root.document.addEventListener('visibilitychange', function () { if (root.document.hidden) release(); });
    self.enable(false);
  }
  root.TrailJoystick = { Joystick: Joystick, normalize: normalize };
}(typeof window !== 'undefined' ? window : this));
