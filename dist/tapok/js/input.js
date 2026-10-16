/* Ввод: pointer events (мышь + тач + мультитач), курсоры-тапки, свайп-шлепки. */
(function () {
  'use strict';

  var input = {
    cursors: [],
    mapper: null,     // function(clientX, clientY) -> {x, y} в мировых координатах
    onSlap: null,     // function(x, y, cursor)
    onMove: null,     // function(x, y, cursor)
    enabled: true,
    _canvas: null,
    _lastSlap: 0,

    attach: function (canvas) {
      var self = this;
      this._canvas = canvas;

      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      canvas.addEventListener('gesturestart', function (e) { e.preventDefault(); });

      canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        self._ensureAudio();
        var c = self._get(e.pointerId);
        self._place(c, e, true);
        c.down = true;
        c.swing = 1;
        c.ttl = 0;
        if (self.enabled && self.onSlap) self.onSlap(c.x, c.y, c);
        self._lastSlap = performance.now();
      }, { passive: false });

      canvas.addEventListener('pointermove', function (e) {
        var c = self._get(e.pointerId);
        var speed = self._place(c, e, false);
        if (self.enabled && c.down && speed > 9 && performance.now() - self._lastSlap > 110) {
          if (self.onSlap) self.onSlap(c.x, c.y, c);
          self._lastSlap = performance.now();
          c.swing = 1;
        }
        if (self.onMove) self.onMove(c.x, c.y, c);
      }, { passive: false });

      function release(e) {
        var c = self._byId(e.pointerId);
        if (!c) return;
        c.down = false;
        if (e.pointerType === 'touch') c.ttl = 0.45;
      }
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('pointerout', release);
    },

    _ensureAudio: function () {
      if (window.TAPOK.audio) window.TAPOK.audio.init();
    },

    _get: function (id) {
      var c = this._byId(id);
      if (!c) {
        c = { id: id, x: 0, y: 0, px: 0, py: 0, down: false, swing: 0, ttl: 0, ang: 0, type: 'touch' };
        this.cursors.push(c);
        if (this.cursors.length > 6) this.cursors.shift();
      }
      return c;
    },

    _byId: function (id) {
      for (var i = 0; i < this.cursors.length; i++) {
        if (this.cursors[i].id === id) return this.cursors[i];
      }
      return null;
    },

    _place: function (c, e, fresh) {
      c.type = e.pointerType || 'mouse';
      var w = this.mapper ? this.mapper(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
      var speed = 0;
      if (!fresh) {
        var dx = w.x - c.x, dy = w.y - c.y;
        speed = Math.sqrt(dx * dx + dy * dy);
        if (speed > 2) c.ang = Math.atan2(dy, dx);
      }
      c.px = c.x;
      c.py = c.y;
      c.x = w.x;
      c.y = w.y;
      return speed;
    },

    /* Обновление анимации замаха и жизней курсоров */
    update: function (dt) {
      for (var i = this.cursors.length - 1; i >= 0; i--) {
        var c = this.cursors[i];
        if (c.swing > 0) c.swing = Math.max(0, c.swing - dt * 4.5);
        if (!c.down) {
          if (c.type === 'touch') {
            c.ttl -= dt;
            if (c.ttl <= 0) { this.cursors.splice(i, 1); continue; }
          } else {
            c.ttl = 0;
          }
        }
      }
    },

    clear: function () {
      this.cursors.length = 0;
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.input = input;
})();
