/* Juice: партиклы, всплывающий текст, отпечатки, кольца, тряска, hit-stop. */
(function () {
  'use strict';

  function rnd(a, b) { return a + Math.random() * (b - a); }

  var fx = {
    parts: [],
    texts: [],
    stamps: [],
    rings: [],
    shakeT: 0,
    shakeAmp: 0,
    shakeDur: 1,
    hitstopT: 0,

    reset: function () {
      this.parts.length = 0;
      this.texts.length = 0;
      this.stamps.length = 0;
      this.rings.length = 0;
      this.shakeT = 0;
      this.shakeAmp = 0;
      this.hitstopT = 0;
    },

    /* --- генераторы --- */

    splat: function (x, y, color, n) {
      n = n || 12;
      for (var i = 0; i < n; i++) {
        var a = rnd(0, Math.PI * 2);
        var sp = rnd(60, 340);
        this.parts.push({
          kind: 'blob', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          r: rnd(3, 9), life: rnd(0.35, 0.75), max: 0.75,
          color: color || '#6ab04c', g: 900
        });
      }
      for (var j = 0; j < 5; j++) {
        var a2 = rnd(-Math.PI, 0);
        this.parts.push({
          kind: 'wing', x: x, y: y,
          vx: Math.cos(a2) * rnd(40, 160), vy: rnd(-160, -40),
          r: rnd(6, 12), life: rnd(0.5, 1.0), max: 1.0,
          color: '#dfeaf5', g: 260, rot: rnd(0, 6.28), vr: rnd(-6, 6)
        });
      }
    },

    spark: function (x, y, color, n) {
      n = n || 8;
      for (var i = 0; i < n; i++) {
        var a = rnd(0, Math.PI * 2);
        var sp = rnd(120, 420);
        this.parts.push({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: rnd(2, 4), life: rnd(0.15, 0.35), max: 0.35,
          color: color || '#ffe066', g: 0
        });
      }
    },

    feather: function (x, y) {
      for (var i = 0; i < 3; i++) {
        this.parts.push({
          kind: 'wing', x: x, y: y,
          vx: rnd(-90, 90), vy: rnd(-140, -30),
          r: rnd(7, 13), life: rnd(0.6, 1.2), max: 1.2,
          color: '#f2f7fb', g: 200, rot: rnd(0, 6.28), vr: rnd(-5, 5)
        });
      }
    },

    coinPop: function (x, y, n) {
      n = Math.min(n || 1, 6);
      for (var i = 0; i < n; i++) {
        var a = rnd(-Math.PI * 0.85, -Math.PI * 0.15);
        var sp = rnd(120, 260);
        this.parts.push({
          kind: 'coin', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: 9, life: rnd(0.5, 0.8), max: 0.8,
          color: '#ffcf3f', g: 900
        });
      }
    },

    text: function (x, y, str, color, size, vy) {
      this.texts.push({
        x: x, y: y, str: str, color: color || '#fff',
        size: size || 34, life: 0.9, max: 0.9, vy: vy === undefined ? -70 : vy
      });
    },

    stamp: function (x, y, color) {
      this.stamps.push({ x: x, y: y, rot: rnd(-0.5, 0.5), life: 0.45, max: 0.45, color: color || 'rgba(20,20,26,0.35)' });
    },

    ring: function (x, y, r, color) {
      this.rings.push({ x: x, y: y, r0: r * 0.35, r1: r * 1.15, life: 0.28, max: 0.28, color: color || 'rgba(255,255,255,0.5)' });
    },

    shake: function (amp) {
      this.shakeAmp = Math.max(this.shakeAmp, amp);
      this.shakeDur = 0.32;
      this.shakeT = this.shakeDur;
    },

    hitstop: function (sec) {
      this.hitstopT = Math.max(this.hitstopT, sec);
    },

    shakeOffset: function () {
      if (this.shakeT <= 0) return { x: 0, y: 0 };
      var k = this.shakeT / this.shakeDur;
      var a = this.shakeAmp * k * k;
      return { x: rnd(-a, a), y: rnd(-a, a) };
    },

    /* --- жизненный цикл --- */

    update: function (dt) {
      if (this.hitstopT > 0) this.hitstopT = Math.max(0, this.hitstopT - dt);
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        if (this.shakeT <= 0) this.shakeAmp = 0;
      }

      var i, p;
      for (i = this.parts.length - 1; i >= 0; i--) {
        p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot !== undefined) p.rot += p.vr * dt;
      }
      for (i = this.texts.length - 1; i >= 0; i--) {
        var t = this.texts[i];
        t.life -= dt;
        t.y += t.vy * dt;
        t.vy *= 0.96;
        if (t.life <= 0) this.texts.splice(i, 1);
      }
      for (i = this.stamps.length - 1; i >= 0; i--) {
        this.stamps[i].life -= dt;
        if (this.stamps[i].life <= 0) this.stamps.splice(i, 1);
      }
      for (i = this.rings.length - 1; i >= 0; i--) {
        this.rings[i].life -= dt;
        if (this.rings[i].life <= 0) this.rings.splice(i, 1);
      }
    },

    drawUnder: function (ctx) {
      var i;
      for (i = 0; i < this.stamps.length; i++) {
        var s = this.stamps[i];
        var k = s.life / s.max;
        ctx.save();
        ctx.globalAlpha = k * 0.85;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 52 * (1.15 - k * 0.15), 78 * (1.15 - k * 0.15), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k * 0.4;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, -14, 26, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (i = 0; i < this.rings.length; i++) {
        var r = this.rings[i];
        var kr = 1 - r.life / r.max;
        ctx.save();
        ctx.globalAlpha = (1 - kr) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 6 * (1 - kr) + 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * kr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    },

    drawOver: function (ctx) {
      var i, p;
      for (i = 0; i < this.parts.length; i++) {
        p = this.parts[i];
        var k = Math.max(0, p.life / p.max);
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 1.4);
        ctx.fillStyle = p.color;
        if (p.kind === 'wing') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot || 0);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'coin') {
          ctx.translate(p.x, p.y);
          var sq = Math.abs(Math.cos(p.life * 14));
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * Math.max(0.2, sq), p.r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#8a5a06';
          ctx.globalAlpha *= 0.8;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 0.55 * Math.max(0.2, sq), p.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (i = 0; i < this.texts.length; i++) {
        var t = this.texts[i];
        var kk = t.life / t.max;
        var pop = kk > 0.75 ? 1 + (1 - (1 - kk) / 0.25) * 0.0 : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, kk * 1.8);
        ctx.translate(t.x, t.y);
        ctx.scale(pop * (1 + (1 - kk) * 0.12), pop * (1 + (1 - kk) * 0.12));
        ctx.font = '900 ' + t.size + 'px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(4, t.size * 0.18);
        ctx.strokeStyle = 'rgba(12,14,20,0.85)';
        ctx.strokeText(t.str, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, 0, 0);
        ctx.restore();
      }
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.fx = fx;
})();
