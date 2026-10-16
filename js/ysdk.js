/* Обёртка над SDK Яндекс Игр.
   Локально (file:// или ?local=1) работает заглушка, чтобы игру можно было
   отлаживать без Консоли разработчика. */
(function () {
  'use strict';

  var RU_LANGS = ['ru', 'be', 'uk', 'kk', 'uz', 'az', 'ky', 'tg', 'hy', 'ka', 'mo'];

  var P = {
    sdk: null,
    isLocal: true,
    lang: 'ru',
    player: null,
    _i18n: null,

    init: function () {
      var self = this;
      var forceLocal = false;
      try {
        forceLocal = new URLSearchParams(location.search).get('local') === '1';
      } catch (e) {}

      if (forceLocal || typeof window.YaGames === 'undefined') {
        self.isLocal = true;
        self.lang = self._pickLang((navigator.language || 'ru').slice(0, 2));
        return Promise.resolve(false);
      }

      return window.YaGames.init().then(function (sdk) {
        self.sdk = sdk;
        self.isLocal = false;
        try {
          if (sdk.environment && sdk.environment.i18n) {
            self._i18n = sdk.environment.i18n;
            self.lang = self._pickLang(sdk.environment.i18n.lang);
          }
        } catch (e) {}
        return true;
      }).catch(function () {
        self.isLocal = true;
        return false;
      });
    },

    _pickLang: function (code) {
      code = String(code || 'ru').toLowerCase().slice(0, 2);
      return RU_LANGS.indexOf(code) >= 0 ? 'ru' : 'en';
    },

    /* п. 1.19.2: сигнал «игра готова» */
    ready: function () {
      try {
        if (this.sdk && this.sdk.features && this.sdk.features.LoadingAPI) {
          this.sdk.features.LoadingAPI.ready();
        }
      } catch (e) {}
    },

    /* п. 1.19.3: разметка геймплея */
    gameplayStart: function () {
      try {
        if (this.sdk && this.sdk.features && this.sdk.features.GameplayAPI) {
          this.sdk.features.GameplayAPI.start();
        }
      } catch (e) {}
    },

    gameplayStop: function () {
      try {
        if (this.sdk && this.sdk.features && this.sdk.features.GameplayAPI) {
          this.sdk.features.GameplayAPI.stop();
        }
      } catch (e) {}
    },

    /* Полноэкранная реклама. Резолвится после закрытия. */
    showFullscreenAdv: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.sdk || !self.sdk.adv) return resolve(false);
        var settled = false;
        function finish(v) { if (!settled) { settled = true; resolve(v); } }
        try {
          self.sdk.adv.showFullscreenAdv({
            callbacks: {
              onClose: function (wasShown) { finish(!!wasShown); },
              onError: function () { finish(false); }
            }
          });
        } catch (e) { finish(false); }
        setTimeout(function () { finish(false); }, 90000);
      });
    },

    /* Реклама за вознаграждение. true — награду выдать (п. 4.5). */
    showRewarded: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!self.sdk || !self.sdk.adv) return resolve(false);
        var settled = false;
        var rewarded = false;
        function finish(v) { if (!settled) { settled = true; resolve(v); } }
        try {
          self.sdk.adv.showRewardedVideo({
            callbacks: {
              onRewarded: function () { rewarded = true; },
              onClose: function () { finish(rewarded); },
              onError: function () { finish(false); }
            }
          });
        } catch (e) { finish(false); }
        setTimeout(function () { finish(rewarded); }, 120000);
      });
    },

    /* п. 1.2: авторизация только по осознанному нажатию кнопки */
    auth: function () {
      var self = this;
      if (!self.sdk) return Promise.resolve(null);
      return self.sdk.auth.openAuthDialog().then(function () {
        return self.sdk.getPlayer({ scopes: false });
      }).then(function (player) {
        self.player = player;
        return player;
      }).catch(function () { return null; });
    },

    playerName: function () {
      try {
        if (this.player && this.player.getName) return this.player.getName();
      } catch (e) {}
      return '';
    },

    /* Облачные сохранения (используются, только если игрок авторизован). */
    cloudLoad: function () {
      if (!this.player || !this.player.getData) return Promise.resolve(null);
      return this.player.getData(['save']).then(function (d) {
        return d && d.save ? d.save : null;
      }).catch(function () { return null; });
    },

    cloudSave: function (obj) {
      if (!this.player || !this.player.setData) return Promise.resolve(false);
      return this.player.setData({ save: obj }, false).then(function () { return true; })
        .catch(function () { return false; });
    }
  };

  window.TAPOK = window.TAPOK || {};
  window.TAPOK.platform = P;
})();
