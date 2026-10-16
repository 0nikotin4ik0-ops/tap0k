/* Мухи, тараканы и босс-оса: спавн, ИИ полёта, поедание еды, шлепки. */
(function () {
  'use strict';

  var TYPES = {
    fly: { hp: 1, speed: 130, r: 36, score: 10, coins: 4, color: '#43434f', eat: true, weight: 60 },
    fast: { hp: 1, speed: 265, r: 28, score: 25, coins: 8, color: '#6a6a7c', eat: true, weight: 22, fromWave: 2 },
    fat: { hp: 3, speed: 88, r: 52, score: 40, coins: 12, color: '#4d5f38', eat: true, weight: 16, fromWave: 3 },
    gold: { hp: 1, speed: 320, r: 32, score: 100, coins: 40, color: '#e8b31c', eat: false, life: 3.4, weight: 5, fromWave: 5 },
    roach: { hp: 1, speed: 380, r: 32, score: 30, coins: 8, color: '#7c4a1c', eat: false, weight: 12, fromWave: 4 },
    spiderling: { hp: 1, speed: 260, r: 24, score: 15, coins: 5, color: '#3a3a44', eat: true, weight: 0, bossOnly: true }
  };

  /* Боссы по этапам: у каждого свой паттерн, а не просто «оса пожирнее».
     wasp   — пикирует к столу, при достижении −2 терпения, в ярости ускоряется;
     beetle — ползёт напролом, панцирь режет урон вдвое, пока не треснет;
     spider — висит сверху, боком ходит и плодит паучат, которые лезут к еде. */
  var BOSSES = [
    { id: 'wasp', name: 'boss_wasp', r: 100, speed: 52, hp: 80, coins: 60, color: '#e8c22a' },
    { id: 'beetle', name: 'boss_beetle', r: 112, speed: 58, hp: 115, coins: 90, color: '#43371f', armor: true },
    { id: 'spider', name: 'boss_spider', r: 96, speed: 96, hp: 95, coins: 85, color: '#2b2b33' }
  ];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var flies = {
    list: [],
    foods: [],
    bounds: { left: 20, top: 20, right: 700, bottom: 800 },
    TYPES: TYPES,

    init: function (foods, bounds) {
      this.foods = foods || this.foods;
      this.bounds = bounds || this.bounds;
      // после смены раскладки старые цели поедания больше не существуют
      for (var i = 0; i < this.list.length; i++) {
        var f = this.list[i];
        if (f.state === 'seek' || f.state === 'eat') {
          f.state = 'fly';
          f.eatTarget = null;
          f.hunger = 0.5;
        }
      }
    },

    reset: function () {
      this.list.length = 0;
    },

    count: function () {
      var n = 0;
      for (var i = 0; i < this.list.length; i++) {
        var f = this.list[i];
        if (f.type !== 'boss' && f.state !== 'dead') n++;
      }
      return n;
    },

    boss: function () {
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].type === 'boss' && this.list[i].state !== 'dead') return this.list[i];
      }
      return null;
    },

    roster: function (wave) {
      var out = [];
      for (var k in TYPES) {
        var c = TYPES[k];
        if (k === 'boss' || c.bossOnly) continue;
        if (c.fromWave && wave < c.fromWave) continue;
        var w = c.weight;
        if (k === 'fly') w = Math.max(18, 60 - wave * 2);
        out.push({ type: k, weight: w });
      }
      return out;
    },

    pickType: function (wave) {
      var roster = this.roster(wave);
      var total = 0, i;
      for (i = 0; i < roster.length; i++) total += roster[i].weight;
      var r = Math.random() * total;
      for (i = 0; i < roster.length; i++) {
        r -= roster[i].weight;
        if (r <= 0) return roster[i].type;
      }
      return 'fly';
    },

    spawn: function (type, wave) {
      var cfg = TYPES[type] || TYPES.fly;
      var b = this.bounds;
      // к поздним волнам мухи голоднее: окно «успей шлёпнуть» сужается
      var eatWindow = Math.max(1.4, 2.6 - wave * 0.06);
      var hungerScale = Math.max(0.5, 1 - wave * 0.03);
      var f = {
        type: type,
        x: 0, y: 0, vx: 0, vy: 0,
        r: cfg.r,
        hp: cfg.hp, maxHp: cfg.hp,
        speed: cfg.speed * (1 + Math.min(wave, 45) * 0.015),
        color: cfg.color,
        eat: !!cfg.eat,
        state: 'fly',
        ang: 0,
        seed: rnd(0, 100),
        hunger: rnd(0.8, 3.0) * hungerScale,
        eatWindow: eatWindow,        eatTimer: 0,
        eatTarget: null,
        flash: 0,
        deadT: 0,
        life: cfg.life || 0,
        escapePenalty: false,
        escaping: false,
        score: cfg.score,
        coins: cfg.coins,
        wobble: rnd(0, 6.28)
      };

      // Появление из случайного края
      var edge = Math.random();
      if (edge < 0.55) {
        f.x = rnd(b.left + 40, b.right - 40);
        f.y = b.top + 10;
        f.ang = Math.PI / 2 + rnd(-0.5, 0.5);
      } else if (edge < 0.78) {
        f.x = b.left + 10;
        f.y = rnd(b.top + 40, b.bottom - 60);
        f.ang = rnd(-0.5, 0.5);
      } else {
        f.x = b.right - 10;
        f.y = rnd(b.top + 40, b.bottom - 60);
        f.ang = Math.PI + rnd(-0.5, 0.5);
      }

      if (type === 'roach') {
        var leftToRight = Math.random() < 0.5;
        f.x = leftToRight ? b.left + 6 : b.right - 6;
        f.y = b.bottom + (this.tableDrop || 40) * rnd(0.35, 0.95);
        f.ang = leftToRight ? 0 : Math.PI;
        f.state = 'run';
      }

      this.list.push(f);
      return f;
    },

    spawnBoss: function (wave) {
      var b = this.bounds;
      var tier = Math.max(1, Math.ceil(wave / 5));
      var cfg = BOSSES[(tier - 1) % BOSSES.length];
      var cycle = Math.floor((tier - 1) / BOSSES.length);
      var hp = Math.round(cfg.hp * (1 + cycle * 0.6));
      var f = {
        type: 'boss',
        bossId: cfg.id,
        nameKey: cfg.name,
        wave: wave,
        x: b.left + (b.right - b.left) / 2,
        y: b.top + 250,
        vx: 0, vy: 0,
        r: cfg.r,
        hp: hp, maxHp: hp,
        armor: !!cfg.armor,
        speed: cfg.speed * (1 + Math.min(wave, 30) * 0.012),
        color: cfg.color,
        eat: false,
        state: 'fly',
        ang: Math.PI / 2,
        seed: rnd(0, 100),
        hunger: 999,
        eatTimer: 0,
        eatTarget: null,
        spawnT: 3.2,
        flash: 0,
        deadT: 0,
        life: 0,
        escapePenalty: false,
        escaping: false,
        score: 300 + wave * 20,
        coins: cfg.coins + wave * 2,
        wobble: 0,
        rage: false
      };
      this.list.push(f);
      return f;
    },

    update: function (dt, t) {
      var events = [];
      var b = this.bounds;

      for (var i = this.list.length - 1; i >= 0; i--) {
        var f = this.list[i];

        if (f.state === 'dead') {
          f.deadT -= dt;
          if (f.deadT <= 0) this.list.splice(i, 1);
          continue;
        }

        if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 5);

        // --- таракан: бежит по низу ---
        if (f.type === 'roach') {
          f.ang += Math.sin(t * 6 + f.seed) * dt * 2.4;
          f.y += Math.sin(f.ang) * f.speed * dt * 0.4;
          f.x += Math.cos(f.ang) * f.speed * dt;
          if (f.x < b.left - 60 || f.x > b.right + 60) {
            this.list.splice(i, 1);
            events.push({ kind: 'gone' });
          }
          continue;
        }

        // --- босс: паттерн зависит от вида ---
        if (f.type === 'boss') {
          var bid = f.bossId || 'wasp';

          if (f.state === 'retreat') {
            f.y -= f.speed * 1.6 * dt;
            if (f.y < b.top + 250) { f.y = b.top + 250; f.state = 'fly'; }
            continue;
          }

          if (bid === 'beetle') {
            // прёт по прямой вниз, панцирь держит удар
            f.x += Math.sin(t * 0.7 + f.seed) * 14 * dt;
            f.y += f.speed * dt;
            if (f.y > b.bottom + 30) {
              events.push({ kind: 'bossReach', x: f.x, y: f.y });
              f.y = b.top + 250;
              f.state = 'retreat';
            }
            continue;
          }

          if (bid === 'spider') {
            // висит сверху, ходит боком и плодит паучат
            f.x += Math.sin(t * 1.8 + f.seed) * f.speed * dt;
            f.y += f.speed * 0.3 * dt;
            f.spawnT -= dt;
            if (f.spawnT <= 0) {
              f.spawnT = 2.6;
              var sl = this.spawn('spiderling', f.wave || 5);
              sl.x = f.x;
              sl.y = f.y + f.r * 0.5;
              sl.ang = Math.PI / 2;
              events.push({ kind: 'spawnling', x: f.x, y: f.y });
            }
            if (f.y > b.bottom + 30) {
              events.push({ kind: 'bossReach', x: f.x, y: f.y });
              f.y = b.top + 250;
              f.state = 'retreat';
            }
            continue;
          }

          // оса: пикирует к столу, в ярости ускоряется
          f.x += Math.sin(t * 1.3 + f.seed) * 40 * dt;
          f.y += f.speed * (f.hp < f.maxHp * 0.3 ? 1.7 : 1) * dt;
          if (f.y > b.bottom + 30) {
            events.push({ kind: 'bossReach', x: f.x, y: f.y });
            f.y = b.top + 250;
            f.state = 'retreat';
          }
          continue;
        }

        // --- обычные мухи ---
        if (f.state === 'fly') {
          var steer = Math.sin(t * 2.1 + f.seed) * 1.6 + (Math.random() - 0.5) * 1.2;
          f.ang += steer * dt * 1.4;

          if (f.x < b.left + f.r) f.ang = f.ang * 0.3 + 0.15;
          if (f.x > b.right - f.r) f.ang = f.ang * 0.3 + Math.PI - 0.15;
          if (f.y < b.top + f.r) f.ang = Math.abs(f.ang) < 1.57 ? 1.57 + rnd(-0.4, 0.4) : f.ang;
          if (f.y > b.bottom - f.r) f.ang = -1.57 + rnd(-0.4, 0.4);

          f.x += Math.cos(f.ang) * f.speed * dt;
          f.y += Math.sin(f.ang) * f.speed * dt;

          if (f.life > 0) {
            f.life -= dt;
            if (f.life <= 0) {
              f.state = 'away';
              f.escapePenalty = false;
              f.speed *= 1.7;
              f.ang = this._exitAngle(f);
            }
          } else if (f.eat) {
            f.hunger -= dt;
            if (f.hunger <= 0) {
              var food = this._freeFood();
              if (food) {
                f.eatTarget = food;
                food.claimedBy = f;
                f.state = 'seek';
              } else {
                f.hunger = 1.2;
              }
            }
          }
        } else if (f.state === 'seek') {
          var ft = f.eatTarget;
          if (!ft) { f.state = 'fly'; f.hunger = 1; }
          else {
            var dx = ft.x - f.x, dy = ft.y - f.r * 0.6 - f.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 1;
            f.ang = Math.atan2(dy, dx);
            f.x += (dx / d) * f.speed * 1.25 * dt;
            f.y += (dy / d) * f.speed * 1.25 * dt;
            if (d < 8) {
              f.state = 'eat';
              f.eatTimer = f.eatWindow || 2.6;
              f.x = ft.x;
              f.y = ft.y - f.r * 0.6;
            }
          }
        } else if (f.state === 'eat') {
          f.eatTimer -= dt;
          f.y = f.eatTarget.y - f.r * 0.6 + Math.sin(t * 12 + f.seed) * 1.5;
          if (f.eatTimer <= 0) {
            f.state = 'away';
            f.escapePenalty = true;
            f.speed *= 1.5;
            f.ang = this._exitAngle(f);
            if (f.eatTarget) {
              if (f.eatTarget.claimedBy === f) f.eatTarget.claimedBy = null;
              f.eatTarget = null;
            }
            events.push({ kind: 'ate', x: f.x, y: f.y });
          }
        } else if (f.state === 'away') {
          f.x += Math.cos(f.ang) * f.speed * dt;
          f.y += Math.sin(f.ang) * f.speed * dt;
          if (f.x < b.left - 80 || f.x > b.right + 80 || f.y < b.top - 80 || f.y > b.bottom + 200) {
            this.list.splice(i, 1);
            events.push({ kind: 'escape', x: f.x, y: f.y, penalty: f.escapePenalty, type: f.type });
          }
        }
      }

      return events;
    },

    _freeFood: function () {
      var free = [];
      for (var i = 0; i < this.foods.length; i++) {
        if (!this.foods[i].claimedBy) free.push(this.foods[i]);
      }
      if (!free.length) return null;
      return pick(free);
    },

    _exitAngle: function (f) {
      var b = this.bounds;
      var opts = [
        { a: -Math.PI / 2, d: Math.abs(f.y - b.top) },
        { a: Math.PI, d: Math.abs(f.x - b.left) },
        { a: 0, d: Math.abs(b.right - f.x) }
      ];
      opts.sort(function (p, q) { return p.d - q.d; });
      return opts[0].a + rnd(-0.3, 0.3);
    },

    /* Шлепок: попадают ближайшие к точке удара, максимум chain штук. */
    slap: function (x, y, stats) {
      var hits = [];
      for (var i = 0; i < this.list.length; i++) {
        var f = this.list[i];
        if (f.state === 'dead') continue;
        var dx = f.x - x, dy = f.y - y;
        var d = Math.sqrt(dx * dx + dy * dy) - f.r;
        if (d < stats.radius) hits.push({ f: f, d: d });
      }
      hits.sort(function (a, b) { return a.d - b.d; });

      var result = { hits: 0, kills: [], bossHit: false, x: x, y: y };
      var limit = Math.min(stats.chain || 1, hits.length);
      for (var k = 0; k < limit; k++) {
        var fly = hits[k].f;
        // по боссу урон растёт с комбо: серия шлепков важнее, чем просто «тыкать»
        var dmg = stats.damage;
        if (fly.type === 'boss') {
          if (stats.comboMult) dmg = dmg * stats.comboMult;
          // панцирь жука режет урон, пока не треснет на половине здоровья
          if (fly.armor && fly.hp > fly.maxHp * 0.5) dmg = dmg * 0.5;
        }
        fly.hp -= dmg;
        fly.flash = 1;
        fly.state = fly.state === 'eat' ? 'fly' : fly.state;
        if (fly.eatTarget && fly.eatTarget.claimedBy === fly) {
          fly.eatTarget.claimedBy = null;
          fly.eatTarget = null;
        }
        if (fly.type !== 'boss') {
          var ang = Math.atan2(fly.y - y, fly.x - x);
          fly.x += Math.cos(ang) * 16;
          fly.y += Math.sin(ang) * 16;
          fly.ang = ang;
        }
        result.hits++;
        if (fly.type === 'boss') {
          result.bossHit = true;
          if (fly.hp < fly.maxHp * 0.3 && !fly.rage) fly.rage = true;
          if (fly.armor && fly.hp <= fly.maxHp * 0.5) fly.armorBroken = true;
        }
        if (fly.hp <= 0) {
          fly.state = 'dead';
          fly.deadT = 0.22;
          result.kills.push({
            type: fly.type, x: fly.x, y: fly.y, r: fly.r,
            score: fly.score, coins: fly.coins, color: fly.color,
            nameKey: fly.nameKey
          });
        }
      }
      return result;
    },

    draw: function (ctx, t) {
      for (var i = 0; i < this.list.length; i++) {
        var f = this.list[i];
        if (f.state === 'dead') this._drawDead(ctx, f);
        else if (f.type === 'roach') this._drawRoach(ctx, f, t);
        else if (f.type === 'spiderling') this._drawSpiderling(ctx, f, t);
        else if (f.type === 'boss') this._drawBoss(ctx, f, t);
        else this._drawFly(ctx, f, t);
      }
    },

    _wings: function (ctx, f, t, scale) {
      var flap = 0.45 + Math.abs(Math.sin(t * 42 + f.seed)) * 0.75;
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#d8ecff';
      ctx.beginPath();
      ctx.ellipse(-f.r * 0.55, -f.r * 0.25, f.r * 0.95 * scale, f.r * 0.45 * scale * flap, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(f.r * 0.55, -f.r * 0.25, f.r * 0.95 * scale, f.r * 0.45 * scale * flap, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    _drawFly: function (ctx, f, t) {
      var r = f.r;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang + Math.PI / 2);

      // лапки
      ctx.strokeStyle = 'rgba(20,20,26,0.75)';
      ctx.lineWidth = 2.5;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, i * r * 0.35);
        ctx.lineTo(-r * 1.2, i * r * 0.5 + r * 0.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.5, i * r * 0.35);
        ctx.lineTo(r * 1.2, i * r * 0.5 + r * 0.25);
        ctx.stroke();
      }

      this._wings(ctx, f, t, 1);

      // тело
      var grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, '#1b1b22');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 0.82, r, 0, 0, Math.PI * 2);
      ctx.fill();

      if (f.type === 'fat') {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 3;
        for (var s = -1; s <= 1; s++) {
          ctx.beginPath();
          ctx.arc(0, r * 0.1, r * (0.5 + s * 0.18), 0.6, 2.5);
          ctx.stroke();
        }
      }

      // голова
      ctx.fillStyle = f.color === '#43434f' ? '#2a2a33' : f.color;
      ctx.beginPath();
      ctx.arc(0, -r * 0.85, r * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // глаза
      ctx.fillStyle = f.type === 'gold' ? '#7a4a00' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 1.0, r * 0.16, 0, Math.PI * 2);
      ctx.arc(r * 0.2, -r * 1.0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();

      if (f.type === 'gold') {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(-r * 0.3, -r * 0.2, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }

      if (f.flash > 0) {
        ctx.globalAlpha = f.flash * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.9, r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (f.state === 'eat') this._eatMeter(ctx, f);
    },

    _eatMeter: function (ctx, f) {
      var k = Math.max(0, f.eatTimer / (f.eatWindow || 2.6));
      ctx.save();
      ctx.translate(f.x, f.y - f.r - 34);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = k > 0.4 ? '#ffd23f' : '#ff5a5a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '900 18px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1);
      ctx.restore();
    },

    _drawRoach: function (ctx, f, t) {
      var r = f.r;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang + Math.PI / 2);

      // усы
      ctx.strokeStyle = '#5c3410';
      ctx.lineWidth = 3;
      for (var a = -1; a <= 1; a += 2) {
        ctx.beginPath();
        ctx.moveTo(a * r * 0.2, -r * 0.8);
        ctx.quadraticCurveTo(a * r * 1.1, -r * 1.5, a * r * 1.5 + Math.sin(t * 10) * 4, -r * 1.9);
        ctx.stroke();
      }
      // лапки
      ctx.lineWidth = 3;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, i * r * 0.4);
        ctx.lineTo(-r * 1.3, i * r * 0.55 + Math.sin(t * 18 + i) * 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.55, i * r * 0.4);
        ctx.lineTo(r * 1.3, i * r * 0.55 + Math.cos(t * 18 + i) * 3);
        ctx.stroke();
      }
      // тело
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.72, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.62, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (f.flash > 0) {
        ctx.globalAlpha = f.flash * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.8, r * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    _drawBoss: function (ctx, f, t) {
      var id = f.bossId || 'wasp';
      if (id === 'beetle') this._drawBeetle(ctx, f, t);
      else if (id === 'spider') this._drawSpider(ctx, f, t);
      else this._drawWasp(ctx, f, t);
    },

    _flash: function (ctx, f, rx, ry) {
      if (f.flash <= 0) return;
      ctx.globalAlpha = f.flash * 0.7;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    /* Жук-броня: панцирь, рог, шесть лап. Пока панцирь цел — урон вдвое меньше. */
    _drawBeetle: function (ctx, f, t) {
      var r = f.r;
      var step = Math.sin(t * 14) * 0.08;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(t * 1.1) * 0.05);

      // лапы
      ctx.strokeStyle = '#241c10';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      for (var i = -1; i <= 1; i++) {
        for (var s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.4, i * r * 0.42 + r * 0.15);
          ctx.lineTo(s * r * 1.25, i * r * 0.62 + r * 0.42 + step * r * s);
          ctx.stroke();
        }
      }

      // брюшко-панцирь
      var g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, f.armorBroken ? '#6b5a38' : '#5c4a26');
      g.addColorStop(1, '#241c10');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.18, r * 0.92, r * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // шов по центру
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(0, r * 1.2);
      ctx.stroke();

      // трещины, когда панцирь треснул
      if (f.armorBroken) {
        ctx.strokeStyle = 'rgba(255,220,140,0.85)';
        ctx.lineWidth = 5;
        for (var c = 0; c < 3; c++) {
          ctx.beginPath();
          ctx.moveTo(-r * 0.6 + c * r * 0.5, -r * 0.3);
          ctx.lineTo(-r * 0.35 + c * r * 0.5, r * 0.15);
          ctx.lineTo(-r * 0.6 + c * r * 0.5, r * 0.6);
          ctx.stroke();
        }
      }

      // голова и рог
      ctx.fillStyle = '#2e2414';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.95, r * 0.5, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d3018';
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.85);
      ctx.lineTo(-r * 0.16, -r * 1.3);
      ctx.lineTo(r * 0.16, -r * 1.3);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = f.rage ? '#ff7a5a' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 1.0, r * 0.11, 0, Math.PI * 2);
      ctx.arc(r * 0.2, -r * 1.0, r * 0.11, 0, Math.PI * 2);
      ctx.fill();

      this._flash(ctx, f, r * 0.95, r * 1.15);
      ctx.restore();
    },

    /* Паук-плетун: восемь лап, круглое брюшко, плодит паучат. */
    _drawSpider: function (ctx, f, t) {
      var r = f.r;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(t * 1.4) * 0.06);

      ctx.strokeStyle = '#15151a';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      for (var i = 0; i < 4; i++) {
        var yy = -r * 0.5 + i * r * 0.42;
        var bend = Math.sin(t * 6 + i) * r * 0.12;
        for (var s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.3, yy);
          ctx.quadraticCurveTo(s * r * 1.0, yy - r * 0.5 + bend, s * r * 1.25, yy + r * 0.35 + bend);
          ctx.stroke();
        }
      }

      // брюшко
      var g = ctx.createRadialGradient(-r * 0.2, r * 0.3, r * 0.15, 0, r * 0.4, r * 1.1);
      g.addColorStop(0, '#4a4a58');
      g.addColorStop(1, '#1b1b22');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.38, r * 0.82, r * 0.98, 0, 0, Math.PI * 2);
      ctx.fill();

      // узор на брюшке
      ctx.fillStyle = 'rgba(255,210,63,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.1);
      ctx.lineTo(r * 0.26, r * 0.4);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(-r * 0.26, r * 0.4);
      ctx.closePath();
      ctx.fill();

      // головогрудь
      ctx.fillStyle = '#2b2b33';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.45, r * 0.52, r * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      // глаза: два крупных и пара мелких
      ctx.fillStyle = f.rage ? '#ff8a5a' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.6, r * 0.13, 0, Math.PI * 2);
      ctx.arc(r * 0.2, -r * 0.6, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(-r * 0.38, -r * 0.75, r * 0.06, 0, Math.PI * 2);
      ctx.arc(r * 0.38, -r * 0.75, r * 0.06, 0, Math.PI * 2);
      ctx.fill();

      // хелицеры
      ctx.strokeStyle = '#15151a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, -r * 0.2);
      ctx.lineTo(-r * 0.1, r * 0.05);
      ctx.moveTo(r * 0.16, -r * 0.2);
      ctx.lineTo(r * 0.1, r * 0.05);
      ctx.stroke();

      this._flash(ctx, f, r * 0.85, r * 1.05);
      ctx.restore();
    },

    /* Паучок: мелкий, шустрый, лезет к еде. */
    _drawSpiderling: function (ctx, f, t) {
      var r = f.r;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang + Math.PI / 2);

      ctx.strokeStyle = '#15151a';
      ctx.lineWidth = 3;
      for (var i = 0; i < 3; i++) {
        var yy = -r * 0.4 + i * r * 0.4;
        for (var s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.3, yy);
          ctx.lineTo(s * r * 1.2, yy + Math.sin(t * 14 + i) * r * 0.2 + r * 0.1);
          ctx.stroke();
        }
      }
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 0.7, r * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.45, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.22, -r * 0.45, r * 0.14, 0, Math.PI * 2);
      ctx.fill();

      if (f.flash > 0) {
        ctx.globalAlpha = f.flash * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.1, r * 0.8, r * 1.0, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    _drawWasp: function (ctx, f, t) {
      var r = f.r;
      var wob = Math.sin(t * 26) * 0.1;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(t * 1.5) * 0.12 + wob);

      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#cfe8ff';
      var flap = 0.4 + Math.abs(Math.sin(t * 30)) * 0.8;
      ctx.beginPath();
      ctx.ellipse(-r * 0.85, -r * 0.35, r * 0.95, r * 0.42 * flap, -0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.85, -r * 0.35, r * 0.95, r * 0.42 * flap, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // лапки
      ctx.strokeStyle = '#2b2b16';
      ctx.lineWidth = 5;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, i * r * 0.4 + r * 0.2);
        ctx.lineTo(-r * 1.35, i * r * 0.6 + r * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.5, i * r * 0.4 + r * 0.2);
        ctx.lineTo(r * 1.35, i * r * 0.6 + r * 0.5);
        ctx.stroke();
      }

      // брюшко в полоску
      ctx.fillStyle = f.rage ? '#ffb703' : '#f2c31f';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.55, r * 0.78, r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#231f0f';
      for (var s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.ellipse(0, r * (0.2 + s * 0.4), r * (0.72 - s * 0.14), r * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // жало
      ctx.fillStyle = '#2b2b16';
      ctx.beginPath();
      ctx.moveTo(0, r * 1.45);
      ctx.lineTo(-r * 0.14, r * 1.1);
      ctx.lineTo(r * 0.14, r * 1.1);
      ctx.closePath();
      ctx.fill();

      // грудь и голова
      ctx.fillStyle = '#231f0f';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.62, r * 0.46, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f.rage ? '#ffca3a' : '#f2c31f';
      ctx.beginPath();
      ctx.arc(0, -r * 0.95, r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // злые глаза
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.24, -r * 1.02, r * 0.19, r * 0.15, 0.2, 0, Math.PI * 2);
      ctx.ellipse(r * 0.24, -r * 1.02, r * 0.19, r * 0.15, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101014';
      var look = Math.sin(t * 2) * r * 0.05;
      ctx.beginPath();
      ctx.arc(-r * 0.24 + look, -r * 1.0, r * 0.09, 0, Math.PI * 2);
      ctx.arc(r * 0.24 + look, -r * 1.0, r * 0.09, 0, Math.PI * 2);
      ctx.fill();

      // усики
      ctx.strokeStyle = '#231f0f';
      ctx.lineWidth = 5;
      for (var a = -1; a <= 1; a += 2) {
        ctx.beginPath();
        ctx.moveTo(a * r * 0.2, -r * 1.3);
        ctx.quadraticCurveTo(a * r * 0.8, -r * 1.9, a * r * 1.1 + Math.sin(t * 6) * 6, -r * 2.1);
        ctx.stroke();
      }

      if (f.flash > 0) {
        ctx.globalAlpha = f.flash * 0.7;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.9, r * 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },

    _drawDead: function (ctx, f) {
      var k = Math.max(0, f.deadT / 0.22);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.r * (1 + (1 - k)), f.r * 0.5 * (1 + (1 - k) * 0.5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.flies = flies;
})();
