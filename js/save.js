/* Прогресс: монеты, рекорды, оружие, улучшения, достижения, ежедневный бонус.
   localStorage пишется сразу после действия (п. 1.9); облако — при авторизации. */
(function () {
  'use strict';

  var KEY = 'tapok_save_v1';

  var ACH = [
    { id: 'first100', check: function (d) { return d.stats.totalFlies >= 100; } },
    { id: 'combo9', check: function (d) { return d.stats.maxCombo >= 9; } },
    { id: 'boss1', check: function (d) { return d.stats.bossesKilled >= 1; } },
    { id: 'wave10', check: function (d) { return d.bestWave >= 10; } },
    { id: 'perfect', check: function (d) { return d.stats.perfectWaves >= 1; } },
    { id: 'coin1k', check: function (d) { return d.stats.coinsEarned >= 1000; } }
  ];

  function fresh() {
    return {
      coins: 0,
      bestWave: 1,
      bestScore: 0,
      weapons: [true, false, false, false, false],
      upgrades: { combo: 0, magnet: 0, double: 0 },
      ach: {},
      loginRewarded: false,
      daily: { day: '', streak: 0 },
      settings: { sound: true, music: true, vibrate: true },
      stats: {
        totalFlies: 0, maxCombo: 0, bossesKilled: 0,
        perfectWaves: 0, coinsEarned: 0, games: 0, playtime: 0
      }
    };
  }

  var save = {
    data: fresh(),
    ACH: ACH,
    _cloudTimer: null,

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          this.data = this._merge(fresh(), parsed);
        }
      } catch (e) {
        this.data = fresh();
      }
      return this.data;
    },

    _merge: function (base, incoming) {
      if (!incoming || typeof incoming !== 'object') return base;
      for (var k in base) {
        if (!Object.prototype.hasOwnProperty.call(base, k)) continue;
        var v = incoming[k];
        if (v === undefined || v === null) continue;
        if (Array.isArray(base[k])) {
          if (Array.isArray(v)) base[k] = v.slice(0, base[k].length);
        } else if (typeof base[k] === 'object') {
          base[k] = this._merge(base[k], v);
        } else {
          base[k] = v;
        }
      }
      return base;
    },

    /* Запись на диск + отложенная запись в облако */
    flush: function (toCloud) {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {}
      if (toCloud !== false) this._scheduleCloud();
    },

    _scheduleCloud: function () {
      var self = this;
      if (!window.TAPOK.platform.player) return;
      if (this._cloudTimer) clearTimeout(this._cloudTimer);
      this._cloudTimer = setTimeout(function () {
        self._cloudTimer = null;
        window.TAPOK.platform.cloudSave(self.data);
      }, 3000);
    },

    addCoins: function (n) {
      this.data.coins += n;
      this.data.stats.coinsEarned += n;
      return this.data.coins;
    },

    spend: function (n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.flush();
      return true;
    },

    /* Достижения: возвращает список новых id */
    checkAchievements: function () {
      var unlocked = [];
      for (var i = 0; i < ACH.length; i++) {
        var a = ACH[i];
        if (!this.data.ach[a.id] && a.check(this.data)) {
          this.data.ach[a.id] = true;
          unlocked.push(a.id);
        }
      }
      if (unlocked.length) this.flush();
      return unlocked;
    },

    /* Ежедневный бонус. Возвращает сумму или 0. */
    claimDaily: function () {
      var today = new Date().toISOString().slice(0, 10);
      var d = this.data.daily;
      if (d.day === today) return 0;

      var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      d.streak = d.day === y ? Math.min(d.streak + 1, 7) : 1;
      d.day = today;
      var reward = 50 + (d.streak - 1) * 25;
      this.addCoins(reward);
      this.flush();
      return reward;
    },

    dailyAvailable: function () {
      var today = new Date().toISOString().slice(0, 10);
      return this.data.daily.day !== today;
    },

    resetProgress: function () {
      var settings = this.data.settings;
      this.data = fresh();
      this.data.settings = settings;
      this.flush();
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.save = save;
})();
