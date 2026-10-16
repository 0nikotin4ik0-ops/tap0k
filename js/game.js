/* «Тапок» — движок, состояния, волны, экономика, интерфейс. */
(function () {
  'use strict';

  var T = window.TAPOK;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var G = {
    canvas: null,
    ctx: null,
    dpr: 1,
    cw: 0,
    ch: 0,
    play: { x: 0, y: 0, w: 0, h: 0 },
    scale: 1,
    worldW: 720,
    worldH: 1280,
    state: 'boot',
    prevState: 'menu',
    time: 0,
    last: 0,
    buttons: [],
    run: null,
    shop: [],
    toast: { text: '', sub: '', t: 0 },
    frozen: false,
    adActive: false,
    advCooldown: 0,
    pendingRv: false,
    resetArmed: 0,
    waveHint: 0,
    tableShake: 0,
    lastClatter: -9,
    comboPulse: 0,
    achQueue: [],
    achTimer: null
  };

  /* ---------------- геометрия ---------------- */

  function layout() {
    var cw = G.canvas.clientWidth || window.innerWidth;
    var ch = G.canvas.clientHeight || window.innerHeight;
    G.cw = cw;
    G.ch = ch;
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.canvas.width = Math.round(cw * G.dpr);
    G.canvas.height = Math.round(ch * G.dpr);

    // п. 1.6.2.2: соотношение игрового поля не больше 2:1
    var ratio = clamp(ch / cw, 0.5, 2);
    var pw, ph;
    if (ch / cw > ratio) { pw = cw; ph = cw * ratio; } else { ph = ch; pw = ch / ratio; }
    G.play.x = (cw - pw) / 2;
    G.play.y = (ch - ph) / 2;
    G.play.w = pw;
    G.play.h = ph;

    G.scale = Math.min(pw, ph) / 720;
    G.worldW = pw / G.scale;
    G.worldH = ph / G.scale;

    T.flies.init(foods(), bounds());
  }

  function bounds() {
    // top 190: мухи не залетают в зону HUD, иначе тап по мухе над кнопкой паузы
    // нажимал бы паузу вместо шлепка
    return { left: 26, top: 190, right: G.worldW - 26, bottom: tableY() - 16 };
  }

  function isWide() { return G.worldW > G.worldH * 1.15; }

  function tableY() { return G.worldH * (isWide() ? 0.74 : 0.6); }

  function foods() {
    var ty = tableY();
    var h = G.worldH - ty;
    var k = isWide() ? 1.25 : 1;
    var wave = G.run ? G.run.wave : 1;
    var list = [
      { x: G.worldW * 0.5, y: ty + h * (isWide() ? 0.42 : 0.3), r: 66 * k, kind: 'cake', claimedBy: null },
      { x: G.worldW * 0.2, y: ty + h * (isWide() ? 0.3 : 0.2), r: 48 * k, kind: 'cup', claimedBy: null },
      { x: G.worldW * 0.8, y: ty + h * (isWide() ? 0.34 : 0.24), r: 52 * k, kind: 'pie', claimedBy: null }
    ];
    // с 7 волны на столе больше еды: одновременно есть могут больше мух
    if (wave >= 7) {
      list.push({ x: G.worldW * 0.33, y: ty + h * 0.52, r: 44 * k, kind: 'pie', claimedBy: null });
    }
    if (wave >= 13) {
      list.push({ x: G.worldW * 0.67, y: ty + h * 0.56, r: 40 * k, kind: 'cup', claimedBy: null });
    }
    return list;
  }

  /* Мелочи на столе, чтобы нижняя часть экрана не пустовала */
  function drawTableDecor(ctx, jump) {
    var ty = tableY();
    var h = G.worldH - ty;
    var k = isWide() ? 1.3 : 1;
    jump = jump || 0;

    // салфетка
    var nw = Math.min(170, G.worldW * 0.26);
    ctx.save();
    ctx.translate(G.worldW * 0.16, ty + h * 0.72 + jump);
    ctx.rotate(-0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(-nw / 2, -nw * 0.28, nw, nw * 0.56);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-nw / 2, -nw * 0.28, nw, nw * 0.56);
    ctx.restore();

    // вилка
    ctx.save();
    ctx.translate(G.worldW * 0.85, ty + h * 0.68 + jump);
    ctx.rotate(0.4);
    ctx.scale(k * 0.85, k * 0.85);
    ctx.fillStyle = 'rgba(228,233,243,0.32)';
    ctx.fillRect(-4, -6, 8, 62);
    for (var i = -1; i <= 1; i++) ctx.fillRect(i * 7 - 2, -38, 4, 30);
    ctx.beginPath();
    ctx.ellipse(0, -40, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // крошки
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (var c = 0; c < 7; c++) {
      var cx = G.worldW * (0.3 + (c * 0.11) % 0.5);
      var cy = ty + h * (0.5 + ((c * 0.17) % 0.4));
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + (c % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* В меню мухи не залетают в верхнюю часть экрана — там логотип и кнопки */
  function menuBounds() {
    return { left: 26, top: G.worldH * 0.42, right: G.worldW - 26, bottom: tableY() - 16 };
  }

  function toWorld(clientX, clientY) {
    var rect = G.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - G.play.x) / G.scale,
      y: (clientY - rect.top - G.play.y) / G.scale
    };
  }

  /* ---------------- темы волн ---------------- */

  var THEMES = [
    { wall: ['#2a3550', '#141a29'], table: '#6b4a2a', tile: 'rgba(255,255,255,0.05)' },
    { wall: ['#3a2f4f', '#191326'], table: '#5d4326', tile: 'rgba(255,255,255,0.05)' },
    { wall: ['#234a44', '#0f2320'], table: '#6a5030', tile: 'rgba(255,255,255,0.05)' },
    { wall: ['#4a3a22', '#231a0f'], table: '#7a5a2c', tile: 'rgba(255,255,255,0.04)' },
    { wall: ['#3d2430', '#1c1017'], table: '#5a3a24', tile: 'rgba(255,255,255,0.04)' },
    { wall: ['#243a52', '#0e1a26'], table: '#4f3a2a', tile: 'rgba(255,255,255,0.05)' },
    { wall: ['#3c4a1f', '#1a2109'], table: '#6b5230', tile: 'rgba(255,255,255,0.04)' },
    { wall: ['#2b2b2b', '#131313'], table: '#4a4a4a', tile: 'rgba(255,255,255,0.06)' },
    { wall: ['#1d3a4a', '#08161f'], table: '#2f4a55', tile: 'rgba(120,240,255,0.07)' },
    { wall: ['#3a1d4a', '#160820'], table: '#40305a', tile: 'rgba(200,120,255,0.07)' }
  ];

  function theme() {
    var w = G.run ? G.run.wave : 1;
    return THEMES[(w - 1) % THEMES.length] || THEMES[0];
  }

  function waveName(w) {
    return T.i18n.t('w' + (((w - 1) % 12) + 1));
  }

  /* ---------------- утилиты ---------------- */

  function canVibrate() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  function buzz(ms) {
    if (!T.save.data.settings.vibrate) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  function toast(text, sub) {
    G.toast.text = text;
    G.toast.sub = sub || '';
    G.toast.t = 2.4;
  }

  function gainCoins(n) {
    T.save.data.coins += n;
    T.save.data.stats.coinsEarned += n;
    if (G.run) {
      G.run.earned += n;
      G.run.waveCoins += n;
    }
  }

  /* ---------------- реклама ---------------- */

  function pauseForAd() {
    G.adActive = true;
    G.frozen = true;
    T.audio.suspend();
    T.platform.gameplayStop();
  }

  function resumeAfterAd() {
    G.adActive = false;
    G.frozen = false;
    T.audio.resume();
    if (G.state === 'playing') T.platform.gameplayStart();
  }

  function showInterstitial() {
    if (G.advCooldown > 0) return Promise.resolve(false);
    pauseForAd();
    G.advCooldown = 65;
    return T.platform.showFullscreenAdv().then(function (shown) {
      resumeAfterAd();
      return shown;
    });
  }

  function showRewarded(reward) {
    if (G.pendingRv) return;
    G.pendingRv = true;
    T.audio.init();
    T.audio.sfx('click');
    pauseForAd();
    T.platform.showRewarded().then(function (ok) {
      G.pendingRv = false;
      resumeAfterAd();
      if (ok) reward();
      else toast(T.i18n.t('noMoney'));
    });
  }

  /* ---------------- волны и забег ---------------- */

  function newRun() {
    G.run = {
      wave: 0,
      score: 0,
      lives: 3,
      maxLives: 3,
      livesBought: 0,
      kills: 0,
      quota: 0,
      waveKills: 0,
      combo: 0,
      comboT: 0,
      maxCombo: 0,
      perfect: true,
      earned: 0,
      waveCoins: 0,
      totalFlies: 0,
      spawnT: 0,
      bossWave: false,
      bossKilled: false,
      bossSpawned: false,
      doubled: false,
      continueUsed: false,
      waveT: 0
    };
    T.save.data.stats.games++;
    T.flies.reset();
    T.fx.reset();
    T.input.clear();
  }

  function nextWave() {
    var r = G.run;
    r.wave++;
    r.quota = Math.min(5 + r.wave, 24);
    r.waveKills = 0;
    r.waveCoins = 0;
    r.perfect = true;
    r.slowWave = false;
    r.bossWave = r.wave % 5 === 0;
    r.bossKilled = false;
    r.bossSpawned = false;
    r.spawnT = 0;
    r.waveT = 0;
    T.flies.reset();
    T.fx.reset();
    G.waveHint = r.wave === 1 ? 5 : 0;
    G.state = 'playing';
    G.buttons = [];
    T.flies.init(foods(), bounds());
    T.platform.gameplayStart();
    if (!r.bossWave) T.audio.sfx('wave');
  }

  function startRun() {
    T.audio.init();
    newRun();
    nextWave();
  }

  function completeWave() {
    var r = G.run;
    var bonus = waveBonus(r.wave);
    gainCoins(bonus);
    if (r.perfect) T.save.data.stats.perfectWaves++;
    if (r.wave > T.save.data.bestWave) T.save.data.bestWave = r.wave;
    if (r.score > T.save.data.bestScore) T.save.data.bestScore = r.score;
    T.save.flush();
    T.audio.sfx('fanfare');
    T.platform.gameplayStop();
    G.state = 'shop';
    buildShop();
    announceAchievements(T.save.checkAchievements());
    if (r.wave % 3 === 0) {
      setTimeout(function () { showInterstitial(); }, 500);
    }
  }

  function loseLife(n, x, y) {
    var r = G.run;
    if (!r || G.state !== 'playing') return;
    r.lives -= n;
    r.perfect = false;
    T.fx.shake(12 + n * 4);
    T.audio.sfx('lose');
    buzz(70);
    if (x !== undefined) T.fx.text(x, y - 40, T.i18n.t('escape'), '#ff6b6b', 34);
    if (r.lives <= 0) gameOver();
  }

  function gameOver() {
    var r = G.run;
    r.lives = 0;
    var d = T.save.data;
    if (r.wave > d.bestWave) d.bestWave = r.wave;
    if (r.score > d.bestScore) d.bestScore = r.score;
    d.stats.totalFlies += r.totalFlies;
    d.stats.maxCombo = Math.max(d.stats.maxCombo, r.maxCombo);
    T.save.flush();
    T.audio.sfx('gameover');
    T.platform.gameplayStop();
    G.state = 'gameover';
    buildGameOver();
    announceAchievements(T.save.checkAchievements());
  }

  function announceAchievements(list) {
    if (!list || !list.length) return;
    G.achQueue = G.achQueue.concat(list);
    if (!G.achTimer) showNextAch();
  }

  function showNextAch() {
    if (!G.achQueue.length) { G.achTimer = null; return; }
    var id = G.achQueue.shift();
    toast(T.i18n.t('achUnlocked', { n: T.i18n.t('ach_' + id) }), T.i18n.t('ach_' + id + 'd'));
    T.audio.sfx('achievement');
    G.achTimer = setTimeout(function () {
      G.achTimer = null;
      showNextAch();
    }, 2600);
  }

  /* ---------------- шлепок ---------------- */

  function bestWeapon() {
    var list = T.save.data.weapons;
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i]) return i;
    }
    return 0;
  }

  function comboWindow() {
    return 0.7 + T.save.data.upgrades.combo * 0.15;
  }

  /* Уровни улучшений: раньше были true/false, теперь числа (true = 1) */
  function level(v) {
    if (v === true) return 1;
    if (!v) return 0;
    return v | 0;
  }

  function waveBonus(w) { return 12 + w * 4; }

  function coinMul(wave) {
    return (1 + wave * 0.03) * (1 + 0.25 * level(T.save.data.upgrades.magnet));
  }

  function doSlap(x, y) {
    var r = G.run;
    if (!r) return;
    var st = T.weapons.stats(bestWeapon(), T.save.data.upgrades);
    st.comboMult = 1 + Math.min(2, r.combo / 4);
    var res = T.flies.slap(x, y, st);
    T.fx.stamp(x, y);

    if (!res.hits) {
      if (y > tableY()) {
        // шлепок по столу: посуда подпрыгивает и звенит (с паузой, чтобы не тарахтело)
        G.tableShake = 1;
        if (G.time - (G.lastClatter || -9) > 0.16) {
          G.lastClatter = G.time;
          T.audio.sfx('clatter');
        }
        T.fx.spark(x, y, '#efe6cf', 8);
      } else {
        T.fx.ring(x, y, st.radius * 0.6, 'rgba(255,255,255,0.3)');
      }
      return;
    }

    r.combo++;
    r.comboT = comboWindow();
    if (r.combo > r.maxCombo) r.maxCombo = r.combo;
    G.comboPulse = 1;

    var mult = Math.min(9, r.combo);
    T.fx.hitstop(0.035);
    T.fx.ring(x, y, st.radius, 'rgba(255,255,255,0.5)');
    T.audio.sfx('slap', mult);
    if (mult > 1) T.audio.sfx('combo', mult);
    T.fx.shake(3 + mult * 0.8);
    buzz(25);

    if (mult > 1) {
      T.fx.text(x, y - 118, T.i18n.t('slapped', { n: mult }), '#ffd23f', 40 + mult * 3);
    }

    for (var i = 0; i < res.kills.length; i++) {
      var k = res.kills[i];
      r.kills++;
      r.waveKills++;
      r.totalFlies++;
      r.score += k.score * mult;
      gainCoins(Math.max(1, Math.round(k.coins * coinMul(r.wave))));
      T.fx.splat(k.x, k.y,
        k.type === 'roach' ? '#8a5a24' : (k.type === 'gold' ? '#ffd76a' : '#7bb661'),
        k.type === 'fat' ? 20 : 12);
      T.fx.coinPop(k.x, k.y, Math.min(k.coins, 5));
      T.fx.text(k.x, k.y - k.r - 24, '+' + (k.score * mult), '#fff', 30);
      if (k.type === 'boss') {
        r.bossKilled = true;
        T.fx.shake(26);
        T.fx.splat(k.x, k.y, '#f2c31f', 46);
        T.audio.sfx('fanfare');
        toast(T.i18n.t(k.nameKey || 'bossName'), '+1');
      }
    }
    if (res.bossHit) buzz(40);
  }

  /* ---------------- обновление мира ---------------- */

  function updateWorld(dt) {
    var r = G.run;
    if (!r) return;

    if (r.comboT > 0) {
      r.comboT -= dt;
      if (r.comboT <= 0) r.combo = 0;
    }
    r.waveT += dt;
    if (G.waveHint > 0) G.waveHint -= dt;

    if (T.fx.hitstopT <= 0) {
      var events = T.flies.update(dt * (r.slowWave ? 0.62 : 1), G.time);
      for (var i = 0; i < events.length; i++) {
        var e = events[i];
        if (e.kind === 'bossReach') {
          loseLife(2, e.x, e.y);
          T.fx.shake(24);
          if (G.state !== 'playing') return;
        } else if (e.kind === 'spawnling') {
          T.fx.spark(e.x, e.y + 40, '#ff5a5a', 6);
        } else if (e.penalty) {
          loseLife(1, e.x, e.y);
          if (G.state !== 'playing') return;
        } else if (e.kind === 'escape') {
          T.audio.sfx('escape');
          T.fx.feather(e.x, e.y);
        }
      }
    }

    if (G.state !== 'playing') return;

    if (r.bossWave) {
      if (!r.bossSpawned) {
        T.flies.spawnBoss(r.wave);
        r.bossSpawned = true;
        T.audio.sfx('boss');
        T.fx.shake(14);
      }
      r.spawnT -= dt;
      if (r.spawnT <= 0 && T.flies.count() < 4) {
        T.flies.spawn(T.flies.pickType(r.wave), r.wave);
        r.spawnT = 2.2;
      }
    } else {
      r.spawnT -= dt;
      // мягче, чем было: раньше к 10 волне на экране было 8 мух каждые 0.85 с
      var maxOn = Math.min(3 + Math.floor(r.wave / 2.2), 11);
      if (r.spawnT <= 0 && T.flies.count() < maxOn) {
        T.flies.spawn(T.flies.pickType(r.wave), r.wave);
        r.spawnT = Math.max(0.45, 1.4 - r.wave * 0.05);
      }
    }

    if (r.bossWave) {
      if (r.bossKilled) completeWave();
    } else if (r.waveKills >= r.quota) {
      completeWave();
    }
  }

  function updateMenuAmbient(dt) {
    if (T.flies.count() < 3) {
      var f = T.flies.spawn('fly', 1);
      f.hunger = 9999;
      f.eat = false;
      f.speed *= 0.7;
    }
    T.flies.update(dt, G.time);
  }

  /* ---------------- главный цикл ---------------- */

  function update(dt) {
    G.time += dt;
    T.input.update(dt);
    T.fx.update(dt);
    if (G.advCooldown > 0) G.advCooldown -= dt;
    if (G.tableShake > 0) G.tableShake = Math.max(0, G.tableShake - dt * 2.2);
    if (G.comboPulse > 0) G.comboPulse = Math.max(0, G.comboPulse - dt * 3);
    if (G.toast.t > 0) G.toast.t -= dt;

    if (G.state === 'playing') {
      updateWorld(dt);
    } else if (G.state === 'shop' || G.state === 'gameover' || G.state === 'paused') {
      if (T.fx.hitstopT <= 0) T.flies.update(dt, G.time);
    } else if (G.state === 'menu' || G.state === 'howto') {
      updateMenuAmbient(dt);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = G.last ? (now - G.last) / 1000 : 0;
    G.last = now;
    dt = clamp(dt, 0, 0.05);
    if (!G.frozen) update(dt);
    render();
  }

  /* ---------------- сцена ---------------- */

  function drawKitchen(ctx) {
    var th = theme();
    var w = G.worldW, h = G.worldH;
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, th.wall[0]);
    g.addColorStop(1, th.wall[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = th.tile;
    ctx.lineWidth = 2;
    var step = 120;
    var ty = tableY();
    for (var x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ty); ctx.stroke();
    }
    for (var y = 0; y < ty; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    var wx = w * 0.6, wy = h * 0.05, ww = w * 0.32, wh = h * 0.22;
    ctx.fillStyle = 'rgba(120,190,255,0.16)';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 6;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

    ctx.fillStyle = th.table;
    ctx.fillRect(0, ty, w, h - ty);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, ty, w, 14);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    for (var i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, ty + (h - ty) * (i / 4));
      ctx.lineTo(w, ty + (h - ty) * (i / 4));
      ctx.stroke();
    }

    var fs = T.flies.foods;
    var jump = G.tableShake > 0 ? -Math.abs(Math.sin(G.time * 26)) * 9 * G.tableShake : 0;
    drawTableDecor(ctx, jump);
    for (var f = 0; f < fs.length; f++) drawFood(ctx, fs[f], jump);
  }

  function drawFood(ctx, food, jump) {
    ctx.save();
    ctx.translate(food.x, food.y + (jump || 0));
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, food.r * 0.55, food.r * 0.95, food.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    if (food.kind === 'cake') {
      ctx.fillStyle = '#f6f1e7';
      ctx.beginPath();
      ctx.ellipse(0, food.r * 0.2, food.r, food.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2b6c6';
      ctx.fillRect(-food.r * 0.8, -food.r * 0.5, food.r * 1.6, food.r * 0.7);
      ctx.fillStyle = '#fff3d1';
      ctx.beginPath();
      ctx.ellipse(0, -food.r * 0.5, food.r * 0.8, food.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8555f';
      ctx.beginPath();
      ctx.arc(0, -food.r * 0.74, food.r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    } else if (food.kind === 'cup') {
      ctx.fillStyle = '#dfe6f2';
      ctx.beginPath();
      ctx.moveTo(-food.r * 0.6, -food.r * 0.6);
      ctx.lineTo(food.r * 0.6, -food.r * 0.6);
      ctx.lineTo(food.r * 0.42, food.r * 0.6);
      ctx.lineTo(-food.r * 0.42, food.r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6b4a2a';
      ctx.beginPath();
      ctx.ellipse(0, -food.r * 0.6, food.r * 0.6, food.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#e8dcc0';
      ctx.beginPath();
      ctx.ellipse(0, 0, food.r * 0.95, food.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c98b3f';
      ctx.beginPath();
      ctx.ellipse(0, -food.r * 0.1, food.r * 0.72, food.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8f5a20';
      for (var i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * 1.3) * food.r * 0.4, -food.r * 0.12 + Math.sin(i * 1.3) * food.r * 0.12, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function pauseButton() {
    return {
      id: 'pause', x: G.worldW - 92, y: 96, w: 68, h: 68, r: 18, style: 'flat',
      label: 'II', size: 30, silent: true,
      onClick: function () { pauseGame(); }
    };
  }

  function drawHud(ctx) {
    var r = G.run;
    if (!r) return;
    var w = G.worldW;

    var g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, 'rgba(8,10,16,0.7)');
    g.addColorStop(1, 'rgba(8,10,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 150);

    var maxShow = Math.max(r.maxLives, r.lives, 3);
    for (var i = 0; i < maxShow; i++) {
      var alive = i < r.lives;
      T.ui.iconSlipper(ctx, 50 + i * 50, 46, 1.05, alive ? '#e0553f' : '#3a3f4c', alive ? 1 : 0.55);
    }

    T.ui.text(ctx, T.i18n.t('wave', { n: r.wave }), w / 2, 40, { size: 34, color: '#fff' });
    T.ui.text(ctx, waveName(r.wave) + '  •  ' + T.i18n.t('score') + ': ' + r.score, w / 2, 78, {
      size: 24, color: 'rgba(255,255,255,0.8)'
    });
    if (!r.bossWave) {
      T.ui.text(ctx, r.waveKills + ' / ' + r.quota, w / 2, 112, { size: 22, color: 'rgba(255,255,255,0.65)' });
    }
    if (r.slowWave) {
      T.ui.text(ctx, '\u2744 ' + T.i18n.t('slowActive'), 26, 92, {
        size: 20, color: '#7fe3ff', align: 'left', stroke: false
      });
    }

    var coinStr = String(T.save.data.coins);
    var coinW = T.ui.measure(ctx, coinStr, 30);
    T.ui.text(ctx, coinStr, w - 44, 46, { size: 30, color: '#ffd75e', align: 'right' });
    T.ui.iconCoin(ctx, w - 44 - coinW - 30, 46, 1.05);

    T.ui.button(ctx, pauseButton(), G.time);

    var boss = T.flies.boss();
    if (boss) {
      var bw = w * 0.62, bx = (w - bw) / 2, by = 176;
      T.ui.panel(ctx, bx - 12, by - 10, bw + 24, 44, { r: 18, alpha: 0.85 });
      var k = clamp(boss.hp / boss.maxHp, 0, 1);
      var bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      bg.addColorStop(0, '#ff6b6b');
      bg.addColorStop(1, '#ffd23f');
      ctx.fillStyle = bg;
      T.ui.rr(ctx, bx, by, Math.max(6, bw * k), 24, 12);
      ctx.fill();
      T.ui.text(ctx, T.i18n.t(boss.nameKey || 'bossName'), w / 2, by - 24, { size: 24, color: '#ffd23f' });
    }

    if (r.combo > 1) {
      // компактная плашка комбо в верхней зоне: центр экрана остаётся игровым
      var pulse = 1 + G.comboPulse * 0.22;
      var k2 = clamp(r.comboT / comboWindow(), 0, 1);
      var cw = Math.min(w * 0.46, 300);
      var cy = boss ? 246 : 128;
      ctx.save();
      T.ui.panel(ctx, (w - cw) / 2, cy, cw, 56, { alpha: 0.75, r: 20, top: 'rgba(48,38,12,0.9)' });
      ctx.translate(w / 2, cy + 28);
      ctx.scale(pulse, pulse);
      T.ui.text(ctx, T.i18n.t('combo', { n: Math.min(9, r.combo) }), 0, 0, {
        size: 32, color: r.combo >= 5 ? '#ffd23f' : '#fff'
      });
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      T.ui.rr(ctx, w / 2 - cw * 0.42, cy + 46, cw * 0.84 * k2, 6, 3);
      ctx.fill();
    }

    if (G.state === 'playing' && G.waveHint > 0 && r.totalFlies === 0) {
      var a = 0.55 + Math.sin(G.time * 6) * 0.4;
      var hw = Math.min(w * 0.82, 470);
      T.ui.panel(ctx, (w - hw) / 2, G.worldH * 0.5 - 44, hw, 88, { alpha: 0.35 + 0.35 * a, r: 26 });
      T.ui.text(ctx, T.i18n.t('tapHint'), w / 2, G.worldH * 0.5, { size: 42, color: '#fff', alpha: a });
    }
  }

  /* ---------------- кнопки ---------------- */

  function btn(o) {
    o.r = o.r || Math.min(26, o.h * 0.34);
    G.buttons.push(o);
    return o;
  }

  function stackButtons(items, top, bottom, gap, x, w, maxH) {
    var n = items.length;
    if (!n) return;
    maxH = maxH || 132;
    var avail = Math.max(54 * n, bottom - top - gap * (n - 1));
    var wsum = 0, i;
    for (i = 0; i < n; i++) wsum += (items[i].weight || 1);
    var heights = [], total = 0;
    for (i = 0; i < n; i++) {
      var hh = Math.min(maxH, Math.max(54, avail * (items[i].weight || 1) / wsum));
      heights.push(hh);
      total += hh;
    }
    total += gap * (n - 1);
    var y = top + Math.max(0, (bottom - top - total) / 2);
    for (i = 0; i < n; i++) {
      var it = items[i];
      it.x = x; it.y = y; it.w = w; it.h = heights[i];
      btn(it);
      y += heights[i] + gap;
    }
  }

  function buildMenu() {
    G.buttons = [];
    var w = G.worldW, h = G.worldH;
    var bw = Math.min(w * 0.78, 520), bx = (w - bw) / 2;

    var items = [{
      id: 'play', label: T.i18n.t('play'), style: 'green', size: 46, weight: 1.35,
      onClick: function () { startRun(); }
    }];

    if (T.save.dailyAvailable()) {
      var reward = 50 + T.save.data.daily.streak * 25;
      items.push({
        id: 'daily', style: 'gold', label: T.i18n.t('daily', { n: reward }), size: 28, weight: 1,
        sub: T.save.data.daily.streak > 0 ? T.i18n.t('streak', { n: T.save.data.daily.streak }) : '',
        onClick: function () {
          var got = T.save.claimDaily();
          if (got) {
            T.audio.sfx('buy');
            toast(T.i18n.t('daily', { n: got }));
            buildMenu();
          }
        }
      });
    }

    items.push({
      id: 'howto', style: 'flat', label: T.i18n.t('howto'), size: 28, weight: 1,
      onClick: function () { G.state = 'howto'; buildHowTo(); }
    });

    if (!T.platform.player && !T.platform.isLocal) {
      items.push({
        id: 'login', style: 'flat', label: T.i18n.t('login'), size: 24, weight: 1,
        sub: T.i18n.t('loginHint'),
        onClick: function () { doAuth(); }
      });
    }

    stackButtons(items, h * 0.42, h - 150, 14, bx, bw, 132);

    btn({
      id: 'sound', x: w - 96, y: 24, w: 72, h: 72, r: 20, style: 'flat',
      icon: 'sound', iconOn: T.save.data.settings.sound,
      onClick: function () {
        var s = T.save.data.settings;
        s.sound = !s.sound;
        T.audio.setMuted(!s.sound);
        T.save.flush();
        T.audio.sfx('click');
        buildMenu();
      }
    });
    btn({
      id: 'music', x: w - 176, y: 24, w: 72, h: 72, r: 20, style: 'flat',
      icon: 'music', iconOn: T.save.data.settings.music !== false,
      onClick: function () {
        var s = T.save.data.settings;
        s.music = !(s.music !== false);
        T.audio.setMusic(s.music);
        T.save.flush();
        T.audio.sfx('click');
        buildMenu();
      }
    });

    if (canVibrate()) {
      btn({
        id: 'vibro', x: 24, y: 24, w: 72, h: 72, r: 20, style: 'flat',
        icon: 'vibrate', iconOn: T.save.data.settings.vibrate,
        onClick: function () {
          var s = T.save.data.settings;
          s.vibrate = !s.vibrate;
          T.save.flush();
          buzz(40);
          T.audio.sfx('click');
          buildMenu();
        }
      });
    }

    T.flies.init(foods(), menuBounds());
  }

  function buildHowTo() {
    G.buttons = [];
    var w = G.worldW, h = G.worldH;
    var bw = Math.min(w * 0.6, 380), bx = (w - bw) / 2;
    stackButtons([{
      id: 'ok', style: 'green', label: T.i18n.t('ok'), size: 34, weight: 1,
      onClick: function () { G.state = 'menu'; buildMenu(); }
    }], h - 170, h - 50, 0, bx, bw);
  }

  /* Раскладка магазина. На широком или низком экране (десктоп, телефон в ландшафте)
     шесть строк в одну колонку не влезают над кнопкой «Следующая волна» — раскладываем
     в две колонки. Строки обязаны закончиться выше h−152. */
  function shopLayout() {
    var w = G.worldW, h = G.worldH;
    var n = Math.max(1, G.shop.length);
    var cols = (n > 4 && (isWide() || h < 900)) ? 2 : 1;
    var rows = Math.ceil(n / cols);
    var top = h * 0.235;
    var bottom = h - 152;
    var gap = 10;
    var rowH = clamp((bottom - top - gap * (rows - 1)) / rows, 60, 120);
    var bw = Math.min(w * (cols === 2 ? 0.94 : 0.9), cols === 2 ? 1020 : 620);
    var btnW = Math.min(cols === 2 ? 160 : 200, (bw / cols) * 0.4);
    return {
      cols: cols, rows: rows, rowH: rowH, gap: gap,
      bw: bw, bx: (w - bw) / 2, top: top, cellW: bw / cols, btnW: btnW
    };
  }

  function buildShop() {
    G.buttons = [];
    var w = G.worldW;
    G.shop = shopItems();
    var L = shopLayout();

    for (var i = 0; i < G.shop.length; i++) {
      (function (item, idx) {
        var col = idx % L.cols;
        var row = Math.floor(idx / L.cols);
        var cx = L.bx + col * L.cellW;
        var ry = L.top + row * (L.rowH + L.gap);
        var canBuy = !item.soldOut && T.save.data.coins >= item.price;
        btn({
          id: 'buy_' + idx,
          x: cx + L.cellW - L.btnW - 14,
          y: ry + L.rowH * 0.16,
          w: L.btnW,
          h: L.rowH * 0.68,
          style: canBuy ? 'green' : 'flat',
          disabled: !canBuy,
          label: item.soldOut ? '\u2014' : (canBuy ? T.i18n.t('buy') : String(item.price)),
          sub: item.soldOut ? '' : (canBuy ? String(item.price) + ' \u20BD' : ''),
          size: 28,
          item: item,
          onClick: function () { buyItem(item, idx); }
        });
      })(G.shop[i], i);
    }

    var nw = Math.min(w * 0.8, 520);
    var hh = G.worldH;
    stackButtons([{
      id: 'next', style: 'blue', label: T.i18n.t('nextWave'), size: 36, weight: 1,
      onClick: function () { nextWave(); }
    }], hh - 128, hh - 40, 0, (w - nw) / 2, nw);
  }

  function shopItems() {
    var d = T.save.data;
    var items = [];

    // 1. следующее оружие
    for (var i = 1; i < T.weapons.LIST.length; i++) {
      if (!d.weapons[i]) {
        var wl = T.weapons.LIST[i];
        items.push({
          kind: 'weapon', index: i, price: wl.price,
          title: T.weapons.name(i),
          sub: T.i18n.t('wSub', { n: wl.damage, n2: wl.radius })
        });
        break;
      }
    }

    // 2. расходник на следующую волну
    items.push({ kind: 'slow', price: 130, title: T.i18n.t('slowName'), sub: T.i18n.t('slowHint') });

    // 3. постоянные треки: уровней много, чтобы прокачка не кончалась к 10 волне
    var mag = level(d.upgrades.magnet);
    if (mag < 3) {
      items.push({
        kind: 'magnet', price: [250, 450, 700][mag],
        title: T.i18n.t('magnet') + '   ' + mag + '/3', sub: T.i18n.t('magnetHint')
      });
    }
    var dbl = level(d.upgrades.double);
    if (dbl < 3) {
      items.push({
        kind: 'double', price: [400, 800, 1400][dbl],
        title: T.i18n.t('doubleSplat') + '   ' + dbl + '/3', sub: T.i18n.t('doubleHint')
      });
    }
    if (d.upgrades.combo < 5) {
      items.push({
        kind: 'combo', price: 150 + d.upgrades.combo * 120,
        title: T.i18n.t('comboUp', { n: '0.15' }) + '   ' + (d.upgrades.combo + 1) + '/5',
        sub: T.i18n.t('comboUpHint')
      });
    }
    items.push({
      kind: 'life',
      price: 150 + G.run.livesBought * 150,
      title: T.i18n.t('livesUp') + '   ' + G.run.livesBought + '/3',
      sub: T.i18n.t('livesUpHint'),
      soldOut: G.run.livesBought >= 3
    });

    return items.slice(0, 6);
  }

  function buyItem(item) {
    var d = T.save.data;
    if (item.soldOut) { T.audio.sfx('error'); return; }
    if (d.coins < item.price) {
      T.audio.sfx('error');
      toast(T.i18n.t('notEnough'));
      return;
    }
    d.coins -= item.price;
    if (item.kind === 'weapon') {
      d.weapons[item.index] = true;
      toast(T.weapons.name(item.index), T.i18n.t('owned'));
    } else if (item.kind === 'life') {
      G.run.livesBought++;
      G.run.maxLives++;
      G.run.lives++;
      toast(T.i18n.t('livesUp'));
    } else if (item.kind === 'slow') {
      G.run.slowWave = true;
      toast(T.i18n.t('slowName'), T.i18n.t('slowActive'));
    } else if (item.kind === 'magnet') {
      d.upgrades.magnet = level(d.upgrades.magnet) + 1;
      toast(T.i18n.t('magnet') + ' ' + d.upgrades.magnet + '/3');
    } else if (item.kind === 'double') {
      d.upgrades.double = level(d.upgrades.double) + 1;
      toast(T.i18n.t('doubleSplat') + ' ' + d.upgrades.double + '/3');
    } else if (item.kind === 'combo') {
      d.upgrades.combo++;
      toast(T.i18n.t('comboUp', { n: '0.15' }) + ' ' + d.upgrades.combo + '/5');
    }
    T.save.flush();
    T.audio.sfx('buy');
    buildShop();
  }

  function buildGameOver() {
    G.buttons = [];
    var w = G.worldW, h = G.worldH;
    var bw = Math.min(w * 0.82, 560), bx = (w - bw) / 2;
    var r = G.run;
    var items = [];

    items.push({
      id: 'again', style: 'green', label: T.i18n.t('again'), size: 38, weight: 1.15,
      onClick: function () { startRun(); }
    });

    if (!r.continueUsed) {
      items.push({
        id: 'rv_continue', style: 'gold', label: T.i18n.t('rvContinue'), size: 24, weight: 1,
        onClick: function () {
          showRewarded(function () {
            r.continueUsed = true;
            r.lives = 1;
            r.perfect = false;
            T.flies.reset();
            G.state = 'playing';
            G.buttons = [];
            T.platform.gameplayStart();
          });
        }
      });
    }

    if (!r.doubled) {
      items.push({
        id: 'rv_coins', style: 'gold', label: T.i18n.t('rvCoins'), size: 24, weight: 1,
        onClick: function () {
          showRewarded(function () {
            r.doubled = true;
            gainCoins(r.earned);
            T.save.flush();
            toast('+' + r.earned + ' ' + T.i18n.t('coins'));
            buildGameOver();
          });
        }
      });
    }

    items.push({
      id: 'menu', style: 'flat', label: T.i18n.t('toMenu'), size: 30, weight: 0.9,
      onClick: function () {
        G.state = 'menu';
        T.flies.reset();
        T.fx.reset();
        buildMenu();
        showInterstitial();
      }
    });

    stackButtons(items, h * 0.55, h - 24, 9, bx, bw, 118);
  }

  function pauseGame() {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    if (G.state !== 'paused') {
      G.prevState = G.state;
      G.state = 'paused';
      T.platform.gameplayStop();
    }
    G.buttons = [];
    var w = G.worldW, h = G.worldH;
    var bw = Math.min(w * 0.8, 560), bx = (w - bw) / 2;

    var items = [
      {
        id: 'resume', style: 'green', label: T.i18n.t('resume'), size: 34, weight: 1.2,
        onClick: function () {
          T.audio.init();
          T.audio.resume();
          G.state = 'playing';
          G.buttons = [];
          T.platform.gameplayStart();
        }
      },
      {
        id: 'psound', style: 'flat', weight: 1, size: 26,
        label: T.i18n.t('sound') + ': ' + (T.save.data.settings.sound ? T.i18n.t('on') : T.i18n.t('off')),
        onClick: function () {
          var s = T.save.data.settings;
          s.sound = !s.sound;
          T.audio.setMuted(!s.sound);
          T.save.flush();
          pauseGame();
        }
      },
      {
        id: 'pmusic', style: 'flat', weight: 1, size: 26,
        label: T.i18n.t('music') + ': ' + (T.save.data.settings.music !== false ? T.i18n.t('on') : T.i18n.t('off')),
        onClick: function () {
          var s = T.save.data.settings;
          s.music = !(s.music !== false);
          T.audio.setMusic(s.music);
          T.save.flush();
          pauseGame();
        }
      },
      {
        id: 'pvibro', style: 'flat', weight: 1, size: 26,
        label: T.i18n.t('vibrate') + ': ' + (canVibrate()
          ? (T.save.data.settings.vibrate ? T.i18n.t('on') : T.i18n.t('off'))
          : T.i18n.t('vibroUnsupported')),
        onClick: function () {
          if (!canVibrate()) {
            toast(T.i18n.t('vibroHint'));
            return;
          }
          var s = T.save.data.settings;
          s.vibrate = !s.vibrate;
          T.save.flush();
          if (s.vibrate) {
            // заметный тестовый импульс: если не жужжит — дело в системе или браузере
            try { navigator.vibrate([130, 80, 130]); } catch (e) {}
            toast(T.i18n.t('vibroTest'));
          }
          pauseGame();
        }
      },
      {
        id: 'preset', style: 'red', weight: 1, size: 24,
        label: G.resetArmed > 0 ? T.i18n.t('resetProgress') + '?' : T.i18n.t('resetProgress'),
        onClick: function () {
          G.resetArmed++;
          if (G.resetArmed >= 2) {
            T.save.resetProgress();
            G.resetArmed = 0;
            toast(T.i18n.t('resetDone'));
          }
          pauseGame();
        }
      },
      {
        id: 'pmenu', style: 'flat', weight: 1, size: 28, label: T.i18n.t('toMenu'),
        onClick: function () {
          G.state = 'menu';
          T.flies.reset();
          T.fx.reset();
          buildMenu();
        }
      }
    ];

    stackButtons(items, h * 0.24, h - 24, 9, bx, bw);
  }

  function doAuth() {
    T.audio.sfx('click');
    T.platform.auth().then(function (player) {
      if (!player) return;
      T.platform.cloudLoad().then(function (cloud) {
        if (cloud) mergeCloud(cloud);
        if (!T.save.data.loginRewarded) {
          T.save.data.loginRewarded = true;
          gainCoins(200);
          toast('+200 ' + T.i18n.t('coins'));
        } else {
          toast(T.i18n.t('loginOk', { n: T.platform.playerName() || T.i18n.t('guest') }));
        }
        T.save.flush();
        buildMenu();
      });
    });
  }

  function mergeCloud(cloud) {
    var d = T.save.data;
    d.coins = Math.max(d.coins, cloud.coins || 0);
    d.bestScore = Math.max(d.bestScore, cloud.bestScore || 0);
    d.bestWave = Math.max(d.bestWave, cloud.bestWave || 0);
    if (cloud.weapons) {
      for (var i = 0; i < d.weapons.length; i++) d.weapons[i] = d.weapons[i] || !!cloud.weapons[i];
    }
    if (cloud.upgrades) {
      d.upgrades.combo = Math.max(d.upgrades.combo, cloud.upgrades.combo || 0);
      d.upgrades.magnet = d.upgrades.magnet || !!cloud.upgrades.magnet;
      d.upgrades.double = d.upgrades.double || !!cloud.upgrades.double;
    }
    if (cloud.stats) {
      for (var k in d.stats) {
        if (typeof cloud.stats[k] === 'number') d.stats[k] = Math.max(d.stats[k], cloud.stats[k]);
      }
    }
    if (cloud.loginRewarded) d.loginRewarded = true;
  }

  /* ---------------- экраны ---------------- */

  function drawMenu(ctx) {
    var w = G.worldW, h = G.worldH;
    T.ui.panel(ctx, w * 0.04, h * 0.04, w * 0.92, h * 0.92, { alpha: 0.7, r: 40 });

    T.ui.text(ctx, T.i18n.t('title'), w / 2, h * 0.13, { size: Math.min(92, w * 0.15), color: '#fff' });
    T.ui.text(ctx, T.i18n.t('subtitle'), w / 2, h * 0.19, { size: Math.min(42, w * 0.065), color: '#ffd23f' });

    var ph = Math.min(96, h * 0.12);
    T.ui.panel(ctx, w / 2 - 200, h * 0.235, 400, ph, { alpha: 0.8, r: 24 });
    T.ui.text(ctx, T.i18n.t('bestWaveLabel'), w / 2 - 100, h * 0.235 + ph * 0.3, { size: 22, color: 'rgba(255,255,255,0.7)' });
    T.ui.text(ctx, T.i18n.t('bestWaveShort') + ' ' + T.save.data.bestWave, w / 2 - 100, h * 0.235 + ph * 0.7, { size: 32, color: '#fff' });
    T.ui.text(ctx, T.i18n.t('score'), w / 2 + 100, h * 0.235 + ph * 0.3, { size: 22, color: 'rgba(255,255,255,0.7)' });
    T.ui.text(ctx, String(T.save.data.bestScore), w / 2 + 100, h * 0.235 + ph * 0.7, { size: 32, color: '#ffd75e' });

    T.ui.iconCoin(ctx, w / 2 - 62, h * 0.375, 1.0);
    T.ui.text(ctx, String(T.save.data.coins), w / 2 + 8, h * 0.375, { size: 34, color: '#ffd75e', align: 'left' });

    if (T.platform.player) {
      T.ui.text(ctx, T.i18n.t('loginOk', { n: T.platform.playerName() }), w / 2, h * 0.95, { size: 22, color: 'rgba(255,255,255,0.6)' });
    } else if (T.platform.isLocal) {
      T.ui.text(ctx, 'local build', w / 2, h * 0.95, { size: 20, color: 'rgba(255,255,255,0.3)' });
    }
  }

  function drawShop(ctx) {
    var w = G.worldW, h = G.worldH;
    var r = G.run;
    T.ui.panel(ctx, w * 0.03, h * 0.02, w * 0.94, h * 0.96, { alpha: 0.9, r: 40 });

    T.ui.text(ctx, T.i18n.t('waveClear', { n: r.wave }), w / 2, h * 0.1, { size: Math.min(50, w * 0.072), color: '#ffd23f' });
    T.ui.text(ctx, T.i18n.t('waveBonus', { n: waveBonus(r.wave) }), w / 2, h * 0.155, { size: 25, color: 'rgba(255,255,255,0.85)' });
    T.ui.text(ctx, T.i18n.t('shopTitle'), w / 2, h * 0.198, { size: 28, color: '#fff' });

    var L = shopLayout();
    var titleMax = L.cellW - L.btnW - 70;
    var titleSize = Math.min(L.cols === 2 ? 26 : 30, L.rowH * 0.34);

    for (var i = 0; i < G.shop.length; i++) {
      var it = G.shop[i];
      var col = i % L.cols;
      var row = Math.floor(i / L.cols);
      var cx = L.bx + col * L.cellW;
      var ry = L.top + row * (L.rowH + L.gap);
      T.ui.panel(ctx, cx + 4, ry, L.cellW - 8, L.rowH, {
        alpha: 0.92, r: 20,
        top: it.soldOut ? 'rgba(28,31,40,0.92)' : 'rgba(40,46,64,0.96)'
      });
      T.ui.text(ctx, it.title, cx + 22, ry + L.rowH * (it.sub ? 0.36 : 0.5), {
        size: titleSize, color: '#fff', align: 'left', maxWidth: titleMax
      });
      if (it.sub) {
        T.ui.text(ctx, it.sub, cx + 22, ry + L.rowH * 0.7, {
          size: Math.min(21, L.rowH * 0.24), color: 'rgba(255,255,255,0.6)', align: 'left', stroke: false, maxWidth: titleMax
        });
      }
    }

    T.ui.text(ctx, T.i18n.t('shopHint'), w / 2, h - 160, { size: 22, color: 'rgba(255,255,255,0.6)' });

    var coinStr = String(T.save.data.coins);
    var coinW = T.ui.measure(ctx, coinStr, 30);
    T.ui.text(ctx, coinStr, w - 44, 46, { size: 30, color: '#ffd75e', align: 'right' });
    T.ui.iconCoin(ctx, w - 44 - coinW - 30, 46, 1.0);
    T.ui.iconSlipper(ctx, 56, 46, 1.15, T.weapons.LIST[bestWeapon()].color);
  }

  function drawGameOver(ctx) {
    var w = G.worldW, h = G.worldH;
    var r = G.run;
    T.ui.panel(ctx, w * 0.06, h * 0.05, w * 0.88, h * 0.92, { alpha: 0.93, r: 40 });

    T.ui.text(ctx, T.i18n.t('gameover'), w / 2, h * 0.13, { size: Math.min(56, w * 0.082), color: '#ff7b6b' });

    if (r.score > 0 && r.score >= T.save.data.bestScore) {
      T.ui.text(ctx, T.i18n.t('newRecord'), w / 2, h * 0.19, { size: 28, color: '#ffd23f' });
    }

    var rows = [
      [T.i18n.t('statsWave'), String(r.wave)],
      [T.i18n.t('statsScore'), String(r.score)],
      [T.i18n.t('statsFlies'), String(r.totalFlies)],
      [T.i18n.t('statsCombo'), 'x' + Math.min(9, r.maxCombo)],
      [T.i18n.t('coins'), String(T.save.data.coins)]
    ];
    var step = clamp(h * 0.042, 34, 50);
    var ry = h * 0.23;
    for (var i = 0; i < rows.length; i++) {
      T.ui.text(ctx, rows[i][0], w * 0.14, ry + i * step, { size: 26, color: 'rgba(255,255,255,0.75)', align: 'left' });
      T.ui.text(ctx, rows[i][1], w * 0.86, ry + i * step, { size: 28, color: '#fff', align: 'right' });
    }
  }

  function drawPause(ctx) {
    var w = G.worldW, h = G.worldH;
    ctx.fillStyle = 'rgba(6,8,14,0.6)';
    ctx.fillRect(0, 0, w, h);
    T.ui.panel(ctx, w * 0.06, h * 0.05, w * 0.88, h * 0.92, { alpha: 0.92, r: 40 });
    T.ui.text(ctx, T.i18n.t('pause'), w / 2, h * 0.15, { size: Math.min(60, w * 0.09), color: '#fff' });
  }

  function drawHowTo(ctx) {
    var w = G.worldW, h = G.worldH;
    ctx.fillStyle = 'rgba(6,8,14,0.6)';
    ctx.fillRect(0, 0, w, h);
    T.ui.panel(ctx, w * 0.06, h * 0.05, w * 0.88, h * 0.92, { alpha: 0.94, r: 40 });
    T.ui.text(ctx, T.i18n.t('howto'), w / 2, h * 0.14, { size: Math.min(48, w * 0.072), color: '#fff' });

    var lines = [T.i18n.t('howtoText1'), T.i18n.t('howtoText2'), T.i18n.t('howtoText3')];
    var step = clamp(h * 0.07, 56, 88);
    var lineMax = w * 0.82;
    for (var i = 0; i < lines.length; i++) {
      T.ui.text(ctx, lines[i], w / 2, h * 0.26 + i * step, {
        size: Math.min(24, w * 0.036), color: 'rgba(255,255,255,0.9)', weight: 700, maxWidth: lineMax
      });
    }

    T.ui.text(ctx, T.i18n.t('weaponSlot'), w / 2, h * 0.53, { size: 24, color: 'rgba(255,255,255,0.6)' });
    var list = T.weapons.LIST;
    var x0 = w * 0.16, dx = w * 0.17;
    for (var k = 0; k < list.length; k++) {
      var owned = T.save.data.weapons[k];
      T.ui.iconSlipper(ctx, x0 + k * dx, h * 0.62, 1.7, owned ? list[k].color : '#3a3f4c', owned ? 1 : 0.5);
      T.ui.text(ctx, owned ? '\u2713' : String(list[k].price), x0 + k * dx, h * 0.62 + 46, {
        size: 21, color: owned ? '#5ddc7a' : 'rgba(255,255,255,0.5)', stroke: false
      });
    }
  }

  function drawToast(ctx) {
    if (G.toast.t <= 0) return;
    var w = G.worldW;
    // на широком или низком экране тост уходит влево: по центру он перекрывает
    // заголовки экранов (например, «Волна N пройдена!»)
    var wide = isWide() || G.worldH < 900;
    var tw = wide ? Math.min(w * 0.42, 560) : w * 0.84;
    var tx = wide ? 16 : w * 0.08;
    ctx.save();
    ctx.globalAlpha = Math.min(1, clamp(G.toast.t / 0.4, 0, 1));
    T.ui.panel(ctx, tx, 10, tw, G.toast.sub ? 86 : 60, { alpha: 0.94, r: 22, top: 'rgba(62,52,20,0.96)' });
    T.ui.text(ctx, G.toast.text, tx + tw / 2, G.toast.sub ? 40 : 41, { size: 25, color: '#ffd75e', maxWidth: tw - 24 });
    if (G.toast.sub) {
      T.ui.text(ctx, G.toast.sub, tx + tw / 2, 70, {
        size: 19, color: 'rgba(255,255,255,0.8)', stroke: false, maxWidth: tw - 24
      });
    }
    ctx.restore();
  }

  function render() {
    var ctx = G.ctx;
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    var bg = ctx.createLinearGradient(0, 0, 0, G.ch);
    bg.addColorStop(0, '#0b0e14');
    bg.addColorStop(1, '#151a24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, G.cw, G.ch);

    var sh = T.fx.shakeOffset();

    ctx.save();
    ctx.beginPath();
    ctx.rect(G.play.x, G.play.y, G.play.w, G.play.h);
    ctx.clip();
    ctx.translate(G.play.x + sh.x, G.play.y + sh.y);
    ctx.scale(G.scale, G.scale);

    drawKitchen(ctx);
    T.fx.drawUnder(ctx);
    T.flies.draw(ctx, G.time);
    T.fx.drawOver(ctx);

    if (G.state === 'playing' || G.state === 'shop' || G.state === 'gameover' || G.state === 'paused') {
      drawHud(ctx);
    }

    if (G.state === 'playing' || G.state === 'paused') {
      var st = T.weapons.stats(bestWeapon(), T.save.data.upgrades);
      for (var i = 0; i < T.input.cursors.length; i++) {
        T.weapons.drawCursor(ctx, T.input.cursors[i], st, G.time);
      }
    }

    if (G.state === 'menu') drawMenu(ctx);
    else if (G.state === 'howto') drawHowTo(ctx);
    else if (G.state === 'shop') drawShop(ctx);
    else if (G.state === 'gameover') drawGameOver(ctx);
    else if (G.state === 'paused') drawPause(ctx);

    for (var b = 0; b < G.buttons.length; b++) T.ui.button(ctx, G.buttons[b], G.time);

    drawToast(ctx);
    ctx.restore();
  }

  /* ---------------- ввод ---------------- */

  function hitButton(x, y) {
    for (var i = G.buttons.length - 1; i >= 0; i--) {
      if (T.ui.hit(G.buttons[i], x, y)) return G.buttons[i];
    }
    return null;
  }

  function onTap(x, y) {
    if (G.adActive) return;
    T.audio.init();

    if (G.state === 'playing' && T.ui.hit(pauseButton(), x, y)) {
      T.audio.sfx('click');
      pauseGame();
      return;
    }

    var b = hitButton(x, y);
    if (b) {
      if (b.disabled) {
        T.audio.sfx('error');
        return;
      }
      b.pressed = 1;
      setTimeout(function () { b.pressed = 0; }, 90);
      if (!b.silent) T.audio.sfx('click');
      b.onClick();
      return;
    }

    if (G.state === 'playing') doSlap(x, y);
  }

  function onHide() {
    T.audio.suspend();
    if (G.state === 'playing') pauseGame();
  }

  function onShow() {
    if (G.state !== 'paused' && !G.adActive) T.audio.resume();
  }

  /* ---------------- запуск ---------------- */

  /* ---------------- отладочные позы для скриншотов ----------------
     Пример: index.html?local=1&pose=wave  (menu | howto | wave | boss | shop | gameover) */
  function applyPose(pose) {
    if (!pose || pose === 'menu') return;
    if (pose === 'howto') { G.state = 'howto'; buildHowTo(); return; }

    startRun();
    var r = G.run;
    var i, f;

    if (pose === 'wave' || pose === 'boss' || pose === 'beetle' || pose === 'spider') {
      var bossPose = pose === 'boss' ? 1 : (pose === 'beetle' ? 2 : (pose === 'spider' ? 3 : 0));
      r.wave = bossPose ? bossPose * 5 : 3;
      if (bossPose) {
        r.bossWave = true;
        r.bossSpawned = false;
        r.bossKilled = false;
      } else {
        r.quota = 8;
        r.waveKills = 3;
      }
      r.score = bossPose ? 4820 + bossPose * 900 : 1250;
      T.save.data.coins = bossPose ? 1240 + bossPose * 200 : 480;
      r.lives = 3;
      r.combo = bossPose ? 4 : 7;
      r.comboT = comboWindow();
      r.maxCombo = Math.max(r.maxCombo, r.combo);
      T.flies.reset();

      var kinds = bossPose
        ? ['fly', 'fast', 'fat']
        : ['fly', 'fly', 'fast', 'fat', 'gold', 'roach', 'fly'];
      for (i = 0; i < kinds.length; i++) {
        f = T.flies.spawn(kinds[i], r.wave);
        f.x = 100 + Math.random() * (G.worldW - 200);
        f.y = 260 + Math.random() * Math.max(80, T.flies.bounds.bottom - 340);
        f.hunger = 2 + Math.random() * 2;
        f.ang = Math.random() * 6.28;
      }
      if (bossPose) {
        var b = T.flies.spawnBoss(r.wave);
        b.hp = Math.round(b.maxHp * 0.55);
        b.y = T.flies.bounds.top + 250;
        b.spawnT = 2.5;
      }

      T.input.cursors.length = 0;
      T.input.cursors.push({ id: 'shot1', x: G.worldW * 0.4, y: G.worldH * 0.33, px: 0, py: 0, down: false, swing: 0.5, ttl: 1, ang: 0, type: 'mouse' });
      T.input.cursors.push({ id: 'shot2', x: G.worldW * 0.7, y: G.worldH * 0.47, px: 0, py: 0, down: false, swing: 0, ttl: 1, ang: 0, type: 'mouse' });
      T.fx.text(G.worldW * 0.5, G.worldH * 0.29, T.i18n.t('slapped', { n: r.combo }), '#ffd23f', 52);
    } else if (pose === 'shop') {
      r.wave = 4;
      r.quota = 9;
      r.waveKills = 9;
      T.save.data.weapons[1] = true;
      T.save.data.coins = 760;
      completeWave();
    } else if (pose === 'pause') {
      r.wave = 6;
      r.score = 2400;
      r.lives = 2;
      T.save.data.coins = 380;
      pauseGame();
    } else if (pose === 'gameover') {
      r.wave = 6;
      r.score = 3180;
      r.totalFlies = 64;
      r.maxCombo = 9;
      r.earned = 210;
      T.save.data.coins = 540;
      gameOver();
    }
  }

  G.boot = function () {
    G.canvas = document.getElementById('game');
    G.ctx = G.canvas.getContext('2d', { alpha: false });

    T.save.load();
    layout();

    T.input.mapper = toWorld;
    T.input.attach(G.canvas);
    T.input.onSlap = onTap;

    window.addEventListener('resize', function () { layout(); refreshButtons(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { layout(); refreshButtons(); }, 250);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) onHide(); else onShow();
    });
    window.addEventListener('blur', onHide);

    T.platform.init().then(function () {
      var forcedLang = null;
      try { forcedLang = new URLSearchParams(location.search).get('lang'); } catch (e) {}
      T.i18n.setLang(forcedLang ? T.platform._pickLang(forcedLang) : T.platform.lang);
      T.audio.setMuted(!T.save.data.settings.sound);
      T.audio.setMusic(T.save.data.settings.music !== false);
      layout();
      G.state = 'menu';
      buildMenu();
      T.flies.reset();
      for (var i = 0; i < 3; i++) {
        var f = T.flies.spawn('fly', 1);
        f.hunger = 9999;
        f.eat = false;
      }
      T.platform.ready();

      var pose = null, fresh = false;
      try {
        var qs = new URLSearchParams(location.search);
        pose = qs.get('pose');
        fresh = qs.get('fresh') === '1';
      } catch (e) {}
      if (pose) {
        T.audio.setMuted(true);
        if (fresh) T.save.resetProgress();
        setTimeout(function () { applyPose(pose); }, 700);
      }

      requestAnimationFrame(frame);
    });
  };

  function refreshButtons() {
    if (G.state === 'menu') buildMenu();
    else if (G.state === 'shop') buildShop();
    else if (G.state === 'gameover') buildGameOver();
    else if (G.state === 'howto') buildHowTo();
    else if (G.state === 'paused') pauseGame();
  }

  window.TAPOK.game = G;
  G.refreshButtons = refreshButtons;
  G.refreshShop = buildShop;
})();
