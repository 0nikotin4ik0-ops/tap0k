/* Звук: всё синтезируется WebAudio, ни одного файла-ассета.
   Контекст создаётся по первому жесту пользователя. Глушится при потере фокуса (п. 1.3). */
(function () {
  'use strict';

  var A = {
    ctx: null,
    master: null,
    muted: false,
    noiseBuf: null,

    init: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.musicOn) this.startMusic();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this._buildNoise();
        if (this.musicOn) this.startMusic();
      } catch (e) {
        this.ctx = null;
      }
    },

    _buildNoise: function () {
      var ctx = this.ctx;
      var len = Math.floor(ctx.sampleRate * 0.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },

    setMuted: function (m) {
      this.muted = !!m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },

    suspend: function () {
      this.stopMusic();
      if (this.ctx && this.ctx.state === 'running') {
        try { this.ctx.suspend(); } catch (e) {}
      }
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') {
        try { this.ctx.resume(); } catch (e) {}
      }
      if (this.musicOn) this.startMusic();
    },

    /* ---------------- музыка ----------------
       Спокойная петля 4 аккорда (Am–F–C–G): подложка, бас и арпеджио.
       Всё синтезом, файлов нет. Планировщик держит ноты на 0.6 с вперёд. */

    music: { on: false, gain: null, timer: null, step: 0, nextTime: 0, bpm: 100 },
    musicOn: true,

    _CHORDS: [
      { root: 110.00, notes: [220.00, 261.63, 329.63] },
      { root: 87.31, notes: [174.61, 220.00, 261.63] },
      { root: 130.81, notes: [261.63, 329.63, 392.00] },
      { root: 98.00, notes: [196.00, 246.94, 293.66] }
    ],

    _ensureMusicGain: function () {
      if (this.music.gain || !this.ctx) return;
      this.music.gain = this.ctx.createGain();
      this.music.gain.gain.value = 0.8;
      this.music.gain.connect(this.master);
    },

    setMusic: function (on) {
      this.musicOn = !!on;
      if (!on) this.stopMusic();
      else if (this.ctx) this.startMusic();
    },

    startMusic: function () {
      if (!this.ctx || this.muted || this.music.timer || !this.musicOn) return;
      this._ensureMusicGain();
      this.music.on = true;
      this.music.nextTime = Math.max(this.music.nextTime, this.ctx.currentTime + 0.1);
      var self = this;
      this.music.timer = setInterval(function () { self._musicSchedule(); }, 90);
      this._musicSchedule();
    },

    stopMusic: function () {
      this.music.on = false;
      if (this.music.timer) {
        clearInterval(this.music.timer);
        this.music.timer = null;
      }
    },

    _musicSchedule: function () {
      if (!this.ctx || !this.music.on) return;
      var spb = 30 / this.music.bpm;              // шаг = восьмая
      if (this.music.nextTime < this.ctx.currentTime - 1) {
        this.music.nextTime = this.ctx.currentTime + 0.1;   // не догоняем after паузы
      }
      while (this.music.nextTime < this.ctx.currentTime + 0.6) {
        this._musicStep(this.music.step, this.music.nextTime, spb);
        this.music.step++;
        this.music.nextTime += spb;
      }
    },

    _musicStep: function (step, t, spb) {
      var pos = step % 64;                        // петля: 8 тактов
      var chord = this._CHORDS[Math.floor(pos / 16) % 4];
      if (pos % 16 === 0) {
        for (var i = 0; i < chord.notes.length; i++) {
          this._mnote(chord.notes[i], t, spb * 15, 'sine', 0.05, 0.7);
        }
      }
      if (pos % 4 === 0) this._mnote(chord.root, t, spb * 3.4, 'triangle', 0.12, 0.02);
      if (pos % 2 === 0) {
        var idx = Math.floor(step / 2) % 3;
        this._mnote(chord.notes[idx] * 2, t, spb * 2.2, 'sine', 0.055, 0.006);
      }
    },

    _mnote: function (freq, t, dur, type, vol, attack) {
      if (!this.music.gain) return;
      var ctx = this.ctx;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + (attack || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.music.gain);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    _tone: function (opt) {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx;
      var t0 = ctx.currentTime + (opt.delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = opt.type || 'sine';
      osc.frequency.setValueAtTime(opt.f0, t0);
      if (opt.f1 && opt.f1 !== opt.f0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + opt.dur);
      }
      var vol = (opt.vol === undefined ? 0.3 : opt.vol);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + opt.dur + 0.03);
    },

    _noise: function (opt) {
      if (!this.ctx || this.muted || !this.noiseBuf) return;
      var ctx = this.ctx;
      var t0 = ctx.currentTime + (opt.delay || 0);
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      var filt = ctx.createBiquadFilter();
      filt.type = opt.filter || 'lowpass';
      filt.frequency.setValueAtTime(opt.f0 || 1200, t0);
      if (opt.f1) filt.frequency.exponentialRampToValueAtTime(Math.max(60, opt.f1), t0 + opt.dur);
      filt.Q.value = opt.q === undefined ? 1 : opt.q;
      var gain = ctx.createGain();
      var vol = opt.vol === undefined ? 0.35 : opt.vol;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
      src.connect(filt);
      filt.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + opt.dur + 0.03);
    },

    /* Звяк посуды: набор расстроенных обертонов (как у керамики) + щелчок касания.
       Высокие обертоны гаснут быстрее — получается «дзынь», а не «пшик». */
    _clink: function (freq, vol, delay) {
      if (!this.ctx || this.muted) return;
      var ctx = this.ctx;
      var t0 = ctx.currentTime + (delay || 0);
      var partials = [1, 2.14, 3.42, 5.1];
      var gains = [1, 0.5, 0.26, 0.12];
      var dur = 0.24;
      for (var i = 0; i < partials.length; i++) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * partials[i] * (1 + (Math.random() - 0.5) * 0.012);
        var amp = Math.max(0.0002, vol * gains[i]);
        var d = dur * (1 - i * 0.17);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g);
        g.connect(this.master);
        o.start(t0);
        o.stop(t0 + d + 0.03);
      }
      this._noise({ f0: 5200, f1: 2600, dur: 0.02, vol: vol * 0.45, filter: 'highpass', delay: delay });
    },

    sfx: function (name, param) {
      if (!this.ctx) return;
      var p = param || 0;
      switch (name) {
        case 'slap':
          this._noise({ f0: 2600, f1: 260, dur: 0.13, vol: 0.45, q: 0.8 });
          this._tone({ type: 'triangle', f0: 170 - Math.min(p, 9) * 6, f1: 60, dur: 0.12, vol: 0.28 });
          break;
        case 'combo':
          this._tone({ type: 'square', f0: 520 * Math.pow(1.09, Math.min(p, 14)), dur: 0.09, vol: 0.14 });
          break;
        case 'coin':
          this._tone({ type: 'square', f0: 1180, dur: 0.07, vol: 0.16 });
          this._tone({ type: 'square', f0: 1760, dur: 0.09, vol: 0.12, delay: 0.05 });
          break;
        case 'buzz':
          this._tone({ type: 'sawtooth', f0: 180 + Math.random() * 40, f1: 150, dur: 0.18, vol: 0.05 });
          break;
        case 'chomp':
          this._tone({ type: 'square', f0: 320, f1: 180, dur: 0.12, vol: 0.16 });
          break;
        case 'lose':
          this._tone({ type: 'sawtooth', f0: 300, f1: 90, dur: 0.4, vol: 0.3 });
          break;
        case 'escape':
          this._tone({ type: 'sawtooth', f0: 240, f1: 620, dur: 0.3, vol: 0.14 });
          break;
        case 'boss':
          this._tone({ type: 'sawtooth', f0: 70, f1: 130, dur: 0.7, vol: 0.3 });
          this._noise({ f0: 400, f1: 120, dur: 0.7, vol: 0.2 });
          break;
        case 'fanfare':
          [523, 659, 784, 1046].forEach(function (f, i) {
            A._tone({ type: 'triangle', f0: f, dur: 0.22, vol: 0.24, delay: i * 0.1 });
          });
          break;
        case 'wave':
          [440, 587].forEach(function (f, i) {
            A._tone({ type: 'triangle', f0: f, dur: 0.18, vol: 0.22, delay: i * 0.09 });
          });
          break;
        case 'buy':
          this._tone({ type: 'square', f0: 660, dur: 0.08, vol: 0.2 });
          this._tone({ type: 'square', f0: 990, dur: 0.12, vol: 0.18, delay: 0.07 });
          break;
        case 'click':
          this._tone({ type: 'square', f0: 420, dur: 0.05, vol: 0.12 });
          break;
        case 'error':
          this._tone({ type: 'square', f0: 180, f1: 110, dur: 0.16, vol: 0.18 });
          break;
        case 'clatter':
          // лёгкий дребезг посуды: три звяка вразнобой, каждый со своим тоном
          var base = 1750 + Math.random() * 650;
          this._clink(base, 0.1, 0);
          this._clink(base * 1.48, 0.062, 0.042 + Math.random() * 0.03);
          this._clink(base * 0.84, 0.045, 0.088 + Math.random() * 0.05);
          break;
        case 'gameover':
          [392, 330, 262, 196].forEach(function (f, i) {
            A._tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.26, delay: i * 0.16 });
          });
          break;
        case 'achievement':
          [784, 1046, 1318].forEach(function (f, i) {
            A._tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.22, delay: i * 0.08 });
          });
          break;
      }
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.audio = A;
})();
