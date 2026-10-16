/* Оружие: параметры, прокачка и отрисовка курсора-оружия.
   Базовые пути нарисованы высотой ~100 единиц, масштаб подбирается под радиус удара. */
(function () {
  'use strict';

  var LIST = [
    { id: 'slipper', ru: 'Тапок', en: 'Slipper', price: 0, radius: 96, damage: 1, cooldown: 0.18, chain: 1, color: '#c0392b' },
    { id: 'paper', ru: 'Газета', en: 'Newspaper', price: 120, radius: 128, damage: 1, cooldown: 0.14, chain: 1, color: '#e6e1d0' },
    { id: 'swatter', ru: 'Мухобойка', en: 'Fly swatter', price: 350, radius: 112, damage: 2, cooldown: 0.12, chain: 1, color: '#2e86de' },
    { id: 'shocker', ru: 'Электрошокер', en: 'Shocker', price: 900, radius: 150, damage: 2, cooldown: 0.15, chain: 2, color: '#8e44ad' },
    { id: 'cyber', ru: 'Кибер-тапок', en: 'Cyber slipper', price: 2000, radius: 180, damage: 3, cooldown: 0.12, chain: 3, color: '#00d2d3' }
  ];

  function slipperPath(ctx, k) {
    ctx.beginPath();
    ctx.moveTo(-8 * k, -50 * k);
    ctx.quadraticCurveTo(30 * k, -52 * k, 34 * k, -20 * k);
    ctx.quadraticCurveTo(37 * k, 4 * k, 24 * k, 16 * k);
    ctx.quadraticCurveTo(18 * k, 32 * k, 0 * k, 32 * k);
    ctx.quadraticCurveTo(-18 * k, 32 * k, -24 * k, 16 * k);
    ctx.quadraticCurveTo(-37 * k, 4 * k, -34 * k, -20 * k);
    ctx.quadraticCurveTo(-30 * k, -52 * k, -8 * k, -50 * k);
    ctx.closePath();
  }

  var weapons = {
    LIST: LIST,

    name: function (index) {
      var w = LIST[index] || LIST[0];
      return window.TAPOK.i18n.lang === 'en' ? w.en : w.ru;
    },

    stats: function (index, up) {
      var w = LIST[index] || LIST[0];
      return {
        index: index,
        id: w.id,
        radius: w.radius,
        damage: w.damage,
        cooldown: w.cooldown,
        chain: w.chain + ((up && up.double) | 0),
        color: w.color
      };
    },

    /* Курсор-оружие: замах, отпечаток удара и подсказка радиуса */
    drawCursor: function (ctx, cur, st, t) {
      if (cur.ttl !== undefined && cur.type === 'touch' && !cur.down) {
        var fade = Math.max(0, Math.min(1, cur.ttl / 0.45));
        if (fade <= 0) return;
      }
      var swing = cur.swing || 0;
      var ease = swing * swing;
      var size = 0.55 + st.radius / 220;

      // радиус удара
      if (swing > 0.02) {
        ctx.save();
        ctx.globalAlpha = swing * 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, st.radius * (1.15 - swing * 0.15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cur.x, cur.y);
      if (cur.type === 'touch' && !cur.down) {
        ctx.globalAlpha = Math.max(0, Math.min(1, cur.ttl / 0.45));
      }

      // тень
      ctx.save();
      ctx.globalAlpha *= 0.22;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(5, 8, 30 * size, 18 * size, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // замах: поднято → удар
      ctx.rotate(-0.5 + ease * 0.85);
      var sc = size * (1 - swing * 0.08);
      ctx.scale(sc, sc);

      if (st.id === 'paper') this._paper(ctx);
      else if (st.id === 'swatter') this._swatter(ctx);
      else if (st.id === 'shocker') this._shocker(ctx, t, swing);
      else if (st.id === 'cyber') this._cyber(ctx, t);
      else this._slipper(ctx, st.color);

      ctx.restore();
    },

    _slipper: function (ctx, color) {
      // подошва
      slipperPath(ctx, 1);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 16, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3.5;
      slipperPath(ctx, 1);
      ctx.stroke();

      // ремешок
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-28, -6);
      ctx.quadraticCurveTo(0, -22, 28, -6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-28, -1);
      ctx.quadraticCurveTo(0, -17, 28, -1);
      ctx.stroke();
    },

    _paper: function (ctx) {
      ctx.beginPath();
      ctx.moveTo(-38, -46);
      ctx.lineTo(34, -54);
      ctx.lineTo(42, 30);
      ctx.lineTo(-30, 38);
      ctx.closePath();
      ctx.fillStyle = '#efe9d8';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (var i = 0; i < 5; i++) {
        ctx.fillRect(-26, -32 + i * 13, 56, 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.beginPath();
      ctx.moveTo(-38, -46);
      ctx.lineTo(34, -54);
      ctx.lineTo(30, -40);
      ctx.lineTo(-36, -32);
      ctx.closePath();
      ctx.fill();
    },

    _swatter: function (ctx) {
      ctx.strokeStyle = '#2b2b33';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 46);
      ctx.lineTo(0, -2);
      ctx.stroke();

      ctx.fillStyle = '#2e86de';
      ctx.beginPath();
      ctx.ellipse(0, -34, 32, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.5;
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 13, -70);
        ctx.lineTo(i * 13, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-34, -34 + i * 13);
        ctx.lineTo(34, -34 + i * 13);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -34, 32, 34, 0, 0, Math.PI * 2);
      ctx.stroke();
    },

    _shocker: function (ctx, t, swing) {
      ctx.fillStyle = '#2b2b33';
      ctx.beginPath();
      ctx.moveTo(-13, -4);
      ctx.lineTo(13, -4);
      ctx.lineTo(11, 46);
      ctx.lineTo(-11, 46);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#8e44ad';
      ctx.beginPath();
      ctx.ellipse(0, -34, 26, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(-8, -42, 7, 10, 0.4, 0, Math.PI * 2);
      ctx.fill();

      if (swing > 0.05) {
        ctx.strokeStyle = 'rgba(190,235,255,0.95)';
        ctx.lineWidth = 3;
        for (var i = 0; i < 5; i++) {
          var a = t * 24 + i * 1.3;
          ctx.beginPath();
          ctx.moveTo(0, -48);
          ctx.lineTo(Math.cos(a) * 40, -48 - Math.abs(Math.sin(a)) * 26);
          ctx.stroke();
        }
      }
    },

    _cyber: function (ctx, t) {
      var glow = 0.5 + Math.sin(t * 8) * 0.25;
      ctx.save();
      ctx.shadowColor = 'rgba(0,210,211,' + glow + ')';
      ctx.shadowBlur = 26;
      slipperPath(ctx, 1);
      ctx.fillStyle = '#0e3b3f';
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = '#00d2d3';
      ctx.lineWidth = 4;
      slipperPath(ctx, 1);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,210,211,0.75)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-28, -6);
      ctx.quadraticCurveTo(0, -22, 28, -6);
      ctx.stroke();

      ctx.fillStyle = '#00d2d3';
      ctx.beginPath();
      ctx.arc(0, 14, 5 + Math.sin(t * 10) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.weapons = weapons;
})();
