/* Общий стенд для тестов: подделывает DOM и canvas, загружает модули игры,
   даёт ручной прогон кадров. Используется в smoke.js и balance.js.
   Модули игры грузятся один раз на процесс — стенд синглтон. */
'use strict';

const path = require('path');
const fs = require('fs');

let instance = null;

function makeCtx() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  const ctx = {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    font: '10px sans-serif', textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: 'transparent', shadowBlur: 0, lineCap: 'butt', lineJoin: 'miter',
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => null,
    measureText: (s) => ({ width: String(s).length * 9 }),
    getImageData: () => ({ data: [] }),
    setLineDash: noop,
    drawImage: noop
  };
  const names = ['setTransform', 'clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath',
    'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect',
    'roundRect', 'fill', 'stroke', 'save', 'restore', 'translate', 'rotate', 'scale', 'clip',
    'fillText', 'strokeText', 'transform', 'resetTransform'];
  for (const n of names) ctx[n] = noop;
  return ctx;
}

function load(opts) {
  if (instance) return instance;
  opts = opts || {};

  const ctxStub = makeCtx();
  const listeners = {};
  const canvas = {
    width: 0, height: 0,
    clientWidth: opts.w || 390,
    clientHeight: opts.h || 844,
    style: {},
    getContext: () => ctxStub,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: canvas.clientWidth, height: canvas.clientHeight })
  };

  let raf = null;
  let now = 0;

  global.window = global;
  Object.defineProperty(global, 'navigator', {
    value: { language: 'ru', vibrate: () => {} }, configurable: true, writable: true
  });
  global.location = { search: '?local=1' };
  global.document = {
    documentElement: {},
    hidden: false,
    getElementById: () => canvas,
    addEventListener: (t, fn) => { (listeners['doc:' + t] = listeners['doc:' + t] || []).push(fn); }
  };
  global.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; }
  };
  global.requestAnimationFrame = (fn) => { raf = fn; return 1; };
  global.cancelAnimationFrame = () => {};
  global.addEventListener = () => {};
  global.removeEventListener = () => {};
  global.AudioContext = undefined;

  const files = ['ysdk.js', 'i18n.js', 'save.js', 'audio.js', 'fx.js', 'input.js',
    'weapons.js', 'flies.js', 'ui.js', 'game.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
    // eslint-disable-next-line no-eval
    (0, eval)(src + '\n//# sourceURL=' + f);
  }

  const api = {
    T: global.TAPOK,
    canvas,
    ctx: ctxStub,
    get now() { return now; },
    /** прогнать n кадров, ms на кадр */
    tick(n, ms) {
      ms = ms || 16.7;
      for (let i = 0; i < n; i++) {
        now += ms;
        const cb = raf;
        raf = null;
        if (cb) cb(now);
      }
    },
    setSize(w, h) {
      canvas.clientWidth = w;
      canvas.clientHeight = h;
    },
    sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  };

  instance = api;
  return api;
}

module.exports = { load };
