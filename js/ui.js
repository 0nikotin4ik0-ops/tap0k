/* UI-примитивы: панели, кнопки, текст, иконки. Всё в мировых координатах. */
(function () {
  'use strict';

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var ui = {
    rr: rr,

    panel: function (ctx, x, y, w, h, opt) {
      opt = opt || {};
      ctx.save();
      ctx.globalAlpha = opt.alpha === undefined ? 0.92 : opt.alpha;
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, opt.top || 'rgba(28,33,46,0.96)');
      g.addColorStop(1, opt.bottom || 'rgba(16,19,28,0.96)');
      ctx.fillStyle = g;
      rr(ctx, x, y, w, h, opt.r || 26);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = opt.border || 'rgba(255,255,255,0.14)';
      ctx.lineWidth = opt.lw || 3;
      rr(ctx, x, y, w, h, opt.r || 26);
      ctx.stroke();
      ctx.restore();
    },

    text: function (ctx, str, x, y, opt) {
      opt = opt || {};
      ctx.save();
      ctx.font = (opt.weight || 900) + ' ' + (opt.size || 34) + 'px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = opt.align || 'center';
      ctx.textBaseline = opt.baseline || 'middle';
      if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
      if (opt.stroke !== false) {
        ctx.lineWidth = opt.lw || Math.max(3, (opt.size || 34) * 0.16);
        ctx.strokeStyle = opt.strokeColor || 'rgba(10,12,18,0.75)';
        if (opt.maxWidth) ctx.strokeText(str, x, y, opt.maxWidth);
        else ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = opt.color || '#fff';
      if (opt.maxWidth) ctx.fillText(str, x, y, opt.maxWidth);
      else ctx.fillText(str, x, y);
      ctx.restore();
    },

    measure: function (ctx, str, size, weight) {
      ctx.save();
      ctx.font = (weight || 900) + ' ' + (size || 34) + 'px "Segoe UI", Roboto, Arial, sans-serif';
      var w = ctx.measureText(str).width;
      ctx.restore();
      return w;
    },

    button: function (ctx, b, t) {
      var pressed = b.pressed ? 1 : 0;
      var y = b.y + pressed * 4;
      var r = b.r || 24;
      ctx.save();

      var g = ctx.createLinearGradient(b.x, y, b.x, y + b.h);
      if (b.disabled) {
        g.addColorStop(0, '#3a3f4c');
        g.addColorStop(1, '#262a34');
      } else if (b.style === 'gold') {
        g.addColorStop(0, '#ffd75e');
        g.addColorStop(1, '#e8a012');
      } else if (b.style === 'green') {
        g.addColorStop(0, '#5ddc7a');
        g.addColorStop(1, '#1e9e46');
      } else if (b.style === 'red') {
        g.addColorStop(0, '#ff7b6b');
        g.addColorStop(1, '#c0392b');
      } else if (b.style === 'flat') {
        g.addColorStop(0, 'rgba(255,255,255,0.14)');
        g.addColorStop(1, 'rgba(255,255,255,0.07)');
      } else {
        g.addColorStop(0, '#4f7dff');
        g.addColorStop(1, '#2b4fd6');
      }

      if (!b.style || b.style === 'blue') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        rr(ctx, b.x, b.y + 8, b.w, b.h, r);
        ctx.fill();
      }
      ctx.fillStyle = g;
      rr(ctx, b.x, y, b.w, b.h, r);
      ctx.fill();

      ctx.strokeStyle = b.disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      rr(ctx, b.x, y, b.w, b.h, r);
      ctx.stroke();

      var labelColor = b.disabled ? 'rgba(255,255,255,0.5)'
        : (b.style === 'gold' || b.style === 'green' ? '#1a1206' : '#fff');

      if (b.icon === 'sound') {
        this.iconSound(ctx, b.x + b.w / 2, y + b.h / 2, b.h / 46, b.iconOn);
      } else if (b.icon === 'music') {
        this.iconMusic(ctx, b.x + b.w / 2, y + b.h / 2, b.h / 46, b.iconOn);
      } else if (b.icon === 'vibrate') {
        this.iconVibrate(ctx, b.x + b.w / 2, y + b.h / 2, b.h / 46, b.iconOn);
      } else if (b.label) {
        var size = b.size || Math.min(40, b.h * 0.42);
        this.text(ctx, b.label, b.x + b.w / 2, y + (b.sub ? b.h * 0.36 : b.h * 0.5), {
          size: size, color: labelColor, strokeColor: 'rgba(0,0,0,0.35)', lw: 3
        });
      }
      if (b.sub) {
        this.text(ctx, b.sub, b.x + b.w / 2, y + b.h * 0.72, {
          size: Math.min(26, b.h * 0.24), color: b.disabled ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', stroke: false
        });
      }
      ctx.restore();
    },

    hit: function (b, x, y) {
      return x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 10;
    },

    /* --- иконки --- */
    iconSlipper: function (ctx, x, y, s, color, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha === undefined ? 1 : alpha;
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = color || '#e0553f';
      ctx.beginPath();
      ctx.moveTo(-11, -18);
      ctx.quadraticCurveTo(11, -24, 16, -6);
      ctx.quadraticCurveTo(19, 8, 9, 12);
      ctx.quadraticCurveTo(0, 15, -9, 12);
      ctx.quadraticCurveTo(-19, 8, -16, -6);
      ctx.quadraticCurveTo(-14, -14, -11, -18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-13, -5);
      ctx.quadraticCurveTo(0, -13, 13, -5);
      ctx.stroke();
      ctx.restore();
    },

    iconCoin: function (ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = '#ffcf3f';
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0a11a';
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '900 15px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₽', 0, 1);
      ctx.restore();
    },

    iconSound: function (ctx, x, y, s, on) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(-16, -7);
      ctx.lineTo(-6, -7);
      ctx.lineTo(4, -17);
      ctx.lineTo(4, 17);
      ctx.lineTo(-6, 7);
      ctx.lineTo(-16, 7);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      if (on) {
        ctx.beginPath();
        ctx.arc(6, 0, 11, -0.9, 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(6, 0, 18, -0.9, 0.9);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-18, -18);
        ctx.lineTo(18, 18);
        ctx.stroke();
      }
      ctx.restore();
    },

    iconMusic: function (ctx, x, y, s, on) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      var col = on ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, 12);
      ctx.lineTo(6, -14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, -14);
      ctx.quadraticCurveTo(18, -12, 16, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-2, 12, 8, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      if (!on) {
        ctx.beginPath();
        ctx.moveTo(-16, -16);
        ctx.lineTo(16, 16);
        ctx.stroke();
      }
      ctx.restore();
    },

    iconVibrate: function (ctx, x, y, s, on) {      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.45)';
      rr(ctx, -9, -18, 18, 36, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      rr(ctx, -6, -13, 12, 26, 3);
      ctx.fill();
      ctx.strokeStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, -10);
      ctx.lineTo(-16, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -10);
      ctx.lineTo(16, 10);
      ctx.stroke();
      ctx.restore();
    },

    iconStar: function (ctx, x, y, s, color) {      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = color || '#ffd23f';
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var rr2 = i % 2 === 0 ? 16 : 7;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr2, Math.sin(a) * rr2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.ui = ui;
})();
