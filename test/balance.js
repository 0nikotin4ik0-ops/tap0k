/* Стенд баланса: бот играет в «Тапок» сам и печатает, до какой волны дожил.
   Запуск: node test/balance.js [skill] [runs]
   skill 0..1 — насколько хорошо играет (1 = идеально попадает и не зевает).
   Примеры: node test/balance.js 0.55   (новичок)
            node test/balance.js 0.85   (нормальный игрок)
            node test/balance.js 0.97   (скилловый) */
'use strict';

const h = require('./harness').load();
const T = h.T;

const SKILL = parseFloat(process.argv[2] || '0.85');
const RUNS = parseInt(process.argv[3] || '1', 10);

function makeBot(skill) {
  // Навык управляет тремя вещами: как часто бот осматривается, насколько мажет
  // и как быстро успевает реагировать на муху, которая села есть.
  return {
    skill: skill,
    period: 0.10 + (1 - skill) * 0.45,   // с между «решениями»
    jitter: 8 + (1 - skill) * 46,        // мировой разброс точки удара
    slapsPerSec: 4 + skill * 6,          // предел скорости пальца
    lastSlap: -99,
    buy: []
  };
}

function pickTarget() {
  const list = T.flies.list.filter((f) => f.state !== 'dead');
  if (!list.length) return null;
  let best = null, bestScore = -1e9;
  for (const f of list) {
    let score = 0;
    if (f.state === 'eat') score += 1000 - (f.eatTimer * 200);   // вот-вот улетит — спасаем
    if (f.type === 'boss') score += 120;
    if (f.type === 'gold') score += 60;
    score -= f.y * 0.05;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

function buyGreedy() {
  const d = T.save.data;
  let guard = 0;
  while (guard++ < 12) {
    const items = T.game.shop.filter((i) => !i.soldOut && i.price <= d.coins);
    if (!items.length) break;
    // приоритет: новое оружие > улучшения > терпение
    items.sort((a, b) => {
      const rank = (i) => (i.kind === 'weapon' ? 0 : (i.kind === 'slow' ? 3 : (i.kind === 'life' ? 2 : 1)));
      return rank(a) - rank(b) || a.price - b.price;
    });
    const item = items[0];
    const before = T.game.shop.length;
    const btn = T.game.buttons.find((b) => b.id && b.id.indexOf('buy_') === 0 && b.item === item);
    if (!btn) break;
    btn.onClick();
    if (T.game.shop.length === before && !T.game.buttons.some((b) => b.item === item && !b.disabled)) {
      // ничего не изменилось — выходим, чтобы не зациклиться
      if (T.game.state !== 'shop') break;
    }
  }
}

async function oneRun(skill) {
  T.save.resetProgress();
  T.game.state = 'menu';
  T.game.run = null;
  T.flies.reset();
  T.fx.reset();
  T.input.clear();

  // принудительно меню заново
  if (typeof T.game.refreshButtons === 'function') T.game.refreshButtons();

  const play = T.game.buttons.find((b) => b.id === 'play');
  if (!play) throw new Error('нет кнопки ИГРАТЬ');
  play.onClick();

  const bot = makeBot(skill);
  const dt = 0.033;                    // шаг симуляции
  const framesPerTick = 2;             // 2 кадра по 16.7 мс
  let t = 0;
  let nextDecision = 0;
  const waveLog = [];
  let lastWave = 0;
  let waveStart = 0;

  for (let step = 0; step < 200000; step++) {
    h.tick(framesPerTick);
    t += dt;

    if (T.game.state === 'shop') {
      if (lastWave) waveLog.push({ wave: lastWave, sec: +(t - waveStart).toFixed(1), lives: T.game.run.lives, coins: T.save.data.coins });
      buyGreedy();
      const next = T.game.buttons.find((b) => b.id === 'next');
      if (!next) break;
      lastWave = T.game.run.wave;
      waveStart = t;
      next.onClick();
      continue;
    }

    if (T.game.state === 'paused') {
      // бот не должен застревать в паузе: если игра встала, продолжаем
      const resume = T.game.buttons.find((b) => b.id === 'resume');
      if (resume) resume.onClick(); else break;
      continue;
    }

    if (T.game.state === 'gameover') {
      if (lastWave) waveLog.push({ wave: lastWave, sec: +(t - waveStart).toFixed(1), lives: 0, coins: T.save.data.coins });
      break;
    }

    if (T.game.state !== 'playing') continue;

    if (t >= nextDecision) {
      nextDecision = t + bot.period;
      const target = pickTarget();
      const canSlap = (t - bot.lastSlap) >= 1 / bot.slapsPerSec;
      if (target && canSlap) {
        const jx = (Math.random() * 2 - 1) * bot.jitter;
        const jy = (Math.random() * 2 - 1) * bot.jitter;
        T.input.onSlap(target.x + jx, target.y + jy);
        bot.lastSlap = t;
      }
    }
  }

  return {
    skill: skill,
    wave: T.game.run ? T.game.run.wave : 0,
    score: T.game.run ? T.game.run.score : 0,
    kills: T.game.run ? T.game.run.totalFlies : 0,
    coins: T.save.data.coins,
    weapons: T.save.data.weapons.map((v, i) => (v ? i : null)).filter((v) => v !== null),
    upgrades: JSON.parse(JSON.stringify(T.save.data.upgrades)),
    sec: +t.toFixed(0),
    waves: waveLog
  };
}

async function main() {
  T.game.boot();
  await h.sleep(20);

  const results = [];
  for (let i = 0; i < RUNS; i++) results.push(await oneRun(SKILL));

  console.log('\nнавык ' + SKILL + ', забегов ' + RUNS);
  console.log('волна | время, с | монеты | счёт');
  for (const r of results) {
    console.log(
      String(r.wave).padStart(5) + ' | ' +
      r.sec.toFixed(1).padStart(8) + ' | ' +
      String(r.coins).padStart(6) + ' | ' + r.score
    );
    if (RUNS === 1) {
      console.log('  по волнам:');
      for (const w of r.waves) {
        console.log('    волна ' + String(w.wave).padStart(2) + ': ' +
          w.sec.toFixed(1).padStart(5) + ' c, терпение ' + w.lives + ', монет было ' + w.coins);
      }
      console.log('  оружие:', r.weapons.join(', ') || 'только тапок',
        '| улучшения:', JSON.stringify(r.upgrades), '| мух прихлопнуто:', r.kills);
    }
  }
  const avg = results.reduce((s, r) => s + r.wave, 0) / results.length;
  console.log('\nсредняя волна: ' + avg.toFixed(1) + ' | лучшая: ' + Math.max.apply(null, results.map((r) => r.wave)));
  process.exit(0);
}

main().catch((e) => { console.error('ОШИБКА:', e); process.exit(1); });
