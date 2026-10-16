/* Смоук-тест без браузера: прогоняет реальный игровой цикл через стенд test/harness.js.
   Запуск: node test/smoke.js */
'use strict';

const h = require('./harness').load();
const T = h.T;
const canvas = h.canvas;
const tick = h.tick;

const fails = [];
function check(name, cond, extra) {
  if (cond) console.log('  ok   ' + name);
  else { console.log('  FAIL ' + name + (extra ? ' -> ' + extra : '')); fails.push(name); }
}

async function main() {
  console.log('boot...');
  T.game.boot();
  await h.sleep(20);
  tick(5);
  check('состояние menu', T.game.state === 'menu', T.game.state);
  check('кнопка ИГРАТЬ есть', T.game.buttons.some((b) => b.id === 'play'));

  const play = T.game.buttons.find((b) => b.id === 'play');
  play.onClick();
  tick(2);
  check('забег стартовал', T.game.state === 'playing', T.game.state);
  check('волна 1', T.game.run.wave === 1, T.game.run.wave);

  let taps = 0;
  for (let step = 0; step < 90; step++) {
    tick(10);
    const list = T.flies.list.filter((f) => f.state !== 'dead');
    for (const f of list) {
      if (T.game.state === 'shop') break;
      T.input.onSlap(f.x, f.y);
      taps++;
    }
    if (T.game.state === 'shop' || T.game.state === 'gameover') break;
  }
  check('шлепки регистрируются', T.game.run.totalFlies > 0, T.game.run.totalFlies);
  check('монеты капают', T.save.data.coins > 0, T.save.data.coins);
  check('дошли до магазина или гейм-овера', T.game.state === 'shop' || T.game.state === 'gameover', T.game.state);

  if (T.game.state === 'shop') {
    check('в магазине есть товары', T.game.shop.length > 0, T.game.shop.length);
    const next = T.game.buttons.find((b) => b.id === 'next');
    check('кнопка следующей волны есть', !!next);

    T.save.data.coins = 3000;
    T.game.refreshShop();
    const coinsBefore = T.save.data.coins;
    let bought = 0;
    for (let i = 0; i < 6; i++) {
      const buy = T.game.buttons.find((b) => b.id && b.id.indexOf('buy_') === 0 && !b.disabled);
      if (!buy) break;
      buy.onClick();
      bought++;
    }
    check('покупки проходят', bought > 0 && T.save.data.coins < coinsBefore, bought + ' шт, монет ' + T.save.data.coins);
    check('оружие или улучшение куплено',
      T.save.data.weapons.some((v, i) => i > 0 && v) || T.save.data.upgrades.combo > 0 ||
      T.save.data.upgrades.magnet || T.save.data.upgrades.double);

    next.onClick();
    tick(3);
    check('волна 2 идёт', T.game.state === 'playing' && T.game.run.wave === 2, T.game.state + '/' + T.game.run.wave);
  }

  const livesBefore = T.game.run.lives;
  tick(2400);
  check('жизни теряются при поедании', T.game.run.lives < livesBefore || T.game.state === 'gameover',
    livesBefore + ' -> ' + T.game.run.lives);

  canvas.clientWidth = 900; canvas.clientHeight = 500;
  tick(2);
  check('ландшафт: поле в пределах 2:1',
    T.game.worldH / T.game.worldW <= 2.01 && T.game.worldW / T.game.worldH <= 2.01,
    T.game.worldW + 'x' + T.game.worldH);
  canvas.clientWidth = 390; canvas.clientHeight = 844;
  tick(2);
  check('портрет: мир посчитан', T.game.worldW === 720, T.game.worldW);

  T.save.flush();
  check('сохранение пишется', !!localStorage.getItem('tapok_save_v1'));

  console.log(fails.length ? '\nПРОВАЛЕНО: ' + fails.join(', ') : '\nВСЁ ОК');
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error('ОШИБКА ТЕСТА:', e);
  process.exit(1);
});
