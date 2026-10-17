/* Обёртка над SDK Telegram Mini Apps (Telegram Games / Instant Games).
   Replacement для обёртки SDK Яндекс Игр: public surface stays identical
   (init, ready, gameplayStart/Stop, showFullscreenAdv, showRewarded, auth,
   playerName, cloudLoad, cloudSave, player, isLocal, lang), so game.js and
   save.js keep calling window.TAPOK.platform.* without changes.

   Telegram injects the SDK into the page itself — window.Telegram.GameDev
   (weak SDK: ads) and window.Telegram.AppInfo — when the game runs as an
   Instant Game, so no CDN script is required. Everything is feature-detected:
   outside Telegram (file://, plain browser) the local stub is used, and
   ?local=1 forces the stub for debugging. */
(function () {
  'use strict';

  var ADSGRAM_REWARD_BLOCK_ID = "54516";

  var RU_LANGS = ['ru', 'be', 'uk', 'kk', 'uz', 'az', 'ky', 'tg', 'hy', 'ka', 'mo'];

  /* Optional explicit SDK loader. Empty = rely on the client injection.
     If Telegram docs give your game a script URL, put it here (index.html may
     carry the <script> tag instead) and it is injected before the game boots. */
  var TG_SDK_URL = '';

  /* Optional server bridge (strong SDK). Telegram has no client-side cloud
     storage or leaderboard API: cross-device sync and score submission need
     your own endpoint that verifies the signed GameStart payload server-side.
     Empty = localStorage mirror, which keeps progress on one device. */
  var TG_BRIDGE_URL = '';

  var CLOUD_KEY = 'tapok_cloud_v1';

  var P = {
    sdk: null,      /* window.Telegram.GameDev when present */
    weak: null,     /* weak SDK object (ads) */
    isLocal: true,
    lang: 'ru',
    player: null,   /* { id, name } — truthy means "signed in" */
    gameplayMs: 0,
    _playStart: 0,

    init: function () {
      var self = this;
      var forceLocal = false;
      try {
        forceLocal = new URLSearchParams(location.search).get('local') === '1';
      } catch (e) {}

      /* AdsGram ships as its own script (index.html loads sad.min.js) and has
         nothing to do with window.Telegram.GameDev, so it must be initialized
         BEFORE the GameDev check below: a plain Mini App gets no GameDev
         injected, and without this the ad controller never exists and every
         rewarded tap falls through to the "no ad" branch. */
      if (!forceLocal && window.Adsgram && ADSGRAM_REWARD_BLOCK_ID) {
        try {
          self.adController = window.Adsgram.init({
            blockId: ADSGRAM_REWARD_BLOCK_ID,
            // debug: true // Раскомментируйте для тестов
          });
          console.log("[AdsGram] Инициализирован");
        } catch (e) {
          console.warn("[AdsGram] Ошибка инициализации", e);
        }
      }

      var gd = null;
      try {
        if (window.Telegram && window.Telegram.GameDev) gd = window.Telegram.GameDev;
      } catch (e) {}

      if (forceLocal || !gd) {
        self.isLocal = true;
        self.lang = self._pickLang((navigator.language || 'ru').slice(0, 2));
        return Promise.resolve(false);
      }

      self.sdk = gd;
      try {
        self.weak = gd.Weaksdk || gd.weakSDK || gd;
      } catch (e) {
        self.weak = gd;
      }
      self.isLocal = false;

      /* Telegram does not pass the interface language to the game, so the
         browser locale decides (п. 2.14 keeps the same ru/en choice). */
      self.lang = self._pickLang((navigator.language || 'ru').slice(0, 2));

      /* In a Mini App the user is already authenticated by Telegram. */
      self.player = self._identity();
      if (!self.player) self.player = { id: '', name: '' };

      return Promise.resolve(true);
    },

    _pickLang: function (code) {
      code = String(code || 'ru').toLowerCase().slice(0, 2);
      return RU_LANGS.indexOf(code) >= 0 ? 'ru' : 'en';
    },

    _inTelegram: function () {
      try {
        if (window.Telegram && window.Telegram.GameDev) return true;
        if (window.Telegram && window.Telegram.AppInfo) return true;
        var qs = new URLSearchParams(location.search);
        return qs.has('tghash') || qs.has('tgchat');
      } catch (e) {
        return false;
      }
    },

    /* Method lookup with name tolerance: the weak SDK renames a few calls
       between SDK versions, so try every known spelling. */
    _weak: function (names) {
      var roots = [this.weak, this.sdk];
      for (var i = 0; i < roots.length; i++) {
        var r = roots[i];
        if (!r) continue;
        for (var j = 0; j < names.length; j++) {
          var f = r[names[j]];
          if (typeof f === 'function') {
            try {
              return f.bind(r);
            } catch (e) {
              return f;
            }
          }
        }
      }
      return null;
    },

    /* Client-side identity, best effort. Telegram signs the launch payload
       server-side; the client only sees what the SDK chooses to expose. */
    _identity: function () {
      var info = null;
      try {
        var f = this._weak(['getUserInfo', 'getGameUserInfo', 'getUser']);
        if (f) info = f();
      } catch (e) {}
      if (!info) {
        try {
          info = (this.sdk && this.sdk.user) || (window.Telegram && window.Telegram.AppInfo);
        } catch (e) {}
      }
      if (!info) return null;

      var name = '';
      try {
        if (info.getName) name = String(info.getName() || '');
        if (!name && info.name) name = String(info.name);
        if (!name && info.displayName) name = String(info.displayName);
        if (!name && info.first_name) name = String(info.first_name);
      } catch (e) {}

      var id = '';
      try {
        id = String(info.id || info.telegramId || info.chatId || '');
      } catch (e) {}

      if (!name && !id) return null;
      return { id: id, name: name };
    },

    /* Telegram has no LoadingAPI marker (п. 1.19.2) — kept as a no-op hook
       so the game keeps one call site for "the game is ready". */
    ready: function () {},

    /* Telegram has no GameplayAPI (п. 1.19.3). The pair still tracks real
       gameplay time, which is what ad/leaderboard rules need later. */
    gameplayStart: function () {
      try {
        if (!this._playStart) this._playStart = Date.now();
      } catch (e) {}
    },

    gameplayStop: function () {
      try {
        if (this._playStart) {
          this.gameplayMs += Date.now() - this._playStart;
          this._playStart = 0;
        }
      } catch (e) {}
    },

    /* Fullscreen ad between waves. Resolves true when the ad ran. */
    showFullscreenAdv: function () {
      var self = this;
      return new Promise(function (resolve) {
        var f = self._weak(['showFullscreenAd', 'showFullscreenAdv']);
        if (!f) return resolve(false);
        var settled = false;
        function finish(v) {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        }
        try {
          var r = f();
          if (r && typeof r.then === 'function') {
            r.then(function (res) { finish(res === undefined ? true : res !== false); },
              function () { finish(false); });
          } else {
            finish(r !== false);
          }
        } catch (e) {
          finish(false);
        }
        setTimeout(function () { finish(false); }, 90000);
      });
    },

        /* Rewarded ad. Resolves true when the reward may be given (п. 4.5). */
    showRewarded: function () {
      var self = this;
      return new Promise(function (resolve) {
        
        // 1. ПЫТАЕМСЯ ПОКАЗАТЬ РЕКЛАМУ ЧЕРЕЗ ADSGRAM
        if (self.adController) {
          self.adController.show()
            .then(function (result) {
              // show() resolves только когда пользователь смотрел до конца
              if (!result || result.done !== false) {
                console.log("[AdsGram] Награда получена");
                resolve(true);
              } else {
                console.log("[AdsGram] Реклама закрыта раньше времени");
                resolve(false);
              }
            })
            .catch(function (err) {
              console.warn("[AdsGram] Ошибка показа рекламы:", err);
              resolve(false);
            });
          return;
        }

        // 2. ФОЛЛБЭК НА НАТИВНЫЙ SDK TELEGRAM (если AdsGram не подключен)
        var f = self._weak(['showRewardedAd', 'showRewardedVideo']);
        if (!f) return resolve(false);
        
        var settled = false;
        function finish(v) {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        }
        try {
          var r = f();
          if (r && typeof r.then === 'function') {
            r.then(function (res) { finish(res === undefined ? true : res !== false); },
              function () { finish(false); });
          } else {
            finish(r !== false);
          }
        } catch (e) {
          finish(false);
        }
        setTimeout(function () { finish(false); }, 120000);
      });
    },

    /* Telegram signs the user in before the game opens, so there is no
       openAuthDialog (п. 1.2). auth() only resolves the identity. */
    auth: function () {
      var self = this;
      if (self.player) return Promise.resolve(self.player);
      if (self.isLocal || !self._inTelegram()) return Promise.resolve(null);
      self.player = self._identity() || { id: '', name: '' };
      return Promise.resolve(self.player);
    },

    playerName: function () {
      try {
        if (this.player && this.player.name) return String(this.player.name);
      } catch (e) {}
      return '';
    },

    /* Server bridge request. Returns a Promise, or null when the bridge is
       not configured (then the localStorage mirror is used). */
    _bridge: function (path, payload) {
      if (!TG_BRIDGE_URL || typeof fetch !== 'function') return null;
      try {
        return fetch(TG_BRIDGE_URL + path, {
          method: payload ? 'POST' : 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : null
        });
      } catch (e) {
        return null;
      }
    },

    cloudLoad: function () {
      var self = this;
      if (!self.player) return Promise.resolve(null);

      var req = self._bridge('/load', null);
      if (req) {
        return req.then(function (resp) {
          var body = resp.json();
          if (body && typeof body.then === 'function') {
            return body.then(function (d) { return d && d.save ? d.save : null; });
          }
          return Promise.resolve(body && body.save ? body.save : null);
        }).catch(function () { return null; });
      }

      try {
        var raw = localStorage.getItem(CLOUD_KEY);
        return Promise.resolve(raw ? JSON.parse(raw) : null);
      } catch (e) {
        return Promise.resolve(null);
      }
    },

    cloudSave: function (obj) {
      var self = this;
      if (!self.player) return Promise.resolve(false);

      var req = self._bridge('/save', { save: obj });
      if (req) {
        return req.then(function (resp) {
          return resp && resp.ok !== false;
        }).catch(function () { return false; });
      }

      try {
        localStorage.setItem(CLOUD_KEY, JSON.stringify(obj));
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    },

    /* Leaderboard submission through the bridge (Telegram leaderboards are a
       strong-SDK feature, so the server does the verification). */
    submitScore: function (score) {
      var self = this;
      if (!self.player) return Promise.resolve(false);
      var req = self._bridge('/leaderboard/submit', { score: score });
      if (req) {
        return req.then(function (resp) {
          return resp && resp.ok !== false;
        }).catch(function () { return false; });
      }
      return Promise.resolve(false);
    }
  };

  /* Optional explicit loader, only when a URL is configured. */
  if (TG_SDK_URL) {
    try {
      var s = document.createElement('script');
      s.src = TG_SDK_URL;
      s.async = true;
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.platform = P;
})();
